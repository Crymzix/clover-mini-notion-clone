# Mini-Notion Clone — Implementation Plan

## Project Overview

Build a mini Notion clone where a page is a vertical stack of text blocks. Users can create, edit, reorder, and delete blocks. Multiple users can collaborate in real-time via WebSocket. All data persists in SQLite. No hosted services — everything runs locally.

**Constraint:** Do NOT use prebuilt text-editor libraries (Tiptap, Blocknote, Slate, ProseMirror, Lexical, etc.). Handle editing logic manually with contentEditable.

---

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React 18+, TypeScript, Tailwind CSS
- **Backend:** Separate Express server with `ws` (WebSocket) + REST endpoints
- **Database:** SQLite via `better-sqlite3`
- **No external editor libraries.** Use native `contentEditable` for text editing.
- **No Socket.io.** Use the `ws` package directly for WebSocket.

## Project Structure

```
mini-notion/
├── client/                     # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Main entry — redirects or shows page list
│   │   └── page/[id]/
│   │       └── page.tsx        # Page view — block editor
│   ├── components/
│   │   ├── BlockList.tsx       # Renders ordered blocks, handles drag-and-drop reorder
│   │   ├── Block.tsx           # Single block — contentEditable + style handling
│   │   ├── BlockStyleMenu.tsx  # Dropdown to pick H1/H2/H3/paragraph
│   │   ├── AddBlockButton.tsx  # "+" button to insert a new block
│   │   ├── DragHandle.tsx      # Grip icon for drag-and-drop on each block
│   │   └── PresenceIndicator.tsx # Shows how many users are connected
│   ├── hooks/
│   │   ├── useWebSocket.ts     # WebSocket connection management + message dispatch
│   │   └── useBlocks.ts        # Block state, CRUD operations, optimistic updates
│   ├── lib/
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── utils.ts            # Helpers (generateId, calculateSortOrder, etc.)
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/
│   ├── index.ts                # Express + WebSocket server entry point
│   ├── db.ts                   # SQLite setup, schema, query functions
│   ├── ws.ts                   # WebSocket handler — message routing + broadcast
│   ├── routes.ts               # REST routes for initial page/block load
│   ├── seed.ts                 # Seeds database with sample page + blocks
│   ├── tsconfig.json
│   └── package.json
├── README.md
└── package.json                # Root package.json with scripts to run both
```

---

## Phase 1: Project Setup & Database

### 1.1 Initialize project structure

Create the monorepo structure above. The root `package.json` should have scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npx tsx watch index.ts",
    "dev:client": "cd client && npm run dev",
    "setup": "cd client && npm install && cd ../server && npm install",
    "seed": "cd server && npx tsx seed.ts"
  }
}
```

### 1.2 Server dependencies

```
cd server && npm init -y
npm install express better-sqlite3 ws uuid cors
npm install -D typescript @types/express @types/better-sqlite3 @types/ws @types/uuid tsx @types/cors
```

### 1.3 Client dependencies

```
cd client
npx create-next-app@latest . --typescript --tailwind --app --src=false --import-alias="@/*"
npm install uuid
npm install -D @types/uuid
```

### 1.4 Database schema (server/db.ts)

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, 'notion.db'));

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

export default db;
```

**Important:** `sort_order` is a REAL (float). When inserting a block between two others, calculate the midpoint: `newSortOrder = (prevSortOrder + nextSortOrder) / 2`. When appending to the end, use `maxSortOrder + 1.0`. This avoids renumbering all blocks on every reorder.

### 1.5 Seed data (server/seed.ts)

Create a seed script that inserts one page with 3-4 sample blocks so testers see content immediately on first run:

```typescript
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
```

---

## Phase 2: Server — REST + WebSocket

### 2.1 REST endpoints (server/routes.ts)

These are for initial page load only. All mutations go through WebSocket.

```
GET /api/pages              → list all pages (returns [{id, title}])
GET /api/pages/:id          → get page with all blocks sorted by sort_order
POST /api/pages             → create a new page, return {id, title}
```

The GET /api/pages/:id response shape:

```typescript
{
  page: { id: string, title: string },
  blocks: Array<{
    id: string,
    type: string,
    content: string,
    style: 'h1' | 'h2' | 'h3' | 'paragraph',
    sort_order: number
  }>
}
```

### 2.2 WebSocket server (server/ws.ts)

Run the WebSocket server on the same HTTP server as Express (upgrade the connection).

**Connection management:**
- Maintain a `Map<string, Set<WebSocket>>` mapping `pageId` → connected clients
- On connect, client sends: `{ type: "join", pageId: "xxx" }`
- Server adds the client to that page's connection set
- On disconnect, remove client from set

