# NextAuth + Google OAuth + Prisma Integration

## 🎯 Configuration réalisée

### 📁 Fichiers créés/modifiés

#### Routes NextAuth
- `app/api/auth/[...nextauth]/route.ts` - Configuration NextAuth avec Google OAuth
- `app/api/me/route.ts` - API de test pour vérifier la session

#### Helpers & Types
- `lib/auth.ts` - Helper `getSession()` pour le serveur
- `types/next-auth.d.ts` - Augmentation TypeScript pour inclure `user.id`

#### Providers
- `components/providers/SessionProvider.tsx` - Wrapper client pour NextAuth

#### Mise à jour des composants existants
- `app/layout.tsx` - Intégration du SessionProvider
- `components/ui/Header.tsx` - Utilisation de `useSession()` au lieu du mock
- `components/ui/UserMenu.tsx` - Vraie authentification + bouton logout
- `components/ui/MobileNav.tsx` - Session dans le menu mobile

#### Configuration
- `package.json` - Ajout du script `postinstall: "prisma generate"`

## 🔑 Fonctionnalités

### ✅ Authentification Google
- **User.id = Google sub** (pas d'auto-génération)
- **Session strategy: JWT** pour la performance
- **PrismaAdapter** pour la persistance en base
- **session.user.id exposé** côté client et serveur

### ✅ API Routes
- `/api/auth/signin` - Page de connexion NextAuth
- `/api/auth/signout` - Déconnexion
- `/api/auth/callback/google` - Callback Google OAuth
- `/api/me` - Test de session (retourne user.id)

### ✅ Types TypeScript
```typescript
// Session étendue avec user.id
interface Session {
  user: {
    id: string        // Google sub
    name?: string | null
    email?: string | null  
    image?: string | null
  }
}
```

## 🚀 Utilisation

### Côté client (hooks)
```tsx
import { useSession, signIn, signOut } from 'next-auth/react'

function MyComponent() {
  const { data: session, status } = useSession()
  
  if (status === 'loading') return <p>Chargement...</p>
  if (status === 'unauthenticated') return <button onClick={() => signIn('google')}>Se connecter</button>
  
  return (
    <div>
      <p>Connecté en tant que {session.user.name}</p>
      <p>User ID: {session.user.id}</p> {/* Google sub */}
      <button onClick={() => signOut()}>Se déconnecter</button>
    </div>
  )
}
```

### Côté serveur (RSC, API routes)
```tsx
import { getSession } from '@/lib/auth'

// Dans un Server Component
export default async function MyPage() {
  const session = await getSession()
  
  if (!session) {
    return <div>Non connecté</div>
  }
  
  return <div>User ID: {session.user.id}</div> // Google sub
}

// Dans une API route
export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  
  // Utiliser session.user.id (Google sub) pour les requêtes DB
  const userTransactions = await prisma.transaction.findMany({
    where: { userId: session.user.id }
  })
  
  return NextResponse.json({ transactions: userTransactions })
}
```

## 🔐 Variables d'environnement requises

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=your-postgres-url
DIRECT_DATABASE_URL=your-direct-postgres-url
```

## 🗄️ Schema Prisma

Le schéma utilise `User.id` comme `String @id` sans `@default` :

```prisma
model User {
  id            String    @id          // Google sub (pas d'auto-génération)
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  accounts      Account[]
  sessions      Session[]
  transactions  Transaction[]         // Vos tables métier
}
```

## ✅ Tests de validation

### 1. Test d'authentification
1. Aller sur `/api/auth/signin`
2. Se connecter avec Google
3. Vérifier la redirection vers la page d'accueil

### 2. Test de session
1. Une fois connecté, aller sur `/api/me`
2. Vérifier que `session.user.id` = Google sub
3. Format attendu : `{"session":{"user":{"id":"1234567890","name":"John Doe","email":"john@example.com","image":"..."}}, ...}`

### 3. Test de déconnexion
1. Cliquer sur "Logout" dans le header/menu mobile
2. Vérifier la redirection et la perte de session

## 🐛 Dépannage

### Erreur "React Context is unavailable"
- ✅ **Résolu** : `SessionProvider` est maintenant un composant client

### TypeScript : Property 'id' does not exist
- ✅ **Résolu** : Types augmentés dans `types/next-auth.d.ts`

### PrismaClient instanciation multiple
- ✅ **Résolu** : Singleton pattern dans la route NextAuth

### Build fails avec "Cannot find module"
- Vérifier que `@next-auth/prisma-adapter` est installé
- Exécuter `npm run postinstall` pour générer le client Prisma

---

🎉 **NextAuth est maintenant opérationnel avec Google OAuth et Prisma !**

La session contient `user.id = Google sub` et est disponible partout dans l'application.
