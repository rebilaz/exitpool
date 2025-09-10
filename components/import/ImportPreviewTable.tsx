// components/import/ImportPreviewTable.tsx
"use client";

import React from "react";
import type { NormalizedRow } from "@/hooks/useBulkImport";
import { useSymbolSuggestions, type SymbolSuggestion } from "@/hooks/useSymbolSuggestions";
import {
  X,
  Calculator,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

/* ---------------- Number utils ---------------- */
function shortNumber(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  const v = Number(value);
  const abs = Math.abs(v);
  const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0$/, "");
  if (abs >= 1_000_000_000) return `${fmt(v / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${fmt(v / 1_000_000)}M`;
  if (abs >= 1_000) return `${fmt(v / 1_000)}k`;
  return `${v}`;
}
function formatMaxDecimals(n?: number, max = 6) {
  if (!Number.isFinite(Number(n))) return "";
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  }).format(Number(n));
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --- 2 décimales + compact k/M/B ---
function fmtSmart(n?: number | null): string {
  if (!Number.isFinite(Number(n))) return "";
  const v = Number(n);
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (a >= 1_000_000)    return (v / 1_000_000).toFixed(2) + "M";
  if (a >= 1_000)        return (v / 1_000).toFixed(2) + "k";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
}

function fmtSmartOrDash(n?: number | null): string {
  return Number.isFinite(Number(n)) ? fmtSmart(Number(n)) : "–";
}

/* ---------------- Time utils ---------------- */
function timeAgo(date: Date) {
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const now = Date.now();
  const diffMs = date.getTime() - now;

  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hour = Math.round(min / 60);
  const day = Math.round(hour / 24);
  const week = Math.round(day / 7);
  const month = Math.round(day / 30);
  const year = Math.round(day / 365);

  if (Math.abs(year) >= 1) return rtf.format(year, "year");
  if (Math.abs(month) >= 1) return rtf.format(month, "month");
  if (Math.abs(week) >= 1) return rtf.format(week, "week");
  if (Math.abs(day) >= 1) return rtf.format(day, "day");
  if (Math.abs(hour) >= 1) return rtf.format(hour, "hour");
  if (Math.abs(min) >= 1) return rtf.format(min, "minute");
  return rtf.format(sec, "second");
}
function fullDateString(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR");
}
function relativeOrEmpty(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return timeAgo(d);
}

/* ---------------- UI bits ---------------- */
function SideBadge({ side }: { side?: string }) {
  const s = (side ?? "").toUpperCase();
  const map = {
    BUY: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    SELL: "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
    TRANSFER: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  } as const;
  const cls =
    s in map
      ? map[s as keyof typeof map]
      : "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>
      {s || ""}
    </span>
  );
}

