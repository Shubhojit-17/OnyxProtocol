#!/bin/bash

echo "Checking for account details..."
echo ""
echo "=== starknet_open_zeppelin_accounts.json ==="
cat /root/.starknet_accounts/starknet_open_zeppelin_accounts.json 2>/dev/null || echo "Not found at default location"
echo ""
echo "=== Checking other locations ==="
find /root -name "*.json" -path "*account*" 2>/dev/null | while read f; do
  echo "Found: $f"
  cat "$f"
  echo ""
done
