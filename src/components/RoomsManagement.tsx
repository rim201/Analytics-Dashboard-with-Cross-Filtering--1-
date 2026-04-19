import { Search, Filter, Thermometer, Wind, Volume2, Sun, Plus, Trash2, Droplets, Pencil, Factory } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  comfortChipToneClass,
  statusHigherIsWorse,
  statusHumidityPct,
  statusLux,
  statusNoiseDb,
  statusPm10,
  statusPm25,
  statusTemperature,
  type ComfortStatusChip,
} from '../services/sensorComfortRules';
import {
  createRoom,
  deleteRoom,
  getLinkedDeviceDocIdForRoom,
  listDevices,
  listRooms,
  subscribeRoomsWithLatestMeasurements,
  updateRoom,
  type DeviceRecord,
  type RoomListRow,
} from '../services/firestoreApi';

interface RoomsManagementProps {
  onRoomSelect: (roomId: string) => void;
  isAdmin?: boolean;
}

function comfortPill(value: number | null, statusFn: (v: number) => ComfortStatusChip) {
  if (value == null) return null;
  const s = statusFn(value);
  return (
    <span
      className={`mt-0.5 inline-block w-max max-w-full px-1.5 py-0.5 rounded-md text-[10px] font-medium leading-tight ${comfortChipToneClass(s)}`}
    >
      {s.label}
    </span>
  );
}

const defaultAddForm = () => ({
  name: '',
  capacity: '',
  linkedDeviceId: '',
});

