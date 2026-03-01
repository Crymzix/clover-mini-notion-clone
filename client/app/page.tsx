'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Page, WSMessage } from '@/lib/types';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { v4 as uuid } from 'uuid';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/use-websocket';

export default function Home() {
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const { send } = useWebSocket('ws://localhost:3001', useCallback((msg: WSMessage) => {
        if (msg.type === 'page:create') {
            setPages(prev => {
                if (prev.find(p => p.id === msg.payload.id)) return prev;
                return [{ id: msg.payload.id, title: msg.payload.title }, ...prev];
            });
        } else if (msg.type === 'page:update_title') {
            setPages(prev => prev.map(p =>
                p.id === msg.payload.pageId ? { ...p, title: msg.payload.title } : p
            ));
        }
    }, []));

    useEffect(() => {
        async function fetchPages() {
            try {
                const response = await fetch('http://localhost:3001/api/pages');
                if (!response.ok) {
                    throw new Error('Failed to fetch pages');
                }
                const data = await response.json();
                setPages(data);
            } catch (err) {
                console.error('Failed to fetch pages:', err);
                setError('Failed to connect to the server. Make sure the backend is running.');
            } finally {
                setLoading(false);
            }
        }

        fetchPages();
    }, []);

    const createNewPage = () => {
        const id = uuid();
        const title = 'Untitled';
        setPages(prev => [{ id, title }, ...prev]);
        send({ type: 'page:create', payload: { id, title } });
        router.push(`/page/${id}`);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <main className="max-w-4xl mx-auto px-4 py-32">
            <header className="flex items-center justify-between mb-12">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">My Pages</h1>
                    <p className="text-muted-foreground">Select a page to start editing or create a new one.</p>
                </div>
                <Button onClick={createNewPage} size="lg">
                    <Plus size={20} className="mr-2" /> New Page
                </Button>
            </header>

            {error ? (
                <div className="p-8 text-center border rounded-xl border-dashed bg-muted/50">
                    <p className="text-muted-foreground">{error}</p>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {pages.map((page) => (
                        <Link key={page.id} href={`/page/${page.id}`}>
                            <Card className="hover:border-primary transition-colors cursor-pointer group h-full">
                                <CardHeader>
                                    <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors mb-2">
                                        <FileText size={20} />
                                    </div>
                                    <CardTitle className="line-clamp-1">{page.title || 'Untitled'}</CardTitle>
                                    <CardDescription className="text-xs">ID: {page.id.slice(0, 8)}...</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}

                    {pages.length === 0 && (
                        <div
                            onClick={createNewPage}
                            className="col-span-full h-48 border border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <Plus size={32} className="text-muted-foreground mb-4" />
                            <p className="text-muted-foreground font-medium">Create your first page</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}