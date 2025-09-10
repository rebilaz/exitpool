"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Transaction } from "@/lib/repos/transactionRepo";

/* =============================================================================
   PETITS HELPERS DE FORMAT
============================================================================= */
const fullDate = (d: Date) => new Date(d).toLocaleString("fr-FR");
const fmtQty   = (n: number) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 8 });
const fmtPrice = (n: number) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const fmtTotal = (n: number) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* =============================================================================
   GROUPEMENT PAR TIMESTAMP (SECONDE)  →  TxGroup = “transaction parent”
============================================================================= */
export type TxGroup = {
  key: string;           // seconde
  ts: Date;
  items: Transaction[];  // transactions filles
  symbol: string;        // symbole majoritaire (par somme |qty|)
  side: "BUY" | "SELL" | "TRANSFER" | "";
  qtyAbs: number;        // somme |qty| (indicatif)
  totalUsd?: number;     // somme qty*price si price != null
};

function groupByExactSecond(transactions: Transaction[]): TxGroup[] {
  const buckets = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const k = String(Math.floor(new Date(t.timestamp).getTime() / 1000));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(t);
  }

  const groups: TxGroup[] = [];
  for (const [key, items] of buckets) {
    // symbole majoritaire
    const bySym = new Map<string, number>();
    for (const it of items) {
      const s = (it.symbol || "").toUpperCase();
      bySym.set(s, (bySym.get(s) ?? 0) + Math.abs(it.quantity));
    }
    const symEntry = [...bySym.entries()].sort((a, b) => b[1] - a[1])[0];
    const symbol = symEntry?.[0] ?? (items[0]?.symbol ?? "");
    const qtyAbs = symEntry?.[1] ?? 0;

    // side majoritaire
    const bySide = new Map<string, number>();
    for (const it of items) bySide.set(it.side, (bySide.get(it.side) ?? 0) + 1);
    const side = ( [...bySide.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" ) as TxGroup["side"];

    // total USD
    let totalUsd = 0, has = false;
    for (const it of items) {
      if (it.price != null) { totalUsd += it.quantity * (it.price as number); has = true; }
    }

    groups.push({
      key,
      ts: new Date(Number(key) * 1000),
      items,
      symbol,
      side,
      qtyAbs,
      totalUsd: has ? totalUsd : undefined,
    });
  }

  groups.sort((a, b) => b.ts.getTime() - a.ts.getTime()); // récent → ancien
  return groups;
}

/* =============================================================================
   UI bits
============================================================================= */
function SidePill({ side }: { side: string }) {
  const s = (side || "").toUpperCase();
  const cls =
    s === "BUY"
      ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
      : s === "SELL"
      ? "bg-rose-100 text-rose-800 ring-1 ring-rose-200"
      : "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>{s || ""}</span>;
}

/* =============================================================================
   Résumé (cards) — ne compte que les PARENTS (groups)
============================================================================= */
/* =============================================================================
   Résumé (cards) — VERSION COMPACTE
============================================================================= */
export function TransactionSummary({ transactions }: { transactions: Transaction[] }) {
  const parentGroups = useMemo(() => groupByExactSecond(transactions), [transactions]);

  const totalParents = parentGroups.length;
  const buyParents   = parentGroups.filter((g) => g.side === "BUY").length;
  const sellParents  = parentGroups.filter((g) => g.side === "SELL").length;

  const netInvested =
    parentGroups.reduce((acc, g) => acc + (g.side === "BUY" ? (g.totalUsd ?? 0) : 0), 0) -
    parentGroups.reduce((acc, g) => acc + (g.side === "SELL" ? (g.totalUsd ?? 0) : 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
      {/* Carte */}
      <div className="bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="text-lg font-semibold text-black">{totalParents}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">Total transactions</div>
      </div>

      {/* Carte */}
      <div className="bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="text-lg font-semibold text-emerald-600">{buyParents}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">Achats</div>
      </div>

      {/* Carte */}
      <div className="bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="text-lg font-semibold text-rose-600">{sellParents}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">Ventes</div>
      </div>

      {/* Carte */}
      <div className="bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="text-lg font-semibold text-blue-600">
          ${netInvested.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">Investi net</div>
      </div>
    </div>
  );
}

/* =============================================================================
   Liste Apple-like avec groupement, alignement, popup et pagination
============================================================================= */
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type SideFilter = "ALL" | "BUY" | "SELL" | "TRANSFER";

export function TransactionListApple({
  transactions,
  isLoading,
}: {
  transactions: Transaction[];
  isLoading?: boolean;
}) {
  // filtres / tri
  const [side, setSide] = useState<SideFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");

  // pagination
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // popup groupe
  const [openGroup, setOpenGroup] = useState<TxGroup | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  // Filtrer
  const filteredTx = useMemo(() => {
    const bySide = side === "ALL" ? transactions : transactions.filter((t) => t.side === side);
    if (!normalizedQuery) return bySide;
    return bySide.filter((t) => {
      const sym = (t.symbol || "").toLowerCase();
      const note = (t.note || "").toLowerCase();
      return sym.includes(normalizedQuery) || note.includes(normalizedQuery);
    });
  }, [transactions, side, normalizedQuery]);

  // Trier transactions (ensuite on groupe)
  const sortedTx = useMemo(() => {
    const copy = [...filteredTx];
    switch (sortKey) {
      case "date-asc":
        copy.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
        break;
      case "amount-desc":
        copy.sort((a, b) => (b.price ? b.quantity * +b.price : 0) - (a.price ? a.quantity * +a.price : 0));
        break;
      case "amount-asc":
        copy.sort((a, b) => (a.price ? a.quantity * +a.price : 0) - (b.price ? b.quantity * +b.price : 0));
        break;
      default:
        copy.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    }
    return copy;
  }, [filteredTx, sortKey]);

  // Grouper → parents
  const allGroups = useMemo(() => groupByExactSecond(sortedTx), [sortedTx]);

  // reset page si filtres changent
  useEffect(() => { setPage(1); }, [side, sortKey, query, transactions]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allGroups.length / perPage));
  const start = (page - 1) * perPage;
  const visibleGroups = allGroups.slice(start, start + perPage);

  // Skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!allGroups.length) {
    return (
      <div className="text-center py-12 text-gray-700 bg-white rounded-lg border border-gray-200">
        <div className="text-5xl mb-3">🧾</div>
        <div className="font-medium">Aucune transaction</div>
        <div className="text-sm mt-1">Ajoutez une transaction ou importez un CSV</div>
      </div>
    );
  }

  return (
    <>
      {/* Barre de contrôle */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Segmented */}
          <div className="inline-flex rounded-full border border-gray-200 p-1 bg-gray-50">
            {([
              ["ALL", "Tous"],
              ["BUY", "Achat"],
              ["SELL", "Vente"],
              ["TRANSFER", "Transfert"],
            ] as const).map(([val, label]) => {
              const active = side === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSide(val as SideFilter)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200
                    ${active ? "bg-white border border-gray-200 shadow-sm text-gray-700" : "text-gray-700 opacity-80 hover:opacity-100"}
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Recherche */}
          <div className="relative md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (symbole, note)"
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-black text-sm text-black placeholder-gray-400"
            />
          </div>

          {/* Tri */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-700">Tri</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-black focus:border-black text-black"
            >
              <option value="date-desc">Date ↓</option>
              <option value="date-asc">Date ↑</option>
              <option value="amount-desc">Montant ↓</option>
              <option value="amount-asc">Montant ↑</option>
            </select>
          </div>

          {/* Import CSV */}
          <button
            type="button"
            className="ml-auto md:ml-0 h-9 px-3 rounded-lg border border-black bg-black text-white text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Importer CSV
          </button>
        </div>
      </div>

      {/* Liste des groupes (parents) — ALIGNEMENT STABLE via min-w + tabular-nums */}
      <div className="space-y-3">
        {visibleGroups.map((g) => {
          const hasChildren = g.items.length > 1;
          const avgPrice = g.totalUsd && g.qtyAbs ? g.totalUsd / g.qtyAbs : null;

          return (
            <div
              key={g.key}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between tabular-nums"
            >
              {/* Bloc gauche */}
              <div className="flex items-center gap-3">
                <SidePill side={g.side} />
                <div className="font-mono text-sm text-gray-900">{g.symbol}</div>
                <div className="text-xs text-gray-700">{fullDate(g.ts)}</div>
              </div>

              {/* Bloc droite : large gaps + min-w pour aligner toutes les lignes */}
              <div className="flex items-center gap-12">
                <div className="text-right min-w-[72px]">
                  <div className="font-medium text-gray-900">{fmtQty(g.qtyAbs)}</div>
                  <div className="text-[11px] text-gray-700">Qté</div>
                </div>

                <div className="text-right min-w-[110px]">
                  {avgPrice != null ? (
                    <>
                      <div className="text-gray-900">${fmtPrice(avgPrice)}</div>
                      <div className="text-[11px] text-gray-700">Prix moyen</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">—</div>
                  )}
                </div>

                <div className="text-right min-w-[130px]">
                  {g.totalUsd != null ? (
                    <>
                      <div className="font-semibold text-gray-900">${fmtTotal(g.totalUsd)}</div>
                      <div className="text-[11px] text-gray-700">Total</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">—</div>
                  )}
                </div>

                {/* bouton info sombre */}
                {hasChildren ? (
                  <button
                    onClick={() => setOpenGroup(g)}
                    title="Détails"
                    className="w-8 h-8 rounded-full bg-neutral-800 text-white grid place-items-center
                               hover:bg-black transition-colors duration-200 shadow-sm hover:shadow-md"
                  >
                    i
                  </button>
                ) : (
                  <div className="w-8" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Afficher</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="h-9 rounded-lg border border-gray-300 text-sm text-black focus:ring-2 focus:ring-black focus:border-black"
          >
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-sm text-gray-700">par page</span>
        </div>

        <div className="flex items-center gap-1">
          {totalPages <= 1 ? (
            <span className="h-9 min-w-[36px] grid place-items-center rounded-lg border border-gray-200 bg-white text-sm text-gray-900">1</span>
          ) : (
            <>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-50"
                disabled={page === 1}
              >
                Préc.
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const n = i + 1;
                const active = n === page;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-9 min-w-[36px] px-2 rounded-lg text-sm
                      ${active ? "bg-black text-white" : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"}
                    `}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-50"
                disabled={page === totalPages}
              >
                Suiv.
              </button>
            </>
          )}
        </div>
      </div>

      {/* POPUP groupe — plus grand, infos filles plus petites */}
      {openGroup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 animate-[fadeIn_.15s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Transactions du groupe</h3>
              <button
                onClick={() => setOpenGroup(null)}
                className="h-8 px-3 rounded-lg bg-neutral-800 text-white hover:bg-black transition-colors"
              >
                Fermer
              </button>
            </div>

            <div className="divide-y divide-gray-200">
              {openGroup.items.map((t) => {
                const hasPrice = t.price != null;
                return (
                  <div key={t.transaction_id} className="py-3 flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-3">
                      <SidePill side={t.side} />
                      <span className="font-mono text-gray-900">{t.symbol}</span>
                      <span className="text-xs text-gray-600">{fullDate(new Date(t.timestamp))}</span>
                    </div>
                    <div className="flex items-center gap-10 tabular-nums">
                      <div className="text-right min-w-[72px]">
                        <div className="text-gray-900">{fmtQty(t.quantity)}</div>
                        <div className="text-[11px] text-gray-600">Qté</div>
                      </div>
                      <div className="text-right min-w-[110px]">
                        {hasPrice ? (
                          <>
                            <div className="text-gray-900">${fmtPrice(t.price as number)}</div>
                            <div className="text-[11px] text-gray-600">Prix</div>
                          </>
                        ) : (
                          <div className="text-gray-400">—</div>
                        )}
                      </div>
                      <div className="text-right min-w-[130px]">
                        {hasPrice ? (
                          <>
                            <div className="font-semibold text-gray-900">
                              ${fmtTotal(t.quantity * (t.price as number))}
                            </div>
                            <div className="text-[11px] text-gray-600">Total</div>
                          </>
                        ) : (
                          <div className="text-gray-400">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
