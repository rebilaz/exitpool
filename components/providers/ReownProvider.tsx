// components/providers/ReownProvider.tsx
"use client";

import { AppKitProvider } from "@reown/appkit/react";
// Si AppKit ne fournit pas "base" de base, on peut passer un objet chain compatible viem
import { base } from "viem/chains"; // sert au metadata si besoin

type Props = { children: React.ReactNode };

// Définition de la chain pour AppKit (format WalletConnect/AppKit)
const baseChain = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || ""] } },
  blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
  testnet: false,
};

export function ReownProvider({ children }: Props) {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
  return (
    <AppKitProvider
      projectId={projectId}
      metadata={{
        name: "CryptoPilot",
        description: "Gérez votre portefeuille crypto avec intelligence",
        url: typeof window !== "undefined" ? window.location.origin : "https://cryptopilot.app",
        icons: ["https://cryptopilot.app/icon.png"],
      }}
      networks={[baseChain]}
      defaultNetwork={baseChain}
    >
      {children}
    </AppKitProvider>
  );
}

export default ReownProvider;
