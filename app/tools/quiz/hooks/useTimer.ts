import { useState, useEffect, useRef, useCallback } from "react";

export const useTimer = (initialTime: number, onTimeout: () => void) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Update the ref when onTimeout changes
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      onTimeoutRef.current();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLeft]); // Removed onTimeout from dependencies

  const resetTimer = useCallback((newTime: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(newTime);
  }, []);

  return { timeLeft, resetTimer };
};