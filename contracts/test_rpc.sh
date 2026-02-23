#!/bin/bash
set -e

echo "Testing Starknet Sepolia RPC endpoints..."
echo ""

ENDPOINTS=(
  "https://free-rpc.nethermind.io/sepolia-juno/"
  "https://rpc.starknet-testnet.lava.build"
  "https://starknet-sepolia.reddio.com/rpc/v0_7"
)

for url in "${ENDPOINTS[@]}"; do
  echo "Testing: $url"
  result=$(curl -s --max-time 10 -X POST "$url" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"starknet_specVersion","params":[],"id":1}' 2>&1) || true
  echo "$result"
  echo "---"
done
