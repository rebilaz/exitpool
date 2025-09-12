// Script de debug WalletConnect pour la console navigateur
// Usage: coller ce code dans la console, puis utiliser les fonctions debug

console.log('🛠️ WalletConnect Debug Tools loaded');

// Purger tout le localStorage WalletConnect
window.debugWC = {
  // Purge complète
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
    return toDelete;
  },

  // Lister les clés WalletConnect
  listStorage: () => {
    const wcKeys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@2') || key.startsWith('@walletconnect'))) {
        try {
          wcKeys[key] = JSON.parse(localStorage.getItem(key));
        } catch {
          wcKeys[key] = localStorage.getItem(key);
        }
      }
    }
    console.table(wcKeys);
    return wcKeys;
  },

  // Test connectivité WebSocket
  testWebSocket: () => {
    console.log('🔌 Testing WebSocket connection to WalletConnect relay...');
    const ws = new WebSocket('wss://relay.walletconnect.com');
    ws.onopen = () => {
      console.log('✅ WebSocket relay connection OK');
      ws.close();
    };
    ws.onerror = (e) => {
      console.error('❌ WebSocket relay connection failed:', e);
    };
    ws.onclose = () => {
      console.log('🔌 WebSocket closed');
    };
  },

  // Vérifier les instances provider en mémoire
  checkProvider: () => {
    const g = globalThis;
    console.log('🔍 Global WC provider state:');
    console.log('- __wcProvider exists:', !!g.__wcProvider);
    console.log('- window.ethereum exists:', !!window.ethereum);
    console.log('- Current origin:', window.location.origin);
    return {
      hasProvider: !!g.__wcProvider,
      hasEthereum: !!window.ethereum,
      origin: window.location.origin
    };
  },

  // Compter les instances multiples (pour détecter les fuites mémoire)
  trackInstances: () => {
    window.wcInstances = (window.wcInstances || 0) + 1;
    console.log('📊 WC instances count:', window.wcInstances);
    return window.wcInstances;
  }
};

console.log(`
🛠️ Debug commands disponibles:
- debugWC.hardReset()      // Purge localStorage WC
- debugWC.listStorage()    // Affiche les clés WC
- debugWC.testWebSocket()  // Test connectivité relay
- debugWC.checkProvider()  // État du provider
- debugWC.trackInstances() // Compter les instances

💡 En cas d'erreur "No matching key":
1. debugWC.hardReset()
2. Recharger la page
3. Réessayer la connexion
`);
