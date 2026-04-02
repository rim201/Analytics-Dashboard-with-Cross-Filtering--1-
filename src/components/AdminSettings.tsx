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
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  appendCurrentSnapshotsForAllRooms,
  createDevice,
  deleteDevice,
  deleteRoomMeasurementsInRange,
  listDevices,
  listRooms,
  listUsers,
  deleteUser,
  updateDevice,
  updateUser,
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
            <h3 className="font-semibold text-gray-900">Mesures salles (historique)</h3>
            <p className="mt-2 text-sm text-gray-600 max-w-3xl">
              Chaque enregistrement stocke la <strong>date</strong> et les valeurs{' '}
              <strong>température, humidité, CO₂, bruit, lumière</strong>. L’affichage des courbes et des dernières
              valeurs se fait dans le détail de chaque salle. Ici vous pouvez uniquement{' '}
              <strong>supprimer un intervalle</strong> de mesures pour une salle, ou capturer l’état actuel de toutes les
              salles.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={measureBusy || rooms.length === 0}
                onClick={() => void handleAppendSnapshotsAllRooms()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Capturer l’état actuel (toutes les salles)
              </button>
            </div>
          </div>
          <div className="p-6 space-y-5 max-w-2xl">
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
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={measureBusy}
                onClick={() => void handleDeleteMeasureRange()}
                className="rounded-xl border-2 border-red-900 bg-red-600 px-5 py-2.5 text-sm font-semibold !text-white shadow-md hover:bg-red-700 hover:border-red-950 disabled:cursor-not-allowed disabled:border-red-400 disabled:bg-red-400 disabled:!text-white disabled:opacity-100"
              >
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
          {/* AI Model Info */}
          <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200/50">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">AI Model Configuration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Current version: v2.4.1 • Training dataset: 2,847 samples • Accuracy: 94.5%
                </p>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition">
                    Retrain Model
                  </button>
                  <button className="px-4 py-2 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition shadow-sm">
                    View Logs
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Optimization Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Optimization Aggressiveness</label>
                <input type="range" min="1" max="10" defaultValue="7" className="w-full h-2 bg-emerald-200 rounded-full appearance-none cursor-pointer" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Conservative</span>
                  <span>Aggressive</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Learning Rate</label>
                <select defaultValue="medium" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none">
                  <option value="slow">Slow (0.001)</option>
                  <option value="medium">Medium (0.01)</option>
                  <option value="fast">Fast (0.1)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900">Auto-apply Recommendations</div>
                  <div className="text-sm text-gray-500">Automatically apply low-risk optimizations</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}