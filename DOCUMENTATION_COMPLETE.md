# 📊 CryptoPilot4 - Documentation Technique Complète

## 🎯 Vue d'ensemble du projet

CryptoPilot4 est une application Next.js 15 de gestion de portefeuille de cryptomonnaies avec authentification, synchronisation temps réel des prix, et analytics avancées. L'application utilise une architecture hybride PostgreSQL + BigQuery pour optimiser les performances et la scalabilité.

## 🏗️ Architecture générale

### Stack technologique
- **Frontend** : Next.js 15.5.2 + React 19 + TypeScript 5.9
- **Styling** : Tailwind CSS 4.1 + Framer Motion + Recharts
- **Backend** : Next.js API Routes + Prisma ORM
- **Base de données** : PostgreSQL (données relationnelles) + BigQuery (analytics)
- **Authentification** : NextAuth.js 4.24 + Google OAuth + bcryptjs
- **État** : TanStack React Query 5.85
- **Analytics** : Vercel Analytics

### Architecture des données
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │    BigQuery     │    │   DeFiLlama     │
│   (Prisma)      │    │   (Analytics)   │    │   (Prix temps   │
│                 │    │                 │    │    réel)        │
│ • Users         │    │ • Transactions  │    │                 │
│ • Accounts      │    │ • Snapshots     │    │ • Prix crypto   │
│ • Sessions      │    │ • Portfolio     │    │ • Market data   │
│ • Transactions  │    │   history       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔐 Système d'authentification

### NextAuth.js Configuration
```typescript
// app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [GoogleProvider({...})],
  callbacks: {
    jwt: ({ token, user, account }) => {
      // Stockage de l'ID Prisma et Google sub
      token.pid = user.id; // ID Prisma (cuid)
      token.sub = account.providerAccountId; // Google sub
    },
    session: ({ session, token }) => {
      // Exposition dans la session
      session.user.id = token.pid; // Pour les relations Prisma
      session.user.sub = token.sub; // Pour l'interopérabilité
    }
  }
}
```

### Gestion des utilisateurs
- **Utilisateurs authentifiés** : ID Prisma permanent via Google OAuth
- **Utilisateurs anonymes** : ID temporaire stocké dans `localStorage` (`cp_temp_user_id`)
- **Migration automatique** : Les transactions anonymes sont migrées vers l'ID permanent au login

### Modèles Prisma
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  passwordHash  String?   // Pour auth email/password
  createdAt     DateTime  @default(now())
  
  accounts      Account[]
  sessions      Session[]
  transactions  Transaction[]
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String   // Référence vers User.id
  asset     String   @db.VarChar(64)
  amount    Decimal  @db.Decimal(38, 18)
  price     Decimal  @db.Decimal(38, 18)
  side      String   @db.VarChar(10) // "BUY" | "SELL" | "TRANSFER"
  ts        DateTime @default(now())
}
```

## 💰 Gestion du portefeuille

### Service Portfolio (lib/services/portfolioService.ts)

#### Calcul du portefeuille actuel
```typescript
export interface CurrentPortfolio {
  userId: string;
  assets: CurrentPortfolioAsset[];
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  totalPnlPercent: number;
  lastUpdated: Date;
}

export interface CurrentPortfolioAsset {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
}
```

#### Logique de calcul
1. **Récupération des transactions** depuis BigQuery
2. **Agrégation par symbole** : somme des quantités (BUY - SELL)
3. **Calcul du prix moyen** : moyenne pondérée des prix d'achat
4. **Récupération des prix actuels** via DeFiLlama
5. **Calcul des métriques** : PnL, pourcentages, valeurs

#### Historique du portefeuille
```typescript
export interface PortfolioHistory {
  userId: string;
  range: "7d" | "30d" | "1y";
  points: PortfolioHistoryPoint[];
  totalReturn: number;
  totalReturnPercent: number;
}

