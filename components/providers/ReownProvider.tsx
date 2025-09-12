'use client';

import { AppKitProvider } from '@reown/appkit/react';
// Réseaux dispo dans AppKit (Abstract inclus)
import { abstract, abstractTestnet, mainnet } from '@reown/appkit/networks';

type Props = { children: React.ReactNode };

export function ReownProvider({ children }: Props) {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
  return (
    <AppKitProvider
      projectId={projectId}
      metadata={{
        name: 'CryptoPilot',
        description: 'Gérez votre portefeuille crypto avec intelligence',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://cryptopilot.app',
        icons: ['https://cryptopilot.app/icon.png'],
      }}
      // Choisis les réseaux que tu veux afficher dans le modal
      networks={[abstract, abstractTestnet, mainnet]}
      defaultNetwork={abstract}
    >
      {children}
    </AppKitProvider>
  );
}

export default ReownProvider;
