# Mini-Notion Clone

A real-time collaborative block editor. Pages are vertical stacks of blocks that multiple users can edit simultaneously through WebSocket. Everything persists in SQLite and runs locally.

## Quick Start

```
npm install        # Install root dependencies
npm run setup      # Install client + server dependencies
npm run seed       # Seed the database with sample content
npm run dev        # Start both client (port 3000) and server (port 3001)
```

Open http://localhost:3000 in two browser tabs to see real-time collaboration.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Express with `ws` (WebSocket) + REST, SQLite via `better-sqlite3`
- **No prebuilt editor libraries.** All editing is handled manually with `contentEditable`.
- **No Socket.io.** WebSocket is implemented directly with the `ws` package.

## Features

**Block types.** The editor supports three block types. Text blocks can be styled as headings (H1, H2, H3) or paragraph text. Divider blocks render as a horizontal rule for visual separation. Checklist blocks have a checkbox next to editable text, and clicking the checkbox toggles strikethrough styling. All block types can be dragged to reorder and are fully synced across clients.

**Real-time collaboration.** Open the same page in multiple tabs or browsers and every change syncs instantly. Typing, style changes, reordering, creating blocks, deleting blocks, and toggling checkboxes all broadcast to other clients. The home page list also updates in real time when pages are created or renamed from another tab.

**Undo and redo.** Press Cmd+Z (or Ctrl+Z) to undo and Cmd+Shift+Z (or Ctrl+Shift+Z) to redo. Every operation is tracked: creating, deleting, editing, reordering, and toggling checkboxes. Undo and redo actions are also sent through WebSocket so they persist on the server and sync to other clients.

**Drag-and-drop reordering.** Blocks can be reordered by dragging the grip handle on the left side. A blue drop indicator shows where the block will land. The new position is calculated using float midpoints so reordering is always O(1) without renumbering.

**Keyboard shortcuts.** Enter creates a new block below the current one and focuses it. If you are in a checklist block, Enter creates another checklist block. Backspace on an empty block deletes it and moves focus to the previous block. Arrow keys navigate between blocks when the cursor is at the start or end of a block.

## How It Works

The app is split into two processes. The Next.js frontend runs on port 3000 and the Express backend runs on port 3001. They communicate through REST for initial data loading and WebSocket for all mutations.

When a user opens a page, the client fetches the page and its blocks via `GET /api/pages/:id`, then opens a WebSocket connection and sends a `join` message for that page. From that point on, every edit is sent as a WebSocket message. The server persists the change to SQLite and broadcasts it to all other clients viewing the same page. The sender never waits for confirmation. The UI updates optimistically so the editor always feels fast.

The home page also connects via WebSocket so that new pages created in another tab show up immediately without a refresh.

## Architecture Decisions

**Float-based sort order for blocks.** Each block has a `sort_order` column stored as a REAL. When reordering, I calculate the midpoint between the two neighbors rather than renumbering every block. This gives O(1) reorder operations. Notion, Linear, and Figma all use a similar approach.

**Operation-based sync over WebSocket.** Each edit is sent as a discrete operation (`block:create`, `block:update`, `block:delete`, `block:reorder`, `block:toggle_checked`, `page:create`, `page:update_title`). The server is the single source of truth. It persists to SQLite then broadcasts to other clients. This is simpler than CRDTs and appropriate for this scope.

**Optimistic updates.** Every mutation updates local state immediately before sending the WebSocket message. The user never sees loading spinners for their own edits.

**contentEditable with focus-aware remote updates.** Text editing uses native `contentEditable` divs. The tricky part is handling concurrent edits without the cursor jumping around. I only apply remote content updates when the block is not currently focused by the local user. If someone else edits the same block you are typing in, their changes are ignored until you blur. This is a last-write-wins tradeoff. A production system would use OT or CRDTs for true character-level merging.

**Undo/redo with an operation stack.** I maintain undo and redo stacks as refs in the `useBlocks` hook. Each user action pushes an entry to the undo stack that captures enough state to reverse it. For example, deleting a block saves a full copy of the block data so it can be re-created on undo. Performing a new action clears the redo stack. Undo and redo both send the inverse operation through WebSocket so the server stays in sync.

**Debounced saves.** Content updates are debounced by 300ms so we are not sending a WebSocket message on every single keystroke.

**Presence tracking.** The server tracks how many clients are connected to each page and broadcasts a count whenever someone joins or leaves. The frontend shows this as a simple indicator in the header.

**Reconnection with exponential backoff.** If the WebSocket connection drops, the client automatically retries with delays of 1s, 2s, 4s, up to a max of 10s.

## Project Structure

```
mini-notion-clone/
  client/                        # Next.js frontend
    app/
      layout.tsx                 # Root layout with fonts
      page.tsx                   # Home page, lists all pages
      page/[id]/page.tsx         # Page editor with block list
    components/
      block.tsx                  # Single block (text, divider, checklist)
      block-list.tsx             # Renders blocks, drag-and-drop, add menu
      presence-indicator.tsx     # Shows connected user count
      ui/                        # shadcn/ui components
    hooks/
      use-websocket.ts           # WebSocket connection management
      use-blocks.ts              # Block CRUD, undo/redo, optimistic updates
    lib/
      types.ts                   # Shared TypeScript types
      utils.ts                   # Tailwind merge helper
  server/
    index.ts                     # Express + WebSocket entry point
    db.ts                        # SQLite schema and prepared queries
    ws.ts                        # WebSocket message handling and broadcast
    routes.ts                    # REST endpoints for initial data load
    seed.ts                      # Seeds a sample page with blocks
```

## What I Would Improve With More Time

- CRDT-based conflict resolution for character-level concurrent editing
- Cursor presence showing where other users are typing
- User authentication and per-page permissions
- More block types like images, code blocks, and embeds
- Offline support with operation queuing and replay
- Slash command menu for quickly inserting block types
- Page deletion with confirmation
