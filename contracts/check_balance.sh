#!/bin/bash
set -e

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
ADDRESS="0x0523b8fbc83d396302afd1e350358fd5e7c606e3e628099a63d18743b4ac24e0"

echo "Checking balance for $ADDRESS ..."
echo ""

# Check STRK balance (token address on Sepolia)
STRK_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
ETH_TOKEN="0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"

echo "=== STRK Balance ==="
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_call\",\"params\":[{\"contract_address\":\"$STRK_TOKEN\",\"entry_point_selector\":\"0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e\",\"calldata\":[\"$ADDRESS\"]},\"latest\"],\"id\":1}" 2>&1
echo ""

echo "=== ETH Balance ==="
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_call\",\"params\":[{\"contract_address\":\"$ETH_TOKEN\",\"entry_point_selector\":\"0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e\",\"calldata\":[\"$ADDRESS\"]},\"latest\"],\"id\":1}" 2>&1
echo ""