export interface PortfolioHistoryPoint {
  date: Date;
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
}
```

### Repository des transactions (lib/repos/transactionRepo.ts)

#### Ajout de transaction idempotent
```typescript
async addTransaction(data: AddTransactionData): Promise<string> {
  // Utilise MERGE pour éviter les doublons
  // Supporte clientTxId pour l'idempotence côté client
  const query = `
    MERGE \`${projectId}.${this.dataset}.transactions\` T
    USING (SELECT @transactionId as transaction_id, ...) S
    ON T.transaction_id = S.transaction_id
    WHEN NOT MATCHED THEN INSERT (...)
  `;
}
```

#### Gestion des snapshots
- **Sauvegarde quotidienne** du portefeuille dans BigQuery
- **Breakdown détaillé** par asset (quantité, valeur, prix)
- **Optimisation des requêtes** d'historique

## 📈 Système de prix temps réel

### Architecture des prix
```
DeFiLlama API → PricingService → Cache → Frontend
     ↓              ↓           ↓        ↓
  Prix bruts    Normalisation  Redis   React Query
```

### PricingService (lib/services/pricingService.ts)
```typescript
export class PricingService {
  // Récupération des prix depuis DeFiLlama
  async getPrices(symbols: string[]): Promise<PriceMap>
  
  // Normalisation des symboles (BTC → bitcoin)
  private normalizeSymbol(symbol: string): string
  
  // Cache intelligent avec TTL
  private async getCachedPrice(symbol: string): Promise<number | null>
}
```

### PricingCentralService (lib/services/pricingCentralService.ts)
```typescript
export class PricingCentralService {
  async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    if (!symbols.length) return {};
    try {
      const prices = await getPricesForSymbols(symbols);
      logger.info("Prices fetched successfully", {
        symbols: symbols.length,
        pricesReturned: Object.keys(prices).length,
      });
      return prices;
    } catch (error) {
      logger.error("Error fetching prices", { error, symbols });
      return {};
    }
  }

  async getPriceForSymbol(symbol: string): Promise<number | null> {
    const prices = await this.getCurrentPrices([symbol]);
    return prices[String(symbol).toUpperCase()] ?? null;
  }

  async checkPricesAvailability(symbols: string[]) {
    const prices = await this.getCurrentPrices(symbols);
    const available = Object.keys(prices);
    const missing = symbols.map((s) => String(s).toUpperCase()).filter((s) => !prices[s]);
    return { available, missing, success: missing.length === 0 };
  }
}
```

### Hook usePrices (hooks/usePrices.ts)
```typescript
export function usePrices({ symbols, refreshInterval, enabled }) {
  return useQuery({
    queryKey: ['prices', symbols],
    queryFn: () => fetchPrices(symbols),
    refetchInterval: refreshInterval, // 30s par défaut
    enabled: enabled && symbols.length > 0,
    staleTime: 10000, // 10s
  });
}
```

### Synchronisation automatique
- **Refresh automatique** toutes les 30 secondes
- **Invalidation intelligente** : seules les données modifiées sont re-fetchées
- **Gestion des erreurs** : retry automatique avec backoff exponentiel

## 🎨 Interface utilisateur

### Architecture des composants

#### Page principale (app/page.tsx)
```typescript
export default function Home() {
  // 1. Authentification
  const { data: session } = useSession();
  const userId = session?.user?.id ?? getTempUserId();
  
  // 2. Récupération du portefeuille
  const { data: currentPortfolio } = useCurrentPortfolio(userId);
  
  // 3. Récupération des prix
  const symbols = useMemo(() => currentPortfolio?.assets.map(a => a.symbol) ?? [], [currentPortfolio]);
  const { prices, lastUpdated } = usePrices({ symbols, refreshInterval: 30000 });
  
  // 4. Conversion des données
  const assets = useMemo(() => convertToPortfolioAssets(currentPortfolio, prices), [currentPortfolio, prices]);
  
  // 5. Données synchronisées pour le chart
  const { todayValue, lastUpdatedLabel } = usePortfolioChartData(assets, lastUpdated);
}
```

#### Header Apple-like (components/ui/Header.tsx)
```typescript
export default function Header() {
  const isCompact = useScrollCompact(24); // Hook de scroll
  const { data: session } = useSession();
  
  // Migration automatique des transactions anonymes
  useEffect(() => {
    if (status === 'authenticated') {
      migrateTempTransactions(session.user.id);
    }
  }, [status]);
  
  return (
    <header data-compact={isCompact} className="group/header">
      {/* Navigation + boutons avec animations group-data-[compact=true]/header:* */}
    </header>
  );
}
```

#### Système de tabs Portfolio/Import
```typescript
const [portfolioTab, setPortfolioTab] = useState<"portfolio" | "import">("portfolio");

