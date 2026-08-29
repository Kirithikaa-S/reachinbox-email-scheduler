import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { EmailTable } from '../components/EmailTable';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { ComposeEmailModal } from '../components/ComposeEmailModal';
import { api, ApiError } from '../services/api';
import type { ScheduledEmail } from '../types';

type Tab = 'scheduled' | 'sent';

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>('scheduled');
  const [emails, setEmails] = useState<ScheduledEmail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScheduledEmail[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = async (activeTab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const data = activeTab === 'scheduled' ? await api.scheduledEmails() : await api.sentEmails();
      setEmails(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchEmails(searchQuery);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const displayedEmails = searchResults ?? emails;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your scheduled and sent email campaigns</p>
          </div>
          <Button onClick={() => setComposeOpen(true)}>+ Compose New Email</Button>
        </div>

        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <Input
            placeholder="Search emails…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
          {searchResults !== null && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchResults(null);
                setSearchQuery('');
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {searchResults === null && (
          <div className="mb-4 flex gap-2 border-b border-gray-200">
            {(['scheduled', 'sent'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  tab === t
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
              </button>
            ))}
          </div>
        )}

        {loading && searchResults === null && <Loading label="Loading emails…" />}
        {!loading && error && searchResults === null && (
          <ErrorState message={error} onRetry={() => load(tab)} />
        )}
        {!loading && !error && displayedEmails && displayedEmails.length === 0 && (
          <EmptyState
            title={searchResults !== null ? 'No matching emails' : `No ${tab} emails yet`}
            description={
              searchResults !== null
                ? 'Try a different search term.'
                : 'Compose a new email to get started.'
            }
            action={
              searchResults === null ? (
                <Button onClick={() => setComposeOpen(true)}>+ Compose New Email</Button>
              ) : undefined
            }
          />
        )}
        {!loading && !error && displayedEmails && displayedEmails.length > 0 && (
          <EmailTable emails={displayedEmails} mode={searchResults !== null ? 'sent' : tab} />
        )}
      </main>

      <ComposeEmailModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={() => load(tab)}
      />
    </div>
  );
}
