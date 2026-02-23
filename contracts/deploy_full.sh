#!/bin/bash
set -e

RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"

echo "═══════════════════════════════════════════════"
echo "  Step 1: Deploy Account on Sepolia"
echo "═══════════════════════════════════════════════"
echo ""

sncast account deploy \
  --url "$RPC_URL" \
  --name sepolia 2>&1

echo ""
echo "✅ Account deployed!"
echo ""

echo "═══════════════════════════════════════════════"
echo "  Step 2: Build Cairo Contract"
echo "═══════════════════════════════════════════════"
echo ""

cd /contracts
scarb build 2>&1
echo ""
echo "✅ Contract built!"
echo ""

echo "═══════════════════════════════════════════════"
echo "  Step 3: Declare Contract"
echo "═══════════════════════════════════════════════"
echo ""

DECLARE_OUTPUT=$(sncast --profile sepolia declare --contract-name OnyxDarkPool 2>&1) || true
echo "$DECLARE_OUTPUT"

if echo "$DECLARE_OUTPUT" | grep -q "is already declared"; then
  CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1)
else
  CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep "class_hash" | grep -oP '0x[0-9a-fA-F]+')
fi

echo ""
echo "Class Hash: $CLASS_HASH"
echo ""

echo "═══════════════════════════════════════════════"
echo "  Step 4: Deploy Contract"
echo "═══════════════════════════════════════════════"
echo ""

OPERATOR_ADDRESS="0x0523b8fbc83d396302afd1e350358fd5e7c606e3e628099a63d18743b4ac24e0"

DEPLOY_OUTPUT=$(sncast --profile sepolia deploy \
  --class-hash "$CLASS_HASH" \
  --constructor-calldata "$OPERATOR_ADDRESS" \
  2>&1)

echo "$DEPLOY_OUTPUT"

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "contract_address" | grep -oP '0x[0-9a-fA-F]+')

echo ""
echo "═══════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Contract Address: $CONTRACT_ADDRESS"
echo "  Operator Address: $OPERATOR_ADDRESS"
echo "  Private Key:      0x2c7655d3956d67318be19b4ea9d007723fc176d17a2272ddb852a45042fe5a5"
echo ""
echo "  Explorer: https://sepolia.starkscan.co/contract/$CONTRACT_ADDRESS"
echo ""