**Message protocol — Client → Server:**

```typescript
type WSMessage =
  | { type: 'join'; pageId: string; clientId: string }
  | { type: 'block:create'; payload: { id: string; pageId: string; content: string; style: string; sortOrder: number } }
  | { type: 'block:update'; payload: { id: string; content?: string; style?: string } }
  | { type: 'block:delete'; payload: { id: string } }
  | { type: 'block:reorder'; payload: { id: string; sortOrder: number } }
  | { type: 'page:update_title'; payload: { pageId: string; title: string } }
```

**Server behavior on each message:**
1. Parse the message
2. Persist the change to SQLite
3. Broadcast the SAME message to ALL other clients on the same page (exclude sender)

**Broadcasting helper:**

```typescript
function broadcast(pageId: string, message: object, excludeClient?: WebSocket) {
  const clients = pageConnections.get(pageId);
  if (!clients) return;
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
```

**Presence tracking:**
- When a client joins or disconnects, broadcast `{ type: 'presence', count: N }` to all clients on that page
- This enables the PresenceIndicator component on the frontend

### 2.3 Server entry point (server/index.ts)

```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './ws';
import { setupRoutes } from './routes';

const app = express();
app.use(cors());
app.use(express.json());

setupRoutes(app);

const server = http.createServer(app);
setupWebSocket(server);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Server runs on port 3001, Next.js on port 3000.

---

## Phase 3: Frontend — Block Rendering & Editing

### 3.1 Page view (app/page/[id]/page.tsx)

On mount:
1. Fetch `GET /api/pages/:id` to get initial page + blocks
2. Establish WebSocket connection to `ws://localhost:3001`
3. Send `{ type: "join", pageId }` message
4. Render `<BlockList>` with fetched blocks
5. Listen for incoming WebSocket messages and update local state

### 3.2 useBlocks hook (hooks/useBlocks.ts)

This is the core state manager. It should:

- Hold `blocks` in state as an array sorted by `sort_order`
- Provide functions: `createBlock(afterBlockId?)`, `updateBlock(id, changes)`, `deleteBlock(id)`, `reorderBlock(id, newSortOrder)`
- Each function does TWO things:
  1. **Optimistically update local state immediately** (so UI feels instant)
  2. **Send the operation via WebSocket** (so server persists + broadcasts)
- Accept incoming WebSocket messages and merge them into state (for multiplayer)

**Important for multiplayer merging:** When receiving a `block:update` from another user, update the block in local state. When receiving `block:create`, insert it at the correct sort_order position. When receiving `block:delete`, remove it. When receiving `block:reorder`, update the sort_order and re-sort.

### 3.3 useWebSocket hook (hooks/useWebSocket.ts)

Manages the WebSocket lifecycle:

```typescript
function useWebSocket(url: string, onMessage: (msg: WSMessage) => void) {
  // Connect on mount
  // Parse incoming messages and call onMessage callback
  // Provide a `send(msg)` function for outbound messages
  // Reconnect with exponential backoff on disconnect (1s, 2s, 4s, max 10s)
  // Clean up on unmount
}
```

Return `{ send, isConnected, connectionCount }`.

### 3.4 Block component (components/Block.tsx)

Each block renders as:

```
[DragHandle] [contentEditable div] [StyleMenu]
```

**contentEditable behavior:**

- Use a `div` with `contentEditable={true}` and `suppressContentEditableWarning={true}`
- Set initial content via `dangerouslySetInnerHTML` ONLY on first render. After that, let the DOM own the text content and read from it on changes.
- **DO NOT** use a React-controlled pattern for contentEditable (setting innerHTML on every render). This causes cursor jumping. Instead:
  - Set initial HTML once
  - On `onInput`, read `e.currentTarget.textContent` and debounce-send the update
  - Only overwrite innerHTML when receiving an update FROM ANOTHER USER (via WebSocket), and only if the block is NOT currently focused by the local user

**Debounce saves:** Use a 300ms debounce on `onInput` so we don't send a WebSocket message on every keystroke. Save the full text content after 300ms of no typing.

**Style rendering:**
- `h1` → `<div>` with Tailwind classes `text-4xl font-bold`
- `h2` → `text-3xl font-bold`
- `h3` → `text-2xl font-semibold`
- `paragraph` → `text-base`

**Keyboard behavior:**
- `Enter` key: prevent default, create a new empty block below this one, focus it
- `Backspace` on an empty block: delete the block, focus the previous block
- These keyboard handlers make the editor feel like Notion

**Focus management:**
- When creating a new block, auto-focus it using a ref
- When deleting a block, focus the previous block
- Use `useRef` to hold a reference to each block's contentEditable div