export default function RoomsManagement({ onRoomSelect, isAdmin = false }: RoomsManagementProps) {
  const [rooms, setRooms] = useState<RoomListRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy'>('all');
  const [roomActionMessage, setRoomActionMessage] = useState<string>('');
  const [showAddRoomForm, setShowAddRoomForm] = useState(false);
  const [addForm, setAddForm] = useState(defaultAddForm);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [addRoomSubmitting, setAddRoomSubmitting] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(defaultAddForm);
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [editRoomSubmitting, setEditRoomSubmitting] = useState(false);
  const [editLinkedLoading, setEditLinkedLoading] = useState(false);
  const [iotDevicesPicker, setIotDevicesPicker] = useState<DeviceRecord[]>([]);
  const [iotPickerLoaded, setIotPickerLoaded] = useState(false);
  const addFormRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeRoomsWithLatestMeasurements(
      (rows) => setRooms(rows),
      () => setRooms([]),
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (isAdmin || !showAddRoomForm) return;
    setShowAddRoomForm(false);
    setAddForm(defaultAddForm());
    setAddFormErrors({});
  }, [isAdmin, showAddRoomForm]);

  useEffect(() => {
    if (isAdmin || !editRoomId) return;
    setEditRoomId(null);
    setEditForm(defaultAddForm());
    setEditFormErrors({});
  }, [isAdmin, editRoomId]);

  useEffect(() => {
    if (!showAddRoomForm) return;
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showAddRoomForm]);

  useEffect(() => {
    if (!editRoomId) return;
    editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editRoomId]);

  useEffect(() => {
    if (!showAddRoomForm && !editRoomId) {
      setIotPickerLoaded(false);
      return;
    }
    setIotPickerLoaded(false);
    let cancelled = false;
    (async () => {
      try {
        const roomRows = await listRooms();
        const nameMap = new Map(roomRows.map((r) => [r.id, r.name]));
        const devs = await listDevices(nameMap);
        if (!cancelled) {
          setIotDevicesPicker([...devs].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
        }
      } catch {
        if (!cancelled) setIotDevicesPicker([]);
      } finally {
        if (!cancelled) setIotPickerLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAddRoomForm, editRoomId]);

  useEffect(() => {
    if (!editRoomId) {
      setEditLinkedLoading(false);
      return;
    }
    let cancelled = false;
    setEditLinkedLoading(true);
    void (async () => {
      try {
        const linked = await getLinkedDeviceDocIdForRoom(editRoomId);
        if (!cancelled) {
          setEditForm((f) => ({ ...f, linkedDeviceId: linked ?? '' }));
        }
      } catch {
        if (!cancelled) setEditForm((f) => ({ ...f, linkedDeviceId: '' }));
      } finally {
        if (!cancelled) setEditLinkedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editRoomId]);

  useEffect(() => {
    if (!showAddRoomForm && !editRoomId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !addRoomSubmitting && !editRoomSubmitting) {
        setShowAddRoomForm(false);
        setAddForm(defaultAddForm());
        setAddFormErrors({});
        setEditRoomId(null);
        setEditForm(defaultAddForm());
        setEditFormErrors({});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddRoomForm, editRoomId, addRoomSubmitting, editRoomSubmitting]);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getComfortColor = (score: number) => {
    if (score <= 0) return 'text-gray-500 bg-gray-100 border-gray-200';
    if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  const getStatusColor = (status: string) => {
    return status === 'busy'
      ? 'bg-blue-500'
      : 'bg-emerald-500';
  };

  const validateAddForm = () => {
    const err: Record<string, string> = {};
    const name = addForm.name.trim();
    if (!name) err.name = 'Nom requis.';

    const capacity = parseInt(addForm.capacity, 10);
    if (Number.isNaN(capacity) || capacity < 1) {
      err.capacity = 'Capacité ≥ 1 requise.';
    }

    setAddFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const validateEditForm = () => {
    const err: Record<string, string> = {};
    const name = editForm.name.trim();
    if (!name) err.name = 'Nom requis.';

    const capacity = parseInt(editForm.capacity, 10);
    if (Number.isNaN(capacity) || capacity < 1) {
      err.capacity = 'Capacité ≥ 1 requise.';
    }

    setEditFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmitAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!validateAddForm()) return;

    const capacity = parseInt(addForm.capacity, 10);
    const linkedId = addForm.linkedDeviceId.trim();

    setAddRoomSubmitting(true);
    try {
      await createRoom({
        name: addForm.name.trim(),
        capacity,
        occupancy: 0,
        existingDeviceId: linkedId || undefined,
      });
      const linked = linkedId ? iotDevicesPicker.find((d) => d.id === linkedId) : undefined;
      setRoomActionMessage(
        linked
          ? `Salle créée. L’appareil « ${linked.name} » est maintenant associé à cette salle.`
          : 'Salle ajoutée.',
      );
      setShowAddRoomForm(false);
      setAddForm(defaultAddForm());
      setAddFormErrors({});
    } catch (error) {
      setRoomActionMessage(`Échec : ${error}`);
    } finally {
      setAddRoomSubmitting(false);
    }
  };

  const handleSubmitEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editRoomId) return;
    if (!validateEditForm()) return;

    const capacity = parseInt(editForm.capacity, 10);
    const linkedId = editForm.linkedDeviceId.trim();

    setEditRoomSubmitting(true);
    try {
      await updateRoom(editRoomId, {
        name: editForm.name.trim(),
        capacity,
        existingDeviceId: linkedId || undefined,
      });
      const linked = linkedId ? iotDevicesPicker.find((d) => d.id === linkedId) : undefined;
      setRoomActionMessage(
        linked
          ? `Salle mise à jour. L’appareil « ${linked.name} » est associé à cette salle.`
          : 'Salle mise à jour.',
      );
      setEditRoomId(null);
      setEditForm(defaultAddForm());
      setEditFormErrors({});
    } catch (error) {
      setRoomActionMessage(`Échec : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEditRoomSubmitting(false);
    }
  };

  const handleDeleteRoom = async (room: RoomListRow) => {
    const ok = window.confirm(
      `Supprimer la salle « ${room.name} » ?\n\nCette action est irréversible. Cliquez sur OK pour supprimer, ou Annuler pour ne rien faire.`,
    );
    if (!ok) {
      return;
    }

    try {
      await deleteRoom(String(room.id));
      setRoomActionMessage(`La salle « ${room.name} » a été supprimée.`);
    } catch (error) {
      setRoomActionMessage(`Échec de la suppression : ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meeting Rooms</h2>
          <p className="text-sm text-gray-500">Manage and monitor all meeting rooms</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">{filteredRooms.length} rooms</span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditRoomId(null);
                setEditForm(defaultAddForm());
                setEditFormErrors({});
                if (showAddRoomForm) {
                  setShowAddRoomForm(false);
                  setAddForm(defaultAddForm());
                  setAddFormErrors({});
                } else {
                  setAddForm(defaultAddForm());
                  setAddFormErrors({});
                  setShowAddRoomForm(true);
                }
              }}
              className={`inline-flex items-center px-4 py-2 rounded-xl text-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${
                showAddRoomForm ? 'bg-gray-600 hover:bg-gray-700' : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              {showAddRoomForm ? 'Fermer' : 'Add Room'}
            </button>
          )}
        </div>
      </div>

      {isAdmin && showAddRoomForm && (
        <div
          ref={addFormRef}
          className="bg-white rounded-2xl shadow-lg border-2 border-emerald-200"
          role="region"
          aria-labelledby="add-room-title"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 rounded-t-2xl bg-emerald-50">
            <h3 id="add-room-title" className="text-lg font-semibold text-gray-900">
              Nouvelle salle
            </h3>
            <button
              type="button"
              disabled={addRoomSubmitting}
              onClick={() => {
                setShowAddRoomForm(false);
                setAddForm(defaultAddForm());
                setAddFormErrors({});
              }}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2 disabled:opacity-50"
              aria-label="Fermer le formulaire"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmitAddRoom} className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la salle <span className="text-red-500">*</span>
              </label>
              <input
                id="room-name"
                type="text"
                autoComplete="off"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {addFormErrors.name && <p className="mt-1 text-sm text-red-600">{addFormErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="room-capacity" className="block text-sm font-medium text-gray-700 mb-1">
                Capacité (places) <span className="text-red-500">*</span>
              </label>
              <input
                id="room-capacity"
                type="number"
                min={1}
                value={addForm.capacity}
                onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {addFormErrors.capacity && (
                <p className="mt-1 text-sm text-red-600">{addFormErrors.capacity}</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <label htmlFor="room-linked-device" className="block text-sm font-medium text-gray-900 mb-1">
                Appareil IoT (optionnel)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Choisissez un appareil déjà enregistré (Admin → IoT Devices). Il sera rattaché à cette nouvelle salle
                (remplace l’association précédente).
              </p>
              <select
                id="room-linked-device"
                value={addForm.linkedDeviceId}
                onChange={(e) => setAddForm((f) => ({ ...f, linkedDeviceId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="">— Aucun appareil —</option>
                {iotDevicesPicker.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ipAddress ?? d.name} · Salle : {d.room}
                  </option>
                ))}
              </select>
              {iotPickerLoaded && iotDevicesPicker.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Aucun appareil dans Firestore. Ajoutez-en dans Paramètres → IoT Devices Management.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={addRoomSubmitting}
                onClick={() => {
                  setShowAddRoomForm(false);
                  setAddForm(defaultAddForm());
                  setAddFormErrors({});
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={addRoomSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium shadow-sm hover:bg-emerald-600 disabled:opacity-50"
              >
                {addRoomSubmitting ? 'Enregistrement…' : 'Créer la salle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && editRoomId && (
        <div
          ref={editFormRef}
          className="bg-white rounded-2xl shadow-lg border-2 border-blue-200"
          role="region"
          aria-labelledby="edit-room-title"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 rounded-t-2xl bg-blue-50">
            <h3 id="edit-room-title" className="text-lg font-semibold text-gray-900">
              Modifier la salle
            </h3>
            <button
              type="button"
              disabled={editRoomSubmitting}
              onClick={() => {
                setEditRoomId(null);
                setEditForm(defaultAddForm());
                setEditFormErrors({});
              }}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2 disabled:opacity-50"
              aria-label="Fermer le formulaire"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmitEditRoom} className="px-6 py-4 space-y-4">
            <p className="text-sm text-gray-600">
              L’occupation (libre / occupée) est mise à jour automatiquement par le capteur de mouvement sur l’appareil. Vous
              pouvez modifier le nom, la capacité et l’appareil lié.
            </p>
            <div>
              <label htmlFor="edit-room-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la salle <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-room-name"
                type="text"
                autoComplete="off"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {editFormErrors.name && <p className="mt-1 text-sm text-red-600">{editFormErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="edit-room-capacity" className="block text-sm font-medium text-gray-700 mb-1">
                Capacité (places) <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-room-capacity"
                type="number"
                min={1}
                value={editForm.capacity}
                onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {editFormErrors.capacity && (
                <p className="mt-1 text-sm text-red-600">{editFormErrors.capacity}</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <label htmlFor="edit-room-linked-device" className="block text-sm font-medium text-gray-900 mb-1">
                Appareil IoT (optionnel)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {editLinkedLoading ? 'Chargement de l’association actuelle…' : 'Choisissez un appareil ou aucun.'}
              </p>
              <select
                id="edit-room-linked-device"
                disabled={editLinkedLoading}
                value={editForm.linkedDeviceId}
                onChange={(e) => setEditForm((f) => ({ ...f, linkedDeviceId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:opacity-60"
              >
                <option value="">— Aucun appareil —</option>
                {iotDevicesPicker.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ipAddress ?? d.name} · Salle : {d.room}
                  </option>
                ))}
              </select>
              {iotPickerLoaded && iotDevicesPicker.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Aucun appareil dans Firestore. Ajoutez-en dans Paramètres → IoT Devices Management.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={editRoomSubmitting}
                onClick={() => {
                  setEditRoomId(null);
                  setEditForm(defaultAddForm());
                  setEditFormErrors({});
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={editRoomSubmitting || editLinkedLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium shadow-sm hover:bg-emerald-600 disabled:opacity-50"
              >
                {editRoomSubmitting ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      )}

      {roomActionMessage && (
        <div className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700">
          {roomActionMessage}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="busy">Occupied</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition cursor-pointer"
            onClick={() => onRoomSelect(`room-${room.id}`)}
          >
            {/* Room Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{room.name}</h3>
                  <p className="text-sm text-gray-500">Capacity: {room.capacity}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getComfortColor(room.comfortScore)}`}>
                  {room.comfortScore}%
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(room.status)}`}></div>
                <span className="text-sm font-medium text-gray-700 capitalize">{room.status === 'busy' ? 'occupied' : room.status}</span>
              </div>
            </div>

            {/* Capteurs : dernière mesure (date/heure) ; pas de donnée → -- */}
            <div className="p-6 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Thermometer className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Temp</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.temperature != null ? `${room.temperature.toFixed(1)}°C` : '--'}
                    </p>
                    {comfortPill(room.temperature, statusTemperature)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Humidity</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.humidity != null ? `${Math.round(room.humidity)}%` : '--'}
                    </p>
                    {comfortPill(room.humidity, statusHumidityPct)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wind className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CO₂</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.co2 != null ? `${Math.round(room.co2)} ppm` : '--'}
                    </p>
                    {comfortPill(room.co2, (v) => statusHigherIsWorse(v, 500, 800))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Noise</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.noise != null ? `${Math.round(room.noise)} dB` : '--'}
                    </p>
                    {comfortPill(room.noise, statusNoiseDb)}
                  </div>
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Light</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.light != null ? `${Math.round(room.light)} lux` : '--'}
                    </p>
                    {comfortPill(room.light, statusLux)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Factory className="w-4 h-4 text-slate-600" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PM2.5</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.pm25 != null ? `${room.pm25.toFixed(1)}` : '--'}
                    </p>
                    {comfortPill(room.pm25, statusPm25)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                    <Factory className="w-4 h-4 text-zinc-600" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PM10</p>
                    <p className="text-sm font-medium text-gray-900 tabular-nums">
                      {room.pm10 != null ? `${room.pm10.toFixed(1)}` : '--'}
                    </p>
                    {comfortPill(room.pm10, statusPm10)}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
              <button
                type="button"
                className="flex-1 min-w-[8rem] px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
              >
                View Details
              </button>
              {isAdmin && (
                <button
                  type="button"
                  title="Modifier la salle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddRoomForm(false);
                    setAddForm(defaultAddForm());
                    setAddFormErrors({});
                    setEditRoomId(room.id);
                    setEditForm({
                      name: room.name,
                      capacity: String(room.capacity),
                      linkedDeviceId: '',
                    });
                    setEditFormErrors({});
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-medium hover:bg-blue-100 transition flex items-center justify-center gap-2"
                  aria-label={`Modifier la salle ${room.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteRoom(room);
                  }}
                  className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition flex items-center gap-2"
                  aria-label={`Delete room ${room.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
