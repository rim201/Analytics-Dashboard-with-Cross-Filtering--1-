import { useState } from 'react';
import { Lock, Mail, Zap, Wifi, Thermometer, Wind } from 'lucide-react';
import { authErrorMessage, signInWithCredentials } from '../services/auth';

function readInitialLoginNotice(): string | null {
  try {
    const msg = sessionStorage.getItem('loginNotice');
    if (msg) {
      sessionStorage.removeItem('loginNotice');
      return msg;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => readInitialLoginNotice());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithCredentials(email, password);
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      setError(code ? authErrorMessage(code) : 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center space-y-6 p-8">
          <div className="relative">
            <div className="w-64 h-64 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-3xl opacity-20 blur-3xl absolute"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <Thermometer className="w-8 h-8 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">Temperature</span>
                </div>
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <Wind className="w-8 h-8 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Air Quality</span>
                </div>
                <div className="bg-gradient-to-br from-amber-100 to-amber-200 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <Zap className="w-8 h-8 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Energy</span>
                </div>
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <Wifi className="w-8 h-8 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">IoT Sensors</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-semibold text-gray-800">Smart Building Intelligence</h3>
            <p className="text-gray-600">AI-powered environment optimization</p>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <div className="space-y-6">
            {/* Logo and Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Smart Meeting Room</h1>
              <p className="text-gray-600">Environment Manager</p>
            </div>

            {/* Login Form */}
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <a href="#" className="text-emerald-600 hover:text-emerald-700 font-medium">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition shadow-lg shadow-emerald-500/30 disabled:opacity-60"
              >
                {submitting ? 'Connexion…' : 'Sign In'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
