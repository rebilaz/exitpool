# 🔧 Guide de Debug WalletConnect - Actions à faire

## 🚀 Étape 1: Lancement avec debug activé

```bash
# Lance ton serveur de dev
npm run dev

# Puis ouvre http://localhost:3000 dans ton navigateur
```

## 🛠️ Étape 2: Outils de debug dans la console

1. **Ouvre les DevTools** (F12)
2. **Va dans l'onglet Console**
3. **Copie-colle ce code** pour activer les outils de debug :

```javascript
// === OUTILS DEBUG WALLETCONNECT ===
window.debugWC = {
  hardReset: () => {
    console.log('🧹 Purging WalletConnect localStorage...');
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@2') || key.startsWith('@walletconnect'))) {
        toDelete.push(key);
      }
    }
    console.log('📝 Found keys:', toDelete);
    toDelete.forEach(k => localStorage.removeItem(k));
    console.log('✅ Purged', toDelete.length, 'WC keys');
    location.reload(); // Recharge la page
  },
  
  listStorage: () => {
    const wcKeys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@2') || key.startsWith('@walletconnect'))) {
        try { wcKeys[key] = JSON.parse(localStorage.getItem(key)); } 
        catch { wcKeys[key] = localStorage.getItem(key); }
      }
    }
    console.table(wcKeys);
    return wcKeys;
  }
};
console.log('🛠️ Debug tools ready! Use debugWC.hardReset() or debugWC.listStorage()');
```

## 🔍 Étape 3: Diagnostic pas-à-pas

### Si tu vois l'erreur "No matching key"

1. **Dans la console, tape :**
```javascript
debugWC.listStorage()
```
   - Si tu vois des entrées `wc@2:*`, c'est le problème !

2. **Purge le localStorage :**
```javascript
debugWC.hardReset()
```
   - Cela va recharger la page automatiquement

3. **Réessaie la connexion WalletConnect**

### Si ça persiste, vérifie la config

1. **Ton PROJECT_ID :**
```javascript
console.log('Project ID:', process.env.NEXT_PUBLIC_WC_PROJECT_ID);
```

2. **Vérifie sur Reown Dashboard :**
   - Va sur https://cloud.reown.com/app/c70c10a4ac0e8a49fdda51d4c142b60f
   - Onglet "Settings" → "Domains"
   - Assure-toi que `http://localhost:3000` est dans la liste

3. **Test de connectivité WebSocket :**
```javascript
const ws = new WebSocket('wss://relay.walletconnect.com');
ws.onopen = () => console.log('✅ WS OK');
ws.onerror = (e) => console.log('❌ WS failed:', e);
```

## 📊 Étape 4: Logs détaillés à surveiller

Quand tu testes la connexion, tu vas maintenant voir dans la console :

```
🔍 getWCProvider called, existing: false, initLock: false
🆕 Creating new WalletConnect provider...
🔑 ProjectId: c70c10a4...
⚙️ WC init options: {chains: [2741], optionalChains: [11124], ...}
✅ WalletConnect provider initialized
🔗 ensureWCConnected called
🔍 Checking existing accounts...
👥 Current accounts: []
🚀 No accounts found, calling enable()...
✅ Accounts after enable: ["0x..."]
📞 [LoginModal] Starting WalletConnect login...
👥 [LoginModal] Got accounts: 1
⛓️ [LoginModal] Chain ID: 2741
🎫 [LoginModal] Got nonce for signing
✍️ [LoginModal] Requesting signature...
✅ [LoginModal] Signature received
🔐 [LoginModal] NextAuth result: success
```

## ⚠️ Si tu vois encore des erreurs

**Copie-colle TOUS les logs de la console** et envoie-les moi avec :
1. Le message d'erreur exact
2. Les logs du terminal `npm run dev`
3. Capture d'écran de la page Reown Dashboard "Domains"

## 🎯 Actions immédiates à faire MAINTENANT

1. ✅ Lance `npm run dev`
2. ✅ Ouvre localhost:3000
3. ✅ Ouvre la console (F12)
4. ✅ Copie-colle le code debugWC ci-dessus
5. ✅ Si tu as déjà eu l'erreur, tape `debugWC.hardReset()`
6. ✅ Réessaie une connexion WalletConnect
7. ✅ Note tous les logs et erreurs

**Le bouton "Reset WalletConnect (dev)" dans ton LoginModal fait maintenant la même chose que `debugWC.hardReset()` !**
