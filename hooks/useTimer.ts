'use client';

import { useEffect, useState, useRef } from 'react';

export function useTimer(roundStartedAt: number, active: boolean, limitSeconds = 60) {
  const [secondsRemaining, setSecondsRemaining] = useState(limitSeconds);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !roundStartedAt) {
      setSecondsRemaining(limitSeconds);
      return;
    }

    function tick() {
      const elapsed = (Date.now() - roundStartedAt) / 1000;
      const remaining = Math.min(limitSeconds, Math.max(0, limitSeconds - elapsed));
      setSecondsRemaining(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [roundStartedAt, active, limitSeconds]);

  return secondsRemaining;
}
