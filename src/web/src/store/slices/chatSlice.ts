/**
 * Redux slice for managing chat state including messages, context, real-time communication,
 * typing indicators, and offline support.
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message, MessageStatus, ChatContext } from '../../types/chat';
import { WebSocketService } from '../../services/websocket';
import { api } from '../../services/api';
import { WEBSOCKET_EVENTS } from '../../constants/api';

// WebSocket service instance
const wsService = new WebSocketService(process.env.REACT_APP_WS_URL || '');

// Constants for retry logic
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// WebSocket connection status enum
enum WebSocketStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Interface for chat slice state
 */
interface ChatState {
  messages: Message[];
  context: ChatContext | null;
  loading: boolean;
  error: string | null;
  lastMessageTimestamp: Date | null;
  unreadCount: number;
  isTyping: boolean;
  connectionStatus: WebSocketStatus;
  offlineQueue: Message[];
}

/**
 * Initial state for chat slice
 */
const initialState: ChatState = {
  messages: [],
  context: null,
  loading: false,
  error: null,
  lastMessageTimestamp: null,
  unreadCount: 0,
  isTyping: false,
  connectionStatus: WebSocketStatus.DISCONNECTED,
  offlineQueue: []
};

/**
 * Redux slice for chat functionality
 */
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Add new message to chat
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
      state.lastMessageTimestamp = new Date();
      state.unreadCount += 1;
    },

    // Update message status
    updateMessageStatus: (state, action: PayloadAction<{
      id: string;
      status: MessageStatus;
      retryCount?: number;
    }>) => {
      const message = state.messages.find(m => m.id === action.payload.id);
      if (message) {
        message.status = action.payload.status;
        if (action.payload.retryCount !== undefined) {
          message.metadata = {
            ...message.metadata,
            retryCount: action.payload.retryCount
          };
        }
      }
    },

    // Set typing indicator status
    setTypingStatus: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },

    // Update WebSocket connection status
    setConnectionStatus: (state, action: PayloadAction<WebSocketStatus>) => {
      state.connectionStatus = action.payload;
      if (action.payload === WebSocketStatus.CONNECTED && state.offlineQueue.length > 0) {
        // Move messages from offline queue to regular messages when connection is restored
        state.messages.push(...state.offlineQueue);
        state.offlineQueue = [];
      }
    },

    // Set chat context
    setContext: (state, action: PayloadAction<ChatContext>) => {
      state.context = action.payload;
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Set error state
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset unread count
    resetUnreadCount: (state) => {
      state.unreadCount = 0;
    },

    // Clear chat history
    clearChat: (state) => {
      state.messages = [];
      state.lastMessageTimestamp = null;
      state.unreadCount = 0;
      state.isTyping = false;
    }
  }
});

// Export actions
export const chatActions = chatSlice.actions;

/**
 * Async thunk for sending messages with retry logic and offline support
 */
export const sendMessage = (message: Message) => async (dispatch: any) => {
  dispatch(chatActions.addMessage({ ...message, status: MessageStatus.SENDING }));

  if (wsService.connected) {
    let retryCount = 0;
    let sent = false;

    while (retryCount < RETRY_ATTEMPTS && !sent) {
      try {
        await wsService.sendMessage(message);
        dispatch(chatActions.updateMessageStatus({
          id: message.id,
          status: MessageStatus.SENT
        }));
        sent = true;
      } catch (error) {
        retryCount++;
        dispatch(chatActions.updateMessageStatus({
          id: message.id,
          status: MessageStatus.ERROR,
          retryCount
        }));
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      }
    }

    if (!sent) {
      dispatch(chatActions.setError('Failed to send message after multiple attempts'));
    }
  } else {
    // Queue message for offline handling
    dispatch(chatActions.updateMessageStatus({
      id: message.id,
      status: MessageStatus.ERROR
    }));
    dispatch(chatActions.offlineQueue.push(message));
  }
};

/**
 * Async thunk for fetching chat history
 */
export const fetchChatHistory = (
  projectId: string,
  page: number = 1,
  pageSize: number = 50
) => async (dispatch: any) => {
  try {
    dispatch(chatActions.setLoading(true));
    const response = await api.get<Message[]>(`/api/v1/chat/${projectId}/history`, {
      page,
      pageSize
    });
    
    response.data.forEach(message => {
      dispatch(chatActions.addMessage(message));
    });
    
    dispatch(chatActions.setLoading(false));
  } catch (error) {
    dispatch(chatActions.setError('Failed to fetch chat history'));
    dispatch(chatActions.setLoading(false));
  }
};

// WebSocket event listeners setup
wsService.on(WEBSOCKET_EVENTS.CONNECT, () => {
  dispatch(chatActions.setConnectionStatus(WebSocketStatus.CONNECTED));
});

wsService.on(WEBSOCKET_EVENTS.DISCONNECT, () => {
  dispatch(chatActions.setConnectionStatus(WebSocketStatus.DISCONNECTED));
});

wsService.on(WEBSOCKET_EVENTS.MESSAGE, (event) => {
  if (event.type === 'received') {
    dispatch(chatActions.addMessage(event.message));
  }
});

wsService.on(WEBSOCKET_EVENTS.ERROR, (error) => {
  dispatch(chatActions.setConnectionStatus(WebSocketStatus.ERROR));
  dispatch(chatActions.setError(error.message));
});

// Export reducer
export default chatSlice.reducer;