// Onglet Portfolio : PortfolioSection + PortfolioChart
// Onglet Import : FileDropzone + instructions
```

### Composants de données

#### PortfolioSection (components/PortfolioSection.tsx)
```typescript
// Hook pour les données synchronisées du chart
export function usePortfolioChartData(assets: PortfolioAsset[], lastPriceUpdate?: Date | null) {
  const todayValue = useMemo(() => {
    return assets?.reduce((acc, a) => acc + a.quantity * a.price, 0) ?? 0;
  }, [assets, lastPriceUpdate]); // Recalcule à chaque tick prix
  
  const lastUpdatedLabel = useMemo(() => {
    if (!lastPriceUpdate) return undefined;
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires"
    }).format(lastPriceUpdate);
  }, [lastPriceUpdate]);
  
  return { todayValue, lastUpdatedLabel };
}
```

#### TransactionForm (components/ui/TransactionForm.tsx)
```typescript
export default function TransactionForm({ userId, isOpen, onClose, onSuccess, defaults }: Props) {
  // Gestion des utilisateurs anonymes avec ID temporaire
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
  
  const handleSubmit = async () => {
    // Utilisation de l'ID effectif (permanent ou temporaire)
    const effectiveUserId = userId || getOrCreateTempUserId();
    
    await addTransactionMutation.mutateAsync({
      userId: effectiveUserId,
      symbol,
      quantity: parseFloat(qty),
      price: price ? parseFloat(price) : undefined,
      side,
      timestamp: new Date(transactionDate),
      note: note || undefined,
    });
    
    // Actualisation de l'UI après succès
    router.refresh();
    onSuccess?.();
  };
}
```

#### FileDropzone (components/FileDropzone.tsx)
```typescript
export default function FileDropzone({ onFileSelect }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };
  
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`group relative flex flex-col items-center justify-center
        w-full max-w-md mx-auto h-56 rounded-2xl border-2 border-dashed
        transition-all cursor-pointer
        ${isDragging ? "border-black/80 bg-gray-50" : "border-gray-300 bg-white"}`}
    >
      <Upload className="w-10 h-10 text-gray-400 group-hover:text-black transition-colors" />
      <p className="mt-3 text-sm text-gray-600">Glissez votre fichier ici</p>
      <p className="text-xs text-gray-400">ou cliquez pour parcourir</p>
      <input
        type="file"
        accept=".csv,.xlsx"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
    </div>
  );
}
```

#### PortfolioChart (components/PortfolioChart.tsx)
```typescript
interface PortfolioChartProps {
  range: ChartRange;
  userId?: string;
  todayValue?: number;        // Valeur actuelle du portfolio
  lastUpdatedLabel?: string;  // "MAJ 14:32"
}

