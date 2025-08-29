import { transactionRepo } from './lib/repos/transactionRepo.js';
import { priceRepo } from './lib/repos/priceRepo.js';
import { snapshotRepo } from './lib/repos/snapshotRepo.js';
import { portfolioService } from './lib/services/portfolioService.js';

const userId = '0181b8c0-0b0a-7000-8000-000000000000';
const range: '7d' | '30d' | '1y' = '30d';

async function debugPortfolioHistory() {
  console.log('🔍 DEBUGGING PORTFOLIO HISTORY COMPUTATION\n');

  // 1. Vérifier les transactions
  console.log('1️⃣ VÉRIFICATION DES TRANSACTIONS');
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const transactions = await transactionRepo.getTransactionsByUser(userId, undefined, endDate, 10000);
    console.log(`✅ ${transactions.length} transactions trouvées`);
    transactions.forEach(tx => {
      console.log(`   - ${tx.symbol} ${tx.side} ${tx.quantity} @ ${tx.price} (${tx.timestamp.toISOString().split('T')[0]})`);
    });
  } catch (error) {
    console.log(`❌ Erreur récupération transactions: ${(error as Error).message}`);
  }

  console.log('\n2️⃣ VÉRIFICATION DES PRIX HISTORIQUES');
  try {
    const symbols = ['ETH', 'BTC'];
    const historicalPrices = await priceRepo.getPricesForSymbols(symbols, startDate, endDate);
    console.log(`✅ ${Object.keys(historicalPrices).length} jours avec des prix`);

    // Afficher quelques exemples
    const sampleDates = Object.keys(historicalPrices).slice(0, 5);
    sampleDates.forEach(date => {
      console.log(`   ${date}: ${JSON.stringify(historicalPrices[date])}`);
    });
  } catch (error) {
    console.log(`❌ Erreur récupération prix: ${(error as Error).message}`);
  }

  console.log('\n3️⃣ VÉRIFICATION DES SNAPSHOTS EXISTANTS');
  try {
    const snapshots = await snapshotRepo.getSnapshotsInRange(userId, startDate, endDate);
    console.log(`✅ ${snapshots.length} snapshots trouvés`);
    snapshots.forEach(snapshot => {
      console.log(`   - ${snapshot.date.toISOString().split('T')[0]}: ${snapshot.total_value} USD`);
    });
  } catch (error) {
    console.log(`❌ Erreur récupération snapshots: ${(error as Error).message}`);
  }

  console.log('\n4️⃣ TEST CALCUL COMPLET DU PORTFOLIO');
  try {
    const history = await portfolioService.computePortfolioHistory(userId, range);
    console.log(`✅ Historique calculé: ${history.points.length} points`);
    console.log(`   - Valeur totale: ${history.totalReturn} USD (${history.totalReturnPercent.toFixed(2)}%)`);

    // Afficher les 5 premiers et derniers points
    const firstPoints = history.points.slice(0, 3);
    const lastPoints = history.points.slice(-3);

    console.log('   Premiers points:');
    firstPoints.forEach(point => {
      console.log(`     ${point.date.toISOString().split('T')[0]}: ${point.totalValue.toFixed(2)} USD`);
    });

    console.log('   Derniers points:');
    lastPoints.forEach(point => {
      console.log(`     ${point.date.toISOString().split('T')[0]}: ${point.totalValue.toFixed(2)} USD`);
    });
  } catch (error) {
    console.log(`❌ Erreur calcul portfolio: ${(error as Error).message}`);
    console.error(error);
  }

  console.log('\n5️⃣ VÉRIFICATION FUSEAU HORAIRE');
  const now = new Date();
  console.log(`   Date actuelle: ${now.toISOString()}`);
  console.log(`   Date local: ${now.toLocaleString()}`);
  console.log(`   Offset timezone: ${now.getTimezoneOffset()} minutes`);

  // Test de normalisation
  const normalized = new Date(now);
  normalized.setHours(0, 0, 0, 0);
  console.log(`   Date normalisée: ${normalized.toISOString()}`);
}

debugPortfolioHistory().catch(console.error);
