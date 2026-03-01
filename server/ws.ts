import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { queries } from './db';

type WSMessage =
    | { type: 'join'; pageId: string; clientId: string }
    | { type: 'block:create'; payload: { id: string; pageId: string; content: string; style: string; sort_order: number } }
    | { type: 'block:update'; payload: { id: string; content?: string; style?: string } }
    | { type: 'block:delete'; payload: { id: string } }
    | { type: 'block:reorder'; payload: { id: string; sort_order: number } }
    | { type: 'page:create'; payload: { id: string; title: string } }
    | { type: 'page:update_title'; payload: { pageId: string; title: string } };

// All connected clients (for global broadcasts like page:create)
const allClients = new Set<WebSocket>();
// Map pageId → set of connected clients
const pageConnections = new Map<string, Set<WebSocket>>();
// Map client → pageId (for cleanup on disconnect)
const clientPages = new Map<WebSocket, string>();

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

function broadcastAll(message: object, excludeClient?: WebSocket) {
    const data = JSON.stringify(message);
    for (const client of allClients) {
        if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

function broadcastPresence(pageId: string) {
    const clients = pageConnections.get(pageId);
    const count = clients ? clients.size : 0;
    broadcast(pageId, { type: 'presence', count });
}

function removeClient(ws: WebSocket) {
    const pageId = clientPages.get(ws);
    if (pageId) {
        const clients = pageConnections.get(pageId);
        if (clients) {
            clients.delete(ws);
            if (clients.size === 0) {
                pageConnections.delete(pageId);
            } else {
                broadcastPresence(pageId);
            }
        }
        clientPages.delete(ws);
    }
}

function handleMessage(ws: WebSocket, msg: WSMessage) {
    switch (msg.type) {
        case 'join': {
            // Remove from any previous page
            removeClient(ws);

            const { pageId } = msg;
            if (!pageConnections.has(pageId)) {
                pageConnections.set(pageId, new Set());
            }
            pageConnections.get(pageId)!.add(ws);
            clientPages.set(ws, pageId);

            // Send presence count to all clients including the new one
            broadcastPresence(pageId);
            break;
        }

        case 'block:create': {
            const { id, pageId, content, style, sort_order } = msg.payload;
            queries.createBlock.run(id, pageId, 'text', content, style, sort_order);
            const clientPageId = clientPages.get(ws);
            if (clientPageId) {
                broadcast(clientPageId, msg, ws);
            }
            break;
        }

        case 'block:update': {
            const { id, content, style } = msg.payload;
            if (content !== undefined && style !== undefined) {
                queries.updateBlockContentAndStyle.run(content, style, id);
            } else if (content !== undefined) {
                queries.updateBlockContent.run(content, id);
            } else if (style !== undefined) {
                queries.updateBlockStyle.run(style, id);
            }
            const clientPageId = clientPages.get(ws);
            if (clientPageId) {
                broadcast(clientPageId, msg, ws);
            }
            break;
        }

        case 'block:delete': {
            const { id } = msg.payload;
            queries.deleteBlock.run(id);
            const clientPageId = clientPages.get(ws);
            if (clientPageId) {
                broadcast(clientPageId, msg, ws);
            }
            break;
        }

        case 'block:reorder': {
            const { id, sort_order } = msg.payload;
            queries.updateBlockSortOrder.run(sort_order, id);
            const clientPageId = clientPages.get(ws);
            if (clientPageId) {
                broadcast(clientPageId, msg, ws);
            }
            break;
        }

        case 'page:create': {
            const { id, title } = msg.payload;
            queries.createPage.run(id, title);
            broadcastAll(msg, ws);
            break;
        }

        case 'page:update_title': {
            const { pageId, title } = msg.payload;
            queries.updatePageTitle.run(title, pageId);
            broadcastAll(msg, ws);
            break;
        }
    }
}

export function setupWebSocket(server: HTTPServer) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        allClients.add(ws);

        ws.on('message', (raw) => {
            try {
                const msg: WSMessage = JSON.parse(raw.toString());
                handleMessage(ws, msg);
            } catch (err) {
                console.error('Invalid WebSocket message:', err);
            }
        });

        ws.on('close', () => {
            allClients.delete(ws);
            removeClient(ws);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            allClients.delete(ws);
            removeClient(ws);
        });
    });

    console.log('WebSocket server attached');
}
