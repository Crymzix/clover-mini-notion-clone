'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/use-web-socket';
import { useBlocks } from '@/hooks/use-blocks';
import { BlockList } from '@/components/block-list';
import { PresenceIndicator } from '@/components/presence-indicator';
import { Block, Page, WSMessage } from '@/lib/types';

export default function PageView() {
    const { id: pageId } = useParams() as { id: string };
    const [page, setPage] = useState<Page | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    // Fetch initial data
    useEffect(() => {
        async function fetchPage() {
            try {
                const res = await fetch(`http://localhost:3001/api/pages/${pageId}`);
                if (!res.ok) throw new Error('Page not found');
                const data = await res.json();
                setPage(data.page);
                setIsLoading(false);
                // Initial blocks will be handled by useBlocks when data is ready
            } catch (err) {
                console.error('Failed to fetch page:', err);
                setIsLoading(false);
            }
        }
        fetchPage();
    }, [pageId]);

    // WebSocket management
    const onMessage = useCallback((msg: WSMessage) => {
        handleRemoteUpdate(msg);
    }, []);

    const { send, isConnected, connectionCount } = useWebSocket(
        'ws://localhost:3001',
        onMessage
    );

    // Block state management
    const {
        blocks,
        setBlocks,
        createBlock,
        updateBlock,
        deleteBlock,
        reorderBlock,
        handleRemoteUpdate,
    } = useBlocks(pageId, [], send);

    // Load initial blocks into useBlocks state when fetch completes
    useEffect(() => {
        if (!isLoading && pageId) {
            async function loadBlocks() {
                const res = await fetch(`http://localhost:3001/api/pages/${pageId}`);
                const data = await res.json();
                setBlocks(data.blocks);
                // Send join message after connecting
                if (isConnected) {
                    send({ type: 'join', pageId, clientId: 'local' });
                }
            }
            loadBlocks();
        }
    }, [isLoading, pageId, isConnected]);

    const handleCreateBlock = (afterId?: string) => {
        const newId = createBlock(afterId);
        setFocusedBlockId(newId);
    };

    const handleUpdateTitle = (title: string) => {
        if (page) {
            setPage({ ...page, title });
            send({
                type: 'page:update_title',
                payload: { pageId, title },
            });
        }
    };

    if (isLoading) {
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
            </div>
        );
    }

    if (!page) {
        return (
            <div className='flex items-center justify-center min-h-screen text-gray-500 font-medium'>
                Page not found
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-white'>
            <header className='sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                    <h1
                        contentEditable
                        suppressContentEditableWarning
                        className='text-xl font-bold bg-transparent border-none outline-none focus:bg-blue-50/20 px-1 rounded transition-colors'
                        onBlur={(e) => handleUpdateTitle(e.currentTarget.innerText)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                            }
                        }}
                    >
                        {page.title}
                    </h1>
                </div>
                <PresenceIndicator count={connectionCount} isConnected={isConnected} />
            </header>

            <main className='py-12'>
                <div className='max-w-3xl mx-auto px-6 mb-8'>
                    {/* You could add a cover image or icon here if needed */}
                </div>

                <BlockList
                    blocks={blocks}
                    onUpdate={updateBlock}
                    onDelete={deleteBlock}
                    onCreateBelow={handleCreateBlock}
                    onReorder={reorderBlock}
                    focusedBlockId={focusedBlockId}
                    setFocusedBlockId={setFocusedBlockId}
                />
            </main>
        </div>
    );
}
