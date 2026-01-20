import { useState, useEffect, useRef, useCallback } from 'react';
import Stomp from 'stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

const SOCKET_URL = 'http://localhost:9090/ws';

export const useSocket = (roomId, onMoveReceived) => {
    const [connected, setConnected] = useState(false);
    const stompClientRef = useRef(null);
    const callbackRef = useRef(onMoveReceived);

    // Update callback ref whenever it changes so the socket always calls the latest one
    // This allows us to remove onMoveReceived from the socket dependency array
    useEffect(() => {
        callbackRef.current = onMoveReceived;
    }, [onMoveReceived]);

    useEffect(() => {
        if (!roomId) return;

        const socket = new SockJS(SOCKET_URL);
        const stompClient = Stomp.over(socket);
        // stompClient.debug = null; // Disable debug logs

        stompClient.connect({}, () => {
            setConnected(true);

            // Subscribe to room topic
            stompClient.subscribe(`/topic/room/${roomId}`, (message) => {
                if (callbackRef.current) {
                    try {
                        const moveData = JSON.parse(message.body);
                        callbackRef.current(moveData);
                    } catch (e) {
                        console.error("Error parsing move:", e);
                    }
                }
            });
        }, (err) => {
            console.error('Socket error:', err);
            setConnected(false);
        });

        stompClientRef.current = stompClient;

        return () => {
            if (stompClientRef.current) {
                try {
                    // Only disconnect if connected to avoid InvalidStateError
                    if (stompClientRef.current.connected) {
                        stompClientRef.current.disconnect();
                    } else {
                        // If not connected yet, we might just need to close the underlying socket
                        // But stompjs usually handles this.
                        // Force close socket if needed
                        if (socket && socket.readyState !== WebSocket.CLOSED) {
                            socket.close();
                        }
                    }
                } catch (e) {
                    console.error("Error/Warning during cleanup:", e);
                }
            }
        };
    }, [roomId]); // CRITICAL: Do NOT include onMoveReceived here

    const sendMove = useCallback((move) => {
        if (stompClientRef.current && connected) {
            stompClientRef.current.send('/app/move', {}, JSON.stringify(move));
        }
    }, [connected]);

    return { connected, sendMove };
};
