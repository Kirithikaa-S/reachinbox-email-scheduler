import type {
  ApiResponse,
  Campaign,
  ScheduledEmail,
  SlackStatus,
  User,
} from '../types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
    ...options,
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok || json.success === false) {
    throw new ApiError(json.message ?? `Request failed (${res.status})`, res.status);
  }

  return json.data;
}

export const api = {
  me: () => request<User>('/auth/me'),
  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  googleLoginUrl: () => `${API_URL}/auth/google`,

  scheduledEmails: () => request<ScheduledEmail[]>('/emails/scheduled'),
  sentEmails: () => request<ScheduledEmail[]>('/emails/sent'),
  searchEmails: (q: string) =>
    request<ScheduledEmail[]>(`/emails/search?q=${encodeURIComponent(q)}`),

  scheduleCampaign: (payload: {
    subject: string;
    body: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    recipients: string[];
  }) =>
    request<{ campaign: Campaign; emails: ScheduledEmail[] }>('/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  parseUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ emails: string[]; count: number }>('/emails/parse-upload', {
      method: 'POST',
      body: form,
    });
  },

  slackStatus: () => request<SlackStatus>('/slack/status'),
  slackConnectUrl: () => `${API_URL}/slack/connect`,
  slackDisconnect: () =>
    request<{ disconnected: boolean }>('/slack/disconnect', { method: 'POST' }),
};

export { ApiError };
