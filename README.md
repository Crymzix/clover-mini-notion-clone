# Mini-Notion Clone

A real-time collaborative block editor. Pages are vertical stacks of text blocks that multiple users can edit simultaneously through WebSocket. Everything persists in SQLite and runs locally.

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

## How It Works

The app is split into two processes. The Next.js frontend runs on port 3000 and the Express backend runs on port 3001. They communicate through REST for initial data loading and WebSocket for all mutations.

When a user opens a page, the client fetches the page and its blocks via `GET /api/pages/:id`, then opens a WebSocket connection and sends a `join` message for that page. From that point on, every edit (typing, style changes, reordering, creating or deleting blocks) is sent as a WebSocket message. The server persists the change to SQLite and broadcasts it to all other clients viewing the same page. The sender never waits for confirmation. The UI updates optimistically so the editor always feels fast.

The home page also connects via WebSocket so that new pages created in another tab show up immediately without a refresh.

## Architecture Decisions

**Float-based sort order for blocks.** Each block has a `sort_order` column stored as a REAL. When reordering, I calculate the midpoint between the two neighbors rather than renumbering every block. This gives O(1) reorder operations. Notion, Linear, and Figma all use a similar approach.

**Operation-based sync over WebSocket.** Each edit is sent as a discrete operation (`block:create`, `block:update`, `block:delete`, `block:reorder`, `page:create`, `page:update_title`). The server is the single source of truth. It persists to SQLite then broadcasts to other clients. This is simpler than CRDTs and appropriate for this scope.

**Optimistic updates.** Every mutation updates local state immediately before sending the WebSocket message. The user never sees loading spinners for their own edits.

**contentEditable with focus-aware remote updates.** Text editing uses native `contentEditable` divs. The tricky part is handling concurrent edits without the cursor jumping around. I only apply remote content updates when the block is not currently focused by the local user. If someone else edits the same block you are typing in, their changes are ignored until you blur. This is a last-write-wins tradeoff. A production system would use OT or CRDTs for true character-level merging.

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
      block.tsx                  # Single block with contentEditable
      block-list.tsx             # Renders blocks, handles drag-and-drop
      presence-indicator.tsx     # Shows connected user count
      ui/                        # shadcn/ui components
    hooks/
      use-websocket.ts           # WebSocket connection management
      use-blocks.ts              # Block CRUD, optimistic updates, WS sync
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
- Undo/redo with an operation history stack
- More block types like images, code blocks, dividers, and checklists
- Offline support with operation queuing and replay
- Slash command menu for quickly changing block styles
