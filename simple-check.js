// Script simple pour vérifier les données BigQuery sans imports complexes
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

// Configuration BigQuery
const bigquery = new BigQuery({
  projectId: 'starlit-verve-458814-u9',
  keyFilename: path.join(__dirname, 'starlit-verve-458814-u9-8d2afefa106b.json')
});

async function checkData() {
  try {
    console.log('🔍 VÉRIFICATION DES DONNÉES BIGQUERY\n');

    // 1. Vérifier TOUTES les transactions
    console.log('1️⃣ Vérification de TOUTES les transactions...');
    const allTransactionsQuery = `
      SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as users_count
      FROM \`starlit-verve-458814-u9.Cryptopilot.transactions\`
    `;

    const [allTransactionsJob] = await bigquery.createQueryJob({ query: allTransactionsQuery });
    const [allTransactionsRows] = await allTransactionsJob.getQueryResults();
    const allTransactionCount = allTransactionsRows[0].count;
    const usersCount = allTransactionsRows[0].users_count;
    console.log(`   Total transactions: ${allTransactionCount}`);
    console.log(`   Utilisateurs différents: ${usersCount}`);

    if (allTransactionCount > 0) {
      // Lister tous les user_id
      const usersQuery = `
        SELECT user_id, COUNT(*) as transaction_count
        FROM \`starlit-verve-458814-u9.Cryptopilot.transactions\`
        GROUP BY user_id
        ORDER BY transaction_count DESC
      `;
      const [usersJob] = await bigquery.createQueryJob({ query: usersQuery });
      const [usersRows] = await usersJob.getQueryResults();
      console.log('   Utilisateurs avec transactions:');
      usersRows.forEach(row => {
        console.log(`     - ${row.user_id}: ${row.transaction_count} transactions`);
      });

      // Récupérer un échantillon de transactions récentes
      const sampleQuery = `
        SELECT user_id, symbol, quantity, side, price, timestamp
        FROM \`starlit-verve-458814-u9.Cryptopilot.transactions\`
        ORDER BY timestamp DESC
        LIMIT 5
      `;
      const [sampleJob] = await bigquery.createQueryJob({ query: sampleQuery });
      const [sampleRows] = await sampleJob.getQueryResults();
      console.log('   Dernières transactions:');
      sampleRows.forEach(row => {
        console.log(`     - ${row.user_id}: ${row.side} ${row.quantity} ${row.symbol} à ${row.price} (${row.timestamp.value})`);
      });
    }

    // 2. Vérifier les prix historiques pour BTC et ETH
    console.log('\n2️⃣ Vérification des prix historiques pour BTC/ETH...');
    const symbolsPricesQuery = `
      SELECT 
        symbol,
        COUNT(*) as count,
        MIN(date) as min_date,
        MAX(date) as max_date,
        AVG(price) as avg_price
      FROM \`starlit-verve-458814-u9.Cryptopilot.historical_prices\`
      WHERE symbol IN ('BTC', 'ETH')
      GROUP BY symbol
    `;

    const [symbolsPricesJob] = await bigquery.createQueryJob({ query: symbolsPricesQuery });
    const [symbolsPricesRows] = await symbolsPricesJob.getQueryResults();
    
    if (symbolsPricesRows.length > 0) {
      console.log('   Prix trouvés:');
      symbolsPricesRows.forEach(row => {
        console.log(`     - ${row.symbol}: ${row.count} prix (${row.min_date.value} → ${row.max_date.value}), moyenne: ${row.avg_price}`);
      });
    } else {
      console.log('   ❌ Aucun prix historique pour BTC/ETH');
    }

    // Vérifier tous les prix historiques disponibles
    const allPricesQuery = `
      SELECT 
        symbol,
        COUNT(*) as count
      FROM \`starlit-verve-458814-u9.Cryptopilot.historical_prices\`
      GROUP BY symbol
      ORDER BY count DESC
      LIMIT 10
    `;

    const [allPricesJob] = await bigquery.createQueryJob({ query: allPricesQuery });
    const [allPricesRows] = await allPricesJob.getQueryResults();
    
    console.log('\n   Tous les symboles avec prix historiques:');
    if (allPricesRows.length > 0) {
      allPricesRows.forEach(row => {
        console.log(`     - ${row.symbol}: ${row.count} prix`);
      });
    } else {
      console.log('     ❌ Aucun prix historique du tout');
    }

    // 3. Vérifier les snapshots
    console.log('\n3️⃣ Vérification des snapshots...');
    const snapshotsQuery = `
      SELECT COUNT(*) as count
      FROM \`starlit-verve-458814-u9.Cryptopilot.portfolio_snapshots\`
      WHERE user_id = 'test-user-123'
    `;

    const [snapshotsJob] = await bigquery.createQueryJob({ query: snapshotsQuery });
    const [snapshotsRows] = await snapshotsJob.getQueryResults();
    const snapshotsCount = snapshotsRows[0].count;
    console.log(`   Snapshots pour test-user-123: ${snapshotsCount}`);

    // Diagnostic
    console.log('\n🔍 DIAGNOSTIC:');
    if (transactionCount === 0) {
      console.log('❌ PROBLÈME: Aucune transaction trouvée');
      console.log('💡 SOLUTION: Ajouter des transactions via l\'interface');
    } else if (pricesCount === 0) {
      console.log('❌ PROBLÈME: Aucun prix historique trouvé');
      console.log('💡 SOLUTION: Remplir la table historical_prices');
    } else if (snapshotsCount === 0) {
      console.log('⚠️  INFO: Aucun snapshot (cache) trouvé - calcul à partir des transactions');
    } else {
      console.log('✅ Données présentes - le problème est ailleurs');
    }

  } catch (error) {
    console.log('❌ Erreur:', error.message);
    console.log('💡 Vérifiez que les tables existent et que les credentials sont corrects');
  }
}

checkData();