// Fusion de l'historique avec la valeur actuelle
const portfolioData = useMemo(() => {
  let chartData = portfolioHistory.points.map(point => ({...}));
  
  // Remplacement du dernier point avec todayValue
  if (todayValue !== undefined && chartData.length > 0) {
    chartData[chartData.length - 1] = {
      ...chartData[chartData.length - 1],
      value: todayValue
    };
  }
  
  return chartData;
}, [range, portfolioHistory, todayValue]);
```

### Animations et interactions

#### Header compact (hooks/useScrollCompact.ts)
```typescript
export function useScrollCompact(threshold = 24) {
  const [isCompact, setIsCompact] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > threshold);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);
  
  return isCompact;
}
```

#### Animations Tailwind
```css
/* Boutons qui se rétrécissent en mode compact */
.h-10.group-data-[compact=true]/header:h-6
.px-4.group-data-[compact=true]/header:px-2
.text-sm.group-data-[compact=true]/header:text-[10px]
.transition-all.duration-300
```

## 🔄 Gestion d'état et cache

### Configuration centralisée (lib/cacheConfig.ts)
```typescript
export const cacheConfig = {
  staleTime: {
    prices: 30 * 1000,        // 30 secondes
    portfolio: 30 * 1000,      // 30 secondes 
    transactions: 5 * 60 * 1000, // 5 minutes
    history: 10 * 60 * 1000,   // 10 minutes
    symbols: 30 * 60 * 1000,   // 30 minutes
  },
  refetchInterval: {
    prices: 30 * 1000,         // 30 secondes
    portfolio: 60 * 1000,      // 1 minute
    realtime: 10 * 1000,       // 10 secondes (pour les prix en temps réel)
  },
  debounce: {
    search: 300,      // ms pour les recherches
    input: 500,       // ms pour les inputs généraux
  },
} as const;
```

### TanStack React Query
```typescript
// Configuration globale (components/providers/ReactQueryProvider.tsx)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### Hook usePrices avancé (hooks/usePrices.ts)
```typescript
export function usePrices({ symbols, refreshInterval, enabled }: UsePricesOptions) {
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Gestion des requêtes avec AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const fetchPrices = useCallback(async (forceRefresh = false) => {
    // Annulation des requêtes précédentes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    // ... logique de fetch avec retry et gestion d'erreurs
  }, [symbols, enabled]);
}
```

### Cache des données
- **Portfolio** : Cache 30s, invalidation après ajout de transaction
- **Prix** : Cache 30s, refresh automatique 30s
- **Historique** : Cache 10min, invalidation quotidienne
- **Symboles** : Cache 30min, invalidation manuelle

### Invalidation intelligente
```typescript
// Après ajout de transaction
queryClient.invalidateQueries({ queryKey: ['portfolio', userId] });
queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
queryClient.invalidateQueries({ queryKey: ['history', userId] });
```

## 🔧 Jobs asynchrones et post-traitement

### Job AfterTransaction (lib/jobs/afterTransaction.ts)
```typescript
export interface AfterTransactionPayload {
  userId: string;
  symbol: string;
  txDate: string | Date;
  rid?: string;
  prewarmHistory?: false | "7d" | "30d" | "1y";
}

export async function runAfterTransactionJob(payload: AfterTransactionPayload) {
  // 1. Backfill des prix historiques manquants pour le symbole
  const historicalPrices = await getHistoricalPricesForSymbols([payload.symbol]);
  
  // 2. Mise à jour du snapshot du jour (valorisation temps réel)
  const portfolio = await portfolioService.getCurrentPortfolio(payload.userId);
  await snapshotRepo.saveSnapshot({
    date: normalizeToMidnight(new Date()),
    totalValue: portfolio.totalValue,
    breakdown: portfolio.assets.reduce((acc, asset) => ({
      ...acc,
      [asset.symbol]: {
        quantity: asset.quantity,
        value: asset.value,
        price: asset.currentPrice
      }
    }), {})
  });
  
  // 3. Pré-chauffage optionnel de l'historique
  if (payload.prewarmHistory) {
    await portfolioService.getPortfolioHistory(payload.userId, payload.prewarmHistory);
  }
}
```

