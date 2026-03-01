'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage } from '@/lib/types';

export function useWebSocket(url: string, onMessage: (msg: WSMessage) => void) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionCount, setConnectionCount] = useState(0);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelay = useRef(1000);

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        const socket = new WebSocket(url);

        socket.onopen = () => {
            console.log('Connected to WebSocket server');
            setIsConnected(true);
            reconnectDelay.current = 1000; // Reset reconnect delay
        };

        socket.onmessage = (event) => {
            try {
                const msg: WSMessage = JSON.parse(event.data);
                if (msg.type === 'presence') {
                    setConnectionCount(msg.count);
                }
                onMessage(msg);
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        socket.onclose = () => {
            console.log('Disconnected from WebSocket server');
            setIsConnected(false);
            // Attempt reconnection with exponential backoff
            reconnectTimeout.current = setTimeout(() => {
                reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
                connect();
            }, reconnectDelay.current);
        };

        socket.onerror = (err) => {
            console.error('WebSocket error:', err);
            socket.close();
        };

        ws.current = socket;
    }, [url, onMessage]);

    const send = useCallback((msg: WSMessage) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(msg));
        } else {
            console.warn('WebSocket is not connected. Message not sent:', msg);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (ws.current) ws.current.close();
        };
    }, [connect]);

    return { send, isConnected, connectionCount };
}
