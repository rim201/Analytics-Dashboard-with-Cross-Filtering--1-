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
import { validateDeviceIpAddress } from '../utils/deviceIpValidation';
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
  /** Adresse IP du Raspberry (SSH / déploiement manuel). */
  ipAddress?: string;
  sshUser?: string;
  sshPort?: number;
  lastSensorPush?: string;
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
  const q = query(collection(db, 'inAppNotifications'), where('userId', '==', userId), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(mapInAppNotificationDoc);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(rows.slice(0, 40));
    },
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

/**
 * Temps réel : liste des salles + dernière mesure de chaque salle.
 * Déclenche `onData` à chaque changement de salle ou de dernière mesure.
 */
export function subscribeRoomsWithLatestMeasurements(
  onData: (rows: RoomListRow[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const roomUnsubs = new Map<string, () => void>();
  const roomRows = new Map<string, RoomRow>();
  const latestByRoom = new Map<string, MeasurementRow | null>();

  const emit = () => {
    const rows = Array.from(roomRows.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((r) => {
        const m = latestByRoom.get(r.id) ?? null;
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
        } as RoomListRow;
      });
    onData(rows);
  };

  const roomsUnsub = onSnapshot(
    query(collection(db, 'rooms'), orderBy('name')),
    (snap) => {
      const nextIds = new Set<string>();
      for (const d of snap.docs) {
        const room = mapRoomDoc(d);
        nextIds.add(room.id);
        roomRows.set(room.id, room);
        if (!roomUnsubs.has(room.id)) {
          const measUnsub = onSnapshot(
            query(collection(db, 'rooms', room.id, 'measurements'), orderBy('timestamp', 'desc'), limit(1)),
            (ms) => {
              if (ms.empty) {
                latestByRoom.set(room.id, null);
              } else {
                const raw = ms.docs[0].data();
                const ts = raw.timestamp as Timestamp | undefined;
                const timestampIso = ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
                latestByRoom.set(room.id, mapFirestoreDataToMeasurementRow(raw as Record<string, unknown>, timestampIso));
              }
              emit();
            },
            (e) => onError?.(e as Error),
          );
          roomUnsubs.set(room.id, measUnsub);
        }
      }
      for (const [id, unsub] of roomUnsubs) {
        if (!nextIds.has(id)) {
          unsub();
          roomUnsubs.delete(id);
          roomRows.delete(id);
          latestByRoom.delete(id);
        }
      }
      emit();
    },
    (e) => onError?.(e as Error),
  );

  return () => {
    roomsUnsub();
    for (const [, unsub] of roomUnsubs) unsub();
    roomUnsubs.clear();
    roomRows.clear();
    latestByRoom.clear();
  };
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

/**
 * Pour **chaque salle** : enregistre un point de mesure (dernières valeurs Firestore ou null).
 * Puis signale **tous** les documents `devices` ayant un `roomId` pour une capture capteurs immédiate sur Raspberry.
 */
export async function appendCurrentSnapshotsForAllRooms(): Promise<{
  snapshots: number;
  devicesSignaled: number;
}> {
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
  const devicesSignaled = await signalAllAssignedDevicesSensorCapture();
  return { snapshots: n, devicesSignaled };
}

/** `roomId` côté Firestore : chaîne ou DocumentReference — pour requêtes / comparaisons fiables. */
function deviceRoomIdFromFirestore(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id.trim();
  }
  return String(value).trim();
}

/**
 * Comme une itération de {@link appendCurrentSnapshotsForAllRooms} : snapshot (dernières valeurs) pour **une** salle,
 * puis signal `sensorCaptureRequestedAt` sur les documents `devices` dont `roomId` est cette salle.
 * À utiliser pour la capture « par salle » ou depuis la ligne IoT (salle liée).
 */
export async function appendCurrentSnapshotForRoomAndSignalLinkedDevices(roomId: string): Promise<{
  devicesSignaled: number;
}> {
  const rid = roomId.trim();
  if (!rid) {
    throw new Error('Identifiant de salle requis.');
  }
  const room = await getRoomById(rid);
  if (!room) {
    throw new Error('Salle introuvable.');
  }

  const prev = await fetchLatestMeasurementRow(rid);
  const t = Timestamp.now();
  await setRoomMeasurementDoc(rid, t, {
    temperature: prev?.temperature ?? null,
    humidity: prev?.humidity ?? null,
    co2: prev?.co2 ?? null,
    noise: prev?.noise ?? null,
    light: prev?.light ?? null,
  });

  const allDevs = await getDocs(collection(db, 'devices'));
  const now = Timestamp.now();
  let count = 0;
  for (const d of allDevs.docs) {
    if (deviceRoomIdFromFirestore(d.data().roomId) !== rid) continue;
    await updateDoc(d.ref, {
      sensorCaptureRequestedAt: now,
      lastUpdate: now,
    });
    count++;
  }
  return { devicesSignaled: count };
}

/** Demande aux Raspberry (documents \`devices\` liés à une salle) d’envoyer une mesure dès que possible. */
export async function signalAllAssignedDevicesSensorCapture(): Promise<number> {
  const snap = await getDocs(collection(db, 'devices'));
  const now = Timestamp.now();
  let count = 0;
  for (const d of snap.docs) {
    const roomId = deviceRoomIdFromFirestore(d.data().roomId);
    if (!roomId) continue;
    await updateDoc(d.ref, { sensorCaptureRequestedAt: now, lastUpdate: now });
    count++;
  }
  return count;
}

export async function signalDeviceSensorCaptureNow(deviceId: string): Promise<void> {
  await updateDoc(doc(db, 'devices', deviceId), {
    sensorCaptureRequestedAt: Timestamp.now(),
    lastUpdate: Timestamp.now(),
  });
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

// —— Rétention automatique des mesures (settings + purge) —— //

const RETENTION_SETTINGS_PATH = ['settings', 'retention'] as const;
/** Défaut : semaine ISO en cours + semaine ISO précédente (bornes au lundi 00:00 local). */
export const DEFAULT_RETENTION_WEEKS = 2;
export const MIN_RETENTION_WEEKS = 1;
export const MAX_RETENTION_WEEKS = 104;
/** Intervalle minimum entre deux purges automatiques déclenchées depuis l’app (évite les boucles). */
const AUTO_PURGE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type RetentionSettings = {
  retentionWeeks: number;
  autoPurgeEnabled: boolean;
  lastPurgeAt: Date | null;
};

function retentionSettingsRef() {
  return doc(db, RETENTION_SETTINGS_PATH[0], RETENTION_SETTINGS_PATH[1]);
}

export async function getRetentionSettings(): Promise<RetentionSettings> {
  const snap = await getDoc(retentionSettingsRef());
  if (!snap.exists()) {
    return {
      retentionWeeks: DEFAULT_RETENTION_WEEKS,
      autoPurgeEnabled: true,
      lastPurgeAt: null,
    };
  }
  const d = snap.data();
  let weeks = Math.round(Number(d.retentionWeeks));
  if (!Number.isFinite(weeks)) weeks = DEFAULT_RETENTION_WEEKS;
  weeks = Math.min(MAX_RETENTION_WEEKS, Math.max(MIN_RETENTION_WEEKS, weeks));
  const lp = d.lastPurgeAt;
  let lastPurgeAt: Date | null = null;
  if (lp instanceof Timestamp) lastPurgeAt = lp.toDate();
  else if (lp && typeof (lp as Timestamp).toDate === 'function') lastPurgeAt = (lp as Timestamp).toDate();
  return {
    retentionWeeks: weeks,
    autoPurgeEnabled: d.autoPurgeEnabled !== false,
    lastPurgeAt,
  };
}

export async function updateRetentionSettings(
  patch: Partial<{ retentionWeeks: number; autoPurgeEnabled: boolean; lastPurgeAt: Date | null }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.retentionWeeks !== undefined) {
    const w = Math.round(patch.retentionWeeks);
    payload.retentionWeeks = Math.min(MAX_RETENTION_WEEKS, Math.max(MIN_RETENTION_WEEKS, w));
  }
  if (patch.autoPurgeEnabled !== undefined) payload.autoPurgeEnabled = patch.autoPurgeEnabled;
  if (patch.lastPurgeAt !== undefined) {
    payload.lastPurgeAt =
      patch.lastPurgeAt === null ? deleteField() : Timestamp.fromDate(patch.lastPurgeAt);
  }
  await setDoc(retentionSettingsRef(), payload, { merge: true });
}

/** Supprime les mesures strictement antérieures à `before` pour une salle (par lots). */
export async function purgeRoomMeasurementsBefore(roomId: string, before: Date): Promise<number> {
  const beforeTs = Timestamp.fromDate(before);
  const col = collection(db, 'rooms', roomId, 'measurements');
  let total = 0;
  for (;;) {
    const q = query(col, where('timestamp', '<', beforeTs), limit(450));
    const snap = await getDocs(q);
    if (snap.empty) break;
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
    total += snap.size;
    if (snap.size < 450) break;
  }
  return total;
}

/**
 * Lundi 00:00:00.000 **heure locale** du début de la semaine qui contient `d` (semaine ISO : lundi = jour 1).
 */
export function startOfLocalIsoWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Borne inférieure des mesures **conservées** : lundi 00:00 local de la plus ancienne semaine ISO gardée.
 * Ex. `retentionWeeks === 2` → lundi de la semaine précédant celle en cours (on garde 2 semaines ISO complètes en cours + précédente).
 */
export function computeRetentionCutoffIsoWeeks(retentionWeeks: number, now: Date = new Date()): Date {
  const w = Math.min(MAX_RETENTION_WEEKS, Math.max(MIN_RETENTION_WEEKS, Math.round(retentionWeeks)));
  const thisMonday = startOfLocalIsoWeek(now);
  const oldestMonday = new Date(thisMonday);
  oldestMonday.setDate(oldestMonday.getDate() - (w - 1) * 7);
  return oldestMonday;
}

/**
 * Supprime toutes les mesures strictement **antérieures** au lundi 00:00 local de la plus ancienne semaine ISO conservée.
 */
export async function purgeMeasurementsOlderThanRetentionWeeks(retentionWeeks: number): Promise<{
  deleted: number;
  cutoff: Date;
}> {
  const w = Math.min(MAX_RETENTION_WEEKS, Math.max(MIN_RETENTION_WEEKS, Math.round(retentionWeeks)));
  const cutoff = computeRetentionCutoffIsoWeeks(w);
  const rooms = await listRooms();
  let deleted = 0;
  for (const r of rooms) {
    deleted += await purgeRoomMeasurementsBefore(r.id, cutoff);
  }
  return { deleted, cutoff };
}

/**
 * Si la purge auto est activée et qu’au moins 24 h se sont écoulées depuis la dernière purge, supprime les mesures trop anciennes et met à jour `lastPurgeAt`.
 */
export async function maybeRunAutoRetentionPurge(): Promise<{ ran: boolean; deleted: number }> {
  const s = await getRetentionSettings();
  if (!s.autoPurgeEnabled) return { ran: false, deleted: 0 };
  const now = Date.now();
  if (s.lastPurgeAt && now - s.lastPurgeAt.getTime() < AUTO_PURGE_MIN_INTERVAL_MS) {
    return { ran: false, deleted: 0 };
  }
  const { deleted } = await purgeMeasurementsOlderThanRetentionWeeks(s.retentionWeeks);
  await updateRetentionSettings({ lastPurgeAt: new Date() });
  return { ran: true, deleted };
}

// —— Paramètres IA (`settings/ai`) —— //

const MAX_AI_LOG_ENTRIES = 50;
const MAX_AI_LOG_MESSAGE_LEN = 380;

/** Paramètres IA réellement utilisés par les règles de suggestion (seuils capteurs + bandeau tableau de bord). */
export type AiSettings = {
  aggressiveness: number;
  autoApplyRecommendations: boolean;
  lastRetrainRequestedAt: Date | null;
};

export type AiActivityLogEntry = { at: Date; message: string };

function aiSettingsRef() {
  return doc(db, 'settings', 'ai');
}

function defaultAiSettings(): AiSettings {
  return {
    aggressiveness: 7,
    autoApplyRecommendations: false,
    lastRetrainRequestedAt: null,
  };
}

function mapAiActivityLog(raw: unknown): AiActivityLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AiActivityLogEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const msg = (x as { message?: unknown }).message;
    const at = (x as { at?: unknown }).at;
    if (typeof msg !== 'string') continue;
    let d: Date;
    if (at instanceof Timestamp) d = at.toDate();
    else if (at && typeof (at as Timestamp).toDate === 'function') d = (at as Timestamp).toDate();
    else d = new Date(0);
    out.push({ at: d, message: msg.slice(0, MAX_AI_LOG_MESSAGE_LEN) });
  }
  return out;
}