### Système de logging (lib/logger.ts)
```typescript
export const logger = {
  info(msg: string, fields: LogFields = {}) {
    console.log(`[INFO] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  warn(msg: string, fields: LogFields = {}) {
    console.warn(`[WARN] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  error(msg: string, fields: LogFields = {}) {
    console.error(`[ERROR] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  withRid(rid?: string) {
    return {
      info: (m: string, f: LogFields = {}) => logger.info(m, { rid, ...f }),
      warn: (m: string, f: LogFields = {}) => logger.warn(m, { rid, ...f }),
      error: (m: string, f: LogFields = {}) => logger.error(m, { rid, ...f }),
    };
  },
};
```

### Utilitaires de hash et idempotence (lib/utils/hash.ts)
```typescript
// Hash SHA-256 déterministe pour l'idempotence
export function sha256Hex(value: unknown): string {
  const s = typeof value === "string" ? value : stableStringify(value);
  return createHash("sha256").update(s).digest("hex");
}

// Construction d'un client_tx_id idempotent
export function buildClientTxId(input: {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number | null;
  side: "BUY" | "SELL" | "TRANSFER";
  timestamp: string | Date;
  note?: string | null;
}): string {
  const payload = {
    u: String(input.userId).trim(),
    s: String(input.symbol).toUpperCase().trim(),
    q: Number(input.quantity),
    p: input.price != null ? Number(input.price) : null,
    sd: input.side,
    t: new Date(input.timestamp).toISOString(),
    n: input.note ? String(input.note).trim() : "",
  };
  return sha256Hex(payload);
}
```

## 📊 Analytics et monitoring

### Vercel Analytics
```typescript
// app/layout.tsx
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### BigQuery Analytics
- **Transactions** : Toutes les transactions stockées avec métadonnées
- **Snapshots** : État quotidien du portefeuille
- **Prix** : Historique des prix pour l'analyse
- **Performance** : Métriques de performance de l'application

### Client BigQuery (lib/db/bqClient.ts)
```typescript
// Singleton pattern pour éviter les multiples instances
declare global {
  var __bq: BigQuery | undefined;
}

export default function getBigQuery(): BigQuery {
  if (global.__bq) return global.__bq;
  
  const config = getConfig(); // Récupération depuis les env vars
  global.__bq = new BigQuery({
    projectId: config.projectId,
    location: config.location,
    credentials: config.credentials,
  });
  
  return global.__bq;
}

// Support de 3 méthodes d'authentification :
// 1. GOOGLE_APPLICATION_CREDENTIALS (fichier local)
// 2. GCP_SERVICE_ACCOUNT_JSON (JSON inline)
// 3. GCP_SERVICE_ACCOUNT_BASE64 (JSON base64 pour Vercel)
```

## 🔍 Système de recherche et autocomplétion

### TokenService (lib/services/tokenService.ts)
```typescript
export class TokenService {
  // Récupération des mappings symbole → DeFiLlama ID
  async getTokenMappings(symbols: string[]): Promise<Record<string, string>>
  
  // Recherche de suggestions pour l'autocomplétion
  async getTokenSuggestions(query: string, limit: number = 10): Promise<TokenSuggestion[]>
  
  // Validation d'un symbole avec suggestions d'alternatives
  async validateSymbol(symbol: string): Promise<{ valid: boolean; suggestion?: TokenSuggestion }>
  
  // Recherche intelligente avec correspondance exacte + suggestions
  async smartSearch(query: string): Promise<{
    exactMatch?: TokenSuggestion;
    suggestions: TokenSuggestion[];
  }>
}
```

### SymbolAutocomplete (components/SymbolAutocomplete.tsx)
```typescript
export function SymbolAutocomplete({ value, onChange, onSelect, placeholder, className }: SymbolAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { suggestions, loading } = useSymbolSuggestions(value);
  
  // Gestion du clavier (flèches, entrée, échap)
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };
}
```

### Hook useSymbolSuggestions (hooks/useSymbolSuggestions.ts)
```typescript
export function useSymbolSuggestions(query: string): UseSymbolSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    // Debounce configuré via cacheConfig
    const timeoutId = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, cacheConfig.debounce.search);

    return () => clearTimeout(timeoutId);
  }, []);
}
```

### API Suggestions (app/api/symbols/suggestions/route.ts)
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  
  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, suggestions: [] });
  }

  // Utilise le service centralisé pour la recherche intelligente
  const result = await tokenService.smartSearch(query);
  
  // Combine correspondance exacte et suggestions
  const suggestions = result.exactMatch 
    ? [result.exactMatch, ...result.suggestions]
    : result.suggestions;

  return NextResponse.json({ 
    success: true,
    suggestions: suggestions.map(s => ({
      symbol: s.symbol,
      name: s.name || null,
      coingecko_id: s.defillama_id
    }))
  });
}
```

## 📋 Types et interfaces partagés

### Types globaux (lib/types.ts)
```typescript
export type Symbol = string; // always uppercase externally

