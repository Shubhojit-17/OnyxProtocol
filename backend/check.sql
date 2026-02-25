SELECT "id", "orderType", "amount", "status", "onChainId", substring("onChainTxHash", 1, 20) as tx FROM "OrderCommitment";
SELECT "id", "status", "onChainMatchId", substring("onChainTxHash", 1, 20) as tx FROM "Match";
SELECT "matchId", substring("txHash", 1, 30) as tx, "network" FROM "SettlementTx";
SELECT "matchId", "proofStatus" FROM "Proof";
