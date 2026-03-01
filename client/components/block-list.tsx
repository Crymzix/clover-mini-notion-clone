'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Block as BlockType, BlockStyle } from '../lib/types';
import { Block } from './block';
import { cn } from '../lib/utils';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';

interface BlockListProps {
    blocks: BlockType[];
    onUpdate: (id: string, changes: { content?: string; style?: BlockStyle }) => void;
    onDelete: (id: string) => void;
    onCreate: (afterId?: string, style?: BlockStyle) => void;
    onReorder: (id: string, newSortOrder: number) => void;
}

export const BlockList: React.FC<BlockListProps> = ({
    blocks,
    onUpdate,
    onDelete,
    onCreate,
    onReorder,
}) => {
    const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const blockRefs = useRef<{ [id: string]: HTMLElement | null }>({});

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedBlockId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('blockId', id);
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (id === draggedBlockId) {
            setDropIndicator(null);
            return;
        }

        const rect = blockRefs.current[id]?.getBoundingClientRect();
        if (rect) {
            const midpoint = rect.top + rect.height / 2;
            const position = e.clientY < midpoint ? 'above' : 'below';
            setDropIndicator({ id, position });
        }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedBlockId || targetId === draggedBlockId) {
            setDraggedBlockId(null);
            setDropIndicator(null);
            return;
        }

        const targetIndex = blocks.findIndex(b => b.id === targetId);
        let newSortOrder: number;

        const rect = blockRefs.current[targetId]?.getBoundingClientRect();
        const position = rect && e.clientY < (rect.top + rect.height / 2) ? 'above' : 'below';

        if (position === 'above') {
            const prev = blocks[targetIndex - 1];
            const current = blocks[targetIndex];
            if (prev) {
                newSortOrder = (prev.sort_order + current.sort_order) / 2;
            } else {
                newSortOrder = current.sort_order - 1.0;
            }
        } else {
            const current = blocks[targetIndex];
            const next = blocks[targetIndex + 1];
            if (next) {
                newSortOrder = (current.sort_order + next.sort_order) / 2;
            } else {
                newSortOrder = current.sort_order + 1.0;
            }
        }

        onReorder(draggedBlockId, newSortOrder);
        setDraggedBlockId(null);
        setDropIndicator(null);
    };

    const setBlockRef = (id: string, el: HTMLElement | null) => {
        blockRefs.current[id] = el;
    };

    const focusPrev = useCallback((index: number) => {
        if (index > 0) {
            const prevId = blocks[index - 1].id;
            const prevEl = blockRefs.current[prevId]?.querySelector('[contenteditable]');
            (prevEl as HTMLElement)?.focus();
        }
    }, [blocks]);

    const focusNext = useCallback((index: number) => {
        // Need a bit of delay for the new block to be rendered
        setTimeout(() => {
            if (index < blocks.length - 1) {
                const nextId = blocks[index + 1].id;
                const nextEl = blockRefs.current[nextId]?.querySelector('[contenteditable]');
                (nextEl as HTMLElement)?.focus();
            } else if (index === blocks.length - 1) {
                // Target is now at the end
                const lastId = blocks[blocks.length - 1].id;
                const lastEl = blockRefs.current[lastId]?.querySelector('[contenteditable]');
                (lastEl as HTMLElement)?.focus();
            }
        }, 50);
    }, [blocks]);

    return (
        <div ref={containerRef} className="max-w-3xl mx-auto pb-64">
            <div className="flex flex-col">
                {blocks.map((block, index) => (
                    <div
                        key={block.id}
                        ref={(el) => setBlockRef(block.id, el)}
                        onDragOver={(e) => handleDragOver(e, block.id)}
                        onDrop={(e) => handleDrop(e, block.id)}
                        className="relative"
                    >
                        {dropIndicator?.id === block.id && dropIndicator?.position === 'above' && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none" />
                        )}

                        <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, block.id)}
                            className={cn(draggedBlockId === block.id && "bg-accent/50 opacity-50")}
                        >
                            <Block
                                block={block}
                                index={index}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onCreate={(afterId) => onCreate(afterId)}
                                onFocusNext={focusNext}
                                onFocusPrev={focusPrev}
                                isDragging={draggedBlockId === block.id}
                            />
                        </div>

                        {dropIndicator?.id === block.id && dropIndicator?.position === 'below' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 px-12 group">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCreate()}
                    className="text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity"
                >
                    <Plus size={16} className="mr-2" /> Add a block
                </Button>
            </div>
        </div>
    );
};
