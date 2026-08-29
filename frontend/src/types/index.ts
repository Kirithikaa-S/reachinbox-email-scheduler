export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  sequence: number;
  scheduledAt: string;
  status: EmailStatus;
  bullJobId: string | null;
  attempts: number;
  sentAt: string | null;
  failedAt: string | null;
  messageId: string | null;
  previewUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  connectedAt: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