### 3.5 BlockStyleMenu (components/BlockStyleMenu.tsx)

A small dropdown/popover that appears on click (or on hover of a button). Options:
- Paragraph (normal text)
- Heading 1
- Heading 2
- Heading 3

When user selects a style, call `updateBlock(id, { style: newStyle })`. The block re-renders with the new Tailwind classes.

Alternatively, implement a **slash command**: when the user types `/` at the beginning of an empty block, show a dropdown with options. Filter as they type (e.g., `/h1` shows "Heading 1"). This is more Notion-like and impressive.

### 3.6 AddBlockButton (components/AddBlockButton.tsx)

A `+` button that appears:
- At the bottom of the block list (always visible)
- Between blocks on hover (optional, nice-to-have)

On click, creates a new block with style "paragraph", empty content, and sort_order placed after the last block (or between blocks if using the hover version).

---

## Phase 4: Drag-and-Drop Reorder

Implement using native HTML5 drag-and-drop. Do NOT use dnd-kit or react-beautiful-dnd.

### 4.1 DragHandle component

A grip/drag icon (use ⋮⋮ or a 6-dot grid icon via CSS/SVG) on the left side of each block. Set `draggable={true}` on the block's wrapper div. The drag handle should be the visual affordance but the entire block row is the drag target.

### 4.2 Drag-and-drop implementation in BlockList

```
onDragStart(e, blockId):
  - Store the dragged blockId in state or dataTransfer
  - Set drag image / opacity

onDragOver(e, targetBlockId):
  - e.preventDefault() to allow drop
  - Determine if cursor is in top half or bottom half of target block
  - Show a visual drop indicator line (a 2px blue line) above or below the target block
  - Use state like `{ targetId: string, position: 'above' | 'below' }` to control the indicator

onDragEnd:
  - Clear drag state and indicator

onDrop(e, targetBlockId, position):
  - Calculate new sort_order:
    - If dropping ABOVE target: midpoint between target's previous sibling and target
    - If dropping BELOW target: midpoint between target and target's next sibling
    - If dropping at the very top: target.sort_order - 1.0
    - If dropping at the very bottom: target.sort_order + 1.0
  - Call reorderBlock(draggedId, newSortOrder)
  - This triggers optimistic update + WebSocket broadcast
```

### 4.3 Visual indicator

During drag, show a horizontal blue line (2px, full width) at the drop position. Use absolute positioning or a conditional border. Hide it on drag end.

---

## Phase 5: Multiplayer / Real-Time Sync

### 5.1 How it works end-to-end

1. User A types in a block → `onInput` fires → debounced 300ms → `block:update` sent via WebSocket
2. Server receives `block:update` → updates SQLite → broadcasts to User B
3. User B's `useWebSocket` receives the message → `useBlocks` updates state → Block re-renders with new content

### 5.2 Conflict handling

For this take-home, use **last-write-wins**. The server applies whatever it receives most recently. This is acceptable for a demo and avoids the complexity of OT/CRDTs.

**The one tricky case:** When User A is actively typing in a block and User B also edits that same block. The incoming update from B should NOT overwrite A's in-progress typing. Handle this with:

```typescript
// In Block.tsx — only apply remote updates if the block is NOT focused
function handleRemoteUpdate(blockId: string, newContent: string) {
  if (document.activeElement !== blockRef.current) {
    blockRef.current.textContent = newContent;
  }
  // If focused, ignore — local user's version takes priority until they blur
}
```

Add a code comment explaining this tradeoff and noting that production systems use OT or CRDTs for true concurrent editing.

### 5.3 Presence indicator (components/PresenceIndicator.tsx)

Show a small badge in the top-right corner: "🟢 2 users viewing" (or just a count). Driven by the `presence` WebSocket messages from the server. Simple but makes the multiplayer feel tangible.

### 5.4 Client ID

Generate a random `clientId` (UUID) on page load and store in `useRef`. Send it with the `join` message. This is used by the server to track connections. NOT used for user auth — this is just for connection management.

---

## Phase 6: Polish & README

### 6.1 UI polish

- Clean, minimal design. White background, subtle borders. Notion-like feel.
- Blocks should have a slight left padding and a hover state that reveals the drag handle and style menu
- Use a nice monospace or sans-serif font. Inter or system font stack.
- Page title at the top, editable with contentEditable, styled as a large heading
- Empty state: if no blocks exist, show a faint "Press '/' for commands or click '+' to add a block"
- Smooth transitions: blocks should animate when reordered (a simple 150ms CSS transition on transform/opacity)

