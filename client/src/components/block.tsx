'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Block as BlockType, BlockStyle } from '@/lib/types';
import { DragHandle } from './drag-handle';
import { BlockStyleMenu } from './block-style-menu';

interface BlockProps {
    block: BlockType;
    onUpdate: (id: string, content?: string, style?: BlockStyle) => void;
    onDelete: (id: string) => void;
    onCreateBelow: (id: string) => void;
    onFocusPrevious: (id: string) => void;
    isFocused?: boolean;
}

export const Block: React.FC<BlockProps> = ({
    block,
    onUpdate,
    onDelete,
    onCreateBelow,
    onFocusPrevious,
    isFocused,
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Focus the block if isFocused is true
    useEffect(() => {
        if (isFocused && contentRef.current) {
            contentRef.current.focus();
        }
    }, [isFocused]);

    // Handle remote updates - only apply if not focused
    useEffect(() => {
        if (contentRef.current && document.activeElement !== contentRef.current) {
            if (contentRef.current.innerText !== block.content) {
                contentRef.current.innerText = block.content;
            }
        }
    }, [block.content]);

    const handleInput = useCallback(() => {
        if (contentRef.current) {
            const content = contentRef.current.innerText;

            // Check for slash commands
            if (content.startsWith('/')) {
                setShowStyleMenu(true);
            }

            // Debounce the update
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
                onUpdate(block.id, content);
            }, 300);
        }
    }, [block.id, onUpdate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCreateBelow(block.id);
        } else if (e.key === 'Backspace' && !contentRef.current?.innerText) {
            e.preventDefault();
            onDelete(block.id);
            onFocusPrevious(block.id);
        }
    }, [block.id, onCreateBelow, onDelete, onFocusPrevious]);

    const getStyleClasses = () => {
        switch (block.style) {
            case 'h1': return 'text-4xl font-bold text-gray-900 my-4 tracking-tight';
            case 'h2': return 'text-3xl font-bold text-gray-900 my-3 tracking-tight';
            case 'h3': return 'text-2xl font-semibold text-gray-800 my-2 tracking-tight';
            case 'paragraph': return 'text-base text-gray-700 leading-relaxed my-1';
            default: return 'text-base text-gray-700';
        }
    };

    return (
        <div className='group relative flex items-start gap-2 w-full max-w-3xl mx-auto px-4'>
            <div className='opacity-0 group-hover:opacity-100 transition-opacity absolute left-[-1.5rem] mt-1 pt-1'>
                <DragHandle />
            </div>

            <div className='relative w-full'>
                <div
                    ref={contentRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={`w-full outline-none focus:bg-blue-50/10 min-h-[1.5em] focus:ring-1 focus:ring-blue-100 rounded px-1 transition-all ${getStyleClasses()}`}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setShowStyleMenu(false)}
                />

                {showStyleMenu && (
                    <div className='absolute left-0 mt-2 z-20'>
                        <BlockStyleMenu
                            currentStyle={block.style}
                            onSelect={(style) => {
                                onUpdate(block.id, undefined, style);
                                setShowStyleMenu(false);
                            }}
                            isOpen={showStyleMenu}
                            onClose={() => setShowStyleMenu(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
