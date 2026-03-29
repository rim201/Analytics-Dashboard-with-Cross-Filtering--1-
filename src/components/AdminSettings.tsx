import { Users, Cpu, Shield, Settings as SettingsIcon, Wifi, Brain, CheckCircle, AlertCircle, Trash2, Edit } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Facility Manager' | 'Employee';
  status: 'active' | 'inactive';
}

interface DeviceRecord {
  id: number;
  name: string;
  type: string;
  room: string;
  roomId?: number;
  status: 'online' | 'offline' | 'error';
  lastUpdate: string;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'devices' | 'system' | 'ai'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string }[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'Employee' as UserRecord['role'],
    status: 'active' as UserRecord['status'],
  });
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    type: 'Room Gateway',
    roomId: '',
    status: 'online' as DeviceRecord['status'],
  });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [userErrors, setUserErrors] = useState<{ name?: string; email?: string }>({});
  const [deviceErrors, setDeviceErrors] = useState<{ name?: string; type?: string; roomId?: string }>({});

  const showToast = (type: ToastState['type'], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = () =>
    fetch('http://127.0.0.1:8000/api/users/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsers(data?.users || []))
      .catch(() => setUsers([]));

  const fetchDevices = () =>
    fetch('http://127.0.0.1:8000/api/devices/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDevices(data?.devices || []))
      .catch(() => setDevices([]));

  useEffect(() => {
    fetchUsers();
    fetchDevices();
    fetch('http://127.0.0.1:8000/api/rooms/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRooms((data?.rooms || []).map((r: any) => ({ id: r.id, name: r.name }))))
      .catch(() => setRooms([]));
  }, []);

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: 'Employee', status: 'active' });
    setUserErrors({});
    setUserModalOpen(true);
  };

  const openEditUserModal = (user: UserRecord) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setUserErrors({});
    setUserModalOpen(true);
  };

  const submitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; email?: string } = {};
    if (!userForm.name.trim()) errors.name = 'Name is required.';
    if (!userForm.email.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(userForm.email)) errors.email = 'Invalid email format.';
    setUserErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const url = editingUser
      ? `http://127.0.0.1:8000/api/users/${editingUser.id}/`
      : 'http://127.0.0.1:8000/api/users/';
    const method = editingUser ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    });
    if (res.ok) {
      setUserModalOpen(false);
      fetchUsers();
      showToast('success', editingUser ? 'User updated successfully.' : 'User created successfully.');
    } else {
      showToast('error', 'Failed to save user.');
    }
  };

  const deleteUser = async (id: number) => {
    if (!window.confirm('Delete this user?')) return;
    const res = await fetch(`http://127.0.0.1:8000/api/users/${id}/`, { method: 'DELETE' });
    if (res.ok) {
      fetchUsers();
      showToast('success', 'User deleted successfully.');
    } else {
      showToast('error', 'Failed to delete user.');
    }
  };

  const openAddDeviceModal = () => {
    setEditingDevice(null);
    setDeviceForm({
      name: '',
      type: 'Room Gateway',
      roomId: rooms[0] ? String(rooms[0].id) : '',
      status: 'online',
    });
    setDeviceErrors({});
    setDeviceModalOpen(true);
  };

  const openEditDeviceModal = (device: DeviceRecord) => {
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      type: device.type,
      roomId: String(device.roomId || ''),
      status: device.status,
    });
    setDeviceErrors({});
    setDeviceModalOpen(true);
  };

  const submitDeviceForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; type?: string; roomId?: string } = {};
    if (!deviceForm.name.trim()) errors.name = 'Name is required.';
    if (!deviceForm.type.trim()) errors.type = 'Type is required.';
    if (!deviceForm.roomId.trim()) errors.roomId = 'Room is required.';
    setDeviceErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const url = editingDevice
      ? `http://127.0.0.1:8000/api/devices/${editingDevice.id}/`
      : 'http://127.0.0.1:8000/api/devices/';
    const method = editingDevice ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...deviceForm, roomId: parseInt(deviceForm.roomId, 10) }),
    });
    if (res.ok) {
      setDeviceModalOpen(false);
      fetchDevices();
      showToast('success', editingDevice ? 'Device updated successfully.' : 'Device created successfully.');
    } else {
      showToast('error', 'Failed to save device.');
    }
  };

  const deleteDevice = async (id: number) => {
    if (!window.confirm('Delete this device?')) return;
    const res = await fetch(`http://127.0.0.1:8000/api/devices/${id}/`, { method: 'DELETE' });
    if (res.ok) {
      fetchDevices();
      showToast('success', 'Device deleted successfully.');
    } else {
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
          { id: 'system' as const, label: 'System', icon: Cpu },
          { id: 'ai' as const, label: 'AI Config', icon: Brain },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
            <button onClick={openAddUserModal} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition">
              Add User
            </button>
          </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        {user.role}
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
                        <button onClick={() => deleteUser(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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

      {activeTab === 'devices' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">IoT Devices Management</h3>
            <button onClick={openAddDeviceModal} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition">
              Add Device
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{device.type}</td>
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
                        <button onClick={() => deleteDevice(device.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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

      {userModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={submitUserForm} className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{editingUser ? 'Edit User' : 'Add User'}</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              {userErrors.name && <p className="text-xs text-red-600 mt-1">{userErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              {userErrors.email && <p className="text-xs text-red-600 mt-1">{userErrors.email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as UserRecord['role'] }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  <option>Admin</option>
                  <option>Facility Manager</option>
                  <option>Employee</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Status</label>
                <select value={userForm.status} onChange={(e) => setUserForm((p) => ({ ...p, status: e.target.value as UserRecord['status'] }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600">{editingUser ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {deviceModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={submitDeviceForm} className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{editingDevice ? 'Edit Device' : 'Add Device'}</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input value={deviceForm.name} onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              {deviceErrors.name && <p className="text-xs text-red-600 mt-1">{deviceErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <input value={deviceForm.type} onChange={(e) => setDeviceForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required />
              {deviceErrors.type && <p className="text-xs text-red-600 mt-1">{deviceErrors.type}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Room</label>
                <select value={deviceForm.roomId} onChange={(e) => setDeviceForm((p) => ({ ...p, roomId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" required>
                  <option value="" disabled>Select room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
                {deviceErrors.roomId && <p className="text-xs text-red-600 mt-1">{deviceErrors.roomId}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Status</label>
                <select value={deviceForm.status} onChange={(e) => setDeviceForm((p) => ({ ...p, status: e.target.value as DeviceRecord['status'] }))} className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                  <option value="error">error</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeviceModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600">{editingDevice ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}