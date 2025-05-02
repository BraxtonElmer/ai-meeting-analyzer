import { useEffect, useState, useRef, useCallback } from 'react';
import { WebSocketMessage } from '@/types';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(
  meetingId?: number,
  options: UseWebSocketOptions = {}
) {
  // For inactive or completed meetings, we'll simulate a connected state
  // so UI won't show disconnection warnings
  const shouldSimulateConnection = meetingId === undefined;
  
  // Initialize connection state based on meeting status
  const [isConnected, setIsConnected] = useState(shouldSimulateConnection);
  const [error, setError] = useState<Event | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledOnCloseRef = useRef(false);
  
  // Track if this is the first mount to prevent unnecessary reconnection messages
  const isFirstMount = useRef(true);

  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect = false, // Turn off auto-reconnect by default
    reconnectInterval = 5000,
    maxReconnectAttempts = 3
  } = options;

  const connect = useCallback(() => {
    // Skip connection if meeting ID is undefined (completed meetings)
    if (meetingId === undefined) {
      return;
    }
    
    // Don't try to connect if we're in an error state from too many reconnect attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }
    
    // Close existing connection if any
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?meetingId=${meetingId}`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        hasCalledOnCloseRef.current = false;
        onOpen?.();
      });

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage?.(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      });

      socket.addEventListener('close', (event) => {
        setIsConnected(false);
        
        // Only call onClose callback once per connection session
        if (!hasCalledOnCloseRef.current) {
          onClose?.();
          hasCalledOnCloseRef.current = true;
        }

        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Exponential backoff for reconnect attempts
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
          reconnectIntervalRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        }
      });

      socket.addEventListener('error', (event) => {
        setError(event);
        onError?.(event);
      });
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      if (onError) {
        onError(err as Event);
      }
    }
  }, [meetingId, onMessage, onOpen, onClose, onError, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectIntervalRef.current) {
      clearTimeout(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // For inactive meetings, skip connection but maintain "connected" state
    if (shouldSimulateConnection) {
      setIsConnected(true);
      return () => {};
    }
    
    // Only attempt connection for active meetings
    connect();
    
    // Mark as no longer first mount after initial connection attempt
    isFirstMount.current = false;

    return () => {
      disconnect();
    };
  }, [connect, disconnect, shouldSimulateConnection]);

  return {
    isConnected,
    error,
    sendMessage,
    connect,
    disconnect
  };
}
