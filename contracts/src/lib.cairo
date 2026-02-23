/// ─────────────────────────────────────────────────────────────────
/// Onyx Dark Pool — Cairo Smart Contract for Starknet (v2 – ERC20)
///
/// This contract manages the on-chain component of the Onyx private
/// dark-pool trading protocol with REAL ERC20 token custody:
///
///   1. Order commitments  – Users submit Pedersen commitment hashes
///      that hide order details while anchoring them on-chain.
///   2. Match recording    – The operator records a match between two
///      commitment IDs once the off-chain matcher pairs them.
///   3. Settlement         – After ZK-STARK proof verification the
///      operator finalises the match and emits a settlement event.
///   4. ERC20 Vault        – Real token custody via ERC20 transferFrom
///      on deposit and transfer on withdraw. Tokens are held by the
///      contract and tracked per (user, token) pair.
///   5. Token whitelist    – Operator manages supported ERC20 tokens.
///
/// The "proof verification" step is a trusted-operator call rather
/// than an on-chain STARK verifier (adding a full recursive verifier
/// is the natural next step).
/// ─────────────────────────────────────────────────────────────────

use starknet::ContractAddress;

/// ──────────── ERC20 Interface (for external dispatching) ────────────
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(
        self: @TContractState,
        owner: ContractAddress,
        spender: ContractAddress,
    ) -> u256;
}

/// ──────────── Main Contract Interface ────────────
#[starknet::interface]
pub trait IOnyxDarkPool<TContractState> {
    /// Submit a new order commitment to the dark pool.
    fn submit_commitment(
        ref self: TContractState,
        commitment_hash: felt252,
        asset_in: felt252,
        asset_out: felt252,
        encrypted_amount: felt252,
        encrypted_price: felt252,
    ) -> u64;

    /// Record a match between two commitments (operator only).
    fn record_match(
        ref self: TContractState,
        buy_commitment_id: u64,
        sell_commitment_id: u64,
        matched_amount: felt252,
    ) -> u64;

    /// Settle a match after proof verification (operator only).
    fn settle_match(
        ref self: TContractState,
        match_id: u64,
        proof_hash: felt252,
    );

    /// Deposit ERC20 tokens into the shielded vault.
    /// Caller must have approved this contract to spend `amount` of `token`.
    fn vault_deposit(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
    );

    /// Withdraw ERC20 tokens from the shielded vault.
    /// Transfers `amount` of `token` back to the caller.
    fn vault_withdraw(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
    );

    /// Add a supported ERC20 token (operator only).
    fn add_supported_token(
        ref self: TContractState,
        token: ContractAddress,
    );

    /// Remove a supported ERC20 token (operator only).
    fn remove_supported_token(
        ref self: TContractState,
        token: ContractAddress,
    );

    // ── View functions ──

    fn get_commitment(self: @TContractState, commitment_id: u64) -> (felt252, felt252, felt252, u8);
    fn get_match(self: @TContractState, match_id: u64) -> (u64, u64, felt252, u8);
    fn get_vault_balance(self: @TContractState, user: ContractAddress, token: ContractAddress) -> u256;
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
    fn get_commitment_count(self: @TContractState) -> u64;
    fn get_match_count(self: @TContractState) -> u64;
    fn get_operator(self: @TContractState) -> ContractAddress;
}

/// ──────────── Contract ────────────
#[starknet::contract]
mod OnyxDarkPool {
    use core::starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    // ── Storage ──

    #[storage]
    struct Storage {
        /// Deployer / trusted operator.
        operator: ContractAddress,

        /// Sequential commitment counter.
        commitment_count: u64,
        /// commitment_id -> commitment_hash
        commitment_hashes: Map<u64, felt252>,
        /// commitment_id -> asset_in
        commitment_asset_in: Map<u64, felt252>,
        /// commitment_id -> asset_out
        commitment_asset_out: Map<u64, felt252>,
        /// commitment_id -> submitter address
        commitment_owner: Map<u64, ContractAddress>,
        /// commitment_id -> status (0=Open, 1=Matched, 2=Settled, 3=Cancelled)
        commitment_status: Map<u64, u8>,

