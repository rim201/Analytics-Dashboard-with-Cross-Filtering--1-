import React, { useState } from 'react';
import { Lock, Zap } from 'lucide-react';
import { completeFirstLoginPasswordChange, authErrorMessage } from '../services/auth';

interface Props {
  displayName: string;
  email: string;
  onSuccess: () => void;
}

export default function FirstLoginPasswordChange({ displayName, email, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      await completeFirstLoginPasswordChange(password);
      onSuccess();
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code === 'auth/weak-password') {
        setError('Mot de passe trop faible (minimum 6 caractères recommandé : plus long et varié).');
      } else {
        setError(code ? authErrorMessage(code) : 'Impossible de mettre à jour le mot de passe.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 md:p-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-3">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Première connexion</h1>
          <p className="text-sm text-gray-600 mt-1">
            Bonjour <span className="font-medium text-gray-900">{displayName}</span> — définissez votre mot de passe personnel pour continuer.
          </p>
          <p className="text-xs text-gray-500 mt-2 font-mono">{email}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="first-pw" className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="first-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                autoComplete="new-password"
                required
                disabled={submitting}
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label htmlFor="first-pw2" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="first-pw2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                autoComplete="new-password"
                required
                disabled={submitting}
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer et accéder à l’application'}
          </button>
        </form>
      </div>
    </div>
  );
}
