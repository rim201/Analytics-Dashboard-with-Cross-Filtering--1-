import { useState } from 'react';
import { Lock, Mail, Zap, Wifi, Thermometer, Wind } from 'lucide-react';
import {
  authErrorMessage,
  clearLoginNoticeStorage,
  signInWithCredentials,
} from '../services/auth';

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

const FEATURE_TILES = [
  {
    icon: Thermometer,
    label: 'Temperature',
    sublabel: 'Real-time monitoring',
    from: '#fef3c7',
    to: '#fde68a',
    iconColor: '#d97706',
  },
  {
    icon: Wind,
    label: 'Air Quality',
    sublabel: 'CO₂ & PM sensors',
    from: '#dbeafe',
    to: '#bfdbfe',
    iconColor: '#2563eb',
  },
  {
    icon: Zap,
    label: 'Energy',
    sublabel: 'Smart optimization',
    from: '#d1fae5',
    to: '#a7f3d0',
    iconColor: '#059669',
  },
  {
    icon: Wifi,
    label: 'IoT Sensors',
    sublabel: 'Connected devices',
    from: '#ede9fe',
    to: '#ddd6fe',
    iconColor: '#7c3aed',
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => readInitialLoginNotice());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearLoginNoticeStorage();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithCredentials(email, password);
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      setError(code ? authErrorMessage(code) : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 login-page-bg">
      {/* Decorative blobs */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '-10%',
          left: '-5%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: '-10%',
          right: '-5%',
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">

        {/* ── Left panel – feature showcase ── */}
        <div className="hidden md:flex flex-col items-center justify-center gap-8 px-8">
          {/* Logo + headline */}
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 sidebar-logo-glow"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.03em' }}
            >
              Smart Building Intelligence
            </h2>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              AI-powered environment optimization for modern workspaces
            </p>
          </div>

          {/* Feature tiles */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {FEATURE_TILES.map(({ icon: Icon, label, sublabel, from, to, iconColor }) => (
              <div
                key={label}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center login-feature-tile"
                style={{
                  background: `linear-gradient(135deg, ${from}, ${to})`,
                  border: '1px solid rgba(255,255,255,0.6)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <Icon style={{ width: 26, height: 26, color: iconColor }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--gray-800)' }}>
                    {label}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--gray-500)' }}>
                    {sublabel}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-xs font-medium login-trust-badge"
            style={{
              color: 'var(--gray-600)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }}
            />
            Live sensor data · Firestore real-time sync
          </div>
        </div>

        {/* ── Right panel – login form ── */}
        <div
          className="w-full rounded-3xl p-8 md:p-10 login-card"
          style={{ background: 'var(--card)' }}
        >
          {/* Mobile logo */}
          <div className="md:hidden flex justify-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center sidebar-logo-glow"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.03em' }}
            >
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              Sign in to your SmartRoom account
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-5 text-sm border"
              role="alert"
              style={{
                background: '#fef2f2',
                borderColor: '#fecaca',
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--gray-700)' }}
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--gray-400)' }}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none transition"
                  style={{
                    borderColor: 'var(--gray-300)',
                    color: 'var(--gray-900)',
                    fontSize: '14px',
                  }}
                  required
                  disabled={submitting}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--gray-700)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--gray-400)' }}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none transition"
                  style={{
                    borderColor: 'var(--gray-300)',
                    color: 'var(--gray-900)',
                    fontSize: '14px',
                  }}
                  required
                  disabled={submitting}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Remember + forgot */}
            <div className="flex items-center justify-between text-sm pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#10b981' }}
                />
                <span style={{ color: 'var(--gray-600)' }}>Remember me</span>
              </label>
              <a
                href="#"
                className="font-medium text-sm transition"
                style={{ color: '#059669' }}
              >
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl font-semibold text-white transition disabled:opacity-60"
              style={{
                background: submitting
                  ? '#6ee7b7'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                fontSize: '14px',
                letterSpacing: '0.01em',
              }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs" style={{ color: 'var(--gray-400)' }}>
            SmartRoom AI Manager · Secure sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
