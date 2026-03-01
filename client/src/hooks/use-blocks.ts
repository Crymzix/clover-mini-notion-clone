'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { Block, BlockStyle, WSMessage } from '@/lib/types';

export function useBlocks(pageId: string, initialBlocks: Block[], send: (msg: WSMessage) => void) {
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
    const clientId = useRef<string>(uuid());

    // Handle incoming WebSocket messages
    const handleRemoteUpdate = useCallback((msg: WSMessage) => {
        switch (msg.type) {
            case 'block:create': {
                const newBlock = { ...msg.payload, pageId: msg.payload.pageId } as Block;
                setBlocks((prev) => {
                    // Avoid duplicates
                    if (prev.find((b) => b.id === newBlock.id)) return prev;
                    return [...prev, newBlock].sort((a, b) => a.sortOrder - b.sortOrder);
                });
                break;
            }
            case 'block:update': {
                setBlocks((prev) =>
                    prev.map((b) => (b.id === msg.payload.id ? { ...b, ...msg.payload } : b))
                );
                break;
            }
            case 'block:delete': {
                setBlocks((prev) => prev.filter((b) => b.id !== msg.payload.id));
                break;
            }
            case 'block:reorder': {
                setBlocks((prev) =>
                    prev
                        .map((b) => (b.id === msg.payload.id ? { ...b, sortOrder: msg.payload.sortOrder } : b))
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                );
                break;
            }
        }
    }, []);

    const createBlock = useCallback((afterBlockId?: string, style: BlockStyle = 'paragraph') => {
        const newId = uuid();
        let newSortOrder: number;

        if (!afterBlockId) {
            // Append to the end
            const maxSortOrder = blocks.length > 0 ? Math.max(...blocks.map((b) => b.sortOrder)) : 0;
            newSortOrder = maxSortOrder + 1.0;
        } else {
            const idx = blocks.findIndex((b) => b.id === afterBlockId);
            const prevBlock = blocks[idx];
            const nextBlock = blocks[idx + 1];

            if (!nextBlock) {
                newSortOrder = prevBlock.sortOrder + 1.0;
            } else {
                newSortOrder = (prevBlock.sortOrder + nextBlock.sortOrder) / 2;
            }
        }

        const newBlock: Block = {
            id: newId,
            pageId,
            type: 'text',
            content: '',
            style,
            sortOrder: newSortOrder,
        };

        // Optimistic update
        setBlocks((prev) => [...prev, newBlock].sort((a, b) => a.sortOrder - b.sortOrder));

        // Send via WebSocket
        send({
            type: 'block:create',
            payload: { id: newId, pageId, content: '', style, sortOrder: newSortOrder },
        });

        return newId;
    }, [blocks, pageId, send]);

    const updateBlock = useCallback((id: string, content?: string, style?: BlockStyle) => {
        // Optimistic update
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, ...(content !== undefined && { content }), ...(style !== undefined && { style }) } : b))
        );

        // Send via WebSocket
        send({
            type: 'block:update',
            payload: { id, content, style },
        });
    }, [send]);

    const deleteBlock = useCallback((id: string) => {
        // Optimistic update
        setBlocks((prev) => prev.filter((b) => b.id !== id));

        // Send via WebSocket
        send({
            type: 'block:delete',
            payload: { id },
        });
    }, [send]);

    const reorderBlock = useCallback((id: string, newSortOrder: number) => {
        // Optimistic update
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, sortOrder: newSortOrder } : b)).sort((a, b) => a.sortOrder - b.sortOrder)
        );

        // Send via WebSocket
        send({
            type: 'block:reorder',
            payload: { id, sortOrder: newSortOrder },
        });
    }, [send]);

    return {
        blocks,
        setBlocks,
        createBlock,
        updateBlock,
        deleteBlock,
        reorderBlock,
        handleRemoteUpdate,
        clientId: clientId.current,
    };
}
