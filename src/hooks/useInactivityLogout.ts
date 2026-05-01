import { useEffect, useRef } from 'react';

const INACTIVITY_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export function useInactivityLogout(
  enabled: boolean,
  onWarn: () => void,
  onLogout: () => void,
): void {
  const warnFiredRef = useRef(false);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function clearTimers() {
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    }

    function schedule() {
      clearTimers();
      warnFiredRef.current = false;

      warnTimerRef.current = setTimeout(() => {
        if (!warnFiredRef.current) {
          warnFiredRef.current = true;
          onWarn();
        }
      }, INACTIVITY_MS - WARN_BEFORE_MS);

      logoutTimerRef.current = setTimeout(() => {
        onLogout();
      }, INACTIVITY_MS);
    }

    function handleActivity() {
      schedule();
    }

    schedule();
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, handleActivity));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
