import { useCallback, useEffect, useRef, useState } from "react";

// Countdown based on an end timestamp, so it stays accurate when the tab is throttled.
export function useQuizTimer(onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const remainingRef = useRef<number | null>(null);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  });

  const update = useCallback((v: number | null) => {
    remainingRef.current = v;
    setRemaining(v);
  }, []);

  const getRemaining = useCallback((): number | null => {
    if (endAtRef.current !== null) {
      return Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    }
    return remainingRef.current;
  }, []);

  const start = useCallback(
    (seconds: number | null) => {
      if (!seconds || seconds <= 0) {
        endAtRef.current = null;
        update(null);
        setPaused(false);
        return;
      }
      endAtRef.current = Date.now() + seconds * 1000;
      update(seconds);
      setPaused(false);
    },
    [update]
  );

  const pause = useCallback(() => {
    if (endAtRef.current !== null) {
      update(getRemaining());
      endAtRef.current = null;
    }
    setPaused(true);
  }, [getRemaining, update]);

  const resume = useCallback(() => {
    const r = remainingRef.current;
    if (r !== null && r > 0) endAtRef.current = Date.now() + r * 1000;
    setPaused(false);
  }, []);

  const stop = useCallback(() => {
    endAtRef.current = null;
    update(null);
    setPaused(false);
  }, [update]);

  const hasTimer = remaining !== null;

  useEffect(() => {
    if (!hasTimer || paused) return;
    const id = setInterval(() => {
      if (endAtRef.current === null) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      update(left);
      if (left <= 0) {
        endAtRef.current = null;
        clearInterval(id);
        expireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [hasTimer, paused, update]);

  return { remaining, paused, start, pause, resume, stop, getRemaining };
}