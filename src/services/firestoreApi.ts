import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  getDoc,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppRole } from './auth';
import { computeComfortScoreFromSensors } from './comfortScore';

// —— Types (alignés avec l’ancienne API Django) —— //

/** Document `rooms` : métadonnées uniquement — capteurs dans `rooms/{id}/measurements`. */
export type RoomRow = {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
};

export type MeasurementRow = {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  noise: number | null;
  light: number | null;
};

function measurementNumericOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapFirestoreDataToMeasurementRow(x: Record<string, unknown>, timestampIso: string): MeasurementRow {
  return {
    timestamp: timestampIso,
    temperature: measurementNumericOrNull(x.temperature),
    humidity: measurementNumericOrNull(x.humidity),
    co2: measurementNumericOrNull(x.co2),
    noise: measurementNumericOrNull(x.noise),
    light: measurementNumericOrNull(x.light),
  };
}

/** Longueur fixe pour que l’ordre lexicographique des IDs = ordre chronologique (comparaison rapide côté client). */
const MEASUREMENT_DOC_ID_PAD = 16;

/** ID document Firestore = temps en millisecondes (padding). Même instant : suffixe `_1`, `_2`, … */
export function roomMeasurementDocumentId(at: Timestamp | Date): string {
  const ms = at instanceof Timestamp ? at.toMillis() : at.getTime();
  return ms.toString().padStart(MEASUREMENT_DOC_ID_PAD, '0');
}

/**
 * Écrit `rooms/{roomId}/measurements/{id}` avec `id` basé sur `timestamp` (récupération directe par `doc(..., id)`).
 * Les anciennes mesures (ID auto Firestore) restent valides ; les requêtes par champ `timestamp` sont inchangées.
 */
async function setRoomMeasurementDoc(
  roomId: string,
  timestamp: Timestamp,
  fields: Record<string, unknown>,
): Promise<void> {
  const ms = timestamp.toMillis();
  const baseId = ms.toString().padStart(MEASUREMENT_DOC_ID_PAD, '0');
  const payload = { timestamp, ...fields };

  for (let i = 0; i < 64; i++) {
    const docId = i === 0 ? baseId : `${baseId}_${i}`;
    const ref = doc(db, 'rooms', roomId, 'measurements', docId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, payload);
      return;
    }
  }
  await addDoc(collection(db, 'rooms', roomId, 'measurements'), payload);
}

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: 'active' | 'inactive';
  mustChangePassword?: boolean;
};

function mapUserRole(r: unknown): AppRole {
  if (r === 'admin' || r === 'user' || r === 'technicien') return r;
  return 'user';
}

export type DeviceRecord = {
  id: string;
  name: string;
  deviceId?: string;
  room: string;
  roomId: string;
  status: 'online' | 'offline' | 'error';
  lastUpdate: string;
};

export type DashboardSummary = {
  comfortScore: number;
  temperature: number;
  co2: number;
  noise: number;
  light: number;
  temperatureData: { time: string; value: number }[];
  co2Data: { time: string; value: number }[];
  lightData: { time: string; value: number }[];
  noiseData: { time: string; value: number }[];
  roomOverview: { total: number; available: number; occupied: number; maintenance: number };
};

// —— Alerts (Firestore) —— //

export type AlertStatus = 'open' | 'pending' | 'resolved';

export type AlertRow = {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  room: string;
  title: string;
  message: string;
  timestamp: string;
  category: string;
  status: AlertStatus;
  resolutionRequestedBy?: string;
  resolutionRequestedAt?: string;
  /** UID Firebase de l’utilisateur ayant demandé la résolution (notifications). */
  resolutionRequestedByUid?: string;
  resolvedByName?: string;
  resolvedAt?: string;
};

function mapAlertType(t: unknown): AlertRow['type'] {
  if (t === 'critical' || t === 'warning' || t === 'info' || t === 'success') return t;
  return 'info';
}

function mapAlertStatus(s: unknown): AlertStatus {
  if (s === 'open' || s === 'pending' || s === 'resolved') return s;
  return 'open';
}

function formatRelativeAlertTime(createdAtMs: number): string {
  const diff = Date.now() - createdAtMs;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

function firestoreTimeToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return undefined;
}

function mapAlertDoc(d: DocumentSnapshot): AlertRow {
  const x = d.data() ?? {};
  let createdAtMs = Date.now();
  if (x.createdAt instanceof Timestamp) {
    createdAtMs = x.createdAt.toMillis();
  }
  return {
    id: d.id,
    type: mapAlertType(x.type),
    room: String(x.room ?? ''),
    title: String(x.title ?? ''),
    message: String(x.message ?? ''),
    category: String(x.category ?? ''),
    status: mapAlertStatus(x.status),
    timestamp: formatRelativeAlertTime(createdAtMs),
    resolutionRequestedBy: x.resolutionRequestedBy ? String(x.resolutionRequestedBy) : undefined,
    resolutionRequestedAt: firestoreTimeToIso(x.resolutionRequestedAt),
    resolutionRequestedByUid: x.resolutionRequestedByUid ? String(x.resolutionRequestedByUid) : undefined,
    resolvedByName: x.resolvedByName ? String(x.resolvedByName) : undefined,
    resolvedAt: firestoreTimeToIso(x.resolvedAt),
  };
}

export function subscribeAlerts(
  onData: (alerts: AlertRow[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(mapAlertDoc)),
    (err) => onError?.(err as Error),
  );
}

export async function alertRequestResolution(
  alertId: string,
  userName: string,
  userUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'pending',
    resolutionRequestedBy: userName.trim(),
    resolutionRequestedByUid: userUid.trim(),
    resolutionRequestedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function alertMarkDirectResolved(alertId: string, adminName: string): Promise<void> {
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'resolved',
    resolvedByName: adminName.trim(),
    resolvedAt: Timestamp.now(),
    resolutionRequestedBy: deleteField(),
    resolutionRequestedAt: deleteField(),
    resolutionRequestedByUid: deleteField(),
    updatedAt: Timestamp.now(),
  });
}

export async function alertApproveResolution(alertId: string, adminName: string): Promise<void> {
  const ref = doc(db, 'alerts', alertId);
  const snap = await getDoc(ref);
  const x = snap.data() ?? {};
  const targetUid = String(x.resolutionRequestedByUid ?? '').trim();
  const title = String(x.title ?? 'Alerte');

  await updateDoc(ref, {
    status: 'resolved',
    resolvedByName: adminName.trim(),
    resolvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  if (targetUid) {
    await addDoc(collection(db, 'inAppNotifications'), {
      userId: targetUid,
      kind: 'alert_resolution_accepted',
      alertId,
      alertTitle: title,
      read: false,
      createdAt: Timestamp.now(),
    });
  }
}

/** Refus admin : alerte repasse en ouvert + notification à l’utilisateur ayant demandé. */
export async function alertRejectResolution(alertId: string): Promise<void> {
  const ref = doc(db, 'alerts', alertId);
  const snap = await getDoc(ref);
  const x = snap.data() ?? {};
  const targetUid = String(x.resolutionRequestedByUid ?? '').trim();
  const title = String(x.title ?? 'Alerte');

  await updateDoc(ref, {
    status: 'open',
    resolutionRequestedBy: deleteField(),
    resolutionRequestedAt: deleteField(),
    resolutionRequestedByUid: deleteField(),
    updatedAt: Timestamp.now(),
  });

  if (targetUid) {
    await addDoc(collection(db, 'inAppNotifications'), {
      userId: targetUid,
      kind: 'alert_resolution_rejected',
      alertId,
      alertTitle: title,
      read: false,
      createdAt: Timestamp.now(),
    });
  }
}

// —— Notifications in-app (cloche) —— //

export type InAppNotificationKind = 'alert_resolution_accepted' | 'alert_resolution_rejected';

export type InAppNotificationRow = {
  id: string;
  userId: string;
  kind: InAppNotificationKind;
  alertId: string;
  alertTitle: string;
  read: boolean;
  createdAt: string;
};

function mapInAppNotificationDoc(d: DocumentSnapshot): InAppNotificationRow {
  const x = d.data() ?? {};
  const kind = x.kind === 'alert_resolution_rejected' ? 'alert_resolution_rejected' : 'alert_resolution_accepted';
  return {
    id: d.id,
    userId: String(x.userId ?? ''),
    kind,
    alertId: String(x.alertId ?? ''),
    alertTitle: String(x.alertTitle ?? ''),
    read: x.read === true,
    createdAt:
      x.createdAt instanceof Timestamp ? x.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export function subscribeInAppNotificationsForUser(
  userId: string,
  onData: (items: InAppNotificationRow[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(
    collection(db, 'inAppNotifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(40),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(mapInAppNotificationDoc)),
    (err) => onError?.(err as Error),
  );
}

export async function markInAppNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'inAppNotifications', notificationId), {
    read: true,
    updatedAt: Timestamp.now(),
  });
}

export async function markInAppNotificationsReadMany(notificationIds: string[]): Promise<void> {
  const ids = [...new Set(notificationIds)].filter(Boolean);
  if (ids.length === 0) return;
  const now = Timestamp.now();
  const batchSize = 400;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.update(doc(db, 'inAppNotifications', id), { read: true, updatedAt: now });
    }
    await batch.commit();
  }
}

export async function seedAlertsIfEmpty(): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'alerts'), limit(1)));
  if (!snap.empty) return false;

  const now = Date.now();
  const batch = writeBatch(db);

  const seeds: Array<{
    id: string;
    data: Record<string, unknown>;
  }> = [
    {
      id: 'alert_1',
      data: {
        type: 'critical',
        room: 'Project War Room',
        title: 'High CO₂ Level Detected',
        message:
          'CO₂ concentration has exceeded 800 ppm. Immediate ventilation increase recommended.',
        category: 'Air Quality',
        status: 'open',
        createdAt: Timestamp.fromMillis(now - 2 * 60000),
      },
    },
    {
      id: 'alert_2',
      data: {
        type: 'warning',
        room: 'Conference Room A',
        title: 'Temperature Above Setpoint',
        message: 'Current temperature is 2°C above the comfort setpoint. HVAC system adjusting.',
        category: 'Temperature',
        status: 'open',
        createdAt: Timestamp.fromMillis(now - 15 * 60000),
      },
    },
    {
      id: 'alert_3',
      data: {
        type: 'warning',
        room: 'Executive Suite',
        title: 'Occupancy Sensor Malfunction',
        message: 'Occupancy sensor not responding. Manual verification required.',
        category: 'System',
        status: 'open',
        createdAt: Timestamp.fromMillis(now - 32 * 60000),
      },
    },
    {
      id: 'alert_4',
      data: {
        type: 'info',
        room: 'Training Room',
        title: 'Scheduled Maintenance Reminder',
        message: 'HVAC filter replacement scheduled for tomorrow at 8:00 AM.',
        category: 'Maintenance',
        status: 'open',
        createdAt: Timestamp.fromMillis(now - 60 * 60000),
      },
    },
    {
      id: 'alert_5',
      data: {
        type: 'success',
        room: 'Meeting Room B',
        title: 'Optimization Complete',
        message: 'AI has successfully optimized temperature and lighting for current occupancy.',
        category: 'Optimization',
        status: 'resolved',
        createdAt: Timestamp.fromMillis(now - 60 * 60000),
        resolvedByName: 'Facility Admin',
        resolvedAt: Timestamp.fromMillis(now - 60 * 60000),
      },
    },
    {
      id: 'alert_6',
      data: {
        type: 'warning',
        room: 'Focus Room 1',
        title: 'Humidity Level High',
        message: 'Humidity at 62%. Dehumidification system activated.',
        category: 'Air Quality',
        status: 'open',
        createdAt: Timestamp.fromMillis(now - 120 * 60000),
      },
    },
    {
      id: 'alert_7',
      data: {
        type: 'info',
        room: 'Brainstorm Hub',
        title: 'Energy Savings Achieved',
        message: 'Room achieved 15% energy savings today through smart scheduling.',
        category: 'Energy',
        status: 'resolved',
        createdAt: Timestamp.fromMillis(now - 180 * 60000),
        resolvedByName: 'Superviseur',
        resolvedAt: Timestamp.fromMillis(now - 180 * 60000),
      },
    },
    {
      id: 'alert_8',
      data: {
        type: 'critical',
        room: 'Training Room',
        title: 'HVAC System Error',
        message: 'HVAC controller communication lost. Technician notified.',
        category: 'System',
        status: 'resolved',
        createdAt: Timestamp.fromMillis(now - 240 * 60000),
        resolutionRequestedBy: 'Jean Dupont',
        resolutionRequestedAt: Timestamp.fromMillis(now - 250 * 60000),
        resolvedByName: 'Technicien terrain',
        resolvedAt: Timestamp.fromMillis(now - 240 * 60000),
      },
    },
  ];

  for (const { id, data } of seeds) {
    batch.set(doc(db, 'alerts', id), { ...data, updatedAt: Timestamp.now() });
  }
  await batch.commit();
  return true;
}

