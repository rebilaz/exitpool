"use client";

import { useMemo } from "react";
import PortfolioMain, { type PortfolioAsset } from "@/components/PortfolioMain";

interface PortfolioSectionProps {
  assets: PortfolioAsset[];
  pricesLoading?: boolean;
  lastPriceUpdate?: Date | null; // tick prix (~15 min)
  onRemove?: (id: string) => void;
}

// Hook exposé pour être utilisé dans le parent avec le chart
export function usePortfolioChartData(assets: PortfolioAsset[], lastPriceUpdate?: Date | null) {
  // Recalcule à chaque tick prix, même si assets est muté in-place
  const todayValue = useMemo(() => {
    const total = assets?.reduce((acc, a) => acc + a.quantity * a.price, 0) ?? 0;
    return Number.isFinite(total) ? total : 0;
  }, [assets, lastPriceUpdate]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastPriceUpdate) return undefined;
    const time = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(lastPriceUpdate);
    return `${time}`;
  }, [lastPriceUpdate]);

  return { todayValue, lastUpdatedLabel };
}

export default function PortfolioSection({
  assets,
  pricesLoading,
  lastPriceUpdate,
  onRemove,
}: PortfolioSectionProps) {
  return (
    <PortfolioMain
      assets={assets}
      onRemove={onRemove}
      pricesLoading={pricesLoading}
      lastPriceUpdate={lastPriceUpdate ?? null}
    />
  );
}
