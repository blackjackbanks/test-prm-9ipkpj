/**
 * Advanced WebSocket service for managing real-time communication with comprehensive
 * connection lifecycle management, automatic reconnection, and message handling.
 * @version 1.0.0
 */

import { EventEmitter } from 'events'; // v3.3.0
import { WEBSOCKET_EVENTS } from '../constants/api';
import { Message } from '../types/chat';

// Connection configuration constants
const RECONNECT_MAX_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 3000;
const PING_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 10000;
const MAX_MESSAGE_SIZE = 1048576; // 1MB

/**
 * Configuration interface for WebSocket service
 */
interface WebSocketConfig {
  reconnectMaxAttempts?: number;
  reconnectInterval?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  maxMessageSize?: number;
}

/**
 * Advanced WebSocket service class for managing real-time communication
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private eventEmitter: EventEmitter;
  private messageQueue: Message[] = [];
  private pingTimer: NodeJS.Timer | null = null;
  private connectionTimer: NodeJS.Timer | null = null;
  private lastPingTime: number = 0;
  private config: WebSocketConfig;

  /**
   * Initialize WebSocket service with connection URL and optional configuration
   */
  constructor(url: string, config: WebSocketConfig = {}) {
    if (!url) {
      throw new Error('WebSocket URL is required');
    }

    this.url = url;
    this.eventEmitter = new EventEmitter();
    this.config = {
      reconnectMaxAttempts: config.reconnectMaxAttempts || RECONNECT_MAX_ATTEMPTS,
      reconnectInterval: config.reconnectInterval || RECONNECT_INTERVAL,
      pingInterval: config.pingInterval || PING_INTERVAL,
      connectionTimeout: config.connectionTimeout || CONNECTION_TIMEOUT,
      maxMessageSize: config.maxMessageSize || MAX_MESSAGE_SIZE
    };
  }

  /**
   * Establish WebSocket connection with automatic reconnection and timeout handling
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        // Set up connection timeout
        this.connectionTimer = setTimeout(() => {
          if (!this.connected) {
            this.handleConnectionError(new Error('Connection timeout'));
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.clearConnectionTimer();
          this.setupPingInterval();
          this.processMessageQueue();
          this.eventEmitter.emit(WEBSOCKET_EVENTS.CONNECT);
          resolve();
        };

        this.ws.onclose = (event) => {
          this.handleDisconnect(event);
        };

        this.ws.onerror = (error) => {
          this.handleConnectionError(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

      } catch (error) {
        this.handleConnectionError(error);
        reject(error);
      }
    });
  }

  /**
   * Close WebSocket connection gracefully with cleanup
   */
  public disconnect(): void {
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.eventEmitter.emit(WEBSOCKET_EVENTS.DISCONNECT, 'Client disconnected');
  }

  /**
   * Attempt to reconnect with exponential backoff strategy
   */
  public async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
      this.eventEmitter.emit(WEBSOCKET_EVENTS.ERROR, new Error('Max reconnection attempts reached'));
      return;
    }

    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.eventEmitter.emit(WEBSOCKET_EVENTS.RECONNECT, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.reconnectMaxAttempts
    });

    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    return this.connect();
  }

  /**
   * Send message through WebSocket with queuing and retry support
   */
  public async sendMessage(message: Message): Promise<void> {
    if (!message.content || message.content.length > this.config.maxMessageSize) {
      throw new Error('Invalid message size');
    }

    const messageWithMetadata = {
      ...message,
      timestamp: Date.now()
    };

    if (!this.connected) {
      this.messageQueue.push(messageWithMetadata);
      return;
    }

    try {
      this.ws?.send(JSON.stringify(messageWithMetadata));
      this.eventEmitter.emit(WEBSOCKET_EVENTS.MESSAGE, {
        type: 'sent',
        message: messageWithMetadata
      });
    } catch (error) {
      this.messageQueue.push(messageWithMetadata);
      this.eventEmitter.emit(WEBSOCKET_EVENTS.ERROR, error);
      throw error;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Process queued messages after reconnection
   */
  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.connected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.sendMessage(message);
      }
    }
  }

  /**
   * Handle WebSocket connection errors
   */
  private handleConnectionError(error: any): void {
    this.connected = false;
    this.clearTimers();
    this.eventEmitter.emit(WEBSOCKET_EVENTS.ERROR, error);
    this.reconnect();
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(event: CloseEvent): void {
    this.connected = false;
    this.clearTimers();
    this.eventEmitter.emit(WEBSOCKET_EVENTS.DISCONNECT, event.reason);
    
    if (event.code !== 1000) {
      this.reconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'pong') {
        this.handlePong();
        return;
      }

      this.eventEmitter.emit(WEBSOCKET_EVENTS.MESSAGE, {
        type: 'received',
        message
      });
    } catch (error) {
      this.eventEmitter.emit(WEBSOCKET_EVENTS.ERROR, error);
    }
  }

  /**
   * Set up ping interval for connection health monitoring
   */
  private setupPingInterval(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        this.lastPingTime = Date.now();
      }
    }, this.config.pingInterval);
  }

  /**
   * Handle pong response for connection health monitoring
   */
  private handlePong(): void {
    const latency = Date.now() - this.lastPingTime;
    this.eventEmitter.emit(WEBSOCKET_EVENTS.HEALTH_CHECK, { latency });
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearPingTimer();
    this.clearConnectionTimer();
  }

  /**
   * Clear ping timer
   */
  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Clear connection timer
   */
  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }
}