function mapRoomDoc(d: DocumentSnapshot): RoomRow {
  const x = d.data() ?? {};
  const occ = Number(x.occupancy ?? 0);
  return {
    id: d.id,
    name: String(x.name ?? ''),
    capacity: Number(x.capacity ?? 0),
    occupancy: occ,
    status: occ > 0 ? 'busy' : 'available',
  };
}

function formatLastUpdate(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// —— Rooms —— //

export async function listRooms(): Promise<RoomRow[]> {
  const snap = await getDocs(query(collection(db, 'rooms'), orderBy('name')));
  return snap.docs.map(mapRoomDoc);
}

/** Liste salles pour l’UI : capteurs = dernière mesure horodatée (`null` → afficher « -- »). */
export type RoomListRow = {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
  /** Calculé depuis les capteurs de la dernière mesure ; `0` si aucune donnée. */
  comfortScore: number;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  noise: number | null;
  light: number | null;
};

export async function listRoomsWithLatestMeasurements(): Promise<RoomListRow[]> {
  const rooms = await listRooms();
  return Promise.all(
    rooms.map(async (r) => {
      const m = await fetchLatestMeasurementRow(r.id);
      const temperature = m?.temperature ?? null;
      const humidity = m?.humidity ?? null;
      const co2 = m?.co2 ?? null;
      const noise = m?.noise ?? null;
      const light = m?.light ?? null;
      return {
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        occupancy: r.occupancy,
        status: r.status,
        comfortScore:
          computeComfortScoreFromSensors({
            temperature,
            humidity,
            co2,
            noise,
            light,
          }) ?? 0,
        temperature,
        humidity,
        co2,
        noise,
        light,
      };
    }),
  );
}

/** Dernière mesure enregistrée (avant tout nouvel enregistrement dans le même flux). */
async function fetchLatestMeasurementRow(roomId: string): Promise<MeasurementRow | null> {
  const snap = await getDocs(
    query(collection(db, 'rooms', roomId, 'measurements'), orderBy('timestamp', 'desc'), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  const raw = d.data();
  const ts = raw.timestamp as Timestamp | undefined;
  const timestampIso = ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
  return mapFirestoreDataToMeasurementRow(raw as Record<string, unknown>, timestampIso);
}

/** Réglage lumière (lux) : enregistré uniquement dans `measurements`, pas sur le document `rooms`. */
export async function updateRoomLight(roomId: string, lightLux: number): Promise<void> {
  const clamped = Math.max(150, Math.min(1000, Math.round(Number(lightLux))));
  const room = await getRoomById(roomId);
  if (!room) return;
  const prev = await fetchLatestMeasurementRow(roomId);
  const ts = Timestamp.now();
  if (prev) {
    await setRoomMeasurementDoc(roomId, ts, {
      temperature: prev.temperature,
      humidity: prev.humidity,
      co2: prev.co2,
      noise: prev.noise,
      light: clamped,
    });
    return;
  }
  // Aucune mesure existante : un seul point lumière, sans valeurs par défaut pour les autres capteurs.
  await setRoomMeasurementDoc(roomId, ts, {
    light: clamped,
    temperature: null,
    humidity: null,
    co2: null,
    noise: null,
  });
}

/** Un point d’historique capteurs : date (`timestamp`) + valeurs (température, humidité, CO₂, bruit, lumière). */
export async function appendRoomMeasurementSnapshot(
  roomId: string,
  values: {
    temperature: number;
    humidity: number;
    co2: number;
    noise: number;
    light: number;
  },
  at: Date = new Date(),
): Promise<void> {
  const ts = Timestamp.fromDate(at);
  await setRoomMeasurementDoc(roomId, ts, {
    temperature: values.temperature,
    humidity: values.humidity,
    co2: values.co2,
    noise: values.noise,
    light: values.light,
  });
}

/** Ajoute pour chaque salle un point reprenant la dernière mesure connue (ou champs null si aucune). */
export async function appendCurrentSnapshotsForAllRooms(): Promise<number> {
  const rooms = await listRooms();
  const t = Timestamp.now();
  let n = 0;
  for (const r of rooms) {
    const prev = await fetchLatestMeasurementRow(r.id);
    await setRoomMeasurementDoc(r.id, t, {
      temperature: prev?.temperature ?? null,
      humidity: prev?.humidity ?? null,
      co2: prev?.co2 ?? null,
      noise: prev?.noise ?? null,
      light: prev?.light ?? null,
    });
    n++;
  }
  return n;
}

/** Compte les mesures dont `timestamp` est dans [start, end] (bornes inclusives). */
export async function countRoomMeasurementsInRange(roomId: string, start: Date, end: Date): Promise<number> {
  if (start.getTime() > end.getTime()) return 0;
  const q = query(
    collection(db, 'rooms', roomId, 'measurements'),
    where('timestamp', '>=', Timestamp.fromDate(start)),
    where('timestamp', '<=', Timestamp.fromDate(end)),
  );
  const snap = await getDocs(q);
  return snap.size;
}

/** Supprime toutes les mesures dans [start, end] pour une salle. Retourne le nombre supprimé. */
export async function deleteRoomMeasurementsInRange(roomId: string, start: Date, end: Date): Promise<number> {
  if (start.getTime() > end.getTime()) return 0;
  const q = query(
    collection(db, 'rooms', roomId, 'measurements'),
    where('timestamp', '>=', Timestamp.fromDate(start)),
    where('timestamp', '<=', Timestamp.fromDate(end)),
  );
  const snap = await getDocs(q);
  let batch = writeBatch(db);
  let n = 0;
  let deleted = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    deleted++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
  return deleted;
}

export async function createRoom(payload: {
  name: string;
  capacity: number;
  occupancy: number;
  /** ID document Firestore dans `devices` : l’appareil est rattaché à la nouvelle salle. */
  existingDeviceId?: string;
}): Promise<string> {
  const roomRef = await addDoc(collection(db, 'rooms'), {
    name: payload.name,
    capacity: payload.capacity,
    occupancy: payload.occupancy,
    createdAt: Timestamp.now(),
  });

  if (payload.existingDeviceId) {
    await updateDoc(doc(db, 'devices', payload.existingDeviceId), {
      roomId: roomRef.id,
      lastUpdate: Timestamp.now(),
    });
  }

  return roomRef.id;
}

async function deleteMeasurementsBatch(roomId: string) {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'measurements'));
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

async function deleteDevicesForRoom(roomId: string) {
  const snap = await getDocs(query(collection(db, 'devices'), where('roomId', '==', roomId)));
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteMeasurementsBatch(roomId);
  await deleteDevicesForRoom(roomId);
  await deleteDoc(doc(db, 'rooms', roomId));
}

export async function getRoomById(roomId: string): Promise<RoomRow | null> {
  const r = await getDoc(doc(db, 'rooms', roomId));
  if (!r.exists()) return null;
  return mapRoomDoc(r);
}

// —— Measurements —— //

export async function listMeasurements(roomId: string): Promise<MeasurementRow[]> {
  const snap = await getDocs(
    query(collection(db, 'rooms', roomId, 'measurements'), orderBy('timestamp', 'desc'), limit(100)),
  );
  return snap.docs.map((d) => {
    const x = d.data();
    const ts = x.timestamp as Timestamp | undefined;
    const timestampIso = ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
    return mapFirestoreDataToMeasurementRow(x as Record<string, unknown>, timestampIso);
  });
}

// —— Dashboard —— //

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function averageNumbers(nums: number[]): number {
  if (nums.length === 0) return 0;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const DASHBOARD_24H_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DASHBOARD_MEASUREMENTS_LIMIT = 5000;

type DashboardMeasRow = {
  ms: number;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  noise: number | null;
  light: number | null;
};

function mapMeasurementDocToDashboardRow(x: Record<string, unknown>): DashboardMeasRow {
  const ts = x.timestamp as Timestamp | undefined;
  const date = ts?.toDate?.() ?? new Date(0);
  return {
    ms: date.getTime(),
    temperature: measurementNumericOrNull(x.temperature),
    humidity: measurementNumericOrNull(x.humidity),
    co2: measurementNumericOrNull(x.co2),
    noise: measurementNumericOrNull(x.noise),
    light: measurementNumericOrNull(x.light),
  };
}

/**
 * Mesures des dernières 24 h pour toutes les salles (requêtes par sous-collection).
 * Évite collectionGroup + index composite souvent absent ; repli : orderBy desc + filtre client.
 */
async function fetchMeasurementsMergedLast24h(rooms: RoomRow[], since: Date, sinceTs: Timestamp): Promise<DashboardMeasRow[]> {
  const sinceMs = since.getTime();
  const n = Math.max(1, rooms.length);
  const perRoomLimit = Math.min(2000, Math.ceil(DASHBOARD_MEASUREMENTS_LIMIT / n));

  const batches = await Promise.all(
    rooms.map(async (room) => {
      const col = collection(db, 'rooms', room.id, 'measurements');
      try {
        const qRange = query(
          col,
          where('timestamp', '>=', sinceTs),
          orderBy('timestamp', 'asc'),
          limit(perRoomLimit),
        );
        const snap = await getDocs(qRange);
        return snap.docs.map((d) => mapMeasurementDocToDashboardRow(d.data() as Record<string, unknown>));
      } catch {
        try {
          const qDesc = query(col, orderBy('timestamp', 'desc'), limit(perRoomLimit));
          const snap = await getDocs(qDesc);
          return snap.docs
            .map((d) => mapMeasurementDocToDashboardRow(d.data() as Record<string, unknown>))
            .filter((r) => r.ms >= sinceMs);
        } catch {
          return [];
        }
      }
    }),
  );

  return batches.flat().sort((a, b) => a.ms - b.ms);
}

/** Agrège le tableau de bord sur les mesures des dernières 24 h (toutes salles). */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const rooms = await listRooms();
  const since = new Date(Date.now() - DASHBOARD_24H_MS);
  const sinceTs = Timestamp.fromDate(since);
  const nowMs = Date.now();

  const rows = await fetchMeasurementsMergedLast24h(rooms, since, sinceTs);

  const temperatures = rows.map((r) => r.temperature).filter((v): v is number => v != null);
  const co2s = rows.map((r) => r.co2).filter((v): v is number => v != null);
  const noises = rows.map((r) => r.noise).filter((v): v is number => v != null);
  const lights = rows.map((r) => r.light).filter((v): v is number => v != null);

  const temperature = averageNumbers(temperatures);
  const co2 = averageNumbers(co2s);
  const noise = averageNumbers(noises);
  const light = averageNumbers(lights);

  const comfortScores = rows
    .map((r) =>
      computeComfortScoreFromSensors({
        temperature: r.temperature,
        humidity: r.humidity,
        co2: r.co2,
        noise: r.noise,
        light: r.light,
      }),
    )
    .filter((s): s is number => s != null);
  const comfortScore =
    comfortScores.length > 0
      ? Math.round(comfortScores.reduce((a, b) => a + b, 0) / comfortScores.length)
      : 0;

  const sinceMs = since.getTime();
  const startBucket = Math.floor(sinceMs / HOUR_MS) * HOUR_MS;
  type BucketCell = { temps: number[]; co2s: number[]; lights: number[]; noises: number[] };
  const bucketMap = new Map<number, BucketCell>();

  for (let b = startBucket; b <= nowMs + HOUR_MS; b += HOUR_MS) {
    bucketMap.set(b, { temps: [], co2s: [], lights: [], noises: [] });
  }

  for (const r of rows) {
    if (r.ms < sinceMs || r.ms > nowMs) continue;
    const b = Math.floor(r.ms / HOUR_MS) * HOUR_MS;
    const entry = bucketMap.get(b);
    if (!entry) continue;
    if (r.temperature != null) entry.temps.push(r.temperature);
    if (r.co2 != null) entry.co2s.push(r.co2);
    if (r.light != null) entry.lights.push(r.light);
    if (r.noise != null) entry.noises.push(r.noise);
  }

  const temperatureData: { time: string; value: number }[] = [];
  const co2Data: { time: string; value: number }[] = [];
  const lightData: { time: string; value: number }[] = [];
  const noiseData: { time: string; value: number }[] = [];

  const sortedBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);
  for (const b of sortedBuckets) {
    const cell = bucketMap.get(b);
    if (!cell) continue;
    const d = new Date(b);
    const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
    if (cell.temps.length > 0) {
      temperatureData.push({ time: label, value: averageNumbers(cell.temps) });
    }
    if (cell.co2s.length > 0) {
      co2Data.push({ time: label, value: averageNumbers(cell.co2s) });
    }
    if (cell.lights.length > 0) {
      lightData.push({ time: label, value: averageNumbers(cell.lights) });
    }
    if (cell.noises.length > 0) {
      noiseData.push({ time: label, value: averageNumbers(cell.noises) });
    }
  }

  return {
    comfortScore,
    temperature,
    co2,
    noise,
    light,
    temperatureData,
    co2Data,
    lightData,
    noiseData,
    roomOverview: {
      total: rooms.length,
      available: rooms.filter((r) => r.occupancy === 0).length,
      occupied: rooms.filter((r) => r.occupancy > 0).length,
      maintenance: 0,
    },
  };
}

// —— Users —— //

export async function listUsers(): Promise<UserRecord[]> {
  const snap = await getDocs(query(collection(db, 'userProfiles'), orderBy('name')));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name ?? ''),
      email: String(x.email ?? ''),
      role: mapUserRole(x.role),
      status: (x.status === 'inactive' ? 'inactive' : 'active') as UserRecord['status'],
      mustChangePassword: x.mustChangePassword === true,
    };
  });
}

