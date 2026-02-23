#!/bin/bash
set -e

RPC_URL="https://rpc.starknet-testnet.lava.build"

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
  --add-profile sepolia 2>&1

echo ""
echo "Account created! See above for the address."
echo "Fund it at: https://starknet-faucet.vercel.app/"
