import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid startTime'),
  delayMs: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().positive().default(200),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  senderId: z.string().optional(),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