/* ---------------- Symbol Resolution Component ---------------- */
function SymbolResolver({ 
  parentKey, 
  symbol, 
  isOpen, 
  onOpen, 
  onClose, 
  onResolve 
}: {
  parentKey: string;
  symbol: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onResolve: (suggestion: SymbolSuggestion) => void;
}) {
  const { suggestions, loading } = useSymbolSuggestions(symbol);
  
  // Si une seule suggestion ou aucune, pas besoin de résolution
  if (!suggestions || suggestions.length <= 1) {
    return <span className="font-mono">{symbol}</span>;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="font-mono">{symbol}</span>
        <button
          type="button"
          onClick={onOpen}
          className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 transition-colors"
          title={`${suggestions.length} correspondances trouvées`}
        >
          Résoudre
        </button>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[300px] max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 text-xs text-gray-600">
            Choisissez le bon projet ({suggestions.length} options) :
          </div>
          {loading ? (
            <div className="p-3 text-xs text-gray-500">Chargement...</div>
          ) : (
            <ul className="py-1">
              {suggestions.map((suggestion, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => onResolve(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col gap-1 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{suggestion.symbol}</span>
                      <span className="text-xs text-gray-500">({suggestion.coingecko_id})</span>
                    </div>
                    <div className="text-xs text-gray-600 truncate">{suggestion.name}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="p-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Grouping types & helpers ---------------- */
type ParentTrade = {
  key: string;
  exchange: string;
  symbol: string;          // token parent (flux net max)
  side: string;            // BUY/SELL selon net
  ts: string;              // ISO
  qty: number;             // abs(net flux parent)
  value_usd_like?: number; // abs(net flux USDT/USD)
  quote_token?: string;    // "USDT" | "USD" | undefined
  fee_base: number;
  fee_quote: number;
  fee_other: { token: string; amount: number }[];
  fees_by_token: { token: string; amount: number }[];
  computed_price: boolean;
  is_duplicate: boolean;
  fills: NormalizedRow[];
};

function isFeeRow(r: NormalizedRow) {
  const q = num(r.quantity);
  const f = num((r as any)?.fee);
  return q === 0 && f > 0;
}
function derivePriceIfMissing(r: NormalizedRow) {
  const p = num(r.price);
  if (p) return { price: p, computed: false };
  const t = num((r as any)?.total);
  const q = num(r.quantity);
  if (t && q) return { price: t / q, computed: true };
  return { price: undefined, computed: false };
}
function normTsToSecond(ts?: string): string {
  if (!ts) return "invalid";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return String(Math.floor(d.getTime() / 1000));
}

/** Flux par symbole : BUY = +qty, SELL = -qty, FEE(currency) = -fee */
function groupByExactTimestamp(rows: NormalizedRow[]): ParentTrade[] {
  const usdLike = new Set(["USDT", "USD"]);
  const seenClientIds = new Set<string>();
  const seenHashes = new Set<string>();
  const groups = new Map<string, NormalizedRow[]>();

  for (const r of rows) {
    const key = `${(r.exchange || "").trim()}|${normTsToSecond(r.timestamp)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const parents: ParentTrade[] = [];

  for (const [key, g] of groups) {
    const exchange = (g[0]?.exchange || "").trim();
    const tsSec = key.split("|")[1];
    const tsIso = Number.isFinite(Number(tsSec))
      ? new Date(Number(tsSec) * 1000).toISOString()
      : (g[0]?.timestamp ?? "");

    // 1) Construire flux par symbole
    type Flow = { net: number; buy: number; sell: number };
    const flows = new Map<string, Flow>();
    const addFlow = (sym: string, delta: number, kind: "buy" | "sell" | "fee") => {
      if (!sym) return;
      const f = flows.get(sym) ?? { net: 0, buy: 0, sell: 0 };
      if (kind === "buy") { f.buy += delta; f.net += delta; }
      else if (kind === "sell") { f.sell += delta; f.net -= delta; }
      else { f.net -= delta; } // fee
      flows.set(sym, f);
    };

    let computed_price = false;

    for (const r of g) {
      const sym = (r.symbol || "").trim();
      const side = (r.side || "").toUpperCase();
      const q = num(r.quantity);
      const feeAmt = num((r as any)?.fee);
      if (q > 0) {
        if (side === "BUY") addFlow(sym, q, "buy");
        else if (side === "SELL") addFlow(sym, q, "sell");
        const { computed } = derivePriceIfMissing(r);
        if (computed) computed_price = true;
      } else if (feeAmt > 0 && r.fee_currency) {
        addFlow((r.fee_currency || "").trim(), feeAmt, "fee");
      }
    }

    // 2) Sélection du parent = symbole |net| max (en évitant USDT/USD s'il existe un autre flux non nul)
    const nonUsdCandidates = [...flows.entries()].filter(
      ([sym, f]) => !usdLike.has(sym) && Math.abs(f.net) > 0
    );
    const usdCandidates = [...flows.entries()].filter(
      ([sym, f]) => usdLike.has(sym) && Math.abs(f.net) > 0
    );

    let parentSym = "";
    let parentNet = 0;
    const pickMax = (arr: [string, Flow][]) =>
      arr.reduce(
        (best, cur) => (Math.abs(cur[1].net) > Math.abs(best[1].net) ? cur : best),
        arr[0]
      );

    if (nonUsdCandidates.length) {
      const [s, f] = pickMax(nonUsdCandidates);
      parentSym = s;
      parentNet = f.net;
    } else if (usdCandidates.length) {
      const [s, f] = pickMax(usdCandidates);
      parentSym = s;
      parentNet = f.net;
    } else {
      // fallback (ex: groupe uniquement de fees)
      parentSym = (g.find((x) => x.symbol)?.symbol || "USDT").trim();
      parentNet = flows.get(parentSym)?.net ?? 0;
    }

    const parentQtyAbs = Math.abs(parentNet);
    const parentSide = parentNet >= 0 ? "BUY" : "SELL";

    // 3) Valeur USDT/USD échangée = abs(flux net USDT/USD)
    const usdtNet = (flows.get("USDT")?.net ?? 0) + 0;
    const usdNet = (flows.get("USD")?.net ?? 0) + 0;
    const usdxNet = usdtNet !== 0 ? usdtNet : usdNet;
    const quoteToken = usdtNet !== 0 ? "USDT" : usdNet !== 0 ? "USD" : undefined;
    const value_usd_like = usdxNet !== 0 ? Math.abs(usdxNet) : undefined;

    // 4) Fees agrégées par token
    const fees_by_token: { token: string; amount: number }[] = [];
    for (const [sym, f] of flows.entries()) {
      // estimation fee = différence entre net et (buy - sell) si sym avait eu des buy/sell
      // mais comme on a déjà soustrait les fees directement dans net, on les extrait depuis les lignes fee
    }
    // recalcul précis depuis les lignes à fee
    const feeTotals: Record<string, number> = {};
    for (const r of g) {
      const amt = num((r as any)?.fee);
      if (amt > 0 && r.fee_currency) {
        const t = (r.fee_currency || "").trim();
        feeTotals[t] = (feeTotals[t] ?? 0) + amt;
      }
    }
    for (const [t, a] of Object.entries(feeTotals)) {
      fees_by_token.push({ token: t, amount: a });
    }
    fees_by_token.sort((a, b) => a.token.localeCompare(b.token));

    const fee_base = feeTotals[parentSym] ?? 0;
    const fee_quote = quoteToken ? feeTotals[quoteToken] ?? 0 : 0;
    const fee_other = fees_by_token.filter(
      (f) => f.token !== parentSym && f.token !== quoteToken
    );

    // 5) Détection simple de doublons
    let is_duplicate = false;
    for (const f of g) {
      if (f.client_tx_id && seenClientIds.has(f.client_tx_id)) is_duplicate = true;
      if (f.client_tx_id) seenClientIds.add(f.client_tx_id);
      const h = `${f.exchange}|${f.symbol}|${f.side}|${num(f.quantity)}|${num(
        (f as any).price
      )}|${normTsToSecond(f.timestamp)}|${f.fee_currency}|${num(
        (f as any)?.fee
      )}`;
      if (seenHashes.has(h)) is_duplicate = true;
      seenHashes.add(h);
    }

    parents.push({
      key,
      exchange,
      symbol: parentSym || "—",
      side: parentSide,
      ts: tsIso,
      qty: parentQtyAbs,
      value_usd_like,
      quote_token: quoteToken,
      fee_base,
      fee_quote,
      fee_other,
      fees_by_token,
      computed_price,
      is_duplicate,
      fills: g,
    });
  }

  // récent → ancien
  parents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return parents;
}

/* ---------------- Component ---------------- */
type Props = {
  rows: NormalizedRow[];
  fileName?: string;
  onRemoveFile?: () => void;
  onResolveSymbol?: (parentKey: string, suggestion: SymbolSuggestion) => void;
};

export default function ImportPreviewTable({ rows, fileName, onRemoveFile, onResolveSymbol }: Props) {
  if (!rows || rows.length === 0) return null;

  const isAllMexc = rows.every((r) => r.exchange === "MEXC");
  const [groupMode, setGroupMode] = React.useState<"none" | "mexc-ts">(
    isAllMexc ? "mexc-ts" : "none"
  );
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [resolveOpen, setResolveOpen] = React.useState<string | null>(null);
  const [resolvedSymbols, setResolvedSymbols] = React.useState<Record<string, SymbolSuggestion>>({});

  const parents = React.useMemo(
    () => (groupMode === "mexc-ts" ? groupByExactTimestamp(rows) : []),
    [rows, groupMode]
  );

  const toggleRow = (key: string) =>
    setExpanded((m) => ({ ...m, [key]: !m[key] }));

  const handleResolveSymbol = (parentKey: string, suggestion: SymbolSuggestion) => {
    setResolvedSymbols(prev => ({ ...prev, [parentKey]: suggestion }));
    setResolveOpen(null);
    onResolveSymbol?.(parentKey, suggestion);
  };

  // Fermer le panneau de résolution si on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resolveOpen && !(event.target as Element)?.closest('.relative')) {
        setResolveOpen(null);
      }
    };

    if (resolveOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [resolveOpen]);

  const fmtStr = (v?: string) => (v && v.trim().length ? v : "");

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
      {/* Barre d'options — “Grouper” seul, case grise, libellé noir */}
      <div className="flex items-center gap-4 px-3 py-2 border-b bg-gray-50 text-xs">
        <label className="flex items-center gap-2 text-gray-900">
          <input
            type="checkbox"
            className="accent-gray-700"
            checked={groupMode === "mexc-ts"}
            onChange={(e) => setGroupMode(e.target.checked ? "mexc-ts" : "none")}
          />
          Grouper
        </label>
      </div>

      {/* Mode brut (inchangé) */}
      {groupMode === "none" && (
        <table className="min-w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600 sticky top-0">
            <tr>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2 text-right">Fee</th>
              <th className="px-3 py-2">Fee Currency</th>
              <th className="px-3 py-2">Ext Ref</th>
              <th className="px-3 py-2">Client Tx Id</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Exchange</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-900">
            {rows.map((r, i) => {
              const qtyShort = fmtSmart(r.quantity as any);
              const priceShort = fmtSmart((r as any)?.price);
              const feeShort = fmtSmart((r as any)?.fee);
              const qtyFull = Number.isFinite(Number(r.quantity))
                ? Number(r.quantity).toLocaleString("fr-FR")
                : "";
              const priceFull = Number.isFinite(Number(r.price))
                ? Number(r.price).toLocaleString("fr-FR")
                : "";
              const feeFull = Number.isFinite(Number((r as any)?.fee))
                ? Number((r as any)?.fee).toLocaleString("fr-FR")
                : "";
              const rel = relativeOrEmpty(r.timestamp);
              const full = fullDateString(r.timestamp);

              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{fmtStr(r.symbol)}</td>
                  <td className="px-3 py-2">
                    <SideBadge side={r.side} />
                  </td>
                  <td className="px-3 py-2 text-right" title={qtyFull}>
                    {qtyShort}
                  </td>
                  <td className="px-3 py-2 text-right" title={priceFull}>
                    {priceShort}
                  </td>
                  <td className="px-3 py-2">
                    <span className="relative group cursor-default">
                      {rel}
                      <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                        absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                        rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                        {full}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" title={feeFull}>
                    {feeShort}
                  </td>
                  <td className="px-3 py-2">{(r as any)?.fee_currency ?? ""}</td>
                  <td className="px-3 py-2">{(r as any)?.ext_ref ?? ""}</td>
                  <td className="px-3 py-2">{(r as any)?.client_tx_id ?? ""}</td>
                  <td className="px-3 py-2">{(r as any)?.note ?? ""}</td>
                  <td className="px-3 py-2">{fmtStr(r.exchange as string)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Mode agrégé */}
      {groupMode === "mexc-ts" && (
        <table className="min-w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600 sticky top-0">
            <tr>
              <th className="px-3 py-2"> </th>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2 text-right">USDT/USD Traded</th>
              <th className="px-3 py-2">Fees</th>
              <th className="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-900">
            {parents.map((p) => {
              const qtyLabel = fmtSmart(p.qty);
              const qtyFullParent = formatMaxDecimals(p.qty, 6);
              const qtyTitle = formatMaxDecimals(p.qty, 6);
              const rel = relativeOrEmpty(p.ts);
              const full = fullDateString(p.ts);
              const tradedLabel = fmtSmartOrDash(p.value_usd_like);
              const tradedFullParent = typeof p.value_usd_like === "number"
                ? `${formatMaxDecimals(p.value_usd_like, 6)} ${p.quote_token ?? ""}`
                : "";
              const tradedTitle =
                typeof p.value_usd_like === "number"
                  ? `${formatMaxDecimals(p.value_usd_like, 6)} ${p.quote_token ?? ""}`
                  : "Pas de contrepartie USD";

              return (
                <React.Fragment key={p.key}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 align-middle">
                      <button
                        type="button"
                        aria-label={expanded[p.key] ? "Réduire" : "Déplier"}
                        onClick={() => toggleRow(p.key)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {expanded[p.key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {resolvedSymbols[p.key] ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{resolvedSymbols[p.key].symbol}</span>
                          <span className="text-xs text-gray-500">({resolvedSymbols[p.key].name})</span>
                        </div>
                      ) : (
                        <SymbolResolver
                          parentKey={p.key}
                          symbol={p.symbol}
                          isOpen={resolveOpen === p.key}
                          onOpen={() => setResolveOpen(p.key)}
                          onClose={() => setResolveOpen(null)}
                          onResolve={(suggestion) => handleResolveSymbol(p.key, suggestion)}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <SideBadge side={p.side} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="relative group cursor-default">
                        {qtyLabel}
                        <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                          absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                          rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                          {qtyFullParent}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="relative group cursor-default">
                        {rel}
                        <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                          absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                          rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                          {full}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="relative group cursor-default">
                        {tradedLabel}
                        {tradedFullParent && (
                          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                            absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                            rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                            {tradedFullParent}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.fees_by_token.length === 0 ? (
                        <span className="text-xs text-gray-500">0</span>
                      ) : (
                        p.fees_by_token.map((f) => (
                          <span
                            key={f.token}
                            className="mr-1 text-xs bg-slate-100 px-2 py-0.5 rounded"
                            title={formatMaxDecimals(f.amount, 6)}
                          >
                            {f.token} {fmtSmart(f.amount)}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.computed_price && (
                        <span title="Prix calculé">
                          <Calculator className="inline text-gray-500" size={14} />
                        </span>
                      )}
                      {p.is_duplicate && (
                        <span title="Doublon">
                          <AlertTriangle className="inline text-orange-500 ml-1" size={14} />
                        </span>
                      )}
                    </td>
                  </tr>

                  {expanded[p.key] && (
                    <tr>
                      <td className="px-3 py-2" colSpan={8}>
                        <div className="bg-gray-50 rounded-md p-2 text-[13px]">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-gray-700">
                              Transactions ({p.fills.length})
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-700">Frais totaux :</span>
                            {p.fees_by_token.length === 0 ? (
                              <span className="text-xs text-gray-500">0</span>
                            ) : (
                              p.fees_by_token.map((f) => (
                                <span
                                  key={f.token}
                                  className="mr-1 text-xs bg-slate-100 px-2 py-0.5 rounded"
                                  title={formatMaxDecimals(f.amount, 6)}
                                >
                                  {f.token} {fmtSmart(f.amount)}
                                </span>
                              ))
                            )}
                          </div>

                          <table className="w-full">
                            <thead className="text-[11px] uppercase text-gray-500">
                              <tr>
                                <th className="py-1 text-left">Type</th>
                                <th className="py-1 text-left">Symbol</th>
                                <th className="py-1 text-left">Side</th>
                                <th className="py-1 text-right">Qty</th>
                                <th className="py-1 text-right">Price</th>
                                <th className="py-1 text-left">Fee Token</th>
                                <th className="py-1 text-right">Fee</th>
                                <th className="py-1 text-left">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-900">
                              {p.fills.map((f, idx) => {
                                const q = num(f.quantity);
                                const feeAmt = num((f as any)?.fee);
                                const isFee = isFeeRow(f);
                                const { price } = derivePriceIfMissing(f);
                                const qtyForDisplay = isFee ? feeAmt : q;
                                const qtyFull = qtyForDisplay ? formatMaxDecimals(qtyForDisplay, 6) : "";
                                const relC = relativeOrEmpty(f.timestamp);
                                const fullC = fullDateString(f.timestamp);

                                return (
                                  <tr key={idx} className="border-t border-gray-100">
                                    <td className="py-1">
                                      {isFee ? (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100">
                                          FEE
                                        </span>
                                      ) : (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                          TRADE
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 font-mono">{f.symbol}</td>
                                    <td className="py-1">
                                      <SideBadge side={f.side} />
                                    </td>
                                    <td className="py-1 text-right">
                                      <span className="relative group cursor-default">
                                        {qtyForDisplay ? fmtSmart(qtyForDisplay) : ""}
                                        {qtyForDisplay ? (
                                          <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                                            absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                                            rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                                            {qtyFull}
                                          </span>
                                        ) : null}
                                      </span>
                                    </td>
                                    <td className="py-1 text-right">
                                      {Number.isFinite(Number(price))
                                        ? fmtSmart(Number(price))
                                        : ""}
                                    </td>
                                    <td className="py-1">{(f as any)?.fee_currency ?? ""}</td>
                                    <td className="py-1 text-right">
                                      {isFee ? "" : feeAmt ? fmtSmart(feeAmt) : ""}
                                    </td>
                                    <td className="py-1">
                                      <span className="relative group cursor-default">
                                        {relC}
                                        <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                                          absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                                          rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                                          {fullC}
                                        </span>
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* ligne Totaux */}
                              <tr className="border-t border-gray-200">
                                <td className="py-1 font-medium text-gray-700">Total</td>
                                <td />
                                <td />
                                <td className="py-1 text-right font-medium">
                                  <span className="relative group cursor-default">
                                    {fmtSmart(p.qty)}
                                    <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                                      absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                                      rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                                      {formatMaxDecimals(p.qty, 6)}
                                    </span>
                                  </span>
                                </td>
                                <td />
                                <td className="py-1 font-medium text-gray-700">Frais</td>
                                <td className="py-1 text-right">
                                  {p.fees_by_token.length === 0
                                    ? "0"
                                    : p.fees_by_token
                                        .map((f) => `${f.token} ${fmtSmart(f.amount)}`)
                                        .join("  •  ")}
                                </td>
                                <td className="py-1 text-right font-medium">
                                  {typeof p.value_usd_like === "number" ? (
                                    <span className="relative group cursor-default">
                                      {`${fmtSmart(p.value_usd_like)} ${p.quote_token ?? ""}`}
                                      <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition
                                        absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 whitespace-nowrap
                                        rounded-xl border border-gray-200 bg-white shadow-xl px-3 py-1 text-[11px] text-gray-800">
                                        {`${formatMaxDecimals(p.value_usd_like, 6)} ${p.quote_token ?? ""}`}
                                      </span>
                                    </span>
                                  ) : ""}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {(fileName || onRemoveFile) && (
        <div className="flex items-center justify-between border-t px-3 py-2 bg-gray-50">
          <span className="text-xs text-gray-700 truncate">{fileName ?? ""}</span>
          {onRemoveFile && (
            <button
              type="button"
              onClick={onRemoveFile}
              className="ml-2 inline-flex items-center rounded-md p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
              aria-label="Retirer le fichier"
              title="Retirer le fichier"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
