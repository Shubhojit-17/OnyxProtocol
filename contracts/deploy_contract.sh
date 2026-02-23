#!/bin/bash
set -e

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
CLASS_HASH="0xa14a8ce0ec11f8cafaf7cd74f91245e003552d833c9e6d545c88331676ed34"
OPERATOR_ADDRESS="0x0523b8fbc83d396302afd1e350358fd5e7c606e3e628099a63d18743b4ac24e0"

echo "═══════════════════════════════════════════════"
echo "  Deploying OnyxDarkPool Contract"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Class Hash: $CLASS_HASH"
echo "  Operator:   $OPERATOR_ADDRESS"
echo ""

sncast --profile sepolia deploy \
  --class-hash "$CLASS_HASH" \
  --constructor-calldata "$OPERATOR_ADDRESS" 2>&1

echo ""
echo "✅ Contract deployed!"
