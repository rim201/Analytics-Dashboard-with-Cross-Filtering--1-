import { Search, Filter, Users, Star, Thermometer, Wind, Volume2, Sun, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface RoomsManagementProps {
  onRoomSelect: (roomId: string) => void;
}

const API_BASE = 'http://127.0.0.1:8000';

interface RoomRow {
  id: number;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
  comfortScore: number;
  temperature: number;
  co2: number;
  noise: number;
  light: number;
}

export default function RoomsManagement({ onRoomSelect }: RoomsManagementProps) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy'>('all');
  const [roomActionMessage, setRoomActionMessage] = useState<string>('');

  const fetchRooms = async () => {
    const res = await fetch(`${API_BASE}/api/rooms/`);
    if (!res.ok) return;
    const data = await res.json();
    setRooms(data.rooms || []);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getComfortColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  const getStatusColor = (status: string) => {
    return status === 'busy'
      ? 'bg-blue-500'
      : 'bg-emerald-500';
  };

  const handleAddRoom = async () => {
    const name = window.prompt('Room name?');
    if (!name) return;
    const capInput = window.prompt('Capacity?');
    if (!capInput) return;
    const occInput = window.prompt('Current occupancy? (0 = available)', '0');
    const capacity = parseInt(capInput, 10);
    const occupancy = parseInt(occInput || '0', 10);
    if (Number.isNaN(capacity) || Number.isNaN(occupancy)) return;

    const res = await fetch(`${API_BASE}/api/rooms/create/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, capacity, occupancy }),
    });
    if (res.ok) {
      fetchRooms();
      setRoomActionMessage('Room added successfully.');
    } else {
      const err = await res.text();
      setRoomActionMessage(`Add room failed: ${err || res.status}`);
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
          <button
            type="button"
            onClick={handleAddRoom}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </button>
        </div>
      </div>
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
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>Capacity: {room.capacity}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getComfortColor(room.comfortScore)}`}>
                  {room.comfortScore}%
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(room.status)}`}></div>
                <span className="text-sm font-medium text-gray-700 capitalize">{room.status === 'busy' ? 'occupied' : room.status}</span>
                {room.occupancy > 0 && (
                  <span className="text-sm text-gray-500">
                    ({room.occupancy}/{room.capacity} people)
                  </span>
                )}
              </div>
            </div>

            {/* Sensor Metrics */}
            <div className="p-6 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Thermometer className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Temp</p>
                    <p className="text-sm font-medium text-gray-900">{room.temperature}°C</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wind className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CO₂</p>
                    <p className="text-sm font-medium text-gray-900">{room.co2} ppm</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Noise</p>
                    <p className="text-sm font-medium text-gray-900">{room.noise} dB</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Sun className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Light</p>
                    <p className="text-sm font-medium text-gray-900">{room.light} lux</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button className="w-full px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
