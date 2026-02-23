# Onyx Protocol — Cairo Contract Deployment Guide
# ================================================
#
# This script guides you through building, declaring, and deploying
# the OnyxDarkPool Cairo smart contract on Starknet (Devnet or Sepolia).
#
# Prerequisites:
#   - Scarb (Cairo build tool)
#   - Starknet Foundry (snforge, sncast)
#   - Starknet Devnet (for local) or funded Sepolia account (for testnet)
#
# Install tools (Linux/macOS/WSL):
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh
#
# Windows: Use WSL (see docs.starknet.io/build/quickstart/environment-setup)

set -e

echo "═══════════════════════════════════════════════"
echo "  Onyx Dark Pool — Contract Deployment"
echo "═══════════════════════════════════════════════"

# ─── 1. Build the contract ───────────────────────────
echo ""
echo "▶ Step 1: Building Cairo contract..."
cd "$(dirname "$0")"
scarb build

echo "✅ Contract compiled successfully"
echo ""

# ─── 2. Run tests ────────────────────────────────────
echo "▶ Step 2: Running contract tests..."
snforge test
echo "✅ All tests passed"
echo ""

# ─── Choose network ──────────────────────────────────
NETWORK=${1:-devnet}

if [ "$NETWORK" = "devnet" ]; then
  echo "▶ Deploying to LOCAL DEVNET (http://127.0.0.1:5050)"
  echo "  Make sure starknet-devnet is running: starknet-devnet --seed=0"
  echo ""
  
  # Import predeployed devnet account
  sncast account import \
    --address=0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691 \
    --type=oz \
    --url=http://127.0.0.1:5050 \
    --private-key=0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9 \
    --add-profile=devnet \
    --silent 2>/dev/null || true

  PROFILE="devnet"
  OPERATOR_ADDRESS="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
  OPERATOR_PRIVATE_KEY="0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"
  
elif [ "$NETWORK" = "sepolia" ]; then
  echo "▶ Deploying to STARKNET SEPOLIA"
  echo "  Make sure you have a funded Sepolia account configured."
  echo ""
  
  PROFILE="sepolia"
  OPERATOR_ADDRESS=${STARKNET_OPERATOR_ADDRESS:-""}
  OPERATOR_PRIVATE_KEY=${STARKNET_OPERATOR_PRIVATE_KEY:-""}
  
  if [ -z "$OPERATOR_ADDRESS" ]; then
    echo "❌ STARKNET_OPERATOR_ADDRESS not set. Create a Sepolia account first:"
    echo "   sncast account create --network=sepolia --name=sepolia"
    echo "   Fund it at: https://starknet-faucet.vercel.app/"
    echo "   sncast account deploy --network=sepolia --name=sepolia"
    exit 1
  fi
else
  echo "❌ Unknown network: $NETWORK (use 'devnet' or 'sepolia')"
  exit 1
fi

# ─── 3. Declare the contract ─────────────────────────
echo "▶ Step 3: Declaring contract class..."
DECLARE_OUTPUT=$(sncast --profile=$PROFILE declare --contract-name=OnyxDarkPool 2>&1) || true

if echo "$DECLARE_OUTPUT" | grep -q "is already declared"; then
  CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1)
  echo "ℹ️  Contract already declared. Class hash: $CLASS_HASH"
else
  CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep "Class Hash:" | awk '{print $3}')
  echo "✅ Declared. Class hash: $CLASS_HASH"
fi
echo ""

# ─── 4. Deploy the contract ──────────────────────────
echo "▶ Step 4: Deploying contract instance..."
echo "  Constructor arg: operator = $OPERATOR_ADDRESS"

DEPLOY_OUTPUT=$(sncast --profile=$PROFILE deploy \
  --class-hash=$CLASS_HASH \
  --constructor-calldata=$OPERATOR_ADDRESS 2>&1)

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Contract Address:" | awk '{print $3}')
TX_HASH=$(echo "$DEPLOY_OUTPUT" | grep "Transaction Hash:" | awk '{print $3}')

echo "✅ Contract deployed!"
echo ""
echo "═══════════════════════════════════════════════"
echo "  Deployment Summary"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Network:          $NETWORK"
echo "  Class Hash:       $CLASS_HASH"
echo "  Contract Address: $CONTRACT_ADDRESS"
echo "  Deploy TX:        $TX_HASH"
echo "  Operator:         $OPERATOR_ADDRESS"
echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "▶ Next: Update your .env files:"
echo ""
echo "  backend/.env:"
echo "    STARKNET_CONTRACT_ADDRESS=\"$CONTRACT_ADDRESS\""
echo "    STARKNET_OPERATOR_ADDRESS=\"$OPERATOR_ADDRESS\""
echo "    STARKNET_OPERATOR_PRIVATE_KEY=\"$OPERATOR_PRIVATE_KEY\""
echo ""
echo "  frontend/.env (optional):"
echo "    VITE_DARKPOOL_CONTRACT_ADDRESS=\"$CONTRACT_ADDRESS\""
echo ""

if [ "$NETWORK" = "sepolia" ]; then
  echo "  View on explorer:"
  echo "    https://sepolia.starkscan.co/contract/$CONTRACT_ADDRESS"
  echo "    https://sepolia.starkscan.co/tx/$TX_HASH"
fi

echo ""
echo "🎉 Done! Restart backend and frontend to use on-chain integration."
