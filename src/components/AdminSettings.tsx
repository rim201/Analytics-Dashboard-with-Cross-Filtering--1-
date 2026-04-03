import {
  Users,
  Cpu,
  Shield,
  Settings as SettingsIcon,
  Wifi,
  Brain,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  CalendarClock,
  Camera,
  Database,
  FileText,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  appendCurrentSnapshotsForAllRooms,
  appendAiActivityLog,
  createDevice,
  DEFAULT_RETENTION_WEEKS,
  deleteDevice,
  deleteRoomMeasurementsInRange,
  getAiConfig,
  getRetentionSettings,
  listDevices,
  listRooms,
  listUsers,
  MAX_RETENTION_WEEKS,
  MIN_RETENTION_WEEKS,
  deleteUser,
  purgeMeasurementsOlderThanRetentionWeeks,
  requestAiModelRetrain,
  updateAiSettings,
  updateDevice,
  updateRetentionSettings,
  updateUser,
  type AiActivityLogEntry,
  type DeviceRecord,
  type UserRecord,
} from '../services/firestoreApi';
import {
  createUserWithProfile,
  createUserWithProfileErrorMessage,
  DEFAULT_ADMIN_EMAIL,
  isLeoniDefaultAdminEmail,
  roleLabel,
} from '../services/auth';
import { auth } from '../firebase';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'devices' | 'roomData' | 'system' | 'ai'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as UserRecord['role'],
    status: 'active' as UserRecord['status'],
  });
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    deviceId: '',
    roomId: '',
    status: 'online' as DeviceRecord['status'],
  });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [userErrors, setUserErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [deviceErrors, setDeviceErrors] = useState<{ name?: string }>({});
  const [measureRoomId, setMeasureRoomId] = useState('');
  const [measureDateFrom, setMeasureDateFrom] = useState('');
  const [measureDateTo, setMeasureDateTo] = useState('');
  const [measureBusy, setMeasureBusy] = useState(false);
  const [retentionWeeksInput, setRetentionWeeksInput] = useState(String(DEFAULT_RETENTION_WEEKS));
  const [retentionAutoPurge, setRetentionAutoPurge] = useState(true);
  const [retentionLastPurge, setRetentionLastPurge] = useState<Date | null>(null);
  const [retentionLoadBusy, setRetentionLoadBusy] = useState(false);
  const [retentionActionBusy, setRetentionActionBusy] = useState(false);
  const [aiForm, setAiForm] = useState({
    aggressiveness: 7,
    autoApplyRecommendations: false,
  });
  const [aiActivityLog, setAiActivityLog] = useState<AiActivityLogEntry[]>([]);
  const [aiLastRetrain, setAiLastRetrain] = useState<Date | null>(null);
  const [aiLoadBusy, setAiLoadBusy] = useState(false);
  const [aiSaveBusy, setAiSaveBusy] = useState(false);
  const [aiLogModalOpen, setAiLogModalOpen] = useState(false);

  const showToast = (type: ToastState['type'], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const reloadAll = async () => {
    try {
      const roomRows = await listRooms();
      const nameMap = new Map(roomRows.map((r) => [r.id, r.name]));
      setRooms(roomRows.map((r) => ({ id: r.id, name: r.name })));
      const [u, d] = await Promise.all([listUsers(), listDevices(nameMap)]);
      setUsers(u);
      setDevices(d);
    } catch {
      setUsers([]);
      setDevices([]);
      setRooms([]);
    }
  };

  useEffect(() => {
    void reloadAll();
  }, []);

  useEffect(() => {
    if (activeTab !== 'system') return;
    let cancelled = false;
    setRetentionLoadBusy(true);
    void (async () => {
      try {
        const s = await getRetentionSettings();
        if (cancelled) return;
        setRetentionWeeksInput(String(s.retentionWeeks));
        setRetentionAutoPurge(s.autoPurgeEnabled);
        setRetentionLastPurge(s.lastPurgeAt);
      } catch {
        if (!cancelled) {
          setRetentionWeeksInput(String(DEFAULT_RETENTION_WEEKS));
          setRetentionAutoPurge(true);
          setRetentionLastPurge(null);
        }
      } finally {
        if (!cancelled) setRetentionLoadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'ai') return;
    let cancelled = false;
    setAiLoadBusy(true);
    void (async () => {
      try {
        const { settings, activityLog } = await getAiConfig({ includeLog: true });
        if (cancelled) return;
        setAiForm({
          aggressiveness: settings.aggressiveness,
          autoApplyRecommendations: settings.autoApplyRecommendations,
        });
        setAiActivityLog(activityLog);
        setAiLastRetrain(settings.lastRetrainRequestedAt);
      } catch {
        if (!cancelled) {
          setAiActivityLog([]);
        }
      } finally {
        if (!cancelled) setAiLoadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab !== 'users') {
      setUserModalOpen(false);
      setEditingUser(null);
    }
    if (tab !== 'devices') {
      setDeviceModalOpen(false);
      setEditingDevice(null);
    }
  };

  const openAddUserModal = () => {
    setDeviceModalOpen(false);
    setEditingDevice(null);
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', role: 'user', status: 'active' });
    setUserErrors({});
    setUserModalOpen(true);
  };

  const openEditUserModal = (user: UserRecord) => {
    setDeviceModalOpen(false);
    setEditingDevice(null);
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setUserErrors({});
    setUserModalOpen(true);
  };

  const submitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; email?: string; password?: string } = {};
    const nameTrim = userForm.name.trim();
    const emailTrim = userForm.email.trim();
    const emailLc = emailTrim.toLowerCase();

    if (!nameTrim) errors.name = 'Le nom est obligatoire.';
    else if (nameTrim.length > 120) errors.name = 'Nom trop long (120 caractères max).';

    if (!emailTrim) errors.email = 'L’e-mail est obligatoire.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      errors.email = 'Format d’e-mail invalide.';
    }

    if (!editingUser) {
      if (isLeoniDefaultAdminEmail(emailLc)) {
        errors.email = `L’adresse ${DEFAULT_ADMIN_EMAIL} est réservée au compte administrateur système.`;
      } else if (users.some((u) => u.email.toLowerCase() === emailLc)) {
        errors.email =
          'Un profil avec cet e-mail existe déjà. Modifiez l’utilisateur ou utilisez un autre e-mail.';
      }
      if (!userForm.password || userForm.password.length < 6) {
        errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
      } else if (userForm.password.length > 128) {
        errors.password = 'Mot de passe trop long (128 caractères max).';
      }
    }

    setUserErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      if (editingUser) {
        const role = isLeoniDefaultAdminEmail(editingUser.email) ? 'admin' : userForm.role;
        await updateUser(editingUser.id, {
          name: nameTrim,
          email: emailTrim,
          role,
          status: userForm.status,
        });
      } else {
        await createUserWithProfile(emailTrim, userForm.password, {
          name: nameTrim,
          role: userForm.role,
          status: userForm.status,
        });
      }
      setUserModalOpen(false);
      setEditingUser(null);
      await reloadAll();
      showToast('success', editingUser ? 'User updated successfully.' : 'User created successfully.');
    } catch (err) {
      showToast('error', editingUser ? 'Échec de l’enregistrement.' : createUserWithProfileErrorMessage(err));
    }
  };

  const deleteUserById = async (id: string) => {
    const row = users.find((u) => u.id === id);
    if (row && isLeoniDefaultAdminEmail(row.email)) {
      showToast('error', 'Ce compte administrateur principal ne peut pas être supprimé.');
      return;
    }
    if (id === auth.currentUser?.uid) {
      showToast('error', 'Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (
      !window.confirm(
        'Supprimer cet utilisateur ?\n\nLe profil sera supprimé de Firestore. Le compte Firebase Authentication (connexion) reste inchangé — vous pourrez le retirer manuellement dans la console Firebase si besoin.',
      )
    ) {
      return;
    }
    try {
      await deleteUser(id);
      await reloadAll();
      showToast('success', 'Profil utilisateur supprimé.');
    } catch {
      showToast('error', 'Impossible de supprimer le profil.');
    }
  };

  const openAddDeviceModal = () => {
    setUserModalOpen(false);
    setEditingUser(null);
    setEditingDevice(null);
    setDeviceForm({
      name: '',
      deviceId: '',
      roomId: '',
      status: 'online',
    });
    setDeviceErrors({});
    setDeviceModalOpen(true);
  };

  const openEditDeviceModal = (device: DeviceRecord) => {
    setUserModalOpen(false);
    setEditingUser(null);
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      deviceId: device.deviceId || '',
      roomId: String(device.roomId || ''),
      status: device.status,
    });
    setDeviceErrors({});
    setDeviceModalOpen(true);
  };

  const submitDeviceForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string } = {};
    if (!deviceForm.name.trim()) errors.name = 'Name is required.';
    setDeviceErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      if (editingDevice) {
        await updateDevice(editingDevice.id, {
          name: deviceForm.name,
          deviceId: deviceForm.deviceId.trim(),
          roomId: deviceForm.roomId,
          status: deviceForm.status,
        });
      } else {
        await createDevice({
          name: deviceForm.name,
          deviceId: deviceForm.deviceId.trim(),
          status: deviceForm.status,
        });
      }
      setDeviceModalOpen(false);
      setEditingDevice(null);
      await reloadAll();
      showToast('success', editingDevice ? 'Device updated successfully.' : 'Device created successfully.');
    } catch {
      showToast('error', 'Failed to save device.');
    }
  };

  const handleAppendSnapshotsAllRooms = async () => {
    setMeasureBusy(true);
    try {
      const n = await appendCurrentSnapshotsForAllRooms();
      showToast('success', `${n} série(s) de mesures enregistrée(s) (date + temp., humidité, CO₂, bruit, lumière).`);
    } catch {
      showToast('error', 'Impossible d’enregistrer les mesures.');
    } finally {
      setMeasureBusy(false);
    }
  };

  const handleDeleteMeasureRange = async () => {
    if (!measureRoomId || !measureDateFrom || !measureDateTo) {
      showToast('error', 'Choisissez une salle et les deux dates / heures.');
      return;
    }
    const start = new Date(measureDateFrom);
    const end = new Date(measureDateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      showToast('error', 'Dates invalides.');
      return;
    }
    if (start > end) {
      showToast('error', 'La date de début doit précéder la fin.');
      return;
    }
    const label = rooms.find((r) => r.id === measureRoomId)?.name ?? measureRoomId;
    if (
      !window.confirm(
        `Supprimer toutes les mesures de « ${label} » entre ${start.toLocaleString('fr-FR')} et ${end.toLocaleString('fr-FR')} ?`,
      )
    ) {
      return;
    }
    setMeasureBusy(true);
    try {
      const n = await deleteRoomMeasurementsInRange(measureRoomId, start, end);
      showToast('success', `${n} enregistrement(s) supprimé(s).`);
    } catch {
      showToast('error', 'Impossible de supprimer (vérifiez les règles Firestore ou un index).');
    } finally {
      setMeasureBusy(false);
    }
  };

  const parseRetentionWeeksFromInput = (): number | null => {
    const n = parseInt(retentionWeeksInput.trim(), 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_RETENTION_WEEKS, Math.max(MIN_RETENTION_WEEKS, n));
  };

  const handleSaveRetentionSettings = async () => {
    const weeks = parseRetentionWeeksFromInput();
    if (weeks === null) {
      showToast('error', 'Nombre de semaines invalide.');
      return;
    }
    setRetentionActionBusy(true);
    try {
      await updateRetentionSettings({ retentionWeeks: weeks, autoPurgeEnabled: retentionAutoPurge });
      setRetentionWeeksInput(String(weeks));
      showToast('success', 'Paramètres de rétention enregistrés.');
    } catch {
      showToast('error', 'Impossible d’enregistrer les paramètres.');
    } finally {
      setRetentionActionBusy(false);
    }
  };

  const handleRunRetentionPurgeNow = async () => {
    const weeks = parseRetentionWeeksFromInput();
    if (weeks === null) {
      showToast('error', 'Nombre de semaines invalide.');
      return;
    }
    if (
      !window.confirm(
        `Supprimer toutes les mesures antérieures au lundi 00:00 (heure locale) de la plus ancienne des ${weeks} semaine(s) ISO conservées ? Toutes les salles sont concernées. Irréversible.`,
      )
    ) {
      return;
    }
    setRetentionActionBusy(true);
    try {
      const { deleted, cutoff } = await purgeMeasurementsOlderThanRetentionWeeks(weeks);
      await updateRetentionSettings({
        retentionWeeks: weeks,
        autoPurgeEnabled: retentionAutoPurge,
        lastPurgeAt: new Date(),
      });
      setRetentionLastPurge(new Date());
      showToast(
        'success',
        `${deleted} mesure(s) supprimée(s) — conservation à partir du ${cutoff.toLocaleString('fr-FR')} (lundi 0h, semaines ISO).`,
      );
    } catch {
      showToast('error', 'Échec du nettoyage (réseau, règles Firestore ou index).');
    } finally {
      setRetentionActionBusy(false);
    }
  };

  const refreshAiBundle = async () => {
    const { settings, activityLog } = await getAiConfig({ includeLog: true });
    setAiForm({
      aggressiveness: settings.aggressiveness,
      autoApplyRecommendations: settings.autoApplyRecommendations,
    });
    setAiActivityLog(activityLog);
    setAiLastRetrain(settings.lastRetrainRequestedAt);
  };

  const handleSaveAiSettings = async () => {
    setAiSaveBusy(true);
    try {
      await updateAiSettings({
        aggressiveness: aiForm.aggressiveness,
        autoApplyRecommendations: aiForm.autoApplyRecommendations,
      });
      await appendAiActivityLog(`Paramètres IA enregistrés (${new Date().toLocaleString('fr-FR')}).`);
      await refreshAiBundle();
      showToast('success', 'Configuration IA enregistrée.');
    } catch {
      showToast('error', 'Impossible d’enregistrer la configuration IA.');
    } finally {
      setAiSaveBusy(false);
    }
  };

  const handleAiRetrain = async () => {
    if (
      !window.confirm(
        'Enregistrer une demande de réentraînement ? (Aucun job cloud n’est déclenché automatiquement dans cette version ; l’événement est journalisé.)',
      )
    ) {
      return;
    }
    setAiSaveBusy(true);
    try {
      await requestAiModelRetrain();
      await refreshAiBundle();
      showToast('success', 'Demande enregistrée dans le journal.');
    } catch {
      showToast('error', 'Échec de l’enregistrement.');
    } finally {
      setAiSaveBusy(false);
    }
  };

  const deleteDeviceById = async (id: string) => {
    if (!window.confirm('Delete this device?')) return;
    try {
      await deleteDevice(id);
      await reloadAll();
      showToast('success', 'Device deleted successfully.');
    } catch {
      showToast('error', 'Failed to delete device.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'offline':
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const activeUsers = users.filter((u) => u.status === 'active').length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg border text-sm ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin & Settings</h2>
        <p className="text-sm text-gray-500">Manage users, devices, and system configuration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Active Users</span>
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{activeUsers}/{users.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">IoT Devices</span>
            <Wifi className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{onlineDevices}/{devices.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">System Health</span>
            <Cpu className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">98.5%</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">AI Model</span>
            <Brain className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">v2.4.1</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 inline-flex space-x-1">
        {[
          { id: 'users' as const, label: 'Users', icon: Users },
          { id: 'devices' as const, label: 'IoT Devices', icon: Wifi },
          { id: 'roomData' as const, label: 'Mesures salles', icon: CalendarClock },
          { id: 'system' as const, label: 'System', icon: Cpu },
          { id: 'ai' as const, label: 'AI Config', icon: Brain },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">User Management</h3>
            <button
              type="button"
              onClick={openAddUserModal}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
            >
              Add User
            </button>
          </div>
          {userModalOpen && (
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
              <form onSubmit={submitUserForm} className="mx-auto max-w-2xl space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingUser ? 'Edit User' : 'Add User'}
                </h3>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Name</label>
                  <input
                    value={userForm.name}
                    onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  {userErrors.name && <p className="mt-1 text-xs text-red-600">{userErrors.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                    disabled={!!editingUser}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                    required
                  />
                  {userErrors.email && <p className="mt-1 text-xs text-red-600">{userErrors.email}</p>}
                </div>
                {!editingUser && (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Password</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      autoComplete="new-password"
                    />
                    {userErrors.password && <p className="mt-1 text-xs text-red-600">{userErrors.password}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm((p) => ({ ...p, role: e.target.value as UserRecord['role'] }))
                      }
                      disabled={!!editingUser && isLeoniDefaultAdminEmail(editingUser.email)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-600"
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                      <option value="technicien">technicien</option>
                    </select>
                    {editingUser && isLeoniDefaultAdminEmail(editingUser.email) ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Le rôle admin de ce compte ne peut pas être modifié.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Status</label>
                    <select
                      value={userForm.status}
                      onChange={(e) =>
                        setUserForm((p) => ({ ...p, status: e.target.value as UserRecord['status'] }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUserModalOpen(false);
                      setEditingUser(null);
                      setUserErrors({});
                    }}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600">
                    {editingUser ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-full flex items-center justify-center text-white font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="align-middle">{user.email}</span>
                      {user.mustChangePassword ? (
                        <span className="ml-2 inline-flex align-middle px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          MDP à définir
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium border capitalize ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openEditUserModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit className="w-4 h-4" />
                        </button>
                        {!isLeoniDefaultAdminEmail(user.email) ? (
                          <button onClick={() => deleteUserById(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">IoT Devices Management</h3>
            <button
              type="button"
              onClick={openAddDeviceModal}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
            >
              Add Device
            </button>
          </div>
          {deviceModalOpen && (
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
              <form onSubmit={submitDeviceForm} className="mx-auto max-w-2xl space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingDevice ? 'Edit Device' : 'Add Device'}
                </h3>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Name</label>
                  <input
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  {deviceErrors.name && <p className="mt-1 text-xs text-red-600">{deviceErrors.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Device ID (hardware)</label>
                  <input
                    value={deviceForm.deviceId}
                    onChange={(e) => setDeviceForm((p) => ({ ...p, deviceId: e.target.value }))}
                    placeholder="Optional external ID"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {!editingDevice && (
                  <p className="text-xs text-gray-500">
                    La salle apparaîtra dans le tableau une fois l’appareil associé depuis la création d’une salle
                    (Rooms).
                  </p>
                )}
                {editingDevice ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm text-gray-600">Room</label>
                      <select
                        value={deviceForm.roomId}
                        onChange={(e) => setDeviceForm((p) => ({ ...p, roomId: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">— Non assigné —</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-gray-600">Status</label>
                      <select
                        value={deviceForm.status}
                        onChange={(e) =>
                          setDeviceForm((p) => ({
                            ...p,
                            status: e.target.value as DeviceRecord['status'],
                          }))
                        }
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="online">online</option>
                        <option value="offline">offline</option>
                        <option value="error">error</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Status</label>
                    <select
                      value={deviceForm.status}
                      onChange={(e) =>
                        setDeviceForm((p) => ({
                          ...p,
                          status: e.target.value as DeviceRecord['status'],
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="online">online</option>
                      <option value="offline">offline</option>
                      <option value="error">error</option>
                    </select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceModalOpen(false);
                      setEditingDevice(null);
                      setDeviceErrors({});
                    }}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600">
                    {editingDevice ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Update</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Wifi className="w-5 h-5 text-gray-400 mr-3" />
                        <div className="text-sm font-medium text-gray-900">{device.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono text-xs">
                      {device.deviceId || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{device.room}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium border capitalize ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.lastUpdate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openEditDeviceModal(device)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteDeviceById(device.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roomData' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Mesures salles</h3>
            <p className="mt-2 text-sm text-gray-600 max-w-3xl">
              Gérez l’historique des capteurs (température, humidité, CO₂, bruit, lumière). Les courbes et les dernières
              valeurs se consultent dans le détail de chaque salle.{' '}
              <strong className="font-medium text-gray-800">Capturer l’état actuel</strong> ajoute pour chaque salle un
              point daté du moment du clic, en reprenant la dernière mesure connue (ou des valeurs vides).
            </p>
            <div className="mt-4">
              <button
                type="button"
                disabled={measureBusy || rooms.length === 0}
                onClick={() => void handleAppendSnapshotsAllRooms()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera className="h-4 w-4 shrink-0" aria-hidden />
                Capturer l’état actuel (toutes les salles)
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 max-w-2xl">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Suppression par période</h4>
              <p className="mt-1 text-sm text-gray-600">
                Choisissez une salle et un intervalle : toutes les mesures dont l’horodatage est compris dans cette plage
                seront supprimées définitivement.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Salle</label>
              <select
                value={measureRoomId}
                onChange={(e) => setMeasureRoomId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">— Choisir —</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Du (date et heure)</label>
                <input
                  type="datetime-local"
                  value={measureDateFrom}
                  onChange={(e) => setMeasureDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Au (date et heure)</label>
                <input
                  type="datetime-local"
                  value={measureDateTo}
                  onChange={(e) => setMeasureDateTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                disabled={measureBusy}
                onClick={() => void handleDeleteMeasureRange()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                Supprimer la période
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="space-y-4">
          {/* System Health */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">System Health Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
                <div>
                  <div className="font-medium text-gray-900">API Server</div>
                  <div className="text-sm text-emerald-600">Operational</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
                <div>
                  <div className="font-medium text-gray-900">Database</div>
                  <div className="text-sm text-emerald-600">Operational</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="w-8 h-8 text-amber-600" />
                <div>
                  <div className="font-medium text-gray-900">Cache Server</div>
                  <div className="text-sm text-amber-600">High Load</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rétention des mesures */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-6 h-6 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Rétention des mesures (Firestore)</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4 max-w-3xl">
              La rétention se calcule en <strong>semaines ISO</strong> (lundi 00:00 → dimanche, selon l’heure locale du
              navigateur). Les mesures dont l’horodatage est <strong>avant le lundi 0h</strong> de la plus ancienne semaine
              gardée sont supprimées. Par défaut : <strong>2 semaines ISO</strong> (semaine en cours + semaine précédente).
              Purge automatique au plus une fois par 24 h lorsqu’un admin ouvre l’app, si l’option est activée.
            </p>
            {retentionLoadBusy ? (
              <p className="text-sm text-gray-500">Chargement des paramètres…</p>
            ) : (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label htmlFor="retention-weeks" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de semaines ISO à conserver
                  </label>
                  <input
                    id="retention-weeks"
                    type="number"
                    min={MIN_RETENTION_WEEKS}
                    max={MAX_RETENTION_WEEKS}
                    value={retentionWeeksInput}
                    onChange={(e) => setRetentionWeeksInput(e.target.value)}
                    disabled={retentionActionBusy}
                    className="w-32 rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Entre {MIN_RETENTION_WEEKS} et {MAX_RETENTION_WEEKS}. Seuil de suppression : lundi 0h local de la
                    semaine la plus ancienne encore incluse.
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-medium text-gray-900">Purge automatique</div>
                    <div className="text-sm text-gray-500">
                      Lancer le nettoyage selon ces réglages (max. 1× / 24 h par session admin)
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={retentionAutoPurge}
                      onChange={(e) => setRetentionAutoPurge(e.target.checked)}
                      disabled={retentionActionBusy}
                    />
                    <div className="relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 peer-disabled:opacity-50" />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Dernière purge enregistrée :{' '}
                  {retentionLastPurge
                    ? retentionLastPurge.toLocaleString('fr-FR')
                    : '— (aucune encore en base)'}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    disabled={retentionActionBusy}
                    onClick={() => void handleSaveRetentionSettings()}
                    className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Enregistrer les paramètres
                  </button>
                  <button
                    type="button"
                    disabled={retentionActionBusy}
                    onClick={() => void handleRunRetentionPurgeNow()}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    Nettoyer maintenant
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Security & Access Control</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900">Two-Factor Authentication</div>
                  <div className="text-sm text-gray-500">Require 2FA for all admin users</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900">Session Timeout</div>
                  <div className="text-sm text-gray-500">Auto logout after 30 minutes of inactivity</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200/50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2">IA — journal & réentraînement</h3>
                  {aiLoadBusy ? (
                    <p className="text-sm text-gray-500">Chargement…</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-2">
                        Historique des actions et demande de réentraînement (journalisée dans Firestore, sans job cloud
                        automatique ici).
                      </p>
                      <p className="text-xs text-gray-500">
                        Dernière demande de réentraînement :{' '}
                        {aiLastRetrain ? aiLastRetrain.toLocaleString('fr-FR') : '—'}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={aiSaveBusy || aiLoadBusy}
                  onClick={() => void handleAiRetrain()}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  Demande de réentraînement
                </button>
                <button
                  type="button"
                  disabled={aiLoadBusy}
                  onClick={() => {
                    setAiLogModalOpen(true);
                    void (async () => {
                      try {
                        const { activityLog } = await getAiConfig({ includeLog: true });
                        setAiActivityLog(activityLog);
                      } catch {
                        /* ignore */
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition shadow-sm border border-gray-200"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  Journal
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Comportement des suggestions</h3>
            {aiLoadBusy ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : (
              <div className="space-y-5 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agressivité (1 = prudent, 10 = plus de messages){' '}
                    <span className="text-emerald-600">({aiForm.aggressiveness})</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={aiForm.aggressiveness}
                    onChange={(e) =>
                      setAiForm((p) => ({ ...p, aggressiveness: parseInt(e.target.value, 10) || 7 }))
                    }
                    disabled={aiSaveBusy}
                    className="w-full h-2 bg-emerald-200 rounded-full appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Prudent</span>
                    <span>Agressif</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Ajuste les seuils CO₂, température et lumière pour le tableau de bord et la fiche salle.
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-medium text-gray-900">Application auto des recommandations</div>
                    <div className="text-sm text-gray-500">
                      Si désactivé, le tableau de bord indique que les suggestions sont à valider manuellement.
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={aiForm.autoApplyRecommendations}
                      onChange={(e) =>
                        setAiForm((p) => ({ ...p, autoApplyRecommendations: e.target.checked }))
                      }
                      disabled={aiSaveBusy}
                    />
                    <div className="relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 peer-disabled:opacity-50" />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={aiSaveBusy}
                  onClick={() => void handleSaveAiSettings()}
                  className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          {aiLogModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-log-title"
              onClick={() => setAiLogModalOpen(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[min(80vh,520px)] flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h4 id="ai-log-title" className="font-semibold text-gray-900">
                    Journal IA
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAiLogModalOpen(false)}
                    className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100"
                  >
                    Fermer
                  </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 text-sm space-y-3">
                  {aiActivityLog.length === 0 ? (
                    <p className="text-gray-500">Aucune entrée pour l’instant.</p>
                  ) : (
                    aiActivityLog.map((entry, idx) => (
                      <div key={`${entry.at.getTime()}-${idx}`} className="border-b border-gray-100 pb-2 last:border-0">
                        <div className="text-xs text-gray-400 mb-0.5">
                          {entry.at.toLocaleString('fr-FR')}
                        </div>
                        <div className="text-gray-800">{entry.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}