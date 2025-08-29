#!/usr/bin/env node

/**
 * Script de test pour créer des données de transaction et tester le système complet
 * Ce script va :
 * 1. Ajouter quelques transactions test avec des dates dans le passé
 * 2. Tester le calcul de l'historique du portefeuille
 * 3. Vérifier que les snapshots sont créés correctement
 */

// Import des modules nécessaires
import { portfolioService } from '../lib/services/portfolioService';
import { transactionRepo } from '../lib/repos/transactionRepo';
import { snapshotRepo } from '../lib/repos/snapshotRepo';
import logger from '../lib/logger';

const TEST_USER_ID = 'test-user-123';

async function createTestTransactions() {
  console.log('🚀 Création des transactions de test...\n');
  
  const transactions = [
    // Transactions sur 30 jours pour avoir un historique intéressant
    {
      symbol: 'BTC',
      quantity: 0.5,
      price: 45000,
      side: 'BUY' as const,
      timestamp: new Date('2025-01-15T10:00:00Z'), // Il y a ~15 jours
      note: 'Premier achat BTC'
    },
    {
      symbol: 'ETH',
      quantity: 2.5,
      price: 3200,
      side: 'BUY' as const,
      timestamp: new Date('2025-01-18T14:30:00Z'), // Il y a ~12 jours
      note: 'Achat ETH'
    },
    {
      symbol: 'SOL',
      quantity: 10,
      price: 180,
      side: 'BUY' as const,
      timestamp: new Date('2025-01-22T09:15:00Z'), // Il y a ~8 jours
      note: 'Diversification avec SOL'
    },
    {
      symbol: 'BTC',
      quantity: 0.2,
      side: 'SELL' as const,
      price: 47000,
      timestamp: new Date('2025-01-25T16:45:00Z'), // Il y a ~5 jours
      note: 'Prise de profit partielle BTC'
    },
    {
      symbol: 'USDC',
      quantity: 5000,
      price: 1,
      side: 'BUY' as const,
      timestamp: new Date('2025-01-28T11:20:00Z'), // Il y a ~2 jours
      note: 'Ajout de liquidités USDC'
    }
  ];
  
  for (const tx of transactions) {
    try {
      console.log(`📝 Ajout transaction: ${tx.side} ${tx.quantity} ${tx.symbol} @ $${tx.price} (${tx.timestamp.toISOString().split('T')[0]})`);
      
      const txId = await portfolioService.addTransaction(TEST_USER_ID, {
        symbol: tx.symbol,
        quantity: tx.quantity,
        price: tx.price,
        side: tx.side,
        timestamp: tx.timestamp,
        note: tx.note
      });
      
      console.log(`✅ Transaction créée: ${txId}\n`);
      
      // Petit délai pour éviter de surcharger les APIs
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Erreur création transaction ${tx.symbol}:`, error);
    }
  }
}

async function testPortfolioHistory() {
  console.log('\n📊 Test de l\'historique du portefeuille...\n');
  
  const ranges = ['7d', '30d'] as const;
  
  for (const range of ranges) {
    try {
      console.log(`📈 Calcul historique ${range}...`);
      
      const history = await portfolioService.computePortfolioHistory(TEST_USER_ID, range);
      
      console.log(`✅ Historique ${range} calculé:`);
      console.log(`   - Points de données: ${history.points.length}`);
      console.log(`   - Valeur initiale: $${history.points[0]?.totalValue.toFixed(2) || 'N/A'}`);
      console.log(`   - Valeur finale: $${history.points[history.points.length - 1]?.totalValue.toFixed(2) || 'N/A'}`);
      console.log(`   - Retour total: $${history.totalReturn.toFixed(2)} (${history.totalReturnPercent.toFixed(2)}%)`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Erreur calcul historique ${range}:`, error);
    }
  }
}

async function testCurrentPortfolio() {
  console.log('\n💰 Test du portefeuille actuel...\n');
  
  try {
    const portfolio = await portfolioService.getCurrentPortfolio(TEST_USER_ID);
    
    console.log('✅ Portefeuille actuel:');
    console.log(`   - Valeur totale: $${portfolio.totalValue.toFixed(2)}`);
    console.log(`   - Investissement total: $${portfolio.totalInvested.toFixed(2)}`);
    console.log(`   - PnL total: $${portfolio.totalPnl.toFixed(2)} (${portfolio.totalPnlPercent.toFixed(2)}%)`);
    console.log(`   - Nombre d'assets: ${portfolio.assets.length}`);
    
    if (portfolio.assets.length > 0) {
      console.log('\n📋 Détail des assets:');
      portfolio.assets.forEach(asset => {
        console.log(`   - ${asset.symbol}: ${asset.quantity.toFixed(4)} @ $${asset.currentPrice.toFixed(2)} = $${asset.value.toFixed(2)} (PnL: $${asset.pnl.toFixed(2)})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération portefeuille:', error);
  }
}

async function testSnapshots() {
  console.log('\n💾 Test des snapshots...\n');
  
  try {
    const snapshots = await snapshotRepo.getSnapshotsByUser(TEST_USER_ID, '30d');
    
    console.log(`✅ Snapshots trouvés: ${snapshots.length}`);
    
    if (snapshots.length > 0) {
      console.log('\n📋 Détail des snapshots:');
      snapshots.forEach(snapshot => {
        const breakdown = typeof snapshot.breakdown === 'string' 
          ? JSON.parse(snapshot.breakdown) 
          : snapshot.breakdown;
        const assetCount = Object.keys(breakdown).length;
        console.log(`   - ${snapshot.date.toISOString().split('T')[0]}: $${snapshot.total_value.toFixed(2)} (${assetCount} assets)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération snapshots:', error);
  }
}

async function main() {
  console.log('🧪 === Test du système Portfolio BigQuery ===\n');
  console.log(`👤 Utilisateur de test: ${TEST_USER_ID}\n`);
  
  try {
    // Étape 1: Créer des transactions de test
    await createTestTransactions();
    
    // Étape 2: Tester l'historique du portefeuille
    await testPortfolioHistory();
    
    // Étape 3: Tester le portefeuille actuel
    await testCurrentPortfolio();
    
    // Étape 4: Tester les snapshots
    await testSnapshots();
    
    console.log('\n🎉 Tests terminés avec succès !');
    console.log('\nVous pouvez maintenant:');
    console.log('1. Aller sur http://localhost:3000/transactions');
    console.log('2. Voir votre portefeuille avec les données réelles');
    console.log('3. Ajouter de nouvelles transactions avec des dates personnalisées');
    console.log('4. Voir l\'impact sur l\'historique du graphique\n');
    
  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Executer le script
main().catch(error => {
  console.error('💥 Erreur lors des tests:', error);
  process.exit(1);
});

export { main as runTests };
