import React, { useState } from 'react';

interface SyncControlProps {
  onSync: () => Promise<string | void> | void;
  onCheck?: () => Promise<any> | void;
}

export function SyncControl({ onSync, onCheck }: SyncControlProps) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

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

  const handleCheck = async () => {
    if (!onCheck) return;
    try {
      const data = await onCheck();
      if (Array.isArray(data)) {
        setCheckResult(`Server scouters: ${data.length}`);
      } else {
        setCheckResult(String(data));
      }
      setTimeout(() => setCheckResult(null), 4000);
    } catch (e: any) {
      setCheckResult(e?.message ? String(e.message) : String(e));
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
      {onCheck && (
        <button
          onClick={handleCheck}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-md"
        >
          Check
        </button>
      )}
      <div className="text-sm text-gray-600">
        {status === 'idle' && (message || checkResult || 'Idle')}
        {status === 'working' && 'Syncing...'}
        {status === 'done' && (message || 'Synced')}
        {status === 'error' && (message || 'Error')}
      </div>
    </div>
  );
}
