'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, BlockStyle, BlockType, WSMessage, PageWithBlocks } from '../lib/types';
import { v4 as uuid } from 'uuid';

type UndoEntry =
    | { action: 'create'; blockId: string }
    | { action: 'delete'; block: Block }
    | { action: 'update'; blockId: string; prev: { content?: string; style?: string } }
    | { action: 'reorder'; blockId: string; prevSortOrder: number }
    | { action: 'toggle_checked'; blockId: string; prevChecked: number };

export function useBlocks(pageId: string | undefined, initialData: PageWithBlocks | null, send: (msg: WSMessage) => void) {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [pageTitle, setPageTitle] = useState('Untitled');
    const clientIdRef = useRef<string>(uuid());

    const undoStackRef = useRef<UndoEntry[]>([]);
    const redoStackRef = useRef<UndoEntry[]>([]);
    // Used to suppress pushing to undo stack when applying undo/redo operations
    const suppressUndoRef = useRef(false);

    useEffect(() => {
        if (initialData) {
            setBlocks(initialData.blocks.sort((a, b) => a.sort_order - b.sort_order));
            setPageTitle(initialData.page.title);
        }
    }, [initialData]);

    const pushUndo = useCallback((entry: UndoEntry) => {
        if (suppressUndoRef.current) return;
        undoStackRef.current.push(entry);
        redoStackRef.current = [];
    }, []);

    const handleMessage = useCallback((msg: WSMessage) => {
        switch (msg.type) {
            case 'block:create': {
                setBlocks((prev) => {
                    if (prev.find(b => b.id === msg.payload.id)) return prev;
                    const newBlock: Block = {
                        id: msg.payload.id,
                        page_id: msg.payload.pageId,
                        type: (msg.payload.blockType || 'text') as BlockType,
                        content: msg.payload.content,
                        style: msg.payload.style as BlockStyle,
                        sort_order: msg.payload.sort_order,
                        checked: msg.payload.checked ?? 0,
                    };
                    const nextBlocks = [...prev, newBlock];
                    return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
                });
                break;
            }
            case 'block:update': {
                setBlocks((prev) => prev.map((block) => {
                    if (block.id === msg.payload.id) {
                        return {
                            ...block,
                            ...(msg.payload.content !== undefined ? { content: msg.payload.content } : {}),
                            ...(msg.payload.style !== undefined ? { style: msg.payload.style as BlockStyle } : {}),
                        };
                    }
                    return block;
                }));
                break;
            }
            case 'block:delete': {
                setBlocks((prev) => prev.filter((block) => block.id !== msg.payload.id));
                break;
            }
            case 'block:reorder': {
                setBlocks((prev) => {
                    const nextBlocks = prev.map((block) => {
                        if (block.id === msg.payload.id) {
                            return { ...block, sort_order: msg.payload.sort_order };
                        }
                        return block;
                    });
                    return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
                });
                break;
            }
            case 'block:toggle_checked': {
                setBlocks((prev) => prev.map((block) => {
                    if (block.id === msg.payload.id) {
                        return { ...block, checked: msg.payload.checked };
                    }
                    return block;
                }));
                break;
            }
            case 'page:update_title': {
                if (msg.payload.pageId === pageId) {
                    setPageTitle(msg.payload.title);
                }
                break;
            }
        }
    }, [pageId]);

    const createBlock = useCallback((afterBlockId?: string, style: BlockStyle = 'paragraph', blockType: BlockType = 'text') => {
        if (!pageId) return;

        const id = uuid();
        let sort_order: number;

        if (afterBlockId) {
            const index = blocks.findIndex(b => b.id === afterBlockId);
            const current = blocks[index];
            const next = blocks[index + 1];

            if (next) {
                sort_order = (current.sort_order + next.sort_order) / 2;
            } else {
                sort_order = current.sort_order + 1.0;
            }
        } else {
            const maxSortOrder = blocks.length > 0 ? Math.max(...blocks.map(b => b.sort_order)) : 0;
            sort_order = maxSortOrder + 1.0;
        }

        const newBlock: Block = {
            id,
            page_id: pageId,
            type: blockType,
            content: blockType === 'divider' ? '' : '',
            style,
            sort_order,
            checked: 0,
        };

        setBlocks(prev => [...prev, newBlock].sort((a, b) => a.sort_order - b.sort_order));

        send({
            type: 'block:create',
            payload: { id, pageId, blockType, content: newBlock.content, style, sort_order, checked: 0 }
        });

        pushUndo({ action: 'create', blockId: id });

        return id;
    }, [pageId, blocks, send, pushUndo]);

    const updateBlock = useCallback((id: string, changes: { content?: string; style?: BlockStyle }) => {
        // Capture previous values for undo
        const currentBlock = blocks.find(b => b.id === id);
        if (currentBlock) {
            const prev: { content?: string; style?: string } = {};
            if (changes.content !== undefined) prev.content = currentBlock.content;
            if (changes.style !== undefined) prev.style = currentBlock.style;
            pushUndo({ action: 'update', blockId: id, prev });
        }

        setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...changes } : b)));

        send({
            type: 'block:update',
            payload: { id, ...changes }
        });
    }, [send, blocks, pushUndo]);

    const deleteBlock = useCallback((id: string) => {
        const blockToDelete = blocks.find(b => b.id === id);
        if (blockToDelete) {
            pushUndo({ action: 'delete', block: { ...blockToDelete } });
        }

        setBlocks(prev => prev.filter(b => b.id !== id));

        send({
            type: 'block:delete',
            payload: { id }
        });
    }, [send, blocks, pushUndo]);

    const reorderBlock = useCallback((id: string, sort_order: number) => {
        const currentBlock = blocks.find(b => b.id === id);
        if (currentBlock) {
            pushUndo({ action: 'reorder', blockId: id, prevSortOrder: currentBlock.sort_order });
        }

        setBlocks(prev => {
            const nextBlocks = prev.map(b => (b.id === id ? { ...b, sort_order } : b));
            return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
        });

        send({
            type: 'block:reorder',
            payload: { id, sort_order }
        });
    }, [send, blocks, pushUndo]);

    const toggleChecked = useCallback((id: string) => {
        const currentBlock = blocks.find(b => b.id === id);
        if (!currentBlock) return;

        const newChecked = currentBlock.checked === 1 ? 0 : 1;

        pushUndo({ action: 'toggle_checked', blockId: id, prevChecked: currentBlock.checked ?? 0 });

        setBlocks(prev => prev.map(b => (b.id === id ? { ...b, checked: newChecked } : b)));

        send({
            type: 'block:toggle_checked',
            payload: { id, checked: newChecked }
        });
    }, [send, blocks, pushUndo]);

    const updatePageTitle = useCallback((title: string) => {
        if (!pageId) return;
        setPageTitle(title);
        send({
            type: 'page:update_title',
            payload: { pageId, title }
        });
    }, [pageId, send]);

    // Undo: pop from undo stack, apply inverse, push to redo stack
    const undo = useCallback(() => {
        const entry = undoStackRef.current.pop();
        if (!entry) return;

        suppressUndoRef.current = true;

        switch (entry.action) {
            case 'create': {
                // Undo a create by deleting the block
                const block = blocks.find(b => b.id === entry.blockId);
                setBlocks(prev => prev.filter(b => b.id !== entry.blockId));
                send({ type: 'block:delete', payload: { id: entry.blockId } });
                if (block) {
                    redoStackRef.current.push({ action: 'delete', block: { ...block } });
                }
                break;
            }
            case 'delete': {
                // Undo a delete by re-creating the block
                const b = entry.block;
                setBlocks(prev => [...prev, b].sort((a, c) => a.sort_order - c.sort_order));
                if (pageId) {
                    send({
                        type: 'block:create',
                        payload: {
                            id: b.id, pageId, blockType: b.type,
                            content: b.content, style: b.style, sort_order: b.sort_order,
                            checked: b.checked ?? 0
                        }
                    });
                }
                redoStackRef.current.push({ action: 'create', blockId: b.id });
                break;
            }
            case 'update': {
                // Undo an update by restoring previous values
                const currentBlock = blocks.find(b => b.id === entry.blockId);
                const forwardChanges: { content?: string; style?: string } = {};
                if (entry.prev.content !== undefined && currentBlock) forwardChanges.content = currentBlock.content;
                if (entry.prev.style !== undefined && currentBlock) forwardChanges.style = currentBlock.style;

                setBlocks(prev => prev.map(b => (b.id === entry.blockId ? { ...b, ...entry.prev } : b)));
                send({ type: 'block:update', payload: { id: entry.blockId, ...entry.prev } });

                redoStackRef.current.push({ action: 'update', blockId: entry.blockId, prev: forwardChanges });
                break;
            }
            case 'reorder': {
                const currentBlock = blocks.find(b => b.id === entry.blockId);
                const currentSortOrder = currentBlock?.sort_order ?? 0;

                setBlocks(prev => {
                    const nextBlocks = prev.map(b => (b.id === entry.blockId ? { ...b, sort_order: entry.prevSortOrder } : b));
                    return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
                });
                send({ type: 'block:reorder', payload: { id: entry.blockId, sort_order: entry.prevSortOrder } });

                redoStackRef.current.push({ action: 'reorder', blockId: entry.blockId, prevSortOrder: currentSortOrder });
                break;
            }
            case 'toggle_checked': {
                setBlocks(prev => prev.map(b => (b.id === entry.blockId ? { ...b, checked: entry.prevChecked } : b)));
                send({ type: 'block:toggle_checked', payload: { id: entry.blockId, checked: entry.prevChecked } });

                const currentBlock = blocks.find(b => b.id === entry.blockId);
                redoStackRef.current.push({ action: 'toggle_checked', blockId: entry.blockId, prevChecked: currentBlock?.checked ?? 0 });
                break;
            }
        }

        suppressUndoRef.current = false;
    }, [blocks, send, pageId]);

    // Redo: pop from redo stack, apply forward, push to undo stack
    const redo = useCallback(() => {
        const entry = redoStackRef.current.pop();
        if (!entry) return;

        suppressUndoRef.current = true;

        switch (entry.action) {
            case 'create': {
                // Redo a create means the original action was "delete" and we undid it (re-created).
                // Now redo means delete again.
                const block = blocks.find(b => b.id === entry.blockId);
                setBlocks(prev => prev.filter(b => b.id !== entry.blockId));
                send({ type: 'block:delete', payload: { id: entry.blockId } });
                if (block) {
                    undoStackRef.current.push({ action: 'delete', block: { ...block } });
                }
                break;
            }
            case 'delete': {
                // Redo a delete means the original action was "create" and we undid it (deleted).
                // Now redo means re-create.
                const b = entry.block;
                setBlocks(prev => [...prev, b].sort((a, c) => a.sort_order - c.sort_order));
                if (pageId) {
                    send({
                        type: 'block:create',
                        payload: {
                            id: b.id, pageId, blockType: b.type,
                            content: b.content, style: b.style, sort_order: b.sort_order,
                            checked: b.checked ?? 0
                        }
                    });
                }
                undoStackRef.current.push({ action: 'create', blockId: b.id });
                break;
            }
            case 'update': {
                const currentBlock = blocks.find(b => b.id === entry.blockId);
                const inverseChanges: { content?: string; style?: string } = {};
                if (entry.prev.content !== undefined && currentBlock) inverseChanges.content = currentBlock.content;
                if (entry.prev.style !== undefined && currentBlock) inverseChanges.style = currentBlock.style;

                setBlocks(prev => prev.map(b => (b.id === entry.blockId ? { ...b, ...entry.prev } : b)));
                send({ type: 'block:update', payload: { id: entry.blockId, ...entry.prev } });

                undoStackRef.current.push({ action: 'update', blockId: entry.blockId, prev: inverseChanges });
                break;
            }
            case 'reorder': {
                const currentBlock = blocks.find(b => b.id === entry.blockId);
                const currentSortOrder = currentBlock?.sort_order ?? 0;

                setBlocks(prev => {
                    const nextBlocks = prev.map(b => (b.id === entry.blockId ? { ...b, sort_order: entry.prevSortOrder } : b));
                    return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
                });
                send({ type: 'block:reorder', payload: { id: entry.blockId, sort_order: entry.prevSortOrder } });

                undoStackRef.current.push({ action: 'reorder', blockId: entry.blockId, prevSortOrder: currentSortOrder });
                break;
            }
            case 'toggle_checked': {
                setBlocks(prev => prev.map(b => (b.id === entry.blockId ? { ...b, checked: entry.prevChecked } : b)));
                send({ type: 'block:toggle_checked', payload: { id: entry.blockId, checked: entry.prevChecked } });

                const currentBlock = blocks.find(b => b.id === entry.blockId);
                undoStackRef.current.push({ action: 'toggle_checked', blockId: entry.blockId, prevChecked: currentBlock?.checked ?? 0 });
                break;
            }
        }

        suppressUndoRef.current = false;
    }, [blocks, send, pageId]);

    return {
        blocks,
        pageTitle,
        createBlock,
        updateBlock,
        deleteBlock,
        reorderBlock,
        toggleChecked,
        updatePageTitle,
        handleMessage,
        undo,
        redo,
        clientId: clientIdRef.current,
    };
}
