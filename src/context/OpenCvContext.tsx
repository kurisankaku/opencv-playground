import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ensureLoaded as clientEnsureLoaded,
  getStatus,
  processImage,
  retry as clientRetry,
  subscribe,
  type CvStatus,
  type ProcessResult,
  type CvImage,
} from '../lib/cvClient';

interface OpenCvState {
  status: CvStatus;
  error: string | null;
  ensureLoaded: () => void;
  retry: () => void;
  process: (demoId: string, image: CvImage, params: Record<string, any>) => Promise<ProcessResult>;
}

const Ctx = createContext<OpenCvState>({
  status: 'idle',
  error: null,
  ensureLoaded: clientEnsureLoaded,
  retry: clientRetry,
  process: processImage,
});

export function OpenCvProvider({ children, autoLoad = true }: { children: ReactNode; autoLoad?: boolean }) {
  const [{ status, error }, setState] = useState(() => getStatus());

  useEffect(() => {
    const unsub = subscribe((status, error) => setState({ status, error }));
    setState(getStatus()); // resync in case status changed before we subscribed
    if (autoLoad) clientEnsureLoaded();
    return unsub;
  }, [autoLoad]);

  return (
    <Ctx.Provider
      value={{
        status,
        error,
        ensureLoaded: clientEnsureLoaded,
        retry: clientRetry,
        process: processImage,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useOpenCv() {
  return useContext(Ctx);
}
