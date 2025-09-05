'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

type Props = {
  isOpen: boolean;
  onClose?: () => void;
};

type Mode = 'signin' | 'signup';

export default function LoginModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState(''); // pour signup
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setName('');
      setErrorMsg(null);
      setMode('signin');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const migrateTempIfAny = async () => {
    try {
      const temp = typeof window !== 'undefined' ? localStorage.getItem('cp_temp_user_id') : null;
      if (!temp) return;
      const res = await fetch('/api/users/migrate-temp-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempUserId: temp }),
      });
      if (res.ok) {
        localStorage.removeItem('cp_temp_user_id');
      }
    } catch {
      // no-op (le Header a aussi un fallback de migration au status=authenticated)
    }
  };

  const handleGoogle = async () => {
    // Pour Google, on laisse NextAuth gérer la redirection OAuth
    await signIn('google', { callbackUrl: '/' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password || (mode === 'signup' && !name)) {
      setErrorMsg('Veuillez remplir tous les champs requis.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        // 1) créer le compte
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Impossible de créer le compte.');
        }
      }

      // 2) se connecter via credentials (sans redirection)
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        throw new Error(result?.error || 'Échec de la connexion.');
      }

      // 3) migration immédiate (même logique que Google)
      await migrateTempIfAny();

      // 4) refresh UI + fermer
      router.refresh();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" onClick={() => !isSubmitting && onClose?.()} />

      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">
            {mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
          </h3>
          <button
            onClick={() => !isSubmitting && onClose?.()}
            className="text-neutral-400 hover:text-neutral-600 text-lg"
            disabled={isSubmitting}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.731 32.91 29.273 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.91 6.053 29.727 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.787 16.108 18.999 14 24 14c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.91 8.053 29.727 6 24 6c-7.399 0-13.733 4.005-17.694 8.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.195l-6.19-5.238C29.273 36 24 36 24 36c-5.244 0-9.67-3.115-11.471-7.514l-6.54 5.036C9.909 39.873 16.431 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.036 3.164-3.345 5.651-6.084 7.067l6.19 5.238C37.058 41.833 44 37 44 24c0-1.341-.138-2.651-.389-3.917z" />
            </svg>
            Continuer avec Google
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-neutral-200" />
            <span className="text-[11px] text-neutral-500">ou</span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          {/* Formulaire email */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg p-2 text-sm text-neutral-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Votre nom"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg p-2 text-sm text-neutral-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="vous@exemple.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg p-2 text-sm text-neutral-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-md">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex h-10 items-center justify-center rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-900 disabled:opacity-50"
            >
              {isSubmitting
                ? (mode === 'signin' ? 'Connexion…' : 'Création du compte…')
                : (mode === 'signin' ? 'Se connecter' : 'Créer un compte')}
            </button>
          </form>

          <div className="text-[12px] text-neutral-600 text-center">
            {mode === 'signin' ? (
              <>
                Pas de compte ?{' '}
                <button className="underline underline-offset-2" onClick={() => setMode('signup')}>
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{' '}
                <button className="underline underline-offset-2" onClick={() => setMode('signin')}>
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