function mapSnapToAiSettings(d: Record<string, unknown>): AiSettings {
  const def = defaultAiSettings();
  let ag = Math.round(Number(d.aggressiveness));
  if (!Number.isFinite(ag)) ag = def.aggressiveness;
  ag = Math.min(10, Math.max(1, ag));
  const last = d.lastRetrainRequestedAt;
  let lastRetrainRequestedAt: Date | null = null;
  if (last instanceof Timestamp) lastRetrainRequestedAt = last.toDate();
  else if (last && typeof (last as Timestamp).toDate === 'function') lastRetrainRequestedAt = (last as Timestamp).toDate();
  return {
    aggressiveness: ag,
    autoApplyRecommendations: d.autoApplyRecommendations === true,
    lastRetrainRequestedAt,
  };
}

/**
 * Lit la configuration IA et, si demandé, le journal d’activité (une seule lecture Firestore).
 */
export async function getAiConfig(options?: { includeLog?: boolean }): Promise<{
  settings: AiSettings;
  activityLog: AiActivityLogEntry[];
}> {
  const snap = await getDoc(aiSettingsRef());
  if (!snap.exists()) {
    return {
      settings: defaultAiSettings(),
      activityLog: [],
    };
  }
  const data = snap.data() as Record<string, unknown>;
  const settings = mapSnapToAiSettings(data);
  const activityLog = options?.includeLog ? mapAiActivityLog(data.activityLog) : [];
  return { settings, activityLog };
}

