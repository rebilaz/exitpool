// Script de test pour diagnostiquer le problème du graphique
const fetch = require('node-fetch');

async function testDebug() {
  try {
    console.log('🔍 Test de l\'endpoint de debug...\n');

    const response = await fetch('http://localhost:3005/api/debug?userId=test-user-123&range=7d');
    const data = await response.json();

    if (data.success) {
      const debug = data.debug;

      console.log('📊 RÉSULTATS DU DIAGNOSTIC:\n');

      console.log('1️⃣ TRANSACTIONS:');
      console.log(`   Nombre: ${debug.transactions.count}`);
      if (debug.transactions.sample.length > 0) {
        console.log('   Échantillon:', debug.transactions.sample);
      } else {
        console.log('   ❌ Aucune transaction trouvée!');
      }

      console.log('\n2️⃣ SNAPSHOTS (cache):');
      console.log(`   Nombre: ${debug.snapshots.count}`);
      if (debug.snapshots.sample.length > 0) {
        console.log('   Échantillon:', debug.snapshots.sample);
      } else {
        console.log('   ❌ Aucun snapshot trouvé');
      }

      console.log('\n3️⃣ PRIX HISTORIQUES:');
      console.log(`   Dates avec prix: ${debug.historicalPrices.datesCount}`);
      if (debug.historicalPrices.sample.length > 0) {
        console.log('   Échantillon:', debug.historicalPrices.sample);
      } else {
        console.log('   ❌ Aucun prix historique trouvé!');
      }

      console.log('\n4️⃣ HISTORIQUE CALCULÉ:');
      console.log(`   Points: ${debug.computedHistory.pointsCount}`);
      console.log(`   Rendement total: ${debug.computedHistory.totalReturn}`);
      if (debug.computedHistory.sample.length > 0) {
        console.log('   Échantillon:', debug.computedHistory.sample);
      } else {
        console.log('   ❌ Aucun point calculé!');
      }

      console.log('\n🔍 DIAGNOSTIC:');

      if (debug.transactions.count === 0) {
        console.log('❌ PROBLÈME: Aucune transaction pour cet utilisateur');
      } else if (debug.historicalPrices.datesCount === 0) {
        console.log('❌ PROBLÈME: Aucun prix historique disponible');
      } else if (debug.computedHistory.pointsCount === 0) {
        console.log('❌ PROBLÈME: Le calcul d\'historique échoue');
      } else {
        console.log('✅ Les données semblent correctes');
      }

    } else {
      console.log('❌ Erreur:', data.error);
    }

  } catch (error) {
    console.log('❌ Erreur de connexion:', error.message);
  }
}

testDebug();
