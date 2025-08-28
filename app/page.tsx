"use client";

import PortfolioChart from "../components/PortfolioChart";
import PortfolioMain from "../components/PortfolioMain";

export default function Home() {

  return (
    <>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-screen-2xl px-4 py-6">
          {/* Minimal Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h1 className="text-lg font-semibold text-gray-900">CryptoPilot Dashboard</h1>
              </div>
              <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50">Login</button>
            </div>

          {/* Main 12-col grid */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <PortfolioMain />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-6">
              <PortfolioChart />
            </div>

            {/* Secondary widgets row */}
            <div className="col-span-12 grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4">
                <div className="h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Positions</h3>
                  <p className="text-xs text-gray-500">Widget placeholder.</p>
                </div>
              </div>
              <div className="col-span-12 md:col-span-4">
                <div className="h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">News</h3>
                  <p className="text-xs text-gray-500">Widget placeholder.</p>
                </div>
              </div>
              <div className="col-span-12 md:col-span-4">
                <div className="h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Watchlist</h3>
                  <p className="text-xs text-gray-500">Widget placeholder.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