export interface TokenRow {
  symbol: string; // uppercase
  defillama_id: string; // e.g. 'bitcoin' or 'ethereum'
}

export type PriceMap = Record<string, number>; // SYMBOL -> price USD

export interface Config {
  projectId: string;
  bq: {
    dataset: string;
    table: string;
    location: string;
  };
  credentials?: {
    keyFilename?: string; // path style
    keyJsonObject?: Record<string, unknown>; // inline JSON
  };
  defillamaBase: string;
}
```

## 🚀 Déploiement et configuration

### Variables d'environnement
```bash
# Base de données
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."

# Google Cloud
GOOGLE_PROJECT_ID="your-project"
GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"
BQ_KEY_JSON='{"type":"service_account",...}'

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# BigQuery
BQ_DATASET="Cryptopilot"
BQ_TABLE_TX="transactions"
BQ_USER_ID_COL="user_id"
```

### Scripts de déploiement
```json
{
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "postinstall": "prisma generate"
}
```

## 🔧 APIs et endpoints

### Authentification
- `GET/POST /api/auth/[...nextauth]` : NextAuth endpoints
- `POST /api/auth/register` : Inscription email/password

### Portfolio
- `GET /api/portfolio/current?userId=...` : Portefeuille actuel
- `GET /api/portfolio/history?userId=...&range=30d` : Historique

### Transactions
- `POST /api/transactions/add` : Ajouter une transaction
- `GET /api/transactions?userId=...` : Liste des transactions

### Prix
- `GET /api/prices?symbols=BTC,ETH` : Prix actuels
- `GET /api/symbols/suggestions?q=bit` : Suggestions de symboles

### Jobs asynchrones
- `POST /api/_jobs/after-transaction` : Post-traitement après transaction

## 🧪 Tests et développement

### Scripts de test
```bash
npm run test:portfolio  # Test du service portfolio
npm run dev            # Développement avec Turbopack
npm run build          # Build de production
```

### Structure des tests
- **Unit tests** : Services et repositories
- **Integration tests** : APIs et hooks
- **E2E tests** : Flux utilisateur complets

## 📈 Performance et optimisations

### Optimisations frontend
- **Code splitting** : Composants chargés à la demande
- **Image optimization** : Next.js Image component
- **Bundle analysis** : Analyse des bundles avec Turbopack
- **Caching** : React Query + HTTP cache headers

### Optimisations backend
- **Connection pooling** : Prisma avec pool de connexions
- **Query optimization** : Index sur les colonnes fréquemment utilisées
- **Caching** : Cache Redis pour les prix
- **Batch operations** : Opérations groupées pour BigQuery

### Monitoring
- **Vercel Analytics** : Métriques de performance
- **Error tracking** : Gestion des erreurs avec try/catch
- **Logging** : Logger centralisé avec niveaux
- **Health checks** : Endpoints de santé de l'application

## 🔒 Sécurité

### Authentification
- **JWT tokens** : Sessions sécurisées
- **CSRF protection** : NextAuth.js intégré
- **Password hashing** : bcryptjs avec salt rounds
- **OAuth security** : Google OAuth 2.0

### Données
- **Input validation** : Zod schemas
- **SQL injection** : Prisma ORM protection
- **XSS protection** : React escape automatique
- **CORS** : Configuration restrictive

### Infrastructure
- **HTTPS only** : Redirection automatique
- **Environment variables** : Secrets dans .env
- **Database security** : Connexions chiffrées
- **API rate limiting** : Protection contre les abus

## 🚀 Roadmap et évolutions

### Fonctionnalités en cours
- [ ] Import CSV/XLSX complet
- [ ] Notifications push
- [ ] Mobile app (React Native)
- [ ] API publique

### Améliorations techniques
- [ ] Tests E2E avec Playwright
- [ ] Monitoring avec Sentry
- [ ] CDN pour les assets statiques
- [ ] Microservices architecture

---

*Cette documentation est maintenue à jour avec l'évolution du projet. Pour toute question technique, consulter le code source ou contacter l'équipe de développement.*
