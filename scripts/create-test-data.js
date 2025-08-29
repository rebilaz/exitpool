// Script de test pour créer des données d'exemple dans BigQuery
// Pour tester le nouveau chart connecté aux vraies données

import { portfolioService } from '../lib/services/portfolioService.js';
import logger from '../lib/logger.js';

const TEST_USER_ID = 'test-user-123';

async function createTestData() {
  logger.info('Creating test portfolio data for chart...');
  
  try {
    // Ajouter quelques transactions de test
    const transactions = [
      {
        userId: TEST_USER_ID,
        symbol: 'BTC',
        quantity: 0.5,
        price: 60000,
        side: 'BUY' as const,
        note: 'Initial BTC purchase'
      },
      {
        userId: TEST_USER_ID,
        symbol: 'ETH',
        quantity: 2,
        price: 3000,
        side: 'BUY' as const,
        note: 'Initial ETH purchase'
      },
      {
        userId: TEST_USER_ID,
        symbol: 'SOL',
        quantity: 10,
        price: 150,
        side: 'BUY' as const,
        note: 'Initial SOL purchase'
      },
      {
        userId: TEST_USER_ID,
        symbol: 'BTC',
        quantity: 0.2,
        price: 62000,
        side: 'BUY' as const,
        note: 'Additional BTC'
      }
    ];

    for (const transaction of transactions) {
      const transactionId = await portfolioService.addTransactionWithSnapshot(transaction);
      logger.info('Test transaction added', { transactionId, symbol: transaction.symbol });
      
      // Attendre un peu entre les transactions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('Test data creation completed!');
    
    // Tester la récupération de l'historique
    logger.info('Testing portfolio history retrieval...');
    const history = await portfolioService.computePortfolioHistory(TEST_USER_ID, '30d');
    logger.info('Portfolio history retrieved', { 
      pointsCount: history.points.length,
      totalReturn: history.totalReturn 
    });

  } catch (error) {
    logger.error('Failed to create test data', { error });
  }
}

// Exécuter le script
createTestData().then(() => {
  logger.info('Script completed');
  process.exit(0);
}).catch(error => {
  logger.error('Script failed', { error });
  process.exit(1);
});
