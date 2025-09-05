"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SymbolAutocomplete } from "@/components/SymbolAutocomplete";
import { useAddTransaction } from "@/hooks/usePortfolio";

type Props = {
  userId?: string;               // si fourni, utiliser cet id (fallback si session pas prête)
  isOpen: boolean;               // contrôle d'affichage de la modale par le parent
  onClose?: () => void;          // fermer la modale
  onSuccess?: () => void;        // appelé après succès
  defaults?: {                   // valeurs initiales facultatives
    symbol?: string;
    side?: "BUY" | "SELL";
    dateISO?: string;            // ex: "2025-09-03"
  };
};

// Générer/récupérer un ID temporaire pour les utilisateurs anonymes
function getOrCreateTempUserId() {
  if (typeof window === "undefined") return null;
  const KEY = "cp_temp_user_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function TransactionForm({
  userId,
  isOpen,
  onClose,
  onSuccess,
  defaults,
}: Props) {
  const { data: session } = useSession();

  // États du formulaire
  const [symbol, setSymbol] = useState(defaults?.symbol || "");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    defaults?.dateISO || new Date().toISOString().split("T")[0]
  );
  const [side, setSide] = useState<"BUY" | "SELL">(defaults?.side || "BUY");
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<"idle" | "success" | "error">("idle");

  // Hook pour ajouter des transactions
  const addTransactionMutation = useAddTransaction();

  // Réinitialiser les valeurs par défaut quand elles changent
  useEffect(() => {
    if (defaults?.symbol !== undefined) setSymbol(defaults.symbol);
    if (defaults?.side !== undefined) setSide(defaults.side);
    if (defaults?.dateISO !== undefined) setTransactionDate(defaults.dateISO);
  }, [defaults]);

  // Réinitialiser le formulaire quand on ouvre/ferme
  useEffect(() => {
    if (isOpen) setAddStatus("idle");
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!symbol || !qty) return;

    // Toujours utiliser l'ID Prisma en priorité si dispo
    const effectiveUserId =
      session?.user?.id ?? userId ?? getOrCreateTempUserId();
    if (!effectiveUserId) return;

    const s = symbol.toUpperCase();
    const q = parseFloat(qty);
    if (Number.isNaN(q) || q === 0) return;

    setIsAdding(true);
    setAddStatus("idle");

    try {
      await addTransactionMutation.mutateAsync({
        userId: effectiveUserId,
        symbol: s,
        quantity: q,
        price: price ? parseFloat(price) : undefined,
        side,
        note: "Ajouté via TransactionForm",
        timestamp: transactionDate
          ? new Date(transactionDate + "T12:00:00").toISOString()
          : undefined,
      });

      // Succès immédiat
      setAddStatus("success");

      // Reset instantané du formulaire
      setSymbol(defaults?.symbol || "");
      setQty("");
      setPrice("");
      setTransactionDate(defaults?.dateISO || new Date().toISOString().split("T")[0]);
      setSide(defaults?.side || "BUY");
      setAddStatus("idle");

      // Rafraîchissement côté parent (Home.tsx fait refetchPortfolio dans onSuccess)
      onSuccess?.();
      onClose?.();
    } catch (error) {
      setAddStatus("error");
      console.error("Erreur lors de l'ajout de la transaction:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (isAdding) return;
    setAddStatus("idle");
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg overflow-visible">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Ajouter une transaction
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
            disabled={isAdding}
          >
            ✕
          </button>
        </div>

        {/* Champ symbole */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-700">Symbole</label>
            <SymbolAutocomplete
              value={symbol}
              onChange={setSymbol}
              onSelect={(suggestion) => setSymbol(suggestion.symbol)}
              placeholder="BTC, ETH, SOL..."
              className="text-sm text-gray-900"
            />
          </div>

        {/* Quantité + Prix */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Quantité
              </label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.5 (négatif pour vente)"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="w-full sm:w-40 sm:flex-[0.5]">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Prix <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Prix du marché"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* BUY/SELL */}
          <div className="flex flex-col gap-2">
            <label className="block text-xs font-medium text-gray-700">
              Type de transaction
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide("BUY")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                  side === "BUY"
                    ? "bg-green-50 text-green-700 border border-green-200 shadow-sm"
                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                }`}
              >
                ACHAT
              </button>
              <button
                type="button"
                onClick={() => setSide("SELL")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                  side === "SELL"
                    ? "bg-red-50 text-red-700 border border-red-200 shadow-sm"
                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                }`}
              >
                VENTE
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label className="block text-xs font-medium text-gray-700">
              Date de la transaction
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Tips */}
          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md">
            💡 <strong>ACHAT</strong> : Quantité positive (ex: 0.5)<br />
            💡 <strong>VENTE</strong> : Quantité positive (ex: 0.5)<br />
            Si aucun prix n'est spécifié, le prix actuel du marché sera utilisé.
          </div>

          {/* Feedback */}
          {addStatus === "success" && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-3 rounded-md flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Transaction ajoutée avec succès !
            </div>
          )}
          {addStatus === "error" && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md flex items-center gap-2">
              <span className="text-red-500">✗</span>
              Erreur lors de l'ajout de la transaction. Veuillez réessayer.
            </div>
          )}
        </div>

        {/* Boutons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isAdding}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isAdding || !symbol || !qty}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAdding && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {isAdding ? "Ajout en cours..." : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
