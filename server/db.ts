import DatabaseConstructor, { Database, Statement } from 'better-sqlite3';
import path from 'path';

const db: Database = new DatabaseConstructor(path.join(__dirname, 'notion.db'));

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL DEFAULT '',
    style TEXT NOT NULL DEFAULT 'paragraph',
    sort_order REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks(page_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_sort_order ON blocks(page_id, sort_order);
`);

// Migration: add checked column for checklist blocks
try {
    db.exec('ALTER TABLE blocks ADD COLUMN checked INTEGER NOT NULL DEFAULT 0');
} catch {
    // Column already exists
}

// Query helpers
export const queries: {
    getAllPages: Statement;
    getPageById: Statement;
    createPage: Statement;
    updatePageTitle: Statement;
    getBlocksByPageId: Statement;
    createBlock: Statement;
    updateBlockContent: Statement;
    updateBlockStyle: Statement;
    updateBlockContentAndStyle: Statement;
    updateBlockSortOrder: Statement;
    updateBlockChecked: Statement;
    deleteBlock: Statement;
    getBlockById: Statement;
} = {
    // Pages
    getAllPages: db.prepare('SELECT id, title FROM pages ORDER BY created_at DESC'),
    getPageById: db.prepare('SELECT id, title FROM pages WHERE id = ?'),
    createPage: db.prepare('INSERT INTO pages (id, title) VALUES (?, ?)'),
    updatePageTitle: db.prepare('UPDATE pages SET title = ?, updated_at = datetime(\'now\') WHERE id = ?'),

    // Blocks
    getBlocksByPageId: db.prepare(
        'SELECT id, type, content, style, sort_order, checked FROM blocks WHERE page_id = ? ORDER BY sort_order ASC'
    ),
    createBlock: db.prepare(
        'INSERT INTO blocks (id, page_id, type, content, style, sort_order, checked) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    updateBlockContent: db.prepare(
        'UPDATE blocks SET content = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ),
    updateBlockStyle: db.prepare(
        'UPDATE blocks SET style = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ),
    updateBlockContentAndStyle: db.prepare(
        'UPDATE blocks SET content = ?, style = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ),
    updateBlockSortOrder: db.prepare(
        'UPDATE blocks SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ),
    updateBlockChecked: db.prepare(
        'UPDATE blocks SET checked = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ),
    deleteBlock: db.prepare('DELETE FROM blocks WHERE id = ?'),
    getBlockById: db.prepare('SELECT id, page_id, type, content, style, sort_order, checked FROM blocks WHERE id = ?'),
};

export default db;
