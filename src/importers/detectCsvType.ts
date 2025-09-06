export type CsvKind = "mexc-fr" | "binance-fr" | "generic";

/**
 * Détecte le type de CSV à partir de la première ligne (en-têtes).
 * Tolérant aux BOM, guillemets, accents, et séparateurs , / ;
 */
export function detectCsvType(firstLine: string): CsvKind {
  const cleaned = (firstLine ?? "")
    .replace(/^\uFEFF/, "") // BOM éventuel
    .replace(/"/g, ""); // guillemets éventuels

  const headers = cleaned.split(/[;,]/).map((h) => h.trim().toLowerCase());
  const joined = headers.join("|");

  // MEXC FR : "Temps de création(UTC+2)" + "Cryptomonnaie" (avec/sans accents/variantes)
  const hasCreation =
    joined.includes("temps de création") ||
    joined.includes("temps de creation") ||
    joined.includes("création") ||
    joined.includes("creation");
  const hasCrypto =
    joined.includes("cryptomonnaie") ||
    joined.includes("crypto-monnaie") ||
    joined.includes("crypto monnaie");

  if (hasCreation && hasCrypto) {
    console.info("[IMPORT/DETECT] kind=mexc-fr", { headers });
    return "mexc-fr";
  }

  // Binance FR
  if (joined.includes("date(utc)") && joined.includes("pair")) {
    console.info("[IMPORT/DETECT] kind=binance-fr", { headers });
    return "binance-fr";
  }

  console.info("[IMPORT/DETECT] kind=generic", { headers });
  return "generic";
}
