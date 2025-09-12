'use client';

import { EthereumProvider } from '@walletconnect/ethereum-provider';

type OneOrMore<T> = [T, ...T[]];

type ProviderInitOpts = {
  projectId: string;
  chains: OneOrMore<number>;
  optionalChains?: OneOrMore<number>;
  showQrModal?: boolean;
  optionalMethods?: string[];
  events?: string[];
  optionalEvents?: string[];
  metadata?: {
    name: string;
    description?: string;
    url: string;
    icons?: string[];
  };
};

const g = globalThis as any;

// --- Mutex simple pour éviter 2 inits concurrentes ---
let initLock: Promise<any> | null = null;

const BASE_OPTS: ProviderInitOpts = {
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [2741],          // Abstract mainnet
  optionalChains: [11124], // Abstract testnet
  showQrModal: true,
  optionalMethods: [
    'eth_requestAccounts',
    'eth_accounts',
    'eth_chainId',
    'personal_sign',
    'eth_sign',
    'eth_signTypedData',
    'eth_signTypedData_v4',
  ],
  events: ['accountsChanged', 'chainChanged', 'disconnect'],
  optionalEvents: ['session_delete'],
  metadata: {
    name: 'CryptoPilot',
    description: 'Gérez votre portefeuille crypto avec intelligence',
    url:
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000',
    icons: ['https://cryptopilot.app/icon.png'],
  },
};

function mergeOpts(extra?: Partial<ProviderInitOpts>): ProviderInitOpts {
  return {
    ...BASE_OPTS,
    ...(extra ?? {}),
    ...(extra?.chains ? { chains: extra.chains as OneOrMore<number> } : {}),
    ...(extra?.optionalChains
      ? { optionalChains: extra.optionalChains as OneOrMore<number> }
      : {}),
  };
}

/**
 * Retourne le provider WC (singleton).
 * Protège l'init avec un mutex et garde la même instance malgré le HMR.
 */
export async function getWCProvider(
  extra?: Partial<ProviderInitOpts>
): Promise<any> {
  console.log('🔍 getWCProvider called, existing:', !!g.__wcProvider, 'initLock:', !!initLock);
  
  if (g.__wcProvider) {
    console.log('♻️ Returning existing provider');
    return g.__wcProvider as Promise<any>;
  }

  if (!initLock) {
    console.log('🆕 Creating new WalletConnect provider...');
    initLock = (async () => {
      try {
        const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
        if (!projectId) {
          throw new Error('❌ NEXT_PUBLIC_WC_PROJECT_ID manquant dans .env');
        }
        console.log('🔑 ProjectId:', projectId.substring(0, 8) + '...');
        
        const opts = mergeOpts(extra);
        console.log('⚙️ WC init options:', {
          chains: opts.chains,
          optionalChains: opts.optionalChains,
          showQrModal: opts.showQrModal,
          origin: typeof window !== 'undefined' ? window.location.origin : 'SSR'
        });

        const provider = await EthereumProvider.init(opts as any);
        console.log('✅ WalletConnect provider initialized');

        // Attache les listeners UNE SEULE fois
        provider.on?.('disconnect', (args: any) => {
          console.log('🔌 WC disconnect event:', args);
        });
        provider.on?.('session_delete', (args: any) => {
          console.log('🗑️ WC session_delete event:', args);
        });
        provider.on?.('accountsChanged', (accounts: string[]) => {
          console.log('👤 WC accountsChanged:', accounts);
        });
        provider.on?.('chainChanged', (chainId: string) => {
          console.log('⛓️ WC chainChanged:', chainId);
        });

        g.__wcProvider = Promise.resolve(provider);
        return provider;
      } catch (error) {
        console.error('❌ WalletConnect init failed:', error);
        throw error;
      }
    })().finally(() => {
      initLock = null;
    });
  } else {
    console.log('⏳ Init in progress, awaiting...');
  }

  return (g.__wcProvider = initLock);
}

/**
 * Connecte si nécessaire, de façon idempotente (ne spam pas enable()).
 */
export async function ensureWCConnected(): Promise<any> {
  console.log('🔗 ensureWCConnected called');
  const provider = await getWCProvider();
  
  try {
    // Vérifier si déjà connecté
    console.log('🔍 Checking existing accounts...');
    const acc = (await provider.request({ method: 'eth_accounts' })) as string[];
    console.log('👥 Current accounts:', acc);
    
    if (!acc || acc.length === 0) {
      console.log('🚀 No accounts found, calling enable()...');
      await provider.enable(); // ouvre le QR si besoin
      
      // Revérifier après enable
      const newAcc = (await provider.request({ method: 'eth_accounts' })) as string[];
      console.log('✅ Accounts after enable:', newAcc);
    } else {
      console.log('♻️ Already connected, skipping enable()');
    }
  } catch (e: any) {
    console.error('❌ ensureWCConnected failed:', e);
    
    // Si erreur contient "No matching key" → hard reset
    if (String(e?.message || e).includes('No matching key')) {
      console.warn('🔄 Detected "No matching key" error, attempting hard reset...');
      await hardResetWC();
      const p2 = await getWCProvider();
      console.log('🚀 Calling enable() after hard reset...');
      await p2.enable();
      return p2;
    }
    throw e;
  }
  return provider;
}

/**
 * Hard reset : purge *toute* la storage WalletConnect v2 et récrée une instance propre.
 * À utiliser en dev si "No matching key..." persiste.
 */
export async function hardResetWC() {
  console.log('🧹 Starting WalletConnect hard reset...');
  
  try {
    if (g.__wcProvider) {
      console.log('🔌 Disconnecting existing provider...');
      const p = await g.__wcProvider;
      try { 
        await p.disconnect?.(); 
        console.log('✅ Provider disconnected');
      } catch (e) {
        console.warn('⚠️ Disconnect failed (expected):', e);
      }
    }
  } catch (e) {
    console.warn('⚠️ Provider cleanup failed:', e);
  }
  
  // Purge du cache WC v2 (clé locale "wc@2:" utilisée par le SDK)
  try {
    const ls = typeof window !== 'undefined' ? window.localStorage : null;
    if (ls) {
      console.log('🗑️ Purging localStorage WalletConnect entries...');
      const toDelete: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && (k.startsWith('wc@2') || k.startsWith('@walletconnect'))) {
          toDelete.push(k);
        }
      }
      console.log('📝 Found WC entries to delete:', toDelete.length, toDelete);
      toDelete.forEach((k) => ls.removeItem(k));
      console.log('✅ localStorage purged');
    }
  } catch (e) {
    console.warn('⚠️ localStorage purge failed:', e);
  }
  
  // Reset global state
  g.__wcProvider = undefined;
  initLock = null;
  
  console.log('🎯 Hard reset complete - next getWCProvider() will create fresh instance');
}

// Utilitaire de debug pour la console
if (typeof window !== 'undefined') {
  (window as any).debugWC = {
    hardReset: hardResetWC,
    checkProvider: () => !!g.__wcProvider,
    listWCStorage: () => {
      const items: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('wc@2') || k.startsWith('@walletconnect'))) {
          try {
            items[k] = JSON.parse(localStorage.getItem(k) || 'null');
          } catch {
            items[k] = localStorage.getItem(k);
          }
        }
      }
      return items;
    }
  };
}
