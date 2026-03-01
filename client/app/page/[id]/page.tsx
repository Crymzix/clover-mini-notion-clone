'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/use-websocket';
import { useBlocks } from '@/hooks/use-blocks';
import { PresenceIndicator } from '@/components/presence-indicator';
import { BlockList } from '@/components/block-list';
import { PageWithBlocks } from '@/lib/types';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PageEditor() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [initialData, setInitialData] = useState<PageWithBlocks | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch initial data
    useEffect(() => {
        async function fetchPage() {
            try {
                const response = await fetch(`http://localhost:3001/api/pages/${id}`);
                if (!response.ok) {
                    throw new Error('Page not found');
                }
                const data = await response.json();
                setInitialData(data);
            } catch (err) {
                console.error('Failed to fetch page:', err);
                setError('Failed to load page. Make sure the server is running.');
            } finally {
                setLoading(false);
            }
        }

        if (id) {
            fetchPage();
        }
    }, [id]);

    const onMessage = useCallback((msg: any) => {
        // This will be handled by handleMessage from useBlocks
    }, []);

    const { send, isConnected, connectionCount } = useWebSocket('ws://localhost:3001', (msg) => {
        if (msg.type !== 'presence') {
            handleMessage(msg);
        }
    });

    const {
        blocks,
        pageTitle,
        createBlock,
        updateBlock,
        deleteBlock,
        reorderBlock,
        updatePageTitle,
        handleMessage,
        clientId,
    } = useBlocks(id, initialData, send);

    // Join the page on connect
    useEffect(() => {
        if (isConnected && id) {
            send({ type: 'join', pageId: id, clientId });
        }
    }, [isConnected, id, send, clientId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4">
                <p className="text-destructive font-semibold">{error}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
                <Link href="/" className="text-primary hover:underline">Go back to home</Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/40">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground">
                            <ChevronLeft size={20} />
                        </Link>
                        <div className="h-4 w-[1px] bg-border" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest truncate max-w-[200px]">
                            {pageTitle || 'Untitled'}
                        </span>
                    </div>
                    <PresenceIndicator count={connectionCount} isConnected={isConnected} />
                </div>
            </header>

            {/* Editor Content */}
            <div className="max-w-4xl mx-auto px-4 pt-16 pb-32">
                <header className="mb-8 px-12">
                    <h1
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updatePageTitle(e.currentTarget.innerText)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                            }
                        }}
                        className="text-5xl font-bold tracking-tight outline-none empty:before:content-['Untitled'] empty:before:text-muted-foreground/30"
                    >
                        {pageTitle}
                    </h1>
                </header>

                <BlockList
                    blocks={blocks}
                    onUpdate={updateBlock}
                    onDelete={deleteBlock}
                    onCreate={(afterId) => createBlock(afterId)}
                    onReorder={reorderBlock}
                />
            </div>
        </main>
    );
}
