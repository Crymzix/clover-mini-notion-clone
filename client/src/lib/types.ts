export type BlockStyle = 'h1' | 'h2' | 'h3' | 'paragraph';

export interface Block {
    id: string;
    pageId: string;
    type: string;
    content: string;
    style: BlockStyle;
    sortOrder: number;
}

export interface Page {
    id: string;
    title: string;
}

export type WSMessage =
    | { type: 'join'; pageId: string; clientId: string }
    | { type: 'presence'; count: number }
    | { type: 'block:create'; payload: { id: string; pageId: string; content: string; style: string; sortOrder: number } }
    | { type: 'block:update'; payload: { id: string; content?: string; style?: string } }
    | { type: 'block:delete'; payload: { id: string } }
    | { type: 'block:reorder'; payload: { id: string; sortOrder: number } }
    | { type: 'page:update_title'; payload: { pageId: string; title: string } };
