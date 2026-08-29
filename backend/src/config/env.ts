import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    // Non-fatal at import time; individual services validate what they need.
    return '';
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '5000', 10),

  DATABASE_URL: required('DATABASE_URL'),

  REDIS_URL: process.env.REDIS_URL,
  REDIS_HOST: required('REDIS_HOST', 'localhost'),
  REDIS_PORT: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  ELASTICSEARCH_URL: required('ELASTICSEARCH_URL', 'http://localhost:9200'),

  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: required('GOOGLE_CLIENT_SECRET'),
  GOOGLE_CALLBACK_URL: required(
    'GOOGLE_CALLBACK_URL',
    'http://localhost:5000/api/auth/google/callback'
  ),

  SESSION_SECRET: required('SESSION_SECRET', 'dev-session-secret-change-me'),
  JWT_SECRET: required('JWT_SECRET', 'dev-jwt-secret-change-me'),

  ETHEREAL_HOST: required('ETHEREAL_HOST', 'smtp.ethereal.email'),
  ETHEREAL_PORT: parseInt(process.env.ETHEREAL_PORT ?? '587', 10),
  ETHEREAL_USER: required('ETHEREAL_USER'),
  ETHEREAL_PASSWORD: required('ETHEREAL_PASSWORD'),

  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
  MIN_EMAIL_DELAY_MS: parseInt(process.env.MIN_EMAIL_DELAY_MS ?? '2000', 10),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(
    process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? '200',
    10
  ),

  SLACK_CLIENT_ID: required('SLACK_CLIENT_ID'),
  SLACK_CLIENT_SECRET: required('SLACK_CLIENT_SECRET'),
  SLACK_REDIRECT_URI: required(
    'SLACK_REDIRECT_URI',
    'http://localhost:5000/api/slack/callback'
  ),

  FRONTEND_URL: required('FRONTEND_URL', 'http://localhost:5173'),
};