export async function updateUser(
  userId: string,
  data: { name: string; email: string; role: AppRole; status: 'active' | 'inactive' },
): Promise<void> {
  await updateDoc(doc(db, 'userProfiles', userId), {
    name: data.name,
    email: data.email,
    role: data.role,
    status: data.status,
    updatedAt: Timestamp.now(),
  });
}

/** Supprime uniquement le document Firestore (pas le compte Firebase Authentication). */
export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'userProfiles', userId));
}

// —— Devices —— //

export async function listDevices(roomNames: Map<string, string>): Promise<DeviceRecord[]> {
  const snap = await getDocs(query(collection(db, 'devices'), orderBy('name')));
  return snap.docs.map((d) => {
    const x = d.data();
    const roomId = String(x.roomId ?? '');
    return {
      id: d.id,
      name: String(x.name ?? ''),
      deviceId: x.deviceUid ? String(x.deviceUid) : undefined,
      roomId,
      room: roomNames.get(roomId) ?? '—',
      status: (x.status as DeviceRecord['status']) || 'online',
      lastUpdate: formatLastUpdate(x.lastUpdate as Timestamp | undefined),
    };
  });
}

export async function createDevice(data: {
  name: string;
  deviceId: string;
  status: string;
}): Promise<void> {
  await addDoc(collection(db, 'devices'), {
    name: data.name,
    deviceUid: data.deviceId,
    roomId: '',
    status: data.status,
    lastUpdate: Timestamp.now(),
  });
}

