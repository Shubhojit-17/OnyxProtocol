#!/bin/bash

echo "Testing more Starknet Sepolia RPC endpoints..."
echo ""

ENDPOINTS=(
  "https://starknet-sepolia.public.blastapi.io/rpc/v0_8"
  "https://api.cartridge.gg/x/starknet/sepolia"  
  "https://pathfinder.rpc.sepolia.starknet.io"
  "https://juno.rpc.sepolia.starknet.io"
  "https://starknet-sepolia.blockpi.network/v1/rpc/public"
  "https://rpc-sepolia.kasarlabs.io"
)

for url in "${ENDPOINTS[@]}"; do
  echo "Testing: $url"
  result=$(curl -s --max-time 10 -X POST "$url" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"starknet_specVersion","params":[],"id":1}' 2>&1) || true
  echo "  Result: $result"
  echo "---"
done
