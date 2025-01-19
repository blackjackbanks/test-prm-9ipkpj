/**
 * Custom React hook for managing WebSocket connections with comprehensive connection management,
 * health monitoring, and message queueing capabilities.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { WebSocketService } from '../services/websocket';
import { WEBSOCKET_EVENTS } from '../constants/api';
import { Message } from '../types/chat';

// Connection configuration constants
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_INTERVAL = 5000;
const HEALTH_CHECK_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;
const MAX_QUEUE_SIZE = 1000;

/**
 * WebSocket error interface for standardized error handling
 */
interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * WebSocket hook configuration interface
 */
interface WebSocketConfig {
  url: string;
  token: string;
  onMessage: (message: Message) => void;
  onError?: (error: WebSocketError) => void;
}

/**
 * Custom hook for managing WebSocket connections
 */
export function useWebSocket({
  url,
  token,
  onMessage,
  onError
}: WebSocketConfig) {
  // Connection state management
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [messageQueue, setMessageQueue] = useState<Message[]>([]);
  const [wsService, setWsService] = useState<WebSocketService | null>(null);

  /**
   * Initialize WebSocket service with configuration
   */
  useEffect(() => {
    const service = new WebSocketService(url, {
      reconnectMaxAttempts: RECONNECT_ATTEMPTS,
      reconnectInterval: RECONNECT_INTERVAL,
      pingInterval: HEALTH_CHECK_INTERVAL,
      connectionTimeout: CONNECTION_TIMEOUT
    });

    setWsService(service);

    return () => {
      service.disconnect();
    };
  }, [url]);

  /**
   * Set up WebSocket event listeners
   */
  useEffect(() => {
    if (!wsService) return;

    wsService.on(WEBSOCKET_EVENTS.CONNECT, () => {
      setConnected(true);
      setConnecting(false);
      setReconnecting(false);
      setError(null);
    });

    wsService.on(WEBSOCKET_EVENTS.DISCONNECT, (reason: string) => {
      setConnected(false);
      setError({
        code: 'DISCONNECTED',
        message: reason,
        timestamp: new Date()
      });
    });

    wsService.on(WEBSOCKET_EVENTS.MESSAGE, ({ type, message }) => {
      if (type === 'received') {
        onMessage(message);
      }
    });

    wsService.on(WEBSOCKET_EVENTS.ERROR, (wsError: Error) => {
      const error: WebSocketError = {
        code: 'WS_ERROR',
        message: wsError.message,
        timestamp: new Date(),
        details: { originalError: wsError }
      };
      setError(error);
      onError?.(error);
    });

    wsService.on(WEBSOCKET_EVENTS.RECONNECT, ({ attempt, maxAttempts }) => {
      setReconnecting(true);
      setError({
        code: 'RECONNECTING',
        message: `Reconnection attempt ${attempt}/${maxAttempts}`,
        timestamp: new Date()
      });
    });

    wsService.on(WEBSOCKET_EVENTS.HEALTH_CHECK, ({ latency }) => {
      if (latency > 5000) {
        setError({
          code: 'HIGH_LATENCY',
          message: `High latency detected: ${latency}ms`,
          timestamp: new Date()
        });
      }
    });

    return () => {
      wsService.off(WEBSOCKET_EVENTS.CONNECT, () => {});
      wsService.off(WEBSOCKET_EVENTS.DISCONNECT, () => {});
      wsService.off(WEBSOCKET_EVENTS.MESSAGE, () => {});
      wsService.off(WEBSOCKET_EVENTS.ERROR, () => {});
      wsService.off(WEBSOCKET_EVENTS.RECONNECT, () => {});
      wsService.off(WEBSOCKET_EVENTS.HEALTH_CHECK, () => {});
    };
  }, [wsService, onMessage, onError]);

  /**
   * Establish initial connection
   */
  useEffect(() => {
    if (!wsService || !token) return;

    const connect = async () => {
      try {
        setConnecting(true);
        await wsService.connect();
      } catch (err) {
        setConnecting(false);
        setError({
          code: 'CONNECTION_FAILED',
          message: 'Failed to establish WebSocket connection',
          timestamp: new Date(),
          details: { error: err }
        });
      }
    };

    connect();
  }, [wsService, token]);

  /**
   * Send message with queue management
   */
  const sendMessage = useCallback(async (message: Message) => {
    if (!wsService) return;

    try {
      if (!connected) {
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
          throw new Error('Message queue full');
        }
        setMessageQueue(prev => [...prev, message]);
        return;
      }

      await wsService.sendMessage(message);
    } catch (err) {
      const error: WebSocketError = {
        code: 'SEND_ERROR',
        message: 'Failed to send message',
        timestamp: new Date(),
        details: { error: err }
      };
      setError(error);
      onError?.(error);
    }
  }, [wsService, connected, messageQueue, onError]);

  /**
   * Manual disconnect
   */
  const disconnect = useCallback(() => {
    wsService?.disconnect();
  }, [wsService]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(async () => {
    if (!wsService) return;

    try {
      setReconnecting(true);
      await wsService.reconnect();
    } catch (err) {
      setError({
        code: 'RECONNECT_FAILED',
        message: 'Failed to reconnect',
        timestamp: new Date(),
        details: { error: err }
      });
    }
  }, [wsService]);

  /**
   * Clear current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    connected,
    connecting,
    reconnecting,
    error,
    messageQueue,
    sendMessage,
    disconnect,
    reconnect,
    clearError
  };
}