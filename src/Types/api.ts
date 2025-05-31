import { Request } from 'express';
import { WASocket } from '../index';

// Extend Express Request to include user and session info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    apiKey: string;
  };
  sessionId?: string;
}

// WhatsApp Session Types
export interface WhatsAppSession {
  id: string;
  socket: WASocket | null;
  status: SessionStatus;
  qrCode?: string;
  pairingCode?: string;
  phoneNumber?: string;
  name?: string;
  lastSeen?: Date;
  authData?: any;
  metadata?: any;
  qrRetryCount?: number;
}

export enum SessionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  QR_REQUIRED = 'QR_REQUIRED',
  PAIRING_REQUIRED = 'PAIRING_REQUIRED',
  ERROR = 'ERROR'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  qrcode?: string;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Message Types
export interface SendMessageRequest {
  to: string;
  type: MessageType;
  content: MessageContent;
  options?: MessageOptions;
}

export interface MessageContent {
  text?: string;
  caption?: string;
  media?: string | Buffer;
  fileName?: string;
  mimetype?: string;
  poll?: PollContent;
  location?: LocationContent;
  contact?: ContactContent;
  reaction?: ReactionContent;
}

export interface PollContent {
  name: string;
  options: string[];
  selectableCount?: number;
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactContent {
  displayName: string;
  vcard: string;
}

export interface ReactionContent {
  messageId: string;
  emoji: string;
}

export interface MessageOptions {
  quoted?: string;
  mentions?: string[];
  ephemeral?: number;
  viewOnce?: boolean;
  edit?: string;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll',
  REACTION = 'reaction'
}

// Chat Types
export interface ChatInfo {
  jid: string;
  name?: string;
  isGroup: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastMessage?: any;
  participants?: string[];
}

// Group Types
export interface CreateGroupRequest {
  subject: string;
  participants: string[];
  description?: string;
}

export interface GroupUpdateRequest {
  subject?: string;
  description?: string;
  participants?: {
    add?: string[];
    remove?: string[];
    promote?: string[];
    demote?: string[];
  };
  settings?: GroupSettings;
}

export interface GroupSettings {
  restrict?: boolean;
  announce?: boolean;
  ephemeral?: number;
}

// Contact Types
export interface ContactInfo {
  jid: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  isBlocked: boolean;
  presence?: PresenceInfo;
}

export interface PresenceInfo {
  status: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
  lastSeen?: Date;
}

// Business Types
export interface BusinessProfile {
  description?: string;
  email?: string;
  website?: string;
  category?: string;
  address?: string;
  hours?: BusinessHours;
}

export interface BusinessHours {
  timezone: string;
  schedule: DaySchedule[];
}

export interface DaySchedule {
  day: number; // 0-6 (Sunday-Saturday)
  open: string; // HH:MM format
  close: string; // HH:MM format
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  images?: string[];
  url?: string;
  retailerId?: string;
}

// Webhook Types
export interface WebhookConfig {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  retries?: number;
}

export enum WebhookEvent {
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_UPDATED = 'message.updated',
  CHAT_UPDATED = 'chat.updated',
  GROUP_UPDATED = 'group.updated',
  CONTACT_UPDATED = 'contact.updated',
  CONNECTION_UPDATED = 'connection.updated',
  PRESENCE_UPDATED = 'presence.updated'
}

// Error Types
export interface ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: any;
}

// File Upload Types
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Dashboard Types
export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  messagesLast24h: number;
  totalUsers: number;
  apiCallsLast24h: number;
}

export interface SessionMetrics {
  sessionId: string;
  status: SessionStatus;
  messagesSent: number;
  messagesReceived: number;
  uptime: number;
  lastActivity: Date;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}
