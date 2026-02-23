#!/bin/bash
set -e

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"

echo "═══════════════════════════════════════════════"
echo "  Creating Starknet Sepolia Account"  
echo "═══════════════════════════════════════════════"
echo ""
echo "RPC: $RPC_URL"
echo ""

# Create account
sncast account create \
  --url "$RPC_URL" \
  --name sepolia \
  --add-profile sepolia 2>&1 || true

echo ""
echo "Checking snfoundry.toml for saved account info..."
cat /root/.config/snfoundry/accounts/accounts.json 2>/dev/null || echo "No accounts.json found"
echo ""
cat /contracts/snfoundry.toml 2>/dev/null || echo "No snfoundry.toml found"