export async function updateAiSettings(
  patch: Partial<Pick<AiSettings, 'aggressiveness' | 'autoApplyRecommendations'>> & {
    lastRetrainRequestedAt?: Date | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.aggressiveness !== undefined) {
    const n = Math.round(Number(patch.aggressiveness));
    payload.aggressiveness = Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 7;
  }
  if (patch.autoApplyRecommendations !== undefined) {
    payload.autoApplyRecommendations = Boolean(patch.autoApplyRecommendations);
  }
  if (patch.lastRetrainRequestedAt !== undefined) {
    payload.lastRetrainRequestedAt =
      patch.lastRetrainRequestedAt === null || patch.lastRetrainRequestedAt === undefined
        ? deleteField()
        : Timestamp.fromDate(patch.lastRetrainRequestedAt);
  }
  if (Object.keys(payload).length === 0) return;
  await setDoc(aiSettingsRef(), payload, { merge: true });
}

/** Enregistre une entrée de journal (max 50 lignes). */
export async function appendAiActivityLog(message: string): Promise<void> {
  const msg = message.trim().slice(0, MAX_AI_LOG_MESSAGE_LEN);
  if (!msg) return;
  const snap = await getDoc(aiSettingsRef());
  const prev = snap.exists() ? mapAiActivityLog((snap.data() as Record<string, unknown>).activityLog) : [];
  const entry = { at: Timestamp.now(), message: msg };
  const rest = prev.map((e) => ({ at: Timestamp.fromDate(e.at), message: e.message }));
  const next = [entry, ...rest].slice(0, MAX_AI_LOG_ENTRIES);
  await setDoc(aiSettingsRef(), { activityLog: next }, { merge: true });
}

