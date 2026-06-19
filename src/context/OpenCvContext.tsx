import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadOpenCV } from '../lib/loadOpenCV';
import type { Cv } from '../types/opencv';

export type CvStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OpenCvState {
  cv: Cv | null;
  status: CvStatus;
  error: string | null;
  /** Trigger the (lazy) load. Safe to call repeatedly. */
  ensureLoaded: () => void;
}

const Ctx = createContext<OpenCvState>({
  cv: null,
  status: 'idle',
  error: null,
  ensureLoaded: () => {},
});

export function OpenCvProvider({ children, autoLoad = true }: { children: ReactNode; autoLoad?: boolean }) {
  const [cv, setCv] = useState<Cv | null>(null);
  const [status, setStatus] = useState<CvStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = () => {
    setStatus((prev) => {
      if (prev === 'loading' || prev === 'ready') return prev;
      loadOpenCV()
        .then((loaded) => {
          setCv(loaded);
          setStatus('ready');
        })
        .catch((e: Error) => {
          setError(e.message);
          setStatus('error');
        });
      return 'loading';
    });
  };

  useEffect(() => {
    if (autoLoad) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return <Ctx.Provider value={{ cv, status, error, ensureLoaded }}>{children}</Ctx.Provider>;
}

export function useOpenCv() {
  return useContext(Ctx);
}
