import db from './db';
import { v4 as uuid } from 'uuid';

const pageId = uuid();

db.prepare('DELETE FROM blocks').run();
db.prepare('DELETE FROM pages').run();

db.prepare('INSERT INTO pages (id, title) VALUES (?, ?)').run(pageId, 'Welcome to Mini-Notion');

const blocks = [
  { id: uuid(), content: 'Welcome to Mini-Notion', style: 'h1', sort_order: 1.0 },
  { id: uuid(), content: 'This is a collaborative block editor. Open this page in two browser tabs to see real-time sync in action.', style: 'paragraph', sort_order: 2.0 },
  { id: uuid(), content: 'Getting Started', style: 'h2', sort_order: 3.0 },
  { id: uuid(), content: 'Click on any block to edit it. Use the style menu to change between heading levels and paragraph text. Drag blocks to reorder them.', style: 'paragraph', sort_order: 4.0 },
];

const insert = db.prepare(
  'INSERT INTO blocks (id, page_id, type, content, style, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
);

for (const block of blocks) {
  insert.run(block.id, pageId, 'text', block.content, block.style, block.sort_order);
}

console.log(`Seeded page: ${pageId}`);