### 6.2 Typography styles

```
h1: text-4xl font-bold text-gray-900 (36px bold)
h2: text-3xl font-bold text-gray-900 (30px bold)
h3: text-2xl font-semibold text-gray-800 (24px semibold)
paragraph: text-base text-gray-700 leading-relaxed (16px normal)
```

### 6.3 README.md

Write a clear README with these sections:

```markdown
# Mini-Notion Clone

A real-time collaborative block editor built as a take-home assessment.

## Quick Start

npm install        # Install root dependencies
npm run setup      # Install client + server dependencies
npm run seed       # Seed the database with sample content
npm run dev        # Start both client (port 3000) and server (port 3001)

Open http://localhost:3000 in two browser tabs to see real-time collaboration.

## Architecture Decisions

- **SQLite with float sort_order**: Blocks use floating-point sort_order for
  O(1) reordering without renumbering. New position = midpoint of neighbors.
  This is the same approach used by Notion, Linear, and Figma.

- **Operation-based sync over WebSocket**: Each edit is sent as a discrete
  operation. The server is the single source of truth — it persists to SQLite
  then broadcasts to all other clients. Simpler and more appropriate for this
  scope than CRDTs.

- **Optimistic updates**: UI updates immediately on user action without waiting
  for server confirmation. This makes the editor feel responsive.

- **contentEditable with controlled cursor**: Text editing uses native
  contentEditable divs. Remote updates are only applied when the block is not
  focused locally, preventing cursor jumping during concurrent edits.

- **Last-write-wins for conflicts**: Concurrent edits to the same block use
  last-write-wins semantics. In production, this would use Operational
  Transforms or CRDTs for true convergence.

## Tech Stack

- Next.js 14, React 18, TypeScript, Tailwind CSS
- Express, ws (WebSocket), better-sqlite3
- No prebuilt editor libraries

## What I'd Improve With More Time

- CRDT-based conflict resolution for character-level concurrent editing
- Cursor presence (show other users' cursor positions)
- Block-level permissions and user authentication
- Undo/redo with operation history stack
- More block types (images, code blocks, dividers, checklists)
- Offline support with operation queuing
```

---

## Extra Credit (Implement If Time Allows)

### Undo/Redo

Maintain a local operation stack in `useBlocks`:

```typescript
const [undoStack, setUndoStack] = useState<Operation[]>([]);
const [redoStack, setRedoStack] = useState<Operation[]>([]);
```

Each operation stores enough info to reverse it:
- `block:create` → undo is `block:delete` with the same ID
- `block:delete` → undo is `block:create` with the full block data (save it before deleting)
- `block:update` → undo is `block:update` with the previous content/style
- `block:reorder` → undo is `block:reorder` with the previous sort_order

`Cmd+Z` triggers undo (pop from undo stack, push to redo stack, apply inverse).
`Cmd+Shift+Z` triggers redo (pop from redo stack, push to undo stack, apply operation).

### Slash Command Menu

When user types `/` as the first character of an empty block:
- Show a floating dropdown positioned below the cursor
- Options: Heading 1, Heading 2, Heading 3, Paragraph, Divider
- Filter options as user types (e.g., `/h` shows only heading options)
- On select: clear the `/` text, apply the selected style, focus the block
- Dismiss on Escape or clicking outside

### Additional Block Types

- **Divider:** A block with `type: 'divider'` that renders as `<hr>` with no editable content
- **Checklist:** A block with `type: 'checklist'` that has a checkbox + text. Add a `checked` boolean column or store in a JSON metadata column.

---

## Testing Checklist (Before Submission)

Run through these scenarios manually:

1. ✅ Fresh start: `npm run setup && npm run seed && npm run dev` works with no errors
2. ✅ Blocks load and render with correct styles
3. ✅ Click a block, type text, it saves (refresh page to verify persistence)
4. ✅ Change block style via menu → renders with new style, persists
5. ✅ Press Enter at end of block → new block appears below, cursor moves to it
6. ✅ Press Backspace on empty block → block deletes, cursor moves to previous
7. ✅ Click "+" → new block appears at the bottom
8. ✅ Drag a block to a new position → order updates, persists on refresh
9. ✅ Open two tabs → edit in Tab A → change appears in Tab B within ~500ms
10. ✅ Open two tabs → create block in Tab A → appears in Tab B
11. ✅ Open two tabs → delete block in Tab A → disappears from Tab B
12. ✅ Open two tabs → reorder in Tab A → order updates in Tab B
13. ✅ Presence indicator shows correct count when opening/closing tabs
14. ✅ Server restart → client reconnects automatically
15. ✅ No console errors in browser or server terminal during normal use