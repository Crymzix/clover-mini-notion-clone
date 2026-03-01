'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface PresenceIndicatorProps {
    count: number;
    isConnected: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ count, isConnected }) => {
    return (
        <div className="flex items-center gap-2">
            <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users size={14} />
                {count} {count === 1 ? 'user' : 'users'} online
            </span>
        </div>
    );
};
