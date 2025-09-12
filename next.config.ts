import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ à la racine, pas dans "experimental"
  transpilePackages: [
    "@reown/appkit",
    "@walletconnect/ethereum-provider",
    "@walletconnect/modal",
  ],
};

export default nextConfig;
