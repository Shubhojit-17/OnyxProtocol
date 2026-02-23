#!/bin/bash

echo "=== Finding all account-related files ==="
find /root -name "*account*" -o -name "*starknet*" 2>/dev/null | grep -v ".asdf" | head -20
echo ""
echo "=== /root/.starknet_accounts/ ==="
ls -la /root/.starknet_accounts/ 2>/dev/null || echo "Directory not found"
echo ""
cat /root/.starknet_accounts/starknet_open_zeppelin_accounts.json 2>/dev/null || echo "File not found"
