'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface AddBlockButtonProps {
    onClick: () => void;
    label?: string;
}

export const AddBlockButton: React.FC<AddBlockButtonProps> = ({ onClick, label = 'Add a block' }) => {
    return (
        <button
            onClick={onClick}
            className='flex items-center gap-2 w-full max-w-3xl mx-auto px-4 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors text-sm font-medium focus:outline-none'
        >
            <Plus size={16} />
            <span>{label}</span>
        </button>
    );
};
