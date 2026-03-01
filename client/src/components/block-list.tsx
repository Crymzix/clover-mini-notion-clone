'use client';

import React, { useState, useCallback } from 'react';
import { Block as BlockType, BlockStyle } from '@/lib/types';
import { Block } from './block';
import { AddBlockButton } from './add-block-button';

interface BlockListProps {
    blocks: BlockType[];
    onUpdate: (id: string, content?: string, style?: BlockStyle) => void;
    onDelete: (id: string) => void;
    onCreateBelow: (id: string) => void;
    onReorder: (id: string, newSortOrder: number) => void;
    focusedBlockId: string | null;
    setFocusedBlockId: (id: string | null) => void;
}

export const BlockList: React.FC<BlockListProps> = ({
    blocks,
    onUpdate,
    onDelete,
    onCreateBelow,
    onReorder,
    focusedBlockId,
    setFocusedBlockId,
}) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragTarget, setDragTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);

    const onDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (draggedId === targetId) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const position = y < rect.height / 2 ? 'above' : 'below';

        setDragTarget({ id: targetId, position });
        e.dataTransfer.dropEffect = 'move';
    };

    const onDragEnd = () => {
        setDraggedId(null);
        setDragTarget(null);
    };

    const onDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const targetIdx = blocks.findIndex((b) => b.id === targetId);
        const draggedIdx = blocks.findIndex((b) => b.id === draggedId);
        if (targetIdx === -1 || draggedIdx === -1) return;

        let newSortOrder: number;
        const { position } = dragTarget!;

        if (position === 'above') {
            const prevBlock = blocks[targetIdx - 1];
            if (!prevBlock) {
                newSortOrder = blocks[targetIdx].sortOrder - 1.0;
            } else {
                newSortOrder = (prevBlock.sortOrder + blocks[targetIdx].sortOrder) / 2;
            }
        } else {
            const nextBlock = blocks[targetIdx + 1];
            if (!nextBlock) {
                newSortOrder = blocks[targetIdx].sortOrder + 1.0;
            } else {
                newSortOrder = (blocks[targetIdx].sortOrder + nextBlock.sortOrder) / 2;
            }
        }

        onReorder(draggedId, newSortOrder);
        setDraggedId(null);
        setDragTarget(null);
    };

    const handleFocusPrevious = useCallback((id: string) => {
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx > 0) {
            setFocusedBlockId(blocks[idx - 1].id);
        } else {
            setFocusedBlockId(null);
        }
    }, [blocks, setFocusedBlockId]);

    return (
        <div className='flex flex-col gap-0.5 pb-20'>
            {blocks.map((block) => (
                <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, block.id)}
                    onDragOver={(e) => onDragOver(e, block.id)}
                    onDrop={(e) => onDrop(e, block.id)}
                    onDragEnd={onDragEnd}
                    className={`relative ${draggedId === block.id ? 'opacity-30' : ''}`}
                >
                    {dragTarget?.id === block.id && dragTarget?.position === 'above' && (
                        <div className='absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 transition-all pointer-events-none' />
                    )}

                    <Block
                        block={block}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onCreateBelow={onCreateBelow}
                        onFocusPrevious={handleFocusPrevious}
                        isFocused={focusedBlockId === block.id}
                    />

                    {dragTarget?.id === block.id && dragTarget?.position === 'below' && (
                        <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 transition-all pointer-events-none' />
                    )}
                </div>
            ))}
            <AddBlockButton onClick={() => onCreateBelow(blocks[blocks.length - 1]?.id)} />
        </div>
    );
};
