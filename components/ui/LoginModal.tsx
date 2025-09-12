'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import bs58 from 'bs58';
import { useAppKit } from '@reown/appkit/react';          // ✅ on utilise le hook pour ouvrir le modal
import { ensureWCConnected, hardResetWC } from '@/lib/walletconnect';

type Props = {
  isOpen: boolean;
  onClose?: () => void;
};

type Mode = 'signin' | 'signup';

export default function LoginModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hook AppKit (ouvre juste le sélecteur de wallet)
  const { open } = useAppKit();

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
      if (res.ok) localStorage.removeItem('cp_temp_user_id');
    } catch {}
  };

  // ---- EVM via WalletConnect (QR / extension) : connecte + signe + NextAuth ----
  const loginEvmWithWalletConnect = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const provider = await ensureWCConnected();

      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error('Aucune adresse retournée par le wallet.');

      const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
      const chainId = parseInt(chainIdHex, 16) || 0;

      const { nonce, token } = await fetch('/api/auth/nonce').then((r) => r.json());
      const message =
        `Sign-In with Ethereum (WalletConnect)\n` +
        `nonce:${nonce}\naddr:${address}\nchain:${chainId}\nexp:${Date.now() + 5 * 60_000}`;

      // Convertit en HEX (certains wallets l’exigent pour personal_sign)
      const msgHex = '0x' + new TextEncoder()
        .encode(message)
        .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

      let signature: string | undefined;
      try {
        // personal_sign → params: [dataHex, address]
        signature = (await provider.request({
          method: 'personal_sign',
          params: [msgHex, address],
        })) as string;
      } catch (err: any) {
        if (err?.code === 4001) {
          setErrorMsg('Signature annulée dans le wallet.');
          return;
        }
        // Fallback: eth_sign → params: [address, dataHex]
        signature = (await provider.request({
          method: 'eth_sign',
          params: [address, msgHex],
        })) as string;
      }
      if (!signature) throw new Error('La signature a échoué via WalletConnect.');

      const res = await signIn('wallet', {
        redirect: false,
        chainType: 'evm',
        address,
        chainId,
        message,   // version lisible pour le backend
        signature, // 0x…
        nonce,
        nonceToken: token,
      });
      if (res?.error) throw new Error(res.error);

      await migrateTempIfAny();
      router.refresh();
      onClose?.();
    } catch (e: any) {
      if (String(e?.message || e).includes('No matching key')) {
        setErrorMsg('Session WalletConnect instable (dev). Clique “Reset WalletConnect” puis réessaie.');
        console.warn('[WC] history key mismatch → use hardResetWC() and retry.');
      } else {
        setErrorMsg(e?.message || 'Échec de la connexion via WalletConnect.');
      }
      console.error('[WalletConnect EVM]', e);
      
      // Debug: afficher plus d'infos sur l'erreur
      if (typeof e === 'object' && e !== null) {
        console.log('🔍 Error details:', {
          name: e.name,
          message: e.message,
          code: e.code,
          stack: e.stack?.split('\n').slice(0, 3)
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Solana — Phantom (sans forcer le cluster) ----
  const loginPhantom = async () => {
    setErrorMsg(null);
    try {
      const sol = (window as any).solana;
      if (!sol) throw new Error('Aucun wallet Phantom détecté.');

      try { await sol.connect({ onlyIfTrusted: true }); } catch {}
      const resp = await sol.connect();
      const address: string = resp.publicKey?.toBase58?.() ?? resp.publicKey?.toString?.();
      if (!address) throw new Error("Impossible d'obtenir l'adresse Phantom.");

      const { nonce, token } = await fetch('/api/auth/nonce').then((r) => r.json());
      const message =
        `Sign-In with Solana (Phantom)\n` +
        `nonce:${nonce}\naddr:${address}\nexp:${Date.now() + 5 * 60_000}`;

      const encoded = new TextEncoder().encode(message);
      const signed = await sol.signMessage(encoded, 'utf8');
      const signature = bs58.encode(signed.signature);

      const res = await signIn('wallet', {
        redirect: false,
        chainType: 'solana',
        address,
        message,
        signature,
        nonce,
        nonceToken: token,
      });
      if (res?.error) throw new Error(res.error);

      await migrateTempIfAny();
      router.refresh();
      onClose?.();
    } catch (e: any) {
      if (e?.code === 4001) {
        setErrorMsg('Connexion ou signature annulée dans Phantom.');
        return;
      }
      setErrorMsg(e?.message || 'Échec de la connexion Phantom.');
      console.error('[loginPhantom]', e);
    }
  };

  // ---- Google + email/mot de passe (existant) ----
  const handleGoogle = async () => {
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

      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result || result.error) throw new Error(result?.error || 'Échec de la connexion.');

      await migrateTempIfAny();
      router.refresh();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const WCLogo = () => (
    <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden>
      <path d="M6.5 12.5a8.9 8.9 0 0119 0l-2.5 2.1a6.1 6.1 0 00-14 0L6.5 12.5zm3.2 2.7l2.3 2a3.9 3.9 0 015 0l2.3-2 2.6 2.3-2.4 2.1a7 7 0 01-9 0l-2.4-2.1 2.6-2.3z" fill="currentColor"/>
    </svg>
  );
  const PhantomLogo = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#7C4DFF" />
      <path d="M7 12c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5h-2l-2 2v-2.5C7.8 15.6 7 13.9 7 12z" fill="white" />
    </svg>
  );

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

        <div className="space-y-3">
          {/* Ouvrir juste le sélecteur de wallet (modal AppKit) */}
          <button
            type="button"
            onClick={() => open?.()}        // ouvre le modal Reown/AppKit
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <WCLogo />
            Choisir un wallet (ouvrir le modal)
          </button>

          {/* EVM via WalletConnect (QR/extension) + signature → NextAuth */}
          <button
            type="button"
            onClick={loginEvmWithWalletConnect}
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <WCLogo />
            Se connecter avec un wallet (QR / extension)
          </button>
          {/* Dev-only: bouton de reset WalletConnect */}
          {process.env.NODE_ENV !== 'production' && (
            <button
              type="button"
              onClick={async () => { await hardResetWC(); alert('WalletConnect reset. Réessaie.'); }}
              className="w-full text-[11px] text-neutral-500 underline underline-offset-2"
            >
              Reset WalletConnect (dev)
            </button>
          )}

          {/* Solana — Phantom */}
          <button
            type="button"
            onClick={loginPhantom}
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <PhantomLogo />
            Se connecter avec Phantom
          </button>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-neutral-300 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.731 32.91 29.273 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.91 8.053 29.727 6 24 6c-7.399 0-13.733 4.005-17.694 8.691z" />
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