export async function updateDevice(
  deviceId: string,
  data: { name: string; deviceId: string; roomId: string; status: string },
): Promise<void> {
  await updateDoc(doc(db, 'devices', deviceId), {
    name: data.name,
    deviceUid: data.deviceId,
    roomId: data.roomId,
    status: data.status,
    lastUpdate: Timestamp.now(),
  });
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await deleteDoc(doc(db, 'devices', deviceId));
}

// —— Seed (une seule fois si Firestore vide) —— //

export async function seedFirestoreIfEmpty(): Promise<boolean> {
  const snap = await getDocs(collection(db, 'rooms'));
  if (!snap.empty) return false;

  const roomSeeds = [
    { name: 'Conference Room A', capacity: 12, occupancy: 0 },
    { name: 'Conference Room B', capacity: 8, occupancy: 3 },
    { name: 'Huddle Space 1', capacity: 4, occupancy: 0 },
    { name: 'Board Room', capacity: 20, occupancy: 5 },
    { name: 'Innovation Lab', capacity: 10, occupancy: 0 },
  ];

  for (const r of roomSeeds) {
    const ref = await addDoc(collection(db, 'rooms'), {
      name: r.name,
      capacity: r.capacity,
      occupancy: r.occupancy,
      createdAt: Timestamp.now(),
    });

    for (let i = 0; i < 8; i++) {
      const t = Timestamp.fromDate(new Date(Date.now() - (8 - i) * 3600000));
      await setRoomMeasurementDoc(ref.id, t, {
        temperature: 21 + Math.random() * 3,
        humidity: 40 + Math.random() * 15,
        co2: 450 + Math.random() * 220,
        noise: 35 + Math.random() * 12,
        light: 400 + Math.random() * 100,
      });
    }

    await addDoc(collection(db, 'devices'), {
      name: `Gateway ${r.name}`,
      deviceUid: `IOT-SEED-${ref.id.slice(0, 8)}`,
      roomId: ref.id,
      status: r.occupancy > 0 ? 'online' : 'offline',
      lastUpdate: Timestamp.now(),
    });
  }

  return true;
}
