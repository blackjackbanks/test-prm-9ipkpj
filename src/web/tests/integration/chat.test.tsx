import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { configureStore } from '@reduxjs/toolkit';
import { Server } from 'mock-socket';
import { axe, toHaveNoViolations } from 'jest-axe';

import ChatWindow from '../../src/components/chat/ChatWindow';
import { chatReducer } from '../../store/slices/chatSlice';
import { lightTheme } from '../../styles/theme';
import { MessageType, MessageStatus } from '../../types/chat';
import { WEBSOCKET_EVENTS } from '../../constants/api';

expect.extend(toHaveNoViolations);

// Mock WebSocket URL for testing
const MOCK_WS_URL = 'ws://localhost:1234';

describe('ChatWindow Integration Tests', () => {
  let mockWebSocketServer: Server;
  let store: any;

  // Setup test environment before each test
  beforeEach(() => {
    // Configure mock WebSocket server
    mockWebSocketServer = new Server(MOCK_WS_URL);
    
    // Configure Redux store with initial state
    store = configureStore({
      reducer: {
        chat: chatReducer,
        auth: () => ({ token: 'mock-token' })
      }
    });

    // Configure environment variables
    process.env.REACT_APP_WS_URL = MOCK_WS_URL;
  });

  // Cleanup after each test
  afterEach(() => {
    mockWebSocketServer.close();
    jest.clearAllMocks();
  });

  // Helper function to render ChatWindow with required providers
  const renderChatWindow = () => {
    return render(
      <Provider store={store}>
        <ThemeProvider theme={lightTheme}>
          <ChatWindow
            theme="light"
            locale="en"
            accessibility={{
              screenReader: true,
              highContrast: false,
              reducedMotion: false
            }}
          />
        </ThemeProvider>
      </Provider>
    );
  };

  describe('WebSocket Connectivity', () => {
    it('should establish WebSocket connection on mount', async () => {
      renderChatWindow();

      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });
    });

    it('should handle connection failures gracefully', async () => {
      mockWebSocketServer.close();
      renderChatWindow();

      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });
    });

    it('should reconnect automatically when connection is lost', async () => {
      renderChatWindow();
      
      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });

      mockWebSocketServer.close();
      mockWebSocketServer = new Server(MOCK_WS_URL);

      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });
    });
  });

  describe('Message Handling', () => {
    it('should send and receive messages', async () => {
      renderChatWindow();
      const user = userEvent.setup();

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });

      // Setup message handler
      mockWebSocketServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          const message = JSON.parse(data.toString());
          socket.send(JSON.stringify({
            type: WEBSOCKET_EVENTS.MESSAGE,
            message: {
              id: 'response-1',
              type: MessageType.AI,
              content: 'Test response',
              status: MessageStatus.DELIVERED
            }
          }));
        });
      });

      // Send a message
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Verify message was sent and response received
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
        expect(screen.getByText('Test response')).toBeInTheDocument();
      });
    });

    it('should handle message queuing during offline state', async () => {
      renderChatWindow();
      const user = userEvent.setup();

      mockWebSocketServer.close();

      // Attempt to send message while offline
      const input = screen.getByRole('textbox');
      await user.type(input, 'Offline message');
      await user.keyboard('{Enter}');

      // Verify message is marked as error
      await waitFor(() => {
        const message = screen.getByText('Offline message');
        expect(message).toBeInTheDocument();
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      // Restore connection
      mockWebSocketServer = new Server(MOCK_WS_URL);

      // Verify message is retried
      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });
    });
  });

  describe('File Attachments', () => {
    it('should handle file uploads', async () => {
      renderChatWindow();
      const user = userEvent.setup();

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/file upload/i);

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    it('should enforce file size limits', async () => {
      renderChatWindow();
      const user = userEvent.setup();

      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/file upload/i);

      await user.upload(input, largeFile);

      await waitFor(() => {
        expect(screen.getByText(/exceeds maximum size/i)).toBeInTheDocument();
      });
    });
  });

  describe('Context Awareness', () => {
    it('should display current context information', async () => {
      store.dispatch({
        type: 'chat/setContext',
        payload: {
          projectId: 'test-project',
          templateId: 'test-template',
          activeIntegrations: ['crm', 'docs']
        }
      });

      renderChatWindow();

      await waitFor(() => {
        expect(screen.getByText(/test-project/i)).toBeInTheDocument();
        expect(screen.getByText(/test-template/i)).toBeInTheDocument();
        expect(screen.getByText(/2 connected/i)).toBeInTheDocument();
      });
    });

    it('should update context in real-time', async () => {
      renderChatWindow();

      await waitFor(() => {
        expect(mockWebSocketServer.clients()).toHaveLength(1);
      });

      mockWebSocketServer.clients()[0].send(JSON.stringify({
        type: WEBSOCKET_EVENTS.CONTEXT_UPDATE,
        data: {
          projectId: 'updated-project',
          templateId: 'updated-template',
          activeIntegrations: ['crm']
        }
      }));

      await waitFor(() => {
        expect(screen.getByText(/updated-project/i)).toBeInTheDocument();
        expect(screen.getByText(/updated-template/i)).toBeInTheDocument();
        expect(screen.getByText(/1 connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 AA requirements', async () => {
      const { container } = renderChatWindow();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderChatWindow();
      const user = userEvent.setup();

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/file upload/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /send/i })).toHaveFocus();
    });

    it('should announce new messages to screen readers', async () => {
      renderChatWindow();

      mockWebSocketServer.clients()[0].send(JSON.stringify({
        type: WEBSOCKET_EVENTS.MESSAGE,
        message: {
          id: 'msg-1',
          type: MessageType.AI,
          content: 'Screen reader test',
          status: MessageStatus.DELIVERED
        }
      }));

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/new message/i);
      });
    });
  });
});