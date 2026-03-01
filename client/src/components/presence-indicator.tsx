'use client';

import React from 'react';

interface PresenceIndicatorProps {
    count: number;
    isConnected: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ count, isConnected }) => {
    return (
        <div className='flex items-center gap-2 px-3 py-1 bg-gray-50 border rounded-full text-sm font-medium'>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className='text-gray-600'>
                {isConnected ? `${count} user${count === 1 ? '' : 's'} online` : 'Disconnected'}
            </span>
        </div>
    );
};
