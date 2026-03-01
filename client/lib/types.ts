export type BlockStyle = 'h1' | 'h2' | 'h3' | 'paragraph';

export interface Block {
    id: string;
    page_id: string;
    type: string;
    content: string;
    style: BlockStyle;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface Page {
    id: string;
    title: string;
}

export interface PageWithBlocks {
    page: Page;
    blocks: Block[];
}

export type WSMessage =
    | { type: 'join'; pageId: string; clientId: string }
    | { type: 'block:create'; payload: { id: string; pageId: string; content: string; style: string; sort_order: number } }
    | { type: 'block:update'; payload: { id: string; content?: string; style?: string } }
    | { type: 'block:delete'; payload: { id: string } }
    | { type: 'block:reorder'; payload: { id: string; sort_order: number } }
    | { type: 'page:create'; payload: { id: string; title: string } }
    | { type: 'page:update_title'; payload: { pageId: string; title: string } }
    | { type: 'presence'; count: number };
