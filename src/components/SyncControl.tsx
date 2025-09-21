import React, { useState } from 'react';

interface SyncControlProps {
  onSync: () => Promise<void> | void;
}

export function SyncControl({ onSync }: SyncControlProps) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  const handle = async () => {
    try {
      setStatus('working');
      await onSync();
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('SyncControl: sync error', e);
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
        {status === 'idle' && 'Idle'}
        {status === 'working' && 'Syncing...'}
        {status === 'done' && 'Synced'}
        {status === 'error' && 'Error'}
      </div>
    </div>
  );
}
