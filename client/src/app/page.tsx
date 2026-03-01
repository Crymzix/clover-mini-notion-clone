'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Clock } from 'lucide-react';
import { Page } from '@/lib/types';

export default function Home() {
    const [pages, setPages] = useState<Page[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function fetchPages() {
            try {
                const res = await fetch('http://localhost:3001/api/pages');
                if (!res.ok) throw new Error('Failed to fetch pages');
                const data = await res.json();
                setPages(data);
                setIsLoading(false);
            } catch (err) {
                console.error('Failed to fetch pages:', err);
                setIsLoading(false);
            }
        }
        fetchPages();
    }, []);

    const handleCreatePage = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Untitled' }),
            });
            if (res.ok) {
                const newPage = await res.json();
                router.push(`/page/${newPage.id}`);
            }
        } catch (err) {
            console.error('Failed to create page:', err);
        }
    };

    if (isLoading) {
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-gray-50/50 p-6 md:p-12'>
            <div className='max-w-5xl mx-auto'>
                <header className='flex items-center justify-between mb-12'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-black text-white p-2 rounded-lg'>
                            <FileText size={24} />
                        </div>
                        <h1 className='text-3xl font-extrabold tracking-tight'>Mini Notion</h1>
                    </div>
                    <button
                        onClick={handleCreatePage}
                        className='flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm font-medium'
                    >
                        <Plus size={18} />
                        <span>New Page</span>
                    </button>
                </header>

                <section>
                    <div className='flex items-center gap-2 mb-6 text-gray-500 font-medium'>
                        <Clock size={18} />
                        <h2>Recently viewed</h2>
                    </div>

                    {pages.length === 0 ? (
                        <div className='bg-white border rounded-xl p-12 text-center flex flex-col items-center gap-4 shadow-sm border-gray-200/60'>
                            <div className='bg-gray-100 p-4 rounded-full text-gray-400'>
                                <FileText size={32} />
                            </div>
                            <div className='space-y-1'>
                                <h3 className='text-lg font-semibold'>No pages yet</h3>
                                <p className='text-gray-500'>Create your first page to get started with collaborative editing.</p>
                            </div>
                            <button
                                onClick={handleCreatePage}
                                className='mt-2 text-blue-600 font-semibold hover:underline'
                            >
                                Create your first page
                            </button>
                        </div>
                    ) : (
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {pages.map((page) => (
                                <Link
                                    key={page.id}
                                    href={`/page/${page.id}`}
                                    className='group bg-white border border-gray-200/60 rounded-xl p-6 hover:shadow-lg hover:border-blue-500 transition-all shadow-sm flex flex-col gap-4 relative overflow-hidden'
                                >
                                    <div className='absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity'>
                                        <FileText size={16} className='text-blue-500' />
                                    </div>
                                    <div className='bg-gray-50 w-fit p-3 rounded-lg group-hover:bg-blue-50 transition-colors'>
                                        <FileText size={20} className='text-gray-600 group-hover:text-blue-600' />
                                    </div>
                                    <div className='space-y-1'>
                                        <h3 className='font-bold text-gray-900 truncate'>{page.title}</h3>
                                        <p className='text-sm text-gray-400'>Updated recently</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
