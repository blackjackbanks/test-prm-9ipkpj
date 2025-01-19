/**
 * TypeScript type definitions and interfaces for the chat functionality.
 * Provides comprehensive type safety for chat messages, attachments, and context.
 * @version 1.0.0
 */

import { BaseModel } from './common';

/**
 * Enum defining the possible types of chat messages
 */
export enum MessageType {
  /** Message sent by the user */
  USER = 'USER',
  /** Message sent by the AI assistant */
  AI = 'AI',
  /** System-generated message or notification */
  SYSTEM = 'SYSTEM'
}

/**
 * Enum defining the possible states of a message's delivery status
 */
export enum MessageStatus {
  /** Message is currently being sent */
  SENDING = 'SENDING',
  /** Message has been sent to the server */
  SENT = 'SENT',
  /** Message has been delivered to all recipients */
  DELIVERED = 'DELIVERED',
  /** Error occurred during message delivery */
  ERROR = 'ERROR'
}

/**
 * Interface for file attachments in chat messages
 */
export interface Attachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Original filename of the attachment */
  name: string;
  /** Type of attachment (e.g., 'document', 'image') */
  type: string;
  /** URL to access the attachment */
  url: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  mimeType: string;
}

/**
 * Interface for business context information
 */
export interface BusinessContext {
  /** Industry sector */
  industry: string;
  /** Company size category */
  companySize: string;
  /** Business stage (e.g., 'startup', 'growth') */
  stage: string;
  /** Key business metrics */
  metrics: Record<string, unknown>;
}

/**
 * Interface for managing chat context and integration awareness
 */
export interface ChatContext {
  /** ID of the current project */
  projectId: string;
  /** ID of the active template */
  templateId: string;
  /** List of active integration IDs */
  activeIntegrations: string[];
  /** Current business context */
  businessContext: BusinessContext;
}

/**
 * Interface for additional message metadata and AI processing information
 */
export interface MessageMetadata {
  /** AI model used for processing */
  aiModel: string;
  /** Confidence score of AI response (0-1) */
  confidence: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Core interface for chat message objects
 * Extends BaseModel to inherit common fields like id and createdAt
 */
export interface Message extends BaseModel {
  /** Type of message (USER, AI, or SYSTEM) */
  type: MessageType;
  /** Message content in markdown format */
  content: string;
  /** Array of file attachments */
  attachments: Attachment[];
  /** Current delivery status */
  status: MessageStatus;
  /** Additional metadata for AI messages */
  metadata?: MessageMetadata;
  /** Reference to parent message in a thread */
  parentId?: string;
  /** Whether the message has been edited */
  edited?: boolean;
  /** Reactions to the message */
  reactions?: Record<string, number>;
  /** Message formatting options */
  formatting?: {
    /** Whether to render as rich text */
    richText: boolean;
    /** Custom styling options */
    style?: Record<string, string>;
  };
}

/**
 * Interface for chat thread information
 */
export interface ChatThread {
  /** Unique thread identifier */
  id: string;
  /** Thread title */
  title: string;
  /** Array of message IDs in the thread */
  messageIds: string[];
  /** Thread creation timestamp */
  createdAt: Date;
  /** Thread context information */
  context: ChatContext;
}

/**
 * Type for message validation results
 */
export type MessageValidation = {
  /** Whether the message is valid */
  isValid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** Suggested corrections */
  suggestions?: string[];
};

/**
 * Type for message search parameters
 */
export type MessageSearchParams = {
  /** Search query string */
  query: string;
  /** Filter by message type */
  type?: MessageType;
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Include archived messages */
  includeArchived?: boolean;
};