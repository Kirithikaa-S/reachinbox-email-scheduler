import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const EMAIL_INDEX = 'emails';

export const esClient = new Client({ node: env.ELASTICSEARCH_URL });

let esAvailable = false;

export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info('Created Elasticsearch index', { index: EMAIL_INDEX });
    }
    esAvailable = true;
  } catch (err) {
    esAvailable = false;
    logger.warn('Elasticsearch unavailable - search indexing will be skipped', {
      error: (err as Error).message,
    });
  }
}

export function isEsAvailable(): boolean {
  return esAvailable;
}

export interface EmailDocument {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

/**
 * Index (or update) a document. Failures are logged and swallowed so that
 * core scheduling/sending never crashes because of a search-layer outage.
 */
export async function indexEmailDocument(doc: EmailDocument): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: doc.id,
      document: doc,
      refresh: 'wait_for',
    });
    esAvailable = true;
  } catch (err) {
    esAvailable = false;
    logger.warn('Failed to index email document (non-fatal)', {
      id: doc.id,
      error: (err as Error).message,
    });
  }
}

export interface SearchOptions {
  userId: string;
  query: string;
  size?: number;
}

export async function searchEmails(opts: SearchOptions): Promise<EmailDocument[]> {
  try {
    const result = await esClient.search<EmailDocument>({
      index: EMAIL_INDEX,
      size: opts.size ?? 50,
      query: {
        bool: {
          must: [{ term: { userId: opts.userId } }],
          should: opts.query
            ? [
                { match: { recipient: { query: opts.query, boost: 2 } } },
                { match: { subject: { query: opts.query, boost: 2 } } },
                { match: { body: opts.query } },
              ]
            : [],
          minimum_should_match: opts.query ? 1 : 0,
        },
      },
    });
    return result.hits.hits.map((h) => h._source as EmailDocument);
  } catch (err) {
    logger.warn('Elasticsearch search failed (non-fatal)', {
      error: (err as Error).message,
    });
    return [];
  }
}
