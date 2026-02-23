use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address};
use starknet::ContractAddress;
use onyx_darkpool::IOnyxDarkPoolDispatcher;
use onyx_darkpool::IOnyxDarkPoolDispatcherTrait;

fn OPERATOR() -> ContractAddress {
    starknet::contract_address_const::<'OPERATOR'>()
}

fn USER1() -> ContractAddress {
    starknet::contract_address_const::<'USER1'>()
}

fn USER2() -> ContractAddress {
    starknet::contract_address_const::<'USER2'>()
}

fn deploy_contract() -> IOnyxDarkPoolDispatcher {
    let contract = declare("OnyxDarkPool").unwrap().contract_class();
    let constructor_calldata = array![OPERATOR().into()];
    let (contract_address, _) = contract.deploy(@constructor_calldata).unwrap();
    IOnyxDarkPoolDispatcher { contract_address }
}

#[test]
fn test_submit_commitment() {
    let dispatcher = deploy_contract();

    start_cheat_caller_address(dispatcher.contract_address, USER1());

    let id = dispatcher.submit_commitment(
        'commitment_hash_1',
        'BTC',
        'USDC',
        'enc_amount',
        'enc_price',
    );
    assert(id == 1, 'First commitment should be 1');

    let (hash, asset_in, asset_out, status) = dispatcher.get_commitment(1);
    assert(hash == 'commitment_hash_1', 'Wrong hash');
    assert(asset_in == 'BTC', 'Wrong asset_in');
    assert(asset_out == 'USDC', 'Wrong asset_out');
    assert(status == 0, 'Should be Open');

    assert(dispatcher.get_commitment_count() == 1, 'Count should be 1');
}

#[test]
fn test_record_match() {
    let dispatcher = deploy_contract();

    // User1 submits buy
    start_cheat_caller_address(dispatcher.contract_address, USER1());
    dispatcher.submit_commitment('buy_hash', 'BTC', 'USDC', 'enc_amt1', 'enc_price1');

    // User2 submits sell
    start_cheat_caller_address(dispatcher.contract_address, USER2());
    dispatcher.submit_commitment('sell_hash', 'BTC', 'USDC', 'enc_amt2', 'enc_price2');

    // Operator records match
    start_cheat_caller_address(dispatcher.contract_address, OPERATOR());
    let match_id = dispatcher.record_match(1, 2, 'matched_amount');
    assert(match_id == 1, 'First match should be 1');

    let (buy_id, sell_id, amount, status) = dispatcher.get_match(1);
    assert(buy_id == 1, 'Wrong buy_id');
    assert(sell_id == 2, 'Wrong sell_id');
    assert(amount == 'matched_amount', 'Wrong amount');
    assert(status == 0, 'Should be Pending');

    // Commitments should be Matched (status=1)
    let (_, _, _, buy_status) = dispatcher.get_commitment(1);
    let (_, _, _, sell_status) = dispatcher.get_commitment(2);
    assert(buy_status == 1, 'Buy should be Matched');
    assert(sell_status == 1, 'Sell should be Matched');
}

#[test]
fn test_settle_match() {
    let dispatcher = deploy_contract();

    start_cheat_caller_address(dispatcher.contract_address, USER1());
    dispatcher.submit_commitment('buy_hash', 'BTC', 'USDC', 'ea', 'ep');

    start_cheat_caller_address(dispatcher.contract_address, USER2());
    dispatcher.submit_commitment('sell_hash', 'BTC', 'USDC', 'ea2', 'ep2');

    start_cheat_caller_address(dispatcher.contract_address, OPERATOR());
    dispatcher.record_match(1, 2, 'amount');
    dispatcher.settle_match(1, 'proof_hash_abc');

    let (_, _, _, match_status) = dispatcher.get_match(1);
    assert(match_status == 1, 'Match should be Settled');

    let (_, _, _, buy_status) = dispatcher.get_commitment(1);
    let (_, _, _, sell_status) = dispatcher.get_commitment(2);
    assert(buy_status == 2, 'Buy should be Settled');
    assert(sell_status == 2, 'Sell should be Settled');
}

#[test]
fn test_vault_deposit_withdraw() {
    let dispatcher = deploy_contract();

    start_cheat_caller_address(dispatcher.contract_address, USER1());

    dispatcher.vault_deposit('BTC', 1000);
    let bal = dispatcher.get_vault_balance(USER1(), 'BTC');
    assert(bal == 1000, 'Balance should be 1000');

    dispatcher.vault_withdraw('BTC', 400);
    let bal2 = dispatcher.get_vault_balance(USER1(), 'BTC');
    assert(bal2 == 600, 'Balance should be 600');
}

#[test]
#[should_panic(expected: 'Insufficient vault balance')]
fn test_vault_overdraw() {
    let dispatcher = deploy_contract();

    start_cheat_caller_address(dispatcher.contract_address, USER1());
    dispatcher.vault_deposit('BTC', 100);
    dispatcher.vault_withdraw('BTC', 200); // Should panic
}

#[test]
#[should_panic(expected: 'Only operator can call this')]
fn test_non_operator_cannot_record_match() {
    let dispatcher = deploy_contract();

    start_cheat_caller_address(dispatcher.contract_address, USER1());
    dispatcher.submit_commitment('h1', 'BTC', 'USDC', 'a', 'p');

    start_cheat_caller_address(dispatcher.contract_address, USER2());
    dispatcher.submit_commitment('h2', 'BTC', 'USDC', 'a', 'p');

    // USER1 is not operator — should fail
    start_cheat_caller_address(dispatcher.contract_address, USER1());
    dispatcher.record_match(1, 2, 'amt');
}