/** Horodate la demande de réentraînement et ajoute une ligne au journal. */
export async function requestAiModelRetrain(): Promise<void> {
  const snap = await getDoc(aiSettingsRef());
  const prev = snap.exists() ? mapAiActivityLog((snap.data() as Record<string, unknown>).activityLog) : [];
  const line = `Demande de réentraînement (${new Date().toLocaleString('fr-FR')}).`.slice(0, MAX_AI_LOG_MESSAGE_LEN);
  const entry = { at: Timestamp.now(), message: line };
  const rest = prev.map((e) => ({ at: Timestamp.fromDate(e.at), message: e.message }));
  const next = [entry, ...rest].slice(0, MAX_AI_LOG_ENTRIES);
  await setDoc(
    aiSettingsRef(),
    {
      lastRetrainRequestedAt: Timestamp.now(),
      activityLog: next,
    },
    { merge: true },
  );
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

/** ID du document `devices` associé à cette salle (au plus un, convention UI). */
export async function getLinkedDeviceDocIdForRoom(roomId: string): Promise<string | undefined> {
  const rid = roomId.trim();
  if (!rid) return undefined;
  const snap = await getDocs(collection(db, 'devices'));
  for (const d of snap.docs) {
    if (deviceRoomIdFromFirestore(d.data().roomId) === rid) return d.id;
  }
  return undefined;
}

/**
 * Met à jour nom, capacité, occupation et appareil lié.
 * Refusé si la salle est encore occupée au moment de l’appel.
 */
export async function updateRoom(
  roomId: string,
  payload: {
    name: string;
    capacity: number;
    occupancy: number;
    /** Document `devices` à rattacher ; vide = aucun appareil sur cette salle. */
    existingDeviceId?: string;
  },
): Promise<void> {
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('Salle introuvable.');
  }
  if (room.occupancy > 0) {
    throw new Error('Impossible de modifier une salle tant qu’elle est occupée.');
  }

  const name = payload.name.trim();
  if (!name) {
    throw new Error('Nom requis.');
  }

  const capacity = Number(payload.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    throw new Error('Capacité invalide.');
  }

  const occupancy = Number(payload.occupancy);
  if (!Number.isFinite(occupancy) || occupancy < 0 || occupancy > capacity) {
    throw new Error("Occupation invalide (0 à capacité).");
  }

  await updateDoc(doc(db, 'rooms', roomId), {
    name,
    capacity,
    occupancy,
    updatedAt: Timestamp.now(),
  });

  const newDeviceId = (payload.existingDeviceId ?? '').trim();
  const allForRoom = await getDocs(collection(db, 'devices'));
  for (const d of allForRoom.docs) {
    if (deviceRoomIdFromFirestore(d.data().roomId) !== roomId) continue;
    if (d.id !== newDeviceId) {
      await updateDoc(d.ref, {
        roomId: '',
        lastUpdate: Timestamp.now(),
      });
    }
  }

  if (newDeviceId) {
    await updateDoc(doc(db, 'devices', newDeviceId), {
      roomId: roomId,
      lastUpdate: Timestamp.now(),
    });
  }
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
  const snap = await getDocs(collection(db, 'devices'));
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    if (deviceRoomIdFromFirestore(d.data().roomId) !== roomId) continue;
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

/** Temps réel : métadonnées d’une salle (name/capacity/occupancy/status). */
export function subscribeRoomById(
  roomId: string,
  onData: (room: RoomRow | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) onData(null);
      else onData(mapRoomDoc(snap));
    },
    (e) => onError?.(e as Error),
  );
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

