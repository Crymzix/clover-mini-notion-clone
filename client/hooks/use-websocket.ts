'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage } from '../lib/types';

export function useWebSocket(url: string, onMessage: (msg: WSMessage) => void) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionCount, setConnectionCount] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(1000);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
            setIsConnected(true);
            reconnectDelayRef.current = 1000;
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as WSMessage;
                if (message.type === 'presence') {
                    setConnectionCount(message.count);
                } else {
                    onMessage(message);
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
            setIsConnected(false);
            setConnectionCount(0);

            // Reconnect with exponential backoff
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
                reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 10000);
            }, reconnectDelayRef.current);
        };

        wsRef.current = ws;
    }, [url, onMessage]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    const send = useCallback((message: WSMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message: WebSocket is not open');
        }
    }, []);

    return { send, isConnected, connectionCount };
}
