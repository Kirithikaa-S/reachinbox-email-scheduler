import type { ScheduledEmail } from '../types';
import { StatusBadge } from './States';

interface EmailTableProps {
  emails: ScheduledEmail[];
  mode: 'scheduled' | 'sent';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function EmailTable({ emails, mode }: EmailTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              {mode === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            {mode === 'sent' && (
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Preview</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {emails.map((email) => (
            <tr key={email.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{email.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-gray-600">{email.subject}</td>
              <td className="px-4 py-3 text-gray-600">
                {mode === 'scheduled' ? formatDate(email.scheduledAt) : formatDate(email.sentAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={email.status} />
              </td>
              {mode === 'sent' && (
                <td className="px-4 py-3">
                  {email.previewUrl ? (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
