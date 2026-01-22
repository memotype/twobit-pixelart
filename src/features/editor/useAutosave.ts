import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave(
  onSave: () => Promise<void>,
  delayMs: number,
): {
  status: AutosaveState;
  markDirty: () => void;
} {
  const [status, setStatus] = useState<AutosaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) {
      return;
    }
    dirtyRef.current = false;
    setStatus('saving');
    try {
      await onSave();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [onSave]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setStatus('idle');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void flush();
    }, delayMs);
  }, [delayMs, flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { status, markDirty };
}
