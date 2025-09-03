# Header CryptoPilot - Style Apple

## 📁 Fichiers créés/modifiés

### Nouveaux composants
- `components/ui/Header.tsx` - Composant principal du header
- `components/ui/MobileNav.tsx` - Navigation mobile avec panneau coulissant
- `components/ui/UserMenu.tsx` - Menu utilisateur avec avatar/login
- `hooks/useScrollCompact.ts` - Hook pour la réduction au scroll
- `lib/utils.ts` - Utilitaire pour combiner les classes Tailwind

### Fichiers de configuration
- `tailwind.config.js` - Configuration Tailwind avec support pour shadcn/ui
- `app/layout.tsx` - Intégration du header dans le layout principal

### Corrections
- `app/page.tsx` - Suppression du header dupliqué

## 🎯 Fonctionnalités implémentées

### Header Principal
- ✅ Logo "🚀 CryptoPilot" responsive
- ✅ Navigation centrée (Desktop) : Tableau de bord, Portefeuille, Transactions, Insights
- ✅ Bouton "Ajouter transaction" + Menu utilisateur à droite
- ✅ Sticky top avec glassmorphism (bg-white/70 + backdrop-blur-md)
- ✅ Réduction de hauteur au scroll (h-16 → h-12)
- ✅ Route active mise en surbrillance avec aria-current="page"

### Navigation Mobile
- ✅ Bouton hamburger sur mobile
- ✅ Panneau coulissant full-width
- ✅ Navigation + CTA + Login intégrés
- ✅ Fermeture par overlay ou bouton X

### Accessibilité & UX
- ✅ Support mode sombre
- ✅ Focus states visibles
- ✅ Respect de prefers-reduced-motion
- ✅ Navigation clavier (Tab/Shift+Tab/ESC)
- ✅ ARIA attributes (role="navigation", aria-current)

## 🚀 Usage

Le header est automatiquement inclus sur toutes les pages via `app/layout.tsx`. 

### Props du header
Aucune prop requise - configuration automatique via :
- `usePathname()` pour l'état actif
- `useScrollCompact()` pour la réduction au scroll
- Mock session pour l'état d'authentification

### Personnalisation

Pour connecter l'authentification réelle, remplacez dans `UserMenu.tsx` :
```tsx
const useMockSession = () => ({
  data: { user: { name: 'John Doe', image: null } },
  status: 'authenticated' as const,
});
```

Par votre hook d'authentification (ex: `useSession` de next-auth).

### Installation de shadcn/ui (optionnel)

Pour remplacer les placeholders par les vrais composants shadcn/ui :

```bash
npx shadcn-ui@latest add dropdown-menu avatar button sheet
```

Puis remplacez les placeholders dans les fichiers.

## 🎨 Style

- **Glassmorphism** : `bg-white/70 backdrop-blur-md`
- **Transitions** : 300ms ease-in-out
- **Hauteurs** : h-16 (normal) → h-12 (compact)
- **Z-index** : z-40 pour rester au-dessus du contenu
- **Responsive** : Navigation cachée sur mobile (< md)

## 🔧 Dépendances ajoutées

```json
{
  "clsx": "^2.x.x",
  "tailwind-merge": "^2.x.x", 
  "tailwindcss-animate": "^1.x.x"
}
```

## ✅ Tests

- **Build** : ✅ `npm run build` réussi
- **TypeScript** : ✅ Pas d'erreurs de type
- **Responsive** : ✅ Fonctionne sur mobile/desktop
- **Accessibilité** : ✅ Navigation clavier + ARIA

---

Le header est maintenant fonctionnel et respecte tous les critères demandés ! 🎉
