import { useEffect, useRef } from 'react';
import { subscribeRoomsOccupancyForWatchdog, updateRoomOccupancy } from '../services/firestoreApi';

/** Délai sans mouvement (ms) avant de passer la salle en libre — doit correspondre à pirVacancyMinutes sur le Pi. */
const VACANCY_MS = 2 * 60 * 1000;
/** Fréquence de vérification côté frontend (filet de sécurité si le Pi est hors ligne). */
const CHECK_INTERVAL_MS = 30 * 1000;

type RoomOccupancyState = {
  id: string;
  status: 'available' | 'busy';
  lastMotionAt: string | null;
};

/**
 * Hook de surveillance : si un room est occupé mais que lastMotionAt date de plus de VACANCY_MS,
 * il est automatiquement remis à disponible (filet de sécurité quand le Pi est hors ligne).
 * N'agit que sur les salles dont `lastMotionAt` est renseigné (celles pilotées par PIR).
 */
export function useMotionWatchdog(enabled = true) {
  const roomsRef = useRef<RoomOccupancyState[]>([]);
  const releasingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;

    const unsub = subscribeRoomsOccupancyForWatchdog((rooms) => {
      roomsRef.current = rooms;
    });

    const timer = setInterval(() => {
      const now = Date.now();
      for (const room of roomsRef.current) {
        if (room.status !== 'busy') continue;
        if (!room.lastMotionAt) continue;
        if (releasingRef.current.has(room.id)) continue;

        const lastMs = new Date(room.lastMotionAt).getTime();
        if (now - lastMs > VACANCY_MS) {
          releasingRef.current.add(room.id);
          void updateRoomOccupancy(room.id, false)
            .catch(() => {})
            .finally(() => releasingRef.current.delete(room.id));
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [enabled]);
}
