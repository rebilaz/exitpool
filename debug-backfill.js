import { portfolioService } from './lib/services/portfolioService.js';
import { priceRepo } from './lib/repos/priceRepo.js';
import { getBigQuery } from './lib/db/bqClient.js';
import config from './lib/config.js';

const userId = '0181b8c0-0b0a-7000-8000-000000000000';

async function debugBackfillIssue() {
  console.log('🔍 DIAGNOSTIC BACKFILL - POURQUOI PAS DE PRIX ?\n');

  // 1. Vérifier les transactions existantes
  console.log('1️⃣ TRANSACTIONS EXISTANTES:');
  const bq = getBigQuery();
  try {
    const txQuery = `
      SELECT symbol, quantity, side, price, timestamp, DATE(timestamp) as date
      FROM \`${config.projectId}.Cryptopilot.transactions\`
      WHERE user_id = '${userId}'
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    const [txResult] = await bq.query({ query: txQuery });
    console.log(`   ${txResult.length} transactions trouvées:`);
    txResult.forEach(tx => {
      const txDate = new Date(tx.timestamp.value);
      const today = new Date();
      const isPast = txDate < today;
      console.log(`   - ${tx.symbol} ${tx.side} ${tx.quantity} @ ${tx.price} (${tx.date.value}) ${isPast ? 'PASSÉE' : 'AUJOURD\'HUI'}`);
    });
  } catch (error) {
    console.log(`❌ Erreur récupération transactions: ${error.message}`);
  }

  // 2. Tester manuellement le backfill
  console.log('\n2️⃣ TEST BACKFILL MANUEL:');
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5); // 5 jours dans le passé
  const today = new Date();

  console.log(`   Tentative de backfill pour ETH du ${pastDate.toISOString().split('T')[0]} au ${today.toISOString().split('T')[0]}`);

  try {
    // Appeler directement la méthode backfillHistoricalPrices
    await portfolioService.backfillHistoricalPrices('ETH', pastDate, today, userId);
    console.log('✅ Backfill manuel terminé');
  } catch (error) {
    console.log(`❌ Erreur backfill manuel: ${error.message}`);
    console.error(error);
  }

  // 3. Vérifier si des prix ont été ajoutés
  console.log('\n3️⃣ VÉRIFICATION APRÈS BACKFILL:');
  try {
    const pricesQuery = `
      SELECT COUNT(*) as count, COUNT(DISTINCT symbol) as symbols
      FROM \`${config.projectId}.Cryptopilot.historical_prices\`
      WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    `;
    const [pricesResult] = await bq.query({ query: pricesQuery });
    console.log(`   Prix après backfill: ${pricesResult[0].count} (${pricesResult[0].symbols} symboles)`);

    if (pricesResult[0].count > 0) {
      const sampleQuery = `
        SELECT symbol, date, price, source
        FROM \`${config.projectId}.Cryptopilot.historical_prices\`
        WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        ORDER BY date DESC
        LIMIT 5
      `;
      const [sampleResult] = await bq.query({ query: sampleQuery });
      console.log('   Échantillon des prix ajoutés:');
      sampleResult.forEach(price => {
        console.log(`     - ${price.symbol} ${price.date.value}: ${price.price} (${price.source})`);
      });
    }
  } catch (error) {
    console.log(`❌ Erreur vérification prix: ${error.message}`);
  }

  // 4. Tester directement pricingService
  console.log('\n4️⃣ TEST PRICING SERVICE DIRECT:');
  try {
    const { getHistoricalPricesForSymbols } = await import('./lib/services/pricingService.js');
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 1); // Hier

    console.log(`   Test récupération prix ETH pour ${testDate.toISOString().split('T')[0]}`);
    const prices = await getHistoricalPricesForSymbols(['ETH'], testDate, 'test-rid');

    console.log(`   Prix récupérés: ${Object.keys(prices).length}`);
    Object.entries(prices).forEach(([symbol, price]) => {
      console.log(`     - ${symbol}: ${price}`);
    });
  } catch (error) {
    console.log(`❌ Erreur pricing service: ${error.message}`);
    console.error(error);
  }
}

debugBackfillIssue().catch(console.error);
