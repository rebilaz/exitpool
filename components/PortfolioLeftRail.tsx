"use client";
import React, { useMemo } from "react";

// On réutilise ton type côté page : symbol, quantity, price, avgPrice…
export type LeftRailAsset = {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgPrice?: number;
};

type EventItem = { title?: string; date?: string | number | Date };

interface PortfolioLeftRailProps {
  assets: LeftRailAsset[];
  events?: EventItem[];
  onImportClick?: () => void;
  onAddNoteClick?: () => void;
  onExportClick?: () => void;
  stickyOffset?: number; // px depuis le haut
}

const PortfolioLeftRail: React.FC<PortfolioLeftRailProps> = ({
  assets,
  events = [],
  onImportClick,
  onAddNoteClick,
  onExportClick,
  stickyOffset = 96, // ~ top après header
}) => {
  const sorted = useMemo(
    () => [...assets].sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price)),
    [assets]
  );
  const top3 = useMemo(() => sorted.slice(0, 3), [sorted]);

  const fmtMoney0 = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      className="hidden lg:block"
      aria-label="Colonne gauche - widgets"
    >
      <div
        className="flex flex-col gap-4"
        style={{ position: "sticky", top: stickyOffset }}
      >
        {/* Top 3 positions (pastel compact) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Top 3 positions</h4>
          <div className="space-y-2">
            {top3.map((a) => {
              const val = a.quantity * a.price;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 bg-blue-50"
                >
                  <span className="text-xs font-medium text-blue-800">{a.symbol}</span>
                  <span className="text-xs text-blue-900/85">{fmtMoney0(val)}</span>
                </div>
              );
            })}
            {assets.length === 0 && (
              <div className="text-xs text-gray-500">Aucune position</div>
            )}
          </div>
        </div>

        {/* Derniers événements (mini-timeline) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Derniers évènements</h4>
          <ol className="relative border-s border-gray-200 pl-4 space-y-3">
            {events?.length ? (
              events.slice(0, 4).map((e, i) => (
                <li key={i} className="ms-3">
                  <div className="absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-gray-300" />
                  <p className="text-xs text-gray-800">{e.title || "Évènement"}</p>
                  <span className="text-[10px] text-gray-500">
                    {e.date ? new Date(e.date).toLocaleString("fr-FR") : ""}
                  </span>
                </li>
              ))
            ) : (
              <li className="ms-3 text-xs text-gray-500">Aucun évènement récent</li>
            )}
          </ol>
        </div>

        {/* Actions rapides */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Actions rapides</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onImportClick}
              className="rounded-lg border px-3 py-1.5 text-[11px] hover:bg-gray-50 disabled:opacity-50"
            >
              Importer CSV
            </button>
            <button
              onClick={onAddNoteClick}
              className="rounded-lg border px-3 py-1.5 text-[11px] hover:bg-gray-50 disabled:opacity-50"
            >
              Ajouter note
            </button>
            <button
              onClick={onExportClick}
              className="rounded-lg border px-3 py-1.5 text-[11px] hover:bg-gray-50 disabled:opacity-50"
            >
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioLeftRail;
