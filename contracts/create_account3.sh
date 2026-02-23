#!/bin/bash
set -e

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"

echo "═══════════════════════════════════════════════"
echo "  Creating Starknet Sepolia Account"  
echo "═══════════════════════════════════════════════"
echo ""

# Remove old profile from snfoundry.toml if present
sed -i '/\[sncast\.sepolia\]/,/^$/d' /contracts/snfoundry.toml 2>/dev/null || true

# Create account  
sncast account create \
  --url "$RPC_URL" \
  --name sepolia \
  --add-profile sepolia 2>&1 || true

echo ""
echo "═══════════════════════════════════════════════"
echo "  Account Details (save these!)"
echo "═══════════════════════════════════════════════"
echo ""
echo "=== Accounts JSON ==="
cat /root/.starknet_accounts/starknet_open_zeppelin_accounts.json 2>/dev/null || echo "Not found"
echo ""
echo "=== snfoundry.toml ==="
cat /contracts/snfoundry.toml
