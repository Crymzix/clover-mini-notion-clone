'use client';

import React from 'react';
import { BlockStyle } from '@/lib/types';

interface BlockStyleMenuProps {
    currentStyle: BlockStyle;
    onSelect: (style: BlockStyle) => void;
    isOpen: boolean;
    onClose: () => void;
}

const styles: { value: BlockStyle; label: string; description: string }[] = [
    { value: 'h1', label: 'Heading 1', description: 'Large section heading' },
    { value: 'h2', label: 'Heading 2', description: 'Medium section heading' },
    { value: 'h3', label: 'Heading 3', description: 'Small section heading' },
    { value: 'paragraph', label: 'Text', description: 'Plain text for paragraphs' },
];

export const BlockStyleMenu: React.FC<BlockStyleMenuProps> = ({ currentStyle, onSelect, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <>
            <div className='fixed inset-0 z-10' onClick={onClose} />
            <div className='absolute left-[-10rem] top-[-10rem] z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-2 overflow-hidden animate-in fade-in zoom-in duration-100'>
                <div className='px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                    Turn into
                </div>
                {styles.map((style) => (
                    <button
                        key={style.value}
                        className={`w-full text-left px-3 py-2 flex flex-col hover:bg-gray-50 focus:outline-none ${currentStyle === style.value ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                            onSelect(style.value);
                            onClose();
                        }}
                    >
                        <span className='text-sm font-medium text-gray-800'>{style.label}</span>
                        <span className='text-xs text-gray-500'>{style.description}</span>
                    </button>
                ))}
            </div>
        </>
    );
};
