export type BlockStyle = 'h1' | 'h2' | 'h3' | 'paragraph';
export type BlockType = 'text' | 'divider' | 'checklist';

export interface Block {
    id: string;
    page_id: string;
    type: BlockType;
    content: string;
    style: BlockStyle;
    sort_order: number;
    checked?: number;
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
    | { type: 'block:create'; payload: { id: string; pageId: string; blockType: BlockType; content: string; style: string; sort_order: number; checked?: number } }
    | { type: 'block:update'; payload: { id: string; content?: string; style?: string } }
    | { type: 'block:delete'; payload: { id: string } }
    | { type: 'block:reorder'; payload: { id: string; sort_order: number } }
    | { type: 'block:toggle_checked'; payload: { id: string; checked: number } }
    | { type: 'page:create'; payload: { id: string; title: string } }
    | { type: 'page:update_title'; payload: { pageId: string; title: string } }
    | { type: 'presence'; count: number };
