import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  getDoc,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppRole } from './auth';

// —— Types (alignés avec l’ancienne API Django) —— //

export type RoomRow = {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
  comfortScore: number;
  temperature: number;
  co2: number;
  noise: number;
  light: number;
};

export type MeasurementRow = {
  timestamp: string;
  temperature: number;
  humidity: number;
  co2: number;
  noise: number;
  light: number;
};

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
    comfortScore: Number(x.comfortScore ?? 92),
    temperature: Number(x.temperature ?? 0),
    co2: Number(x.co2 ?? 0),
    noise: Number(x.noise ?? 0),
    light: Number(x.light ?? 0),
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

/** Réglage cible d’éclairage (lux) pour une salle — réservé à l’UI admin. */
export async function updateRoomLight(roomId: string, lightLux: number): Promise<void> {
  const clamped = Math.max(150, Math.min(1000, Math.round(Number(lightLux))));
  await updateDoc(doc(db, 'rooms', roomId), {
    light: clamped,
    updatedAt: Timestamp.now(),
  });
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
    comfortScore: 92,
    temperature: 21 + Math.random() * 3,
    humidity: 40 + Math.random() * 15,
    co2: 450 + Math.random() * 250,
    noise: 36 + Math.random() * 12,
    light: 380 + Math.random() * 120,
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
    return {
      timestamp: ts?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      temperature: Number(x.temperature ?? 0),
      humidity: Number(x.humidity ?? 0),
      co2: Number(x.co2 ?? 0),
      noise: Number(x.noise ?? 0),
      light: Number(x.light ?? 0),
    };
  });
}

// —— Dashboard —— //

const fallbackTemperatureData = [
  { time: '00:00', value: 21.5 },
  { time: '04:00', value: 21.2 },
  { time: '08:00', value: 22.1 },
  { time: '12:00', value: 23.5 },
  { time: '16:00', value: 22.8 },
  { time: '20:00', value: 21.9 },
];

const fallbackCo2Data = [
  { time: '00:00', value: 420 },
  { time: '04:00', value: 410 },
  { time: '08:00', value: 580 },
  { time: '12:00', value: 720 },
  { time: '16:00', value: 650 },
  { time: '20:00', value: 480 },
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const rooms = await listRooms();
  const n = rooms.length || 1;
  const temperature = round1(rooms.reduce((s, r) => s + r.temperature, 0) / n);
  const co2 = round1(rooms.reduce((s, r) => s + r.co2, 0) / n);
  const noise = round1(rooms.reduce((s, r) => s + r.noise, 0) / n);
  const light = round1(rooms.reduce((s, r) => s + r.light, 0) / n);
  const comfortScore = Math.round(rooms.reduce((s, r) => s + r.comfortScore, 0) / n) || 92;

  let temperatureData = fallbackTemperatureData;
  let co2Data = fallbackCo2Data;

  try {
    const mq = query(collectionGroup(db, 'measurements'), orderBy('timestamp', 'desc'), limit(48));
    const mSnap = await getDocs(mq);
    const points = mSnap.docs
      .map((d) => {
        const x = d.data();
        const ts = x.timestamp as Timestamp | undefined;
        const date = ts?.toDate?.() ?? new Date();
        return {
          time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          temperature: Number(x.temperature ?? 0),
          co2: Number(x.co2 ?? 0),
          t: date.getTime(),
        };
      })
      .sort((a, b) => a.t - b.t);
    if (points.length > 0) {
      temperatureData = points.map((p) => ({ time: p.time, value: p.temperature }));
      co2Data = points.map((p) => ({ time: p.time, value: p.co2 }));
    }
  } catch {
    /* index manquant ou pas de mesures : fallback */
  }

  return {
    comfortScore,
    temperature,
    co2,
    noise,
    light,
    temperatureData,
    co2Data,
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
      comfortScore: 88 + Math.floor(Math.random() * 8),
      temperature: 21.2 + Math.random() * 2.5,
      humidity: 42 + Math.random() * 10,
      co2: 480 + Math.random() * 200,
      noise: 38 + Math.random() * 8,
      light: 420 + Math.random() * 80,
      createdAt: Timestamp.now(),
    });

    for (let i = 0; i < 8; i++) {
      const t = Timestamp.fromDate(new Date(Date.now() - (8 - i) * 3600000));
      await addDoc(collection(db, 'rooms', ref.id, 'measurements'), {
        timestamp: t,
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
