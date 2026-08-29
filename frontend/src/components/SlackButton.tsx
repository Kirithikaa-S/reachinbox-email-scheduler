import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button } from './Button';
import { useToast } from '../context/ToastContext';

export function SlackButton() {
  const [connected, setConnected] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = async () => {
    try {
      const status = await api.slackStatus();
      setConnected(status.connected);
      setTeamName(status.teamName);
    } catch {
      // Non-fatal - just show the connect option.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDisconnect = async () => {
    try {
      await api.slackDisconnect();
      setConnected(false);
      showToast('Slack disconnected');
    } catch {
      showToast('Failed to disconnect Slack', 'error');
    }
  };

  if (loading) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          🟢 Slack Connected{teamName ? ` (${teamName})` : ''}
        </span>
        <Button variant="ghost" onClick={handleDisconnect} className="!px-2 !py-1 text-xs">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={() => {
        window.location.href = api.slackConnectUrl();
      }}
    >
      Connect Slack
    </Button>
  );
}
