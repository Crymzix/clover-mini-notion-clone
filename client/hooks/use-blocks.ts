'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, BlockStyle, WSMessage, PageWithBlocks } from '../lib/types';
import { v4 as uuid } from 'uuid';

export function useBlocks(pageId: string | undefined, initialData: PageWithBlocks | null, send: (msg: WSMessage) => void) {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [pageTitle, setPageTitle] = useState('Untitled');
    const clientIdRef = useRef<string>(uuid());

    useEffect(() => {
        if (initialData) {
            setBlocks(initialData.blocks.sort((a, b) => a.sort_order - b.sort_order));
            setPageTitle(initialData.page.title);
        }
    }, [initialData]);

    const handleMessage = useCallback((msg: WSMessage) => {
        switch (msg.type) {
            case 'block:create': {
                setBlocks((prev) => {
                    if (prev.find(b => b.id === msg.payload.id)) return prev;
                    const newBlock: Block = {
                        id: msg.payload.id,
                        page_id: msg.payload.pageId,
                        type: 'text',
                        content: msg.payload.content,
                        style: msg.payload.style as BlockStyle,
                        sort_order: msg.payload.sort_order,
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
            case 'page:update_title': {
                if (msg.payload.pageId === pageId) {
                    setPageTitle(msg.payload.title);
                }
                break;
            }
        }
    }, [pageId]);

    const createBlock = useCallback((afterBlockId?: string, style: BlockStyle = 'paragraph') => {
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
            type: 'text',
            content: '',
            style,
            sort_order,
        };

        // Optimistic update
        setBlocks(prev => [...prev, newBlock].sort((a, b) => a.sort_order - b.sort_order));

        // Send to web socket
        send({
            type: 'block:create',
            payload: { id, pageId, content: '', style, sort_order }
        });

        return id;
    }, [pageId, blocks, send]);

    const updateBlock = useCallback((id: string, changes: { content?: string; style?: BlockStyle }) => {
        // Optimistic update
        setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...changes } : b)));

        // Send to web socket
        send({
            type: 'block:update',
            payload: { id, ...changes }
        });
    }, [send]);

    const deleteBlock = useCallback((id: string) => {
        // Optimistic update
        setBlocks(prev => prev.filter(b => b.id !== id));

        // Send to web socket
        send({
            type: 'block:delete',
            payload: { id }
        });
    }, [send]);

    const reorderBlock = useCallback((id: string, sort_order: number) => {
        // Optimistic update
        setBlocks(prev => {
            const nextBlocks = prev.map(b => (b.id === id ? { ...b, sort_order } : b));
            return nextBlocks.sort((a, b) => a.sort_order - b.sort_order);
        });

        // Send to web socket
        send({
            type: 'block:reorder',
            payload: { id, sort_order }
        });
    }, [send]);

    const updatePageTitle = useCallback((title: string) => {
        if (!pageId) return;
        setPageTitle(title);
        send({
            type: 'page:update_title',
            payload: { pageId, title }
        });
    }, [pageId, send]);

    return {
        blocks,
        pageTitle,
        createBlock,
        updateBlock,
        deleteBlock,
        reorderBlock,
        updatePageTitle,
        handleMessage,
        clientId: clientIdRef.current,
    };
}
