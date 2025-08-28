 Test rapide de l'API
fetch('http://localhost:3001/api/prices?symbols=BTC,ETH,SOL')
  .then(res => res.json())
  .then(data => {
    console.log('API Response:', data);
    if (data.success) {
      console.log('Prix reçus:', data.prices);
    } else {
      console.error('Erreur API:', data.error);
    }
  })
  .catch(err => console.error('Erreur réseau:', err));

console.log('Test API lancé...');
