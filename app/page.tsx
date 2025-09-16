// app/page.tsx
"use client";

export default function Home() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-3xl md:text-4xl font-bold">Exit via Pools (MVP)</h1>
        <p className="text-gray-600">
          Échange “one-sided” via Uniswap V3 (range serrée). Non-custodial, gas only.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/swap-lp"
            className="inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2"
          >
            Ouvrir un LP-Swap
          </a>
          <a
            href="https://docs.yourdomain.tld/exit-via-pools"
            target="_blank"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2"
          >
            Docs
          </a>
        </div>
      </div>
    </div>
  );
}
