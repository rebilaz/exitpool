// Script simple pour vérifier les données BigQuery
import { getBigQuery } from './lib/db/bqClient.js';
import config from './lib/config.js';

const REAL_USER_ID = '0181b8c0-0b0a-7000-8000-000000000000';

async function checkData() {
  try {
    console.log('🔍 VÉRIFICATION DES DONNÉES BIGQUERY\n');

    const bq = getBigQuery();

    // 1. Vérifier les transactions avec le BON user ID
    console.log('1️⃣ Vérification des transactions...');
    const transactionsQuery = `
      SELECT COUNT(*) as count
      FROM \`${config.projectId}.Cryptopilot.transactions\`
      WHERE user_id = '${REAL_USER_ID}'
    `;

    const [transactionsResult] = await bq.query({ query: transactionsQuery });
    const transactionCount = transactionsResult[0].count;
    console.log(`   Transactions pour ${REAL_USER_ID}: ${transactionCount}`);

    if (transactionCount > 0) {
      // Récupérer un échantillon
      const sampleQuery = `
        SELECT symbol, quantity, side, price, timestamp
        FROM \`${config.projectId}.Cryptopilot.transactions\`
        WHERE user_id = '${REAL_USER_ID}'
        ORDER BY timestamp DESC
        LIMIT 5
      `;
      const [sampleResult] = await bq.query({ query: sampleQuery });
      console.log('   Échantillon des transactions:');
      sampleResult.forEach(tx => {
        console.log(`     - ${tx.symbol} ${tx.side} ${tx.quantity} @ ${tx.price} (${tx.timestamp.value})`);
      });
    }

    // 2. Vérifier les prix historiques pour ETH et BTC
    console.log('\n2️⃣ Vérification des prix historiques (ETH/BTC)...');
    const pricesQuery = `
      SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT symbol) as symbols_count,
        COUNT(CASE WHEN symbol = 'ETH' THEN 1 END) as eth_count,
        COUNT(CASE WHEN symbol = 'BTC' THEN 1 END) as btc_count
      FROM \`${config.projectId}.Cryptopilot.historical_prices\`
      WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND symbol IN ('ETH', 'BTC')
    `;

    const [pricesResult] = await bq.query({ query: pricesQuery });
    const pricesCount = pricesResult[0].total_count;
    const symbolsCount = pricesResult[0].symbols_count;
    const ethCount = pricesResult[0].eth_count;
    const btcCount = pricesResult[0].btc_count;

    console.log(`   Prix historiques (30 derniers jours): ${pricesCount}`);
    console.log(`   ETH: ${ethCount} prix, BTC: ${btcCount} prix`);

    if (pricesCount > 0) {
      // Récupérer un échantillon pour ETH et BTC
      const samplePricesQuery = `
        SELECT symbol, date, price
        FROM \`${config.projectId}.Cryptopilot.historical_prices\`
        WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          AND symbol IN ('ETH', 'BTC')
        ORDER BY date DESC, symbol
        LIMIT 10
      `;
      const [samplePricesResult] = await bq.query({ query: samplePricesQuery });
      console.log('   Échantillon des prix:');
      samplePricesResult.forEach(price => {
        console.log(`     - ${price.symbol} ${price.date.value}: ${price.price}`);
      });
    }

    // 3. Vérifier les snapshots avec le BON user ID
    console.log('\n3️⃣ Vérification des snapshots...');
    const snapshotsQuery = `
      SELECT COUNT(*) as count
      FROM \`${config.projectId}.Cryptopilot.portfolio_snapshots\`
      WHERE user_id = '${REAL_USER_ID}'
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;

    const [snapshotsResult] = await bq.query({ query: snapshotsQuery });
    const snapshotsCount = snapshotsResult[0].count;
    console.log(`   Snapshots pour ${REAL_USER_ID} (30 jours): ${snapshotsCount}`);

    if (snapshotsCount > 0) {
      const sampleSnapshotsQuery = `
        SELECT date, total_value, breakdown
        FROM \`${config.projectId}.Cryptopilot.portfolio_snapshots\`
        WHERE user_id = '${REAL_USER_ID}'
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        ORDER BY date DESC
        LIMIT 3
      `;
      const [sampleSnapshotsResult] = await bq.query({ query: sampleSnapshotsQuery });
      console.log('   Échantillon des snapshots:');
      sampleSnapshotsResult.forEach(snapshot => {
        console.log(`     - ${snapshot.date.value}: ${snapshot.total_value} USD`);
      });
    }

    // Diagnostic détaillé
    console.log('\n🔍 DIAGNOSTIC DÉTAILLÉ:');

    if (transactionCount === 0) {
      console.log('❌ PROBLÈME 1: Aucune transaction trouvée pour le user ID réel');
      console.log('💡 SOLUTION: Vérifier que les transactions utilisent le bon user_id');
    } else {
      console.log('✅ PROBLÈME 1 RÉSOLU: Transactions présentes');
    }

    if (ethCount === 0 && btcCount === 0) {
      console.log('❌ PROBLÈME 2: Aucun prix historique pour ETH/BTC');
      console.log('💡 SOLUTION: Remplir la table historical_prices avec des prix pour ETH et BTC');
    } else {
      console.log('✅ PROBLÈME 2 RÉSOLU: Prix historiques présents');
      console.log(`   → ETH: ${ethCount} prix, BTC: ${btcCount} prix`);
    }

    if (snapshotsCount === 0) {
      console.log('⚠️  INFO: Aucun snapshot (cache) trouvé');
      console.log('💡 INFO: Le calcul se fera depuis les transactions + prix historiques');
    } else {
      console.log('✅ INFO: Snapshots présents (calcul accéléré)');
    }

    // Test de calcul de portfolio
    console.log('\n4️⃣ TEST DE CALCUL DE PORTFOLIO:');
    if (transactionCount > 0 && (ethCount > 0 || btcCount > 0)) {
      console.log('✅ Conditions réunies pour le calcul de portfolio');
      console.log('💡 Le problème pourrait être dans:');
      console.log('   - computeDailyPortfolioValues (calcul des valeurs)');
      console.log('   - Problème de fuseau horaire dans les dates');
      console.log('   - Erreur dans la logique de calcul');
    } else {
      console.log('❌ Conditions NON réunies pour le calcul');
    }

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

checkData();
