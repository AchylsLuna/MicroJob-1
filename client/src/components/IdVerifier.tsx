import React, { useState } from 'react';
import { toast } from './../lib/toast';

type Props = {
  profileId?: string;
  onResult?: (result: { decision: string; message?: string }) => void;
};

const GOVERNMENT_IDS = [
  'PhilSys National ID',
  'Philippine Passport',
  "Driver's License",
  'UMID',
  'SSS Card',
  'PRC ID',
  'PhilHealth ID',
  'TIN Card',
  'Postal ID',
];

export default function IdVerifier({ profileId, onResult }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>(GOVERNMENT_IDS[0]);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!file) return toast.error('Please select a document');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('documentType', documentType);
      fd.append('finalize', 'true');
      if (profileId) fd.append('profileId', profileId);

      const resp = await fetch('/api/verify-id/verify', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });

      const body = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        toast.error(body?.message || 'Verification failed');
        onResult?.({ decision: 'error', message: body?.message });
      } else {
        onResult?.({ decision: body?.decision || 'unknown', message: body?.message });
      }
    } catch (err) {
      toast.error('Network error');
      onResult?.({ decision: 'error', message: 'Network error' });
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        className="max-w-sm rounded-[8px] border border-[#CBD5E1] px-3 py-2 text-[13px] text-[#243B53]"
      >
        {GOVERNMENT_IDS.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="px-4 py-2 bg-[#1C4D8D] text-white text-[12px] rounded-[8px] hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Verifying…' : 'Verify ID'}
        </button>
        <span className="text-[12px] text-[#64748B]">or use your device camera to capture an ID</span>
      </div>
    </div>
  );
}