        /// Sequential match counter.
        match_count: u64,
        /// match_id -> buy_commitment_id
        match_buy_id: Map<u64, u64>,
        /// match_id -> sell_commitment_id
        match_sell_id: Map<u64, u64>,
        /// match_id -> matched_amount (felt252, encrypted/hashed)
        match_amount: Map<u64, felt252>,
        /// match_id -> status (0=Pending, 1=Settled)
        match_status: Map<u64, u8>,
        /// match_id -> proof_hash (set on settlement)
        match_proof: Map<u64, felt252>,

        /// ERC20 vault: (user, token_address) -> balance
        vault_balances: Map<(ContractAddress, ContractAddress), u256>,

        /// Supported token whitelist: token_address -> bool
        supported_tokens: Map<ContractAddress, bool>,
    }

    // ── Events ──

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CommitmentSubmitted: CommitmentSubmitted,
        MatchRecorded: MatchRecorded,
        MatchSettled: MatchSettled,
        VaultDeposit: VaultDeposit,
        VaultWithdraw: VaultWithdraw,
        TokenAdded: TokenAdded,
        TokenRemoved: TokenRemoved,
    }

    #[derive(Drop, starknet::Event)]
    struct CommitmentSubmitted {
        #[key]
        commitment_id: u64,
        #[key]
        submitter: ContractAddress,
        commitment_hash: felt252,
        asset_in: felt252,
        asset_out: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct MatchRecorded {
        #[key]
        match_id: u64,
        buy_commitment_id: u64,
        sell_commitment_id: u64,
        matched_amount: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct MatchSettled {
        #[key]
        match_id: u64,
        proof_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct VaultDeposit {
        #[key]
        user: ContractAddress,
        #[key]
        token: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct VaultWithdraw {
        #[key]
        user: ContractAddress,
        #[key]
        token: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenAdded {
        #[key]
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenRemoved {
        #[key]
        token: ContractAddress,
    }

    // ── Constructor ──

    #[constructor]
    fn constructor(ref self: ContractState, operator: ContractAddress) {
        self.operator.write(operator);
        self.commitment_count.write(0);
        self.match_count.write(0);
    }

    // ── Helpers ──

    fn assert_operator(self: @ContractState) {
        let caller = get_caller_address();
        let op = self.operator.read();
        assert(caller == op, 'Only operator can call this');
    }

    // ── Implementation ──

    #[abi(embed_v0)]
    impl OnyxDarkPoolImpl of super::IOnyxDarkPool<ContractState> {
        // ────────── Commitment / Match / Settlement (unchanged) ──────────

        fn submit_commitment(
            ref self: ContractState,
            commitment_hash: felt252,
            asset_in: felt252,
            asset_out: felt252,
            encrypted_amount: felt252,
            encrypted_price: felt252,
        ) -> u64 {
            assert(commitment_hash != 0, 'Empty commitment hash');

            let caller = get_caller_address();
            let id = self.commitment_count.read() + 1;
            self.commitment_count.write(id);

            self.commitment_hashes.entry(id).write(commitment_hash);
            self.commitment_asset_in.entry(id).write(asset_in);
            self.commitment_asset_out.entry(id).write(asset_out);
            self.commitment_owner.entry(id).write(caller);
            self.commitment_status.entry(id).write(0); // Open

            self.emit(CommitmentSubmitted {
                commitment_id: id,
                submitter: caller,
                commitment_hash,
                asset_in,
                asset_out,
            });

            id
        }

        fn record_match(
            ref self: ContractState,
            buy_commitment_id: u64,
            sell_commitment_id: u64,
            matched_amount: felt252,
        ) -> u64 {
            assert_operator(@self);

            let buy_status = self.commitment_status.entry(buy_commitment_id).read();
            let sell_status = self.commitment_status.entry(sell_commitment_id).read();
            assert(buy_status == 0, 'Buy commitment not open');
            assert(sell_status == 0, 'Sell commitment not open');

            let match_id = self.match_count.read() + 1;
            self.match_count.write(match_id);

            self.match_buy_id.entry(match_id).write(buy_commitment_id);
            self.match_sell_id.entry(match_id).write(sell_commitment_id);
            self.match_amount.entry(match_id).write(matched_amount);
            self.match_status.entry(match_id).write(0); // Pending

            self.commitment_status.entry(buy_commitment_id).write(1);
            self.commitment_status.entry(sell_commitment_id).write(1);

            self.emit(MatchRecorded {
                match_id,
                buy_commitment_id,
                sell_commitment_id,
                matched_amount,
            });

            match_id
        }

        fn settle_match(
            ref self: ContractState,
            match_id: u64,
            proof_hash: felt252,
        ) {
            assert_operator(@self);

            let status = self.match_status.entry(match_id).read();
            assert(status == 0, 'Match not pending');

            self.match_proof.entry(match_id).write(proof_hash);
            self.match_status.entry(match_id).write(1); // Settled

            let buy_id = self.match_buy_id.entry(match_id).read();
            let sell_id = self.match_sell_id.entry(match_id).read();
            self.commitment_status.entry(buy_id).write(2);
            self.commitment_status.entry(sell_id).write(2);

            self.emit(MatchSettled { match_id, proof_hash });
        }

        // ────────── ERC20 Vault ──────────

        fn vault_deposit(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
        ) {
            assert(amount > 0, 'Amount must be positive');

            // Verify token is whitelisted
            let supported = self.supported_tokens.entry(token).read();
            assert(supported, 'Token not supported');

            let caller = get_caller_address();
            let this_contract = get_contract_address();

            // Transfer ERC20 tokens from caller to this contract
            let erc20 = IERC20Dispatcher { contract_address: token };
            let success = erc20.transfer_from(caller, this_contract, amount);
            assert(success, 'ERC20 transferFrom failed');

            // Update internal vault balance
            let current = self.vault_balances.entry((caller, token)).read();
            self.vault_balances.entry((caller, token)).write(current + amount);

            self.emit(VaultDeposit { user: caller, token, amount });
        }

        fn vault_withdraw(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
        ) {
            assert(amount > 0, 'Amount must be positive');

            let caller = get_caller_address();
            let current = self.vault_balances.entry((caller, token)).read();
            assert(current >= amount, 'Insufficient vault balance');

            // Update internal vault balance first (checks-effects-interactions)
            self.vault_balances.entry((caller, token)).write(current - amount);

            // Transfer ERC20 tokens from contract to caller
            let erc20 = IERC20Dispatcher { contract_address: token };
            let success = erc20.transfer(caller, amount);
            assert(success, 'ERC20 transfer failed');

            self.emit(VaultWithdraw { user: caller, token, amount });
        }

        // ────────── Token Management (operator only) ──────────

        fn add_supported_token(
            ref self: ContractState,
            token: ContractAddress,
        ) {
            assert_operator(@self);
            self.supported_tokens.entry(token).write(true);
            self.emit(TokenAdded { token });
        }

        fn remove_supported_token(
            ref self: ContractState,
            token: ContractAddress,
        ) {
            assert_operator(@self);
            self.supported_tokens.entry(token).write(false);
            self.emit(TokenRemoved { token });
        }

        // ── View functions ──

        fn get_commitment(
            self: @ContractState,
            commitment_id: u64,
        ) -> (felt252, felt252, felt252, u8) {
            let hash = self.commitment_hashes.entry(commitment_id).read();
            let asset_in = self.commitment_asset_in.entry(commitment_id).read();
            let asset_out = self.commitment_asset_out.entry(commitment_id).read();
            let status = self.commitment_status.entry(commitment_id).read();
            (hash, asset_in, asset_out, status)
        }

        fn get_match(
            self: @ContractState,
            match_id: u64,
        ) -> (u64, u64, felt252, u8) {
            let buy_id = self.match_buy_id.entry(match_id).read();
            let sell_id = self.match_sell_id.entry(match_id).read();
            let amount = self.match_amount.entry(match_id).read();
            let status = self.match_status.entry(match_id).read();
            (buy_id, sell_id, amount, status)
        }

        fn get_vault_balance(
            self: @ContractState,
            user: ContractAddress,
            token: ContractAddress,
        ) -> u256 {
            self.vault_balances.entry((user, token)).read()
        }

        fn is_token_supported(
            self: @ContractState,
            token: ContractAddress,
        ) -> bool {
            self.supported_tokens.entry(token).read()
        }

        fn get_commitment_count(self: @ContractState) -> u64 {
            self.commitment_count.read()
        }

        fn get_match_count(self: @ContractState) -> u64 {
            self.match_count.read()
        }

        fn get_operator(self: @ContractState) -> ContractAddress {
            self.operator.read()
        }
    }
}
