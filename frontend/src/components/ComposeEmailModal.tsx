import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Input, Textarea } from './Input';
import { Button } from './Button';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface ComposeEmailModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

function defaultStartTime(): string {
  const d = new Date(Date.now() + 60_000); // 1 minute from now
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ComposeEmailModal({ open, onClose, onScheduled }: ComposeEmailModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const resetAndClose = () => {
    setSubject('');
    setBody('');
    setRecipients([]);
    setManualRecipients('');
    setStartTime(defaultStartTime());
    setDelayMs(2000);
    setHourlyLimit(200);
    setErrors([]);
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.parseUpload(file);
      setRecipients((prev) => Array.from(new Set([...prev, ...result.emails])));
      showToast(`${result.count} email address${result.count === 1 ? '' : 'es'} detected`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to parse file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const allRecipients = () => {
    const manual = manualRecipients
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set([...recipients, ...manual]));
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!subject.trim()) errs.push('Subject is required');
    if (!body.trim()) errs.push('Body is required');
    const combined = allRecipients();
    if (combined.length === 0) errs.push('At least one recipient email is required');
    if (!startTime || isNaN(Date.parse(startTime))) errs.push('A valid start time is required');
    if (delayMs < 0) errs.push('Delay must be a positive number');
    if (hourlyLimit <= 0) errs.push('Hourly limit must be a positive number');
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    setSubmitting(true);
    try {
      await api.scheduleCampaign({
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
        recipients: allRecipients(),
      });
      showToast('Campaign scheduled successfully');
      onScheduled();
      resetAndClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to schedule campaign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const combinedCount = allRecipients().length;

  return (
    <Modal open={open} onClose={resetAndClose} title="Compose New Email" widthClassName="max-w-2xl">
      <div className="flex flex-col gap-4">
        <Input
          id="subject"
          label="Subject"
          placeholder="Welcome to our product"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          id="body"
          label="Body"
          rows={5}
          placeholder="Hello, ..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">CSV / Text upload</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Parsing…' : 'Upload leads.csv'}
            </Button>
            <span className="text-sm text-gray-500">
              {combinedCount} email address{combinedCount === 1 ? '' : 'es'} detected
            </span>
          </div>
          <Textarea
            id="manual-recipients"
            placeholder="Or paste emails here, separated by commas or new lines"
            rows={2}
            value={manualRecipients}
            onChange={(e) => setManualRecipients(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            id="startTime"
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            id="delayMs"
            label="Delay between emails (ms)"
            type="number"
            min={0}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
          />
          <Input
            id="hourlyLimit"
            label="Hourly limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
          />
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <ul className="list-inside list-disc">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={resetAndClose} type="button">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} type="button">
            {submitting ? 'Scheduling…' : 'Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
