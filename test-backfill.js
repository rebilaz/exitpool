import { portfolioService } from './lib/services/portfolioService.js';

const userId = '0181b8c0-0b0a-7000-8000-000000000000';

async function testBackfillIntegration() {
  console.log('🧪 TEST DE L\'INTÉGRATION BACKFILL\n');

  // Créer une transaction passée pour déclencher le backfill
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10); // 10 jours dans le passé

  console.log('1️⃣ AJOUT D\'UNE TRANSACTION PASSÉE...');
  try {
    const transactionId = await portfolioService.addTransaction(userId, {
      symbol: 'ETH',
      quantity: 1.5,
      side: 'BUY',
      price: 2500, // Prix manuel pour la transaction
      timestamp: pastDate
    });

    console.log(`✅ Transaction ajoutée: ${transactionId}`);
    console.log(`   - Date: ${pastDate.toISOString().split('T')[0]}`);
    console.log(`   - Prix manuel: $2500 (sera utilisé pour le coût d'acquisition)`);

  } catch (error) {
    console.log(`❌ Erreur ajout transaction: ${error.message || error}`);
    return;
  }

  // Attendre un peu pour que le backfill se termine
  console.log('\n2️⃣ ATTENTE DU BACKFILL...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n3️⃣ VÉRIFICATION DE L\'HISTORIQUE DU PORTFOLIO...');
  try {
    const history = await portfolioService.computePortfolioHistory(userId, '30d');

    console.log(`✅ Historique calculé: ${history.points.length} points`);
    console.log(`   - Valeur totale: ${history.totalReturn} USD`);
    console.log(`   - Performance: ${history.totalReturnPercent.toFixed(2)}%`);

    // Afficher quelques points pour vérifier que les valeurs ne sont plus à 0
    const recentPoints = history.points.slice(-5);
    console.log('\n   Derniers points de l\'historique:');
    recentPoints.forEach(point => {
      console.log(`     ${point.date.toISOString().split('T')[0]}: ${point.totalValue.toFixed(2)} USD`);
    });

    // Vérifier que les valeurs ne sont pas toutes à 0
    const nonZeroPoints = history.points.filter(p => p.totalValue > 0);
    if (nonZeroPoints.length > 0) {
      console.log(`\n🎉 SUCCÈS: ${nonZeroPoints.length} points ont des valeurs > 0`);
      console.log('💡 Le backfill automatique fonctionne !');
    } else {
      console.log('\n❌ PROBLÈME: Toutes les valeurs sont encore à 0');
      console.log('🔍 Vérifiez les logs pour les erreurs de backfill');
    }

  } catch (error) {
    console.log(`❌ Erreur calcul historique: ${error.message || error}`);
  }
}

testBackfillIntegration().catch(console.error);
