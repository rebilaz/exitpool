#!/bin/bash

# Script de vérification WalletConnect / Reown
# Usage: chmod +x verify-wc-config.sh && ./verify-wc-config.sh

echo "🔍 WalletConnect Configuration Check"
echo "===================================="

# 1. Vérifier .env
echo "📋 1. Environment Variables:"
if [ -f .env ]; then
    PROJECT_ID=$(grep "NEXT_PUBLIC_WC_PROJECT_ID" .env | cut -d '=' -f2 | tr -d '"')
    if [ -n "$PROJECT_ID" ]; then
        echo "   ✅ NEXT_PUBLIC_WC_PROJECT_ID = $PROJECT_ID"
        echo "   🔗 Reown Dashboard: https://cloud.reown.com/app/$PROJECT_ID"
    else
        echo "   ❌ NEXT_PUBLIC_WC_PROJECT_ID not found in .env"
    fi
else
    echo "   ❌ .env file not found"
fi

# 2. Vérifier les dépendances
echo ""
echo "📦 2. Dependencies Check:"
if [ -f package.json ]; then
    echo "   WalletConnect packages:"
    npm list 2>/dev/null | grep -E "(walletconnect|reown)" || echo "   ⚠️  No WC packages found"
    echo ""
    echo "   React/Next versions:"
    npm list react next 2>/dev/null | grep -E "(react|next)" || echo "   ⚠️  React/Next not found"
else
    echo "   ❌ package.json not found"
fi

# 3. Vérifier les ports
echo ""
echo "🌐 3. Development Server Check:"
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "   ✅ Port 3000 is in use (dev server running?)"
else
    echo "   ⚠️  Port 3000 is free (dev server not running?)"
fi

# 4. Vérifier connectivité réseau
echo ""
echo "🔌 4. Network Connectivity:"
if curl -s --max-time 5 https://relay.walletconnect.com/health >/dev/null; then
    echo "   ✅ WalletConnect relay is reachable"
else
    echo "   ❌ WalletConnect relay is not reachable (VPN/firewall?)"
fi

if curl -s --max-time 5 https://cloud.reown.com >/dev/null; then
    echo "   ✅ Reown Cloud is reachable"
else
    echo "   ❌ Reown Cloud is not reachable"
fi

echo ""
echo "🎯 Next Steps:"
echo "   1. Ouvre la console navigateur sur localhost:3000"
echo "   2. Colle le contenu de debug-wc.js"
echo "   3. Utilise debugWC.hardReset() si erreur 'No matching key'"
echo "   4. Vérifie que ton domaine est autorisé sur Reown Dashboard"
