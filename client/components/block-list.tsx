'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Block as BlockType, BlockStyle, BlockType as BlockTypeEnum } from '../lib/types';
import { Block } from './block';
import { cn } from '../lib/utils';
import { Plus, Minus, CheckSquare, Type } from 'lucide-react';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface BlockListProps {
    blocks: BlockType[];
    onUpdate: (id: string, changes: { content?: string; style?: BlockStyle }) => void;
    onDelete: (id: string) => void;
    onCreate: (afterId?: string, style?: BlockStyle, blockType?: BlockTypeEnum) => string | undefined;
    onReorder: (id: string, newSortOrder: number) => void;
    onToggleChecked: (id: string) => void;
}

export const BlockList: React.FC<BlockListProps> = ({
    blocks,
    onUpdate,
    onDelete,
    onCreate,
    onReorder,
    onToggleChecked,
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

    const handleDragEnd = () => {
        setDraggedBlockId(null);
        setDropIndicator(null);
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

    const pendingFocusId = useRef<string | null>(null);

    const setBlockRef = (id: string, el: HTMLElement | null) => {
        blockRefs.current[id] = el;
    };

    // Focus a block by ID once it's rendered
    useEffect(() => {
        if (pendingFocusId.current) {
            const el = blockRefs.current[pendingFocusId.current]?.querySelector('[contenteditable]');
            if (el) {
                (el as HTMLElement).focus();
                pendingFocusId.current = null;
            }
        }
    }, [blocks]);

    const focusBlock = useCallback((id: string) => {
        const el = blockRefs.current[id]?.querySelector('[contenteditable]');
        if (el) {
            (el as HTMLElement).focus();
        }
    }, []);

    const focusPrev = useCallback((index: number) => {
        if (index > 0) {
            focusBlock(blocks[index - 1].id);
        }
    }, [blocks, focusBlock]);

    const focusNext = useCallback((index: number) => {
        if (index < blocks.length - 1) {
            focusBlock(blocks[index + 1].id);
        }
    }, [blocks, focusBlock]);

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
                            onDragEnd={handleDragEnd}
                            className={cn(draggedBlockId === block.id && "bg-accent/50 opacity-50")}
                        >
                            <Block
                                block={block}
                                index={index}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onCreate={(afterId) => {
                                    const newId = onCreate(afterId);
                                    if (newId) pendingFocusId.current = newId;
                                }}
                                onCreateTyped={(afterId, blockType) => {
                                    const newId = onCreate(afterId, 'paragraph', blockType);
                                    if (newId && blockType !== 'divider') pendingFocusId.current = newId;
                                }}
                                onToggleChecked={onToggleChecked}
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

            <div className="mt-4 px-12 flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCreate()}
                    className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity"
                >
                    <Plus size={16} className="mr-2" /> Add a block
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity px-2"
                        >
                            <Plus size={14} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => onCreate(undefined, 'paragraph', 'text')}>
                            <Type size={16} className="mr-2" /> Text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCreate(undefined, 'paragraph', 'divider')}>
                            <Minus size={16} className="mr-2" /> Divider
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            const newId = onCreate(undefined, 'paragraph', 'checklist');
                            if (newId) pendingFocusId.current = newId;
                        }}>
                            <CheckSquare size={16} className="mr-2" /> Checklist
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};
