#!/bin/bash

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
TX_HASH="0x6484bac835408db4e5f33c7c006434305bfc29a47b63bc50d03c6ad88bbb708"

echo "Checking declaration tx status..."
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":[\"$TX_HASH\"],\"id\":1}" | python3 -m json.tool 2>/dev/null || \
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":[\"$TX_HASH\"],\"id\":1}"
echo ""
