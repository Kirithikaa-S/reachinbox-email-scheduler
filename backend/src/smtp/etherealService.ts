import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SendMailParams {
  fromName: string;
  fromEmail: string;
  smtpUser: string;
  smtpPassword: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
}

const transporterCache = new Map<string, Transporter>();

function getTransporter(smtpUser: string, smtpPassword: string): Transporter {
  const cacheKey = smtpUser;
  const cached = transporterCache.get(cacheKey);
  if (cached) return cached;

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      'Ethereal SMTP credentials are missing. Set ETHEREAL_USER / ETHEREAL_PASSWORD ' +
        '(or per-sender credentials) in your environment before sending email.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.ETHEREAL_HOST,
    port: env.ETHEREAL_PORT,
    secure: env.ETHEREAL_PORT === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  const transporter = getTransporter(params.smtpUser, params.smtpPassword);

  const info = await transporter.sendMail({
    from: `"${params.fromName}" <${params.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  if (previewUrl) {
    logger.info('Ethereal preview URL', { to: params.to, previewUrl });
  }

  return { messageId: info.messageId, previewUrl };
}
