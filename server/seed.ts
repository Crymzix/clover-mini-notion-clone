import db from './db';
import { v4 as uuid } from 'uuid';

const pageId = uuid();

db.prepare('DELETE FROM blocks').run();
db.prepare('DELETE FROM pages').run();

db.prepare('INSERT INTO pages (id, title) VALUES (?, ?)').run(pageId, 'Welcome to Mini-Notion');

const blocks = [
  { id: uuid(), type: 'text', content: 'Welcome to Mini-Notion', style: 'h1', sort_order: 1.0, checked: 0 },
  { id: uuid(), type: 'text', content: 'This is a collaborative block editor. Open this page in two browser tabs to see real-time sync in action.', style: 'paragraph', sort_order: 2.0, checked: 0 },
  { id: uuid(), type: 'divider', content: '', style: 'paragraph', sort_order: 3.0, checked: 0 },
  { id: uuid(), type: 'text', content: 'Getting Started', style: 'h2', sort_order: 4.0, checked: 0 },
  { id: uuid(), type: 'text', content: 'Click on any block to edit it. Use the style menu to change between heading levels and paragraph text. Drag blocks to reorder them.', style: 'paragraph', sort_order: 5.0, checked: 0 },
  { id: uuid(), type: 'checklist', content: 'Try editing this checklist item', style: 'paragraph', sort_order: 6.0, checked: 0 },
  { id: uuid(), type: 'checklist', content: 'This one is already done', style: 'paragraph', sort_order: 7.0, checked: 1 },
];

const insert = db.prepare(
  'INSERT INTO blocks (id, page_id, type, content, style, sort_order, checked) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

for (const block of blocks) {
  insert.run(block.id, pageId, block.type, block.content, block.style, block.sort_order, block.checked);
}

console.log(`Seeded page: ${pageId}`);
