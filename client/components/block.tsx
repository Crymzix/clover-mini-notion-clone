'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Block as BlockType, BlockStyle } from '../lib/types';
import { GripVertical, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface BlockProps {
    block: BlockType;
    index: number;
    onUpdate: (id: string, changes: { content?: string; style?: BlockStyle }) => void;
    onDelete: (id: string) => void;
    onCreate: (afterId: string, style?: BlockStyle) => void;
    onFocusNext: (index: number) => void;
    onFocusPrev: (index: number) => void;
    isDragging?: boolean;
}

export const Block: React.FC<BlockProps> = ({
    block,
    index,
    onUpdate,
    onDelete,
    onCreate,
    onFocusNext,
    onFocusPrev,
    isDragging
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [localContent, setLocalContent] = useState(block.content);
    const isFocused = useRef(false);

    // Sync with remote updates ONLY when not focused
    useEffect(() => {
        if (!isFocused.current && block.content !== localContent) {
            setLocalContent(block.content);
            if (contentRef.current) {
                contentRef.current.innerText = block.content;
            }
        }
    }, [block.content, localContent]);

    // Initial content setup
    useEffect(() => {
        if (contentRef.current && contentRef.current.innerText !== block.content) {
            contentRef.current.innerText = block.content;
        }
    }, []);

    const handleInput = useCallback(() => {
        const newContent = contentRef.current?.innerText || '';
        setLocalContent(newContent);
        // Debounce could be added here, but for now we update directly in optimistic state
        onUpdate(block.id, { content: newContent });
    }, [block.id, onUpdate]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCreate(block.id);
            onFocusNext(index);
        } else if (e.key === 'Backspace' && localContent === '') {
            e.preventDefault();
            onDelete(block.id);
            onFocusPrev(index);
        } else if (e.key === 'ArrowDown') {
            const selection = window.getSelection();
            if (selection && selection.anchorOffset === contentRef.current?.innerText.length) {
                onFocusNext(index);
            }
        } else if (e.key === 'ArrowUp') {
            const selection = window.getSelection();
            if (selection && selection.anchorOffset === 0) {
                onFocusPrev(index);
            }
        }
    };

    const getStyleClasses = (style: BlockStyle) => {
        switch (style) {
            case 'h1': return 'text-4xl font-bold mt-6 mb-2 tracking-tight';
            case 'h2': return 'text-3xl font-bold mt-5 mb-2 tracking-tight';
            case 'h3': return 'text-2xl font-semibold mt-4 mb-1 tracking-tight';
            case 'paragraph': return 'text-base mt-2 mb-2 leading-relaxed';
            default: return 'text-base';
        }
    };

    return (
        <div
            className={cn(
                "group flex items-start gap-2 py-1 px-4 rounded-md transition-colors",
                isDragging ? "opacity-50 bg-accent/50" : "hover:bg-accent/20"
            )}
        >
            <div
                className="mt-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
                draggable
            >
                <GripVertical size={16} className="text-muted-foreground" />
            </div>

            <div className="flex-1 min-h-[1.5em] relative">
                <div
                    ref={contentRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { isFocused.current = true; }}
                    onBlur={() => { isFocused.current = false; }}
                    className={cn(
                        "outline-none w-full break-words",
                        getStyleClasses(block.style),
                        localContent === "" && "before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:pointer-events-none"
                    )}
                    data-placeholder={block.style === 'paragraph' ? "Type '/' for commands..." : "Heading..."}
                />
            </div>

            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-accent rounded-sm text-muted-foreground">
                            <MoreVertical size={16} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onUpdate(block.id, { style: 'h1' })}>Heading 1</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdate(block.id, { style: 'h2' })}>Heading 2</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdate(block.id, { style: 'h3' })}>Heading 3</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdate(block.id, { style: 'paragraph' })}>Text</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-destructive">
                            <Trash2 size={16} className="mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};
