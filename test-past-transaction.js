import { portfolioService } from './lib/services/portfolioService.js';
import { getBigQuery } from './lib/db/bqClient.js';
import config from './lib/config.js';

const userId = '0181b8c0-0b0a-7000-8000-000000000000';

async function testPastTransactionBackfill() {
  console.log('🧪 TEST BACKFILL AVEC TRANSACTION PASSÉE\n');

  // Créer une transaction 5 jours dans le passé
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);

  console.log(`1️⃣ AJOUT TRANSACTION PASSÉE (${pastDate.toISOString().split('T')[0]}):`);
  try {
    const transactionId = await portfolioService.addTransaction(userId, {
      symbol: 'ETH',
      quantity: 1.0,
      side: 'BUY',
      price: 3000, // Prix manuel
      timestamp: pastDate
    });

    console.log(`✅ Transaction ajoutée: ${transactionId}`);
    console.log(`   - ETH BUY 1.0 @ $3000`);
    console.log(`   - Date: ${pastDate.toISOString().split('T')[0]} (PASSÉE)`);

  } catch (error) {
    console.log(`❌ Erreur ajout transaction: ${error.message}`);
    return;
  }

  // Attendre que le backfill se termine
  console.log('\n2️⃣ ATTENTE BACKFILL (5 secondes)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Vérifier les prix ajoutés
  console.log('\n3️⃣ VÉRIFICATION PRIX AJOUTÉS:');
  const bq = getBigQuery();
  try {
    const pricesQuery = `
      SELECT COUNT(*) as count, COUNT(DISTINCT symbol) as symbols
      FROM \`${config.projectId}.Cryptopilot.historical_prices\`
      WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    `;
    const [pricesResult] = await bq.query({ query: pricesQuery });
    console.log(`   Prix dans historical_prices: ${pricesResult[0].count} (${pricesResult[0].symbols} symboles)`);

    if (pricesResult[0].count > 0) {
      const sampleQuery = `
        SELECT symbol, date, price, source, last_updated
        FROM \`${config.projectId}.Cryptopilot.historical_prices\`
        WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        ORDER BY date DESC
        LIMIT 10
      `;
      const [sampleResult] = await bq.query({ query: sampleQuery });
      console.log('   Échantillon des prix:');
      sampleResult.forEach(price => {
        console.log(`     - ${price.symbol} ${price.date.value}: $${price.price} (${price.source})`);
      });
    }

  } catch (error) {
    console.log(`❌ Erreur vérification prix: ${error.message}`);
  }

  // Tester computePortfolioHistory
  console.log('\n4️⃣ TEST COMPUTE PORTFOLIO HISTORY:');
  try {
    const history = await portfolioService.computePortfolioHistory(userId, '7d');
    console.log(`✅ Historique calculé: ${history.points.length} points`);

    const nonZeroPoints = history.points.filter(p => p.totalValue > 0);
    console.log(`   Points avec valeur > 0: ${nonZeroPoints.length}/${history.points.length}`);

    if (nonZeroPoints.length > 0) {
      console.log('   🎉 SUCCÈS: Le backfill fonctionne !');
      console.log(`   Valeur totale: $${history.totalReturn.toFixed(2)} (${history.totalReturnPercent.toFixed(2)}%)`);

      // Afficher les derniers points
      const lastPoints = history.points.slice(-3);
      console.log('   Derniers points:');
      lastPoints.forEach(point => {
        console.log(`     ${point.date.toISOString().split('T')[0]}: $${point.totalValue.toFixed(2)}`);
      });
    } else {
      console.log('   ❌ ÉCHEC: Toutes les valeurs sont à 0');
    }

  } catch (error) {
    console.log(`❌ Erreur calcul historique: ${error.message}`);
  }
}

testPastTransactionBackfill().catch(console.error);
