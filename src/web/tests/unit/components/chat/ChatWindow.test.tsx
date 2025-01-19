import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { mockDeep, MockProxy } from 'jest-mock-extended';
import ChatWindow from '../../../../src/components/chat/ChatWindow';
import { configureStore } from '../../../../src/store';
import { lightTheme } from '../../../../src/styles/theme';
import { Message, MessageStatus, MessageType } from '../../../../src/types/chat';
import { WebSocket } from 'ws';

// Mock WebSocket
jest.mock('ws');

// Mock child components
jest.mock('../../../../src/components/chat/MessageList', () => {
  return function MockMessageList({ messages, onMessageVisible }: any) {
    return (
      <div data-testid="message-list">
        {messages.map((msg: Message) => (
          <div key={msg.id} data-testid="message-item" onClick={() => onMessageVisible(msg.id)}>
            {msg.content}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../../../../src/components/chat/MessageInput', () => {
  return function MockMessageInput({ onSend, disabled, placeholder }: any) {
    return (
      <div data-testid="message-input">
        <input
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => e.target.value}
          data-testid="text-input"
        />
        <button onClick={() => onSend('test message')} data-testid="send-button">
          Send
        </button>
      </div>
    );
  };
});

jest.mock('../../../../src/components/chat/ContextPanel', () => {
  return function MockContextPanel() {
    return <div data-testid="context-panel">Context Panel</div>;
  };
});

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {
      chat: {
        messages: [],
        loading: false,
        error: null,
        context: null,
        connectionStatus: 'connected'
      },
      auth: {
        token: 'test-token'
      }
    },
    mockServices = {
      webSocket: mockDeep<WebSocket>()
    }
  } = {}
) => {
  const store = configureStore(initialState);

  return {
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={lightTheme}>
          {ui}
        </ThemeProvider>
      </Provider>
    ),
    store,
    mockServices
  };
};

describe('ChatWindow Component', () => {
  let mockWebSocket: MockProxy<WebSocket>;

  beforeEach(() => {
    mockWebSocket = mockDeep<WebSocket>();
    (WebSocket as jest.Mock).mockImplementation(() => mockWebSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders chat interface elements correctly', () => {
    const { getByTestId, getByRole } = renderWithProviders(
      <ChatWindow
        theme="light"
        locale="en"
        accessibility={{ screenReader: true, highContrast: false, reducedMotion: false }}
      />
    );

    // Verify main container
    const chatContainer = getByRole('region', { name: /chat window/i });
    expect(chatContainer).toBeInTheDocument();

    // Verify context panel
    const contextPanel = getByTestId('context-panel');
    expect(contextPanel).toBeInTheDocument();

    // Verify message list
    const messageList = getByTestId('message-list');
    expect(messageList).toBeInTheDocument();

    // Verify message input
    const messageInput = getByTestId('message-input');
    expect(messageInput).toBeInTheDocument();
  });

  it('handles message sending correctly', async () => {
    const { getByTestId, store } = renderWithProviders(
      <ChatWindow
        theme="light"
        locale="en"
        accessibility={{ screenReader: true, highContrast: false, reducedMotion: false }}
      />
    );

    // Click send button
    const sendButton = getByTestId('send-button');
    fireEvent.click(sendButton);

    // Verify message dispatch
    await waitFor(() => {
      const state = store.getState();
      expect(state.chat.messages).toHaveLength(1);
      expect(state.chat.messages[0].content).toBe('test message');
      expect(state.chat.messages[0].status).toBe(MessageStatus.SENDING);
    });
  });

  it('handles real-time updates correctly', async () => {
    const { getByTestId, store } = renderWithProviders(
      <ChatWindow
        theme="light"
        locale="en"
        accessibility={{ screenReader: true, highContrast: false, reducedMotion: false }}
      />
    );

    // Simulate incoming message
    const incomingMessage: Message = {
      id: 'test-msg-1',
      type: MessageType.AI,
      content: 'AI response',
      attachments: [],
      status: MessageStatus.DELIVERED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    mockWebSocket.onmessage?.({
      data: JSON.stringify({ type: 'message', message: incomingMessage })
    } as WebSocketMessageEvent);

    // Verify message display
    await waitFor(() => {
      const state = store.getState();
      expect(state.chat.messages).toHaveLength(1);
      expect(state.chat.messages[0].content).toBe('AI response');
    });
  });

  it('handles connection status changes correctly', async () => {
    const { getByTestId, getByPlaceholderText } = renderWithProviders(
      <ChatWindow
        theme="light"
        locale="en"
        accessibility={{ screenReader: true, highContrast: false, reducedMotion: false }}
      />,
      {
        initialState: {
          chat: {
            messages: [],
            loading: false,
            error: null,
            context: null,
            connectionStatus: 'disconnected'
          },
          auth: {
            token: 'test-token'
          }
        }
      }
    );

    // Verify disconnected state
    const input = getByTestId('text-input');
    expect(input).toBeDisabled();
    expect(getByPlaceholderText('Reconnecting...')).toBeInTheDocument();
  });

  it('supports accessibility features', async () => {
    const { getByRole, getByTestId } = renderWithProviders(
      <ChatWindow
        theme="light"
        locale="en"
        accessibility={{ screenReader: true, highContrast: false, reducedMotion: false }}
      />
    );

    // Verify ARIA roles and labels
    expect(getByRole('region', { name: /chat window/i })).toBeInTheDocument();
    expect(getByTestId('message-list')).toHaveAttribute('role', 'log');
    expect(getByTestId('message-input')).toBeInTheDocument();

    // Simulate message for screen reader announcement
    const message: Message = {
      id: 'test-msg-2',
      type: MessageType.AI,
      content: 'New message content',
      attachments: [],
      status: MessageStatus.DELIVERED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    mockWebSocket.onmessage?.({
      data: JSON.stringify({ type: 'message', message })
    } as WebSocketMessageEvent);

    // Verify screen reader announcement
    await waitFor(() => {
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeInTheDocument();
      expect(announcement?.textContent).toContain('New message content');
    });
  });
});