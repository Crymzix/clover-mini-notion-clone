'use client';

import React from 'react';

export const DragHandle: React.FC = () => {
    return (
        <div className='cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md bg-transparent border-none'>
            <svg
                width='12'
                height='18'
                viewBox='0 0 12 18'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
            >
                <path
                    d='M4 2C4 2.55228 3.55228 3 3 3C2.44772 3 2 2.55228 2 2C2 1.44772 2.44772 1 3 1C3.55228 1 4 1.44772 4 2Z'
                    fill='currentColor'
                />
                <path
                    d='M10 2C10 2.55228 9.55228 3 9 3C8.44772 3 8 2.55228 8 2C8 1.44772 8.44772 1 9 1C9.55228 1 10 1.44772 10 2Z'
                    fill='currentColor'
                />
                <path
                    d='M4 9C4 9.55228 3.55228 10 3 10C2.44772 10 2 9.55228 2 9C2 8.44772 2.44772 8 3 8C3.55228 8 4 8.44772 4 9Z'
                    fill='currentColor'
                />
                <path
                    d='M10 9C10 9.55228 9.55228 10 9 10C8.44772 10 8 9.55228 8 9C8 8.44772 8.44772 8 9 8C9.55228 8 10 8.44772 10 9Z'
                    fill='currentColor'
                />
                <path
                    d='M4 16C4 16.5523 3.55228 17 3 17C2.44772 17 2 16.5523 2 16C2 15.4477 2.44772 15 3 15C3.55228 15 4 15.4477 4 16Z'
                    fill='currentColor'
                />
                <path
                    d='M10 16C10 16.5523 9.55228 17 9 17C8.44772 17 8 16.5523 8 16C8 15.4477 8.44772 15 9 15C9.55228 15 10 15.4477 10 16Z'
                    fill='currentColor'
                />
            </svg>
        </div>
    );
};
