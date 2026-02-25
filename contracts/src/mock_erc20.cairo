/// ─────────────────────────────────────────────────────────────────
/// MockERC20 — Mintable ERC20 for Starknet Sepolia testnet
///
/// Anyone can call `mint()` to get tokens — this is for testnet only.
/// Implements the standard ERC20 interface so it works with
/// OnyxDarkPool vault_deposit / vault_withdraw.
/// ─────────────────────────────────────────────────────────────────

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    /// Testnet-only: anyone can mint tokens to themselves
    fn mint(ref self: TContractState, amount: u256);
    /// Testnet-only: operator can mint tokens to any address
    fn mint_to(ref self: TContractState, to: ContractAddress, amount: u256);
}

#[starknet::contract]
mod MockERC20 {
    use core::starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry,
    };
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        _name: felt252,
        _symbol: felt252,
        _decimals: u8,
        _total_supply: u256,
        _balances: Map<ContractAddress, u256>,
        _allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    // ── Events ──

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        value: u256,
    }

    // ── Constructor ──

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: felt252,
        symbol: felt252,
        decimals: u8,
    ) {
        self._name.write(name);
        self._symbol.write(symbol);
        self._decimals.write(decimals);
        self._total_supply.write(0);
    }

    // ── Implementation ──

    #[abi(embed_v0)]
    impl MockERC20Impl of super::IMockERC20<ContractState> {
        fn name(self: @ContractState) -> felt252 {
            self._name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self._symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self._decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self._total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self._balances.entry(account).read()
        }

        fn allowance(
            self: @ContractState,
            owner: ContractAddress,
            spender: ContractAddress,
        ) -> u256 {
            self._allowances.entry((owner, spender)).read()
        }

        fn transfer(
            ref self: ContractState,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let caller_balance = self._balances.entry(caller).read();
            assert(caller_balance >= amount, 'Insufficient balance');

            self._balances.entry(caller).write(caller_balance - amount);
            let recipient_balance = self._balances.entry(recipient).read();
            self._balances.entry(recipient).write(recipient_balance + amount);

            self.emit(Transfer { from: caller, to: recipient, value: amount });
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self._allowances.entry((sender, caller)).read();
            assert(current_allowance >= amount, 'Insufficient allowance');

            let sender_balance = self._balances.entry(sender).read();
            assert(sender_balance >= amount, 'Insufficient balance');

            self._allowances.entry((sender, caller)).write(current_allowance - amount);
            self._balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self._balances.entry(recipient).read();
            self._balances.entry(recipient).write(recipient_balance + amount);

            self.emit(Transfer { from: sender, to: recipient, value: amount });
            true
        }

        fn approve(
            ref self: ContractState,
            spender: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            self._allowances.entry((caller, spender)).write(amount);

            self.emit(Approval { owner: caller, spender, value: amount });
            true
        }

        /// Anyone can mint tokens to themselves (testnet only)
        fn mint(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let balance = self._balances.entry(caller).read();
            self._balances.entry(caller).write(balance + amount);

            let supply = self._total_supply.read();
            self._total_supply.write(supply + amount);

            // Zero address as `from` indicates minting
            let zero: ContractAddress = 0.try_into().unwrap();
            self.emit(Transfer { from: zero, to: caller, value: amount });
        }

        /// Mint tokens to a specific address (testnet only)
        fn mint_to(ref self: ContractState, to: ContractAddress, amount: u256) {
            let balance = self._balances.entry(to).read();
            self._balances.entry(to).write(balance + amount);

            let supply = self._total_supply.read();
            self._total_supply.write(supply + amount);

            let zero: ContractAddress = 0.try_into().unwrap();
            self.emit(Transfer { from: zero, to, value: amount });
        }
    }
}