/** Temps réel : dernières mesures d’une salle (max 100, tri desc). */
export function subscribeMeasurements(
  roomId: string,
  onData: (rows: MeasurementRow[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'rooms', roomId, 'measurements'), orderBy('timestamp', 'desc'), limit(100)),
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data();
        const ts = x.timestamp as Timestamp | undefined;
        const timestampIso = ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
        return mapFirestoreDataToMeasurementRow(x as Record<string, unknown>, timestampIso);
      });
      onData(rows);
    },
    (e) => onError?.(e as Error),
  );
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

/** Utilisateur SSH par défaut pour les Raspberry de salle (connexion et formulaire admin). */
export const DEFAULT_DEVICE_SSH_USER = 'pi';

export async function listDevices(roomNames: Map<string, string>): Promise<DeviceRecord[]> {
  const snap = await getDocs(collection(db, 'devices'));
  const rows = snap.docs.map((d) => {
    const x = d.data();
    const roomId = deviceRoomIdFromFirestore(x.roomId);
    const sshPort = Number(x.sshPort);
    return {
      id: d.id,
      name: String(x.name ?? ''),
      deviceId: x.deviceUid ? String(x.deviceUid) : undefined,
      roomId,
      room: roomNames.get(roomId) ?? '—',
      status: (x.status as DeviceRecord['status']) || 'online',
      lastUpdate: formatLastUpdate(x.lastUpdate as Timestamp | undefined),
      ipAddress: typeof x.ipAddress === 'string' && x.ipAddress.trim() ? x.ipAddress.trim() : undefined,
      sshUser: typeof x.sshUser === 'string' && x.sshUser.trim() ? x.sshUser.trim() : undefined,
      sshPort: Number.isFinite(sshPort) && sshPort > 0 ? sshPort : undefined,
      lastSensorPush: formatLastUpdate(x.lastSensorPushAt as Timestamp | undefined),
    };
  });
  return rows.sort((a, b) =>
    (a.ipAddress ?? '').localeCompare(b.ipAddress ?? '', undefined, { numeric: true, sensitivity: 'base' }),
  );
}

