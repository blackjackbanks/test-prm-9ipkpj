import { useDispatch } from 'react-redux'; // v8.1.0
import { useCallback } from 'react'; // v18.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { addNotification, removeNotification } from '../store/slices/uiSlice';

/**
 * Enum for semantic notification types
 */
export enum NotificationType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  INFO = 'INFO',
  WARNING = 'WARNING'
}

/**
 * Type for notification positioning with MacOS-inspired locations
 */
export type NotificationPosition = 
  | 'TOP_LEFT'
  | 'TOP_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_RIGHT'
  | 'TOP_CENTER'
  | 'BOTTOM_CENTER';

/**
 * Interface for notification action buttons
 */
export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  ariaLabel?: string;
}

/**
 * Configuration options for showing notifications
 */
export interface ShowNotificationOptions {
  message: string;
  type?: NotificationType;
  duration?: number;
  position?: NotificationPosition;
  actions?: NotificationAction[];
  ariaLabel?: string;
  dismissible?: boolean;
}

/**
 * Default configuration for notifications
 */
const DEFAULT_OPTIONS: Partial<ShowNotificationOptions> = {
  type: NotificationType.INFO,
  duration: 5000,
  position: 'TOP_RIGHT',
  dismissible: true
};

/**
 * Maximum number of notifications per position
 */
const MAX_NOTIFICATIONS_PER_POSITION = 3;

/**
 * Custom hook for managing application notifications with enhanced positioning and accessibility
 */
export const useNotification = () => {
  const dispatch = useDispatch();
  
  // Map to track notification timeouts for cleanup
  const notificationTimeouts = new Map<string, NodeJS.Timeout>();
  
  // Map to track notifications per position
  const positionQueues = new Map<NotificationPosition, string[]>();

  /**
   * Shows a notification with the specified options
   */
  const showNotification = useCallback((options: ShowNotificationOptions): string => {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const id = uuidv4();

    // Sanitize message for security
    const sanitizedMessage = mergedOptions.message.trim();
    if (!sanitizedMessage) {
      throw new Error('Notification message cannot be empty');
    }

    // Check position queue limit
    const positionQueue = positionQueues.get(mergedOptions.position!) || [];
    if (positionQueue.length >= MAX_NOTIFICATIONS_PER_POSITION) {
      const oldestId = positionQueue[0];
      hideNotification(oldestId);
    }

    // Create notification object
    const notification = {
      id,
      type: mergedOptions.type,
      message: sanitizedMessage,
      duration: mergedOptions.duration,
      position: mergedOptions.position,
      action: mergedOptions.actions?.[0] ? {
        label: mergedOptions.actions[0].label,
        handler: mergedOptions.actions[0].onClick
      } : null
    };

    // Update screen reader
    const ariaLabel = mergedOptions.ariaLabel || `${mergedOptions.type} notification: ${sanitizedMessage}`;
    const ariaLive = mergedOptions.type === NotificationType.ERROR ? 'assertive' : 'polite';
    
    // Add to Redux store
    dispatch(addNotification(notification));

    // Set up auto-hide timeout if duration is provided
    if (mergedOptions.duration && mergedOptions.duration > 0) {
      const timeout = setTimeout(() => {
        hideNotification(id);
      }, mergedOptions.duration);
      notificationTimeouts.set(id, timeout);
    }

    // Update position queue
    positionQueues.set(
      mergedOptions.position!,
      [...(positionQueues.get(mergedOptions.position!) || []), id]
    );

    return id;
  }, [dispatch]);

  /**
   * Hides a notification with the specified ID
   */
  const hideNotification = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = notificationTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeouts.delete(id);
    }

    // Remove from position queues
    positionQueues.forEach((queue, position) => {
      const updatedQueue = queue.filter(queueId => queueId !== id);
      positionQueues.set(position, updatedQueue);
    });

    // Remove from Redux store
    dispatch(removeNotification(id));
  }, [dispatch]);

  // Clean up timeouts on unmount
  useCallback(() => {
    return () => {
      notificationTimeouts.forEach(timeout => clearTimeout(timeout));
      notificationTimeouts.clear();
      positionQueues.clear();
    };
  }, []);

  return {
    showNotification,
    hideNotification
  };
};

export default useNotification;