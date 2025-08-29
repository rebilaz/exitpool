// Script pour ajouter des prix de test dans BigQuery
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'starlit-verve-458814-u9',
  keyFilename: './starlit-verve-458814-u9-8d2afefa106b.json'
});

async function addTestPrices() {
  console.log('💰 Ajout de prix de test pour BTC et ETH...\n');

  // Prix de test pour BTC et ETH sur les 30 derniers jours
  const testPrices = [];
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // BTC: autour de 45,000-50,000 USD
    const btcPrice = 45000 + Math.random() * 5000;

    // ETH: autour de 2,500-3,000 USD
    const ethPrice = 2500 + Math.random() * 500;

    testPrices.push(
      `SELECT '${dateStr}' as date, 'BTC' as symbol, 'btc' as token_id, ${btcPrice} as price, 'test' as source, TIMESTAMP('${new Date().toISOString()}') as last_updated`,
      `SELECT '${dateStr}' as date, 'ETH' as symbol, 'eth' as token_id, ${ethPrice} as price, 'test' as source, TIMESTAMP('${new Date().toISOString()}') as last_updated`
    );
  }

  const query = `
    INSERT INTO \`starlit-verve-458814-u9.Cryptopilot.historical_prices\`
    (date, symbol, token_id, price, source, last_updated)
    ${testPrices.join(' UNION ALL ')}
  `;

  try {
    console.log('📊 Insertion des prix en cours...');
    const [job] = await bigquery.createQueryJob({ query });
    await job.getQueryResults();

    console.log('✅ SUCCÈS !');
    console.log(`📈 ${testPrices.length} prix ajoutés pour BTC et ETH`);
    console.log('🔄 Le graphique devrait maintenant afficher les valeurs !');

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

addTestPrices();
