#!/usr/bin/env node

/**
 * Script simple pour tester l'ajout d'une transaction via l'API
 */

const TEST_USER_ID = 'test-user-123';

async function testAddTransaction() {
  const transactionData = {
    userId: TEST_USER_ID,
    symbol: 'BTC',
    quantity: 0.1,
    price: 50000,
    side: 'BUY',
    note: 'Test transaction from script',
    timestamp: new Date('2025-08-20T10:00:00Z').toISOString() // Transaction dans le passé
  };

  try {
    console.log('🚀 Test ajout transaction via API...');
    console.log('Données:', transactionData);

    const response = await fetch('http://localhost:3002/api/transactions/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();
    
    console.log('📋 Réponse API:', result);
    
    if (result.success) {
      console.log('✅ Transaction ajoutée avec succès !');
      console.log('ID Transaction:', result.transactionId);
      
      // Attendre un peu puis tester l'historique
      console.log('\n⏳ Attente 2 secondes puis test historique...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tester l'historique
      const historyResponse = await fetch(`http://localhost:3002/api/portfolio/history?userId=${TEST_USER_ID}&range=30d`);
      const historyResult = await historyResponse.json();
      
      console.log('📊 Historique du portefeuille:');
      if (historyResult.success && historyResult.history) {
        console.log(`   - Points de données: ${historyResult.history.points.length}`);
        console.log(`   - Retour total: $${historyResult.history.totalReturn.toFixed(2)}`);
        
        // Afficher quelques points récents
        const recentPoints = historyResult.history.points.slice(-5);
        console.log('   - 5 derniers points:');
        recentPoints.forEach(point => {
          console.log(`     ${point.date.split('T')[0]}: $${point.totalValue.toFixed(2)}`);
        });
      }
      
    } else {
      console.log('❌ Erreur:', result.error);
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
  }
}

// Exécuter le test
testAddTransaction().then(() => {
  console.log('\n🎉 Test terminé !');
}).catch(console.error);