/**
 * Une salle ne peut avoir qu’un seul appareil ; une IP ne peut correspondre qu’à un seul document `devices`.
 * @param excludeDeviceDocId — document en cours d’édition (mise à jour), à exclure des contrôles.
 */
async function assertDeviceRoomAndIpExclusive(params: {
  roomId: string;
  ipAddress: string;
  excludeDeviceDocId?: string;
}): Promise<void> {
  const rid = params.roomId.trim();
  const ipValidation = validateDeviceIpAddress(params.ipAddress);
  if (!ipValidation.ok) {
    throw new Error(ipValidation.message);
  }
  const ip = ipValidation.normalized;

  if (rid) {
    const snapAll = await getDocs(collection(db, 'devices'));
    for (const d of snapAll.docs) {
      if (d.id === params.excludeDeviceDocId) continue;
      if (deviceRoomIdFromFirestore(d.data().roomId) === rid) {
        throw new Error(
          'Cette salle est déjà associée à un autre appareil IoT. Une salle = un seul appareil ; retirez l’association existante ou choisissez une autre salle.',
        );
      }
    }
  }

  const snapIp = await getDocs(query(collection(db, 'devices'), where('ipAddress', '==', ip)));
  for (const d of snapIp.docs) {
    if (d.id !== params.excludeDeviceDocId) {
      throw new Error(
        'Cette adresse IP est déjà enregistrée pour un autre appareil. Un Raspberry = un seul enregistrement.',
      );
    }
  }
}

export async function createDevice(data: {
  status: string;
  ipAddress: string;
  roomId?: string;
  sshUser?: string;
  sshPort?: number;
}): Promise<void> {
  const ipParsed = validateDeviceIpAddress(data.ipAddress ?? '');
  if (!ipParsed.ok) throw new Error(ipParsed.message);
  const ip = ipParsed.normalized;
  const port = typeof data.sshPort === 'number' && data.sshPort > 0 ? data.sshPort : 22;
  const roomId = (data.roomId ?? '').trim();
  await assertDeviceRoomAndIpExclusive({ roomId, ipAddress: ip });
  await addDoc(collection(db, 'devices'), {
    name: ip,
    deviceUid: '',
    roomId,
    status: data.status,
    lastUpdate: Timestamp.now(),
    ipAddress: ip,
    sshUser: (data.sshUser ?? DEFAULT_DEVICE_SSH_USER).trim() || DEFAULT_DEVICE_SSH_USER,
    sshPort: port,
  });
}

export async function updateDevice(
  deviceId: string,
  data: {
    roomId: string;
    status: string;
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
  },
): Promise<void> {
  const ipParsed = validateDeviceIpAddress(data.ipAddress ?? '');
  if (!ipParsed.ok) throw new Error(ipParsed.message);
  const ip = ipParsed.normalized;
  const roomId = (data.roomId ?? '').trim();
  const port = typeof data.sshPort === 'number' && data.sshPort > 0 ? data.sshPort : 22;
  await assertDeviceRoomAndIpExclusive({
    roomId,
    ipAddress: ip,
    excludeDeviceDocId: deviceId,
  });
  await updateDoc(doc(db, 'devices', deviceId), {
    name: ip,
    deviceUid: '',
    roomId,
    status: data.status,
    lastUpdate: Timestamp.now(),
    ipAddress: ip,
    sshUser: (data.sshUser ?? DEFAULT_DEVICE_SSH_USER).trim() || DEFAULT_DEVICE_SSH_USER,
    sshPort: port,
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

  for (let idx = 0; idx < roomSeeds.length; idx++) {
    const r = roomSeeds[idx]!;
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

    const seedIp = `192.0.2.${10 + idx}`;
    await addDoc(collection(db, 'devices'), {
      name: seedIp,
      deviceUid: '',
      roomId: ref.id,
      status: r.occupancy > 0 ? 'online' : 'offline',
      lastUpdate: Timestamp.now(),
      ipAddress: seedIp,
      sshUser: DEFAULT_DEVICE_SSH_USER,
      sshPort: 22,
    });
  }

  return true;
}
