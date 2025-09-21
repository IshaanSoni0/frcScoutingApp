import React, { useState } from 'react';

interface SyncControlProps {
  onSync: () => Promise<string | void> | void;
}

export function SyncControl({ onSync }: SyncControlProps) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handle = async () => {
    try {
      setStatus('working');
      setMessage(null);
      const res = await onSync();
      if (typeof res === 'string') setMessage(res);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('SyncControl: sync error', e);
      setMessage(e?.message ? String(e.message) : String(e));
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handle}
        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md"
      >
        Sync
      </button>
      <div className="text-sm text-gray-600">
        {status === 'idle' && (message || 'Idle')}
        {status === 'working' && 'Syncing...'}
        {status === 'done' && (message || 'Synced')}
        {status === 'error' && (message || 'Error')}
      </div>
    </div>
  );
}
