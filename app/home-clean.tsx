"use client";

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            CryptoPilot
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Gérez votre portefeuille crypto avec intelligence
          </p>
          
          <div className="space-y-4">
            <Link 
              href="/transactions"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
            >
              Accéder au module Transactions & Portefeuille
            </Link>
            
            <div className="text-sm text-gray-500 mt-4">
              <p>✅ Système de transactions avec BigQuery</p>
              <p>✅ Calcul de portefeuille en temps réel</p>
              <p>✅ Intégration des prix DeFiLlama</p>
              <p>✅ Autocomplétion intelligente des symboles</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
