import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
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
  role: 'Admin' | 'Facility Manager' | 'Employee';
  status: 'active' | 'inactive';
};

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
  const snap = await getDocs(query(collection(db, 'users'), orderBy('name')));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name ?? ''),
      email: String(x.email ?? ''),
      role: (x.role as UserRecord['role']) || 'Employee',
      status: (x.status as UserRecord['status']) || 'active',
    };
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  role: string;
  status: string;
}): Promise<void> {
  await addDoc(collection(db, 'users'), data);
}

export async function updateUser(
  userId: string,
  data: { name: string; email: string; role: string; status: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), data);
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId));
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

  await addDoc(collection(db, 'users'), {
    name: 'Admin Demo',
    email: 'admin@example.com',
    role: 'Admin',
    status: 'active',
  });
  await addDoc(collection(db, 'users'), {
    name: 'Facility Manager',
    email: 'facility@example.com',
    role: 'Facility Manager',
    status: 'active',
  });

  return true;
}
