import { useEffect, useState, useRef, useCallback } from 'react';
import { WebSocketMessage } from '@/types';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(
  meetingId?: number | null,
  options: UseWebSocketOptions = {}
) {
  // For inactive or completed meetings, we'll simulate a connected state
  // so UI won't show disconnection warnings
  const shouldSimulateConnection = meetingId === undefined || meetingId === null;
  
  // Initialize connection state based on meeting status
  const [isConnected, setIsConnected] = useState(shouldSimulateConnection);
  const [error, setError] = useState<any | null>(null);
  const socketRef = useRef<Socket | null>(null);
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
    // Skip connection if meeting ID is undefined or null
    if (meetingId === undefined || meetingId === null) {
      console.log("Skipping WebSocket connection - no valid meeting ID");
      return;
    }
    
    // Don't try to connect if we're in an error state from too many reconnect attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }
    
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }    try {      // Connect to the WebSocket server
      // Use port 5050 for the Flask server
      console.log(`Connecting to WebSocket server for meeting ID: ${meetingId}`);
      const socket = io('http://localhost:5050', {
        path: '/socket.io', // Default Socket.IO path
        transports: ['websocket', 'polling'], // Support both websocket and polling
        autoConnect: true,
        reconnection: true, // Always enable reconnection
        reconnectionAttempts: 10, // More attempts
        reconnectionDelay: 1000, // Start with 1 second
        reconnectionDelayMax: 10000, // Max of 10 seconds
        timeout: 20000, // Longer timeout
      });
      
      socketRef.current = socket;      // Join the meeting room
      console.log(`Emitting join event for meeting ID: ${meetingId}`);
      socket.emit('join', { meetingId: String(meetingId) });

      socket.on('connect', () => {
        console.log(`WebSocket connected for meeting ID: ${meetingId}`);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        hasCalledOnCloseRef.current = false;
        onOpen?.();
      });      socket.on('join_confirmation', (data) => {
        console.log('Received join confirmation:', data);
      });
        socket.on('transcription', (message) => {
        console.log('Received transcription message:', JSON.stringify(message));
        try {
          // Pass the message to the handler in the correct format
          onMessage?.(message);
        } catch (err) {
          console.error('Failed to process WebSocket message:', err);
        }
      });
      
      // Listen for welcome messages
      socket.on('welcome', (data) => {
        console.log('Received welcome message:', data);
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Only call onClose callback once per connection session
        if (!hasCalledOnCloseRef.current) {
          onClose?.();
          hasCalledOnCloseRef.current = true;
        }
      });

      socket.on('connect_error', (error) => {
        setError(error);
        onError?.(error);
        
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Exponential backoff for reconnect attempts
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
          reconnectIntervalRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        }
      });
    } catch (err) {
      setError(err);
      onError?.(err);
    }
  }, [meetingId, autoReconnect, maxReconnectAttempts, onOpen, onMessage, onClose, onError, reconnectInterval]);
  
  // Clean up on unmount
  useEffect(() => {
    isFirstMount.current = false;
    
    // For inactive or completed meetings, don't attempt connection
    if (shouldSimulateConnection) {
      return;
    }
    
    connect();
    
    // Clean up on unmount
    return () => {
      if (reconnectIntervalRef.current) {
        clearTimeout(reconnectIntervalRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect, shouldSimulateConnection]);

  // Expose a function to manually send messages
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message', message);
      return true;
    }
    return false;
  }, [isConnected]);

  return {
    isConnected,
    error,
    sendMessage
  };
}
