import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { mockWebSocket } from '../../src/utils/testing';
import { WEBSOCKET_EVENTS } from '../../src/constants/api';
import { MessageType, MessageStatus } from '../../src/types/chat';

// Test constants
const WEBSOCKET_URL = 'wss://api.coreos.com/ws';
const TEST_TOKEN = 'test-auth-token';
const RECONNECT_INTERVAL = 5000;
const CONNECTION_TIMEOUT = 10000;

describe('useWebSocket Hook', () => {
  let mockWs: ReturnType<typeof mockWebSocket>;
  const onMessage = jest.fn();
  const onError = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockWs = mockWebSocket({ url: WEBSOCKET_URL });
    // @ts-ignore - Mock WebSocket global
    global.WebSocket = jest.fn(() => mockWs);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Connection Lifecycle', () => {
    it('should initialize in disconnected state', () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      expect(result.current.connected).toBe(false);
      expect(result.current.connecting).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle successful connection', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.connecting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle connection failure', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new ErrorEvent('error', { 
          error: new Error('Connection failed')
        }));
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toMatchObject({
        code: 'WS_ERROR',
        message: expect.any(String)
      });
    });

    it('should handle disconnection', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        mockWs.dispatchEvent(new CloseEvent('close'));
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toMatchObject({
        code: 'DISCONNECTED',
        message: expect.any(String)
      });
    });

    it('should attempt reconnection on unexpected closure', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        mockWs.dispatchEvent(new CloseEvent('close', { code: 1006 }));
        jest.advanceTimersByTime(RECONNECT_INTERVAL);
      });

      expect(result.current.reconnecting).toBe(true);
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should handle connection timeout', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        jest.advanceTimersByTime(CONNECTION_TIMEOUT);
      });

      expect(result.current.error).toMatchObject({
        code: 'CONNECTION_FAILED',
        message: expect.any(String)
      });
    });
  });

  describe('Message Handling', () => {
    const testMessage = {
      id: 'msg_123',
      type: MessageType.USER,
      content: 'Test message',
      status: MessageStatus.SENDING,
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    it('should send messages when connected', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        await result.current.sendMessage(testMessage);
      });

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining(testMessage.content));
    });

    it('should queue messages when disconnected', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        await result.current.sendMessage(testMessage);
      });

      expect(result.current.messageQueue).toContain(testMessage);
    });

    it('should process queued messages upon reconnection', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        await result.current.sendMessage(testMessage);
        mockWs.dispatchEvent(new Event('open'));
      });

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining(testMessage.content));
      expect(result.current.messageQueue).toHaveLength(0);
    });

    it('should handle received messages', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        mockWs.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify(testMessage)
        }));
      });

      expect(onMessage).toHaveBeenCalledWith(testMessage);
    });

    it('should handle message send errors', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      mockWs.send = jest.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        await result.current.sendMessage(testMessage);
      });

      expect(result.current.error).toMatchObject({
        code: 'SEND_ERROR',
        message: expect.any(String)
      });
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      unmount();

      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should handle manual disconnect', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new Event('open'));
        result.current.disconnect();
      });

      expect(mockWs.close).toHaveBeenCalled();
      expect(result.current.connected).toBe(false);
    });

    it('should clear error state', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ url: WEBSOCKET_URL, token: TEST_TOKEN, onMessage, onError })
      );

      await act(async () => {
        mockWs.dispatchEvent(new ErrorEvent('error', { 
          error: new Error('Test error')
        }));
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});