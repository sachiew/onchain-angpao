//! LiteSVM tests: an in-process Solana VM, no validator needed. Run with `pnpm anchor:test`
//! (builds the .so first, then `cargo test`).

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use angpao::{
    constants::MIN_PACKET_LAMPORTS,
    errors::AngpaoError,
    instructions::CreateAngpaoArgs,
    state::{Angpao, GateKind, SplitMode},
    ID as PROGRAM_ID,
};
use litesvm::LiteSVM;
use solana_sdk::{
    clock::Clock,
    instruction::{Instruction, InstructionError},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::{Transaction, TransactionError},
};

const SOL: u64 = 1_000_000_000;
const START_TS: i64 = 1_770_000_000; // ~Feb 2026
const DAY: i64 = 86_400;

struct Env {
    svm: LiteSVM,
    creator: Keypair,
    relayer: Keypair,
}

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let so = std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/deploy/angpao.so"
    ))
    .expect("run `anchor build` first");
    svm.add_program(PROGRAM_ID, &so).unwrap();
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = START_TS;
    svm.set_sysvar(&clock);

    let creator = Keypair::new();
    let relayer = Keypair::new();
    svm.airdrop(&creator.pubkey(), 100 * SOL).unwrap();
    svm.airdrop(&relayer.pubkey(), 10 * SOL).unwrap();
    Env {
        svm,
        creator,
        relayer,
    }
}

fn warp(env: &mut Env, ts: i64) {
    let mut clock = env.svm.get_sysvar::<Clock>();
    clock.unix_timestamp = ts;
    env.svm.set_sysvar(&clock);
}

fn pda(creator: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"angpao", creator.as_ref(), &id.to_le_bytes()], &PROGRAM_ID).0
}

fn args(mode: SplitMode, amounts: Vec<u64>) -> CreateAngpaoArgs {
    CreateAngpaoArgs {
        id: 42,
        mode,
        theme: 0,
        message: "Huat ah! 恭喜发财".to_string(),
        amounts,
        expiry_ts: START_TS + DAY,
        gatekeeper: None,
        gate_kind: GateKind::None,
        gate_hash: [0; 32],
        fiat_code: *b"myr",
        fiat_total_minor: 8800,
        allowlist_cap: 0,
    }
}

fn equal_amounts(total: u64, n: u64) -> Vec<u64> {
    let base = total / n;
    let mut v = vec![base; n as usize];
    *v.last_mut().unwrap() = total - base * (n - 1);
    v
}

fn create_ix(creator: &Pubkey, a: &CreateAngpaoArgs) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: angpao::accounts::CreateAngpao {
            creator: *creator,
            angpao: pda(creator, a.id),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: angpao::instruction::CreateAngpao { args: a.clone() }.data(),
    }
}

fn claim_ix(angpao: Pubkey, claimer: Pubkey, gatekeeper: Option<Pubkey>) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: angpao::accounts::Claim {
            angpao,
            claimer,
            gatekeeper,
        }
        .to_account_metas(None),
        data: angpao::instruction::Claim {}.data(),
    }
}

fn close_ix(creator: Pubkey, angpao: Pubkey) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: angpao::accounts::RefundAndClose { creator, angpao }.to_account_metas(None),
        data: angpao::instruction::RefundAndClose {}.data(),
    }
}

type TxResult = Result<(), TransactionError>;

fn send(env: &mut Env, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> TxResult {
    let mut all: Vec<&Keypair> = vec![payer];
    all.extend(signers.iter().filter(|k| k.pubkey() != payer.pubkey()));
    let tx = Transaction::new_signed_with_payer(
        ixs,
        Some(&payer.pubkey()),
        &all,
        env.svm.latest_blockhash(),
    );
    let res = env.svm.send_transaction(tx).map(|_| ()).map_err(|e| e.err);
    env.svm.expire_blockhash(); // so an identical retry isn't rejected as a duplicate
    res
}

fn create(env: &mut Env, a: &CreateAngpaoArgs) -> TxResult {
    let creator = env.creator.insecure_clone();
    send(env, &[create_ix(&creator.pubkey(), a)], &creator, &[])
}

/// Gasless claim: the relayer is fee payer, the claimer only signs.
fn claim(env: &mut Env, angpao: Pubkey, claimer: &Keypair) -> TxResult {
    let relayer = env.relayer.insecure_clone();
    send(env, &[claim_ix(angpao, claimer.pubkey(), None)], &relayer, &[claimer])
}

fn fetch(env: &Env, key: Pubkey) -> Angpao {
    let acc = env.svm.get_account(&key).expect("account exists");
    Angpao::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

fn balance(env: &Env, key: &Pubkey) -> u64 {
    env.svm.get_account(key).map(|a| a.lamports).unwrap_or(0)
}

fn assert_err(res: TxResult, expected: AngpaoError) {
    let code: u32 = expected.into();
    match res {
        Err(TransactionError::InstructionError(_, InstructionError::Custom(c))) if c == code => {}
        other => panic!("expected {expected:?} ({code}), got {other:?}"),
    }
}

// ---------------------------------------------------------------- create

#[test]
fn equal_create_splits_exactly_with_remainder_last() {
    let mut env = setup();
    let total = SOL / 10 + 7; // 0.1 SOL + 7 lamports, not divisible by 8
    let a = args(SplitMode::Equal, equal_amounts(total, 8));
    let creator_before = balance(&env, &env.creator.pubkey());
    create(&mut env, &a).unwrap();

    let key = pda(&env.creator.pubkey(), 42);
    let s = fetch(&env, key);
    assert_eq!(s.num_packets, 8);
    assert_eq!(s.total_lamports, total);
    assert_eq!(s.amounts.iter().sum::<u64>(), total);
    assert!(s.amounts[..7].iter().all(|&x| x == total / 8));
    assert_eq!(s.amounts[7], total / 8 + total % 8);
    assert_eq!(s.message, "Huat ah! 恭喜发财");
    assert_eq!(&s.fiat_code, b"myr");
    assert_eq!(s.fiat_total_minor, 8800);

    // Account holds packet total + rent deposit for exactly the reserved size.
    let acc = env.svm.get_account(&key).unwrap();
    assert_eq!(acc.data.len(), Angpao::space(8, 0));
    assert_eq!(acc.data.len(), 311 + 48 * 8);
    let rent = env.svm.minimum_balance_for_rent_exemption(acc.data.len());
    assert_eq!(acc.lamports, total + rent);
    assert!(creator_before - balance(&env, &env.creator.pubkey()) >= total + rent);
}

#[test]
fn equal_create_rejects_uneven_split() {
    let mut env = setup();
    let a = args(SplitMode::Equal, vec![2_000_000, 3_000_000, 2_000_000]);
    assert_err(create(&mut env, &a), AngpaoError::InvalidSplit);
    // Remainder on the wrong packet is also rejected.
    let a = args(SplitMode::Equal, vec![2_000_001, 2_000_000, 2_000_000]);
    assert_err(create(&mut env, &a), AngpaoError::InvalidSplit);
}

#[test]
fn lucky_create_and_claims_pay_amounts_in_order() {
    let mut env = setup();
    let amounts = vec![1_500_000, 9_000_000, 1_000_000, 4_250_000, 2_000_000];
    let total: u64 = amounts.iter().sum();
    create(&mut env, &args(SplitMode::Lucky, amounts.clone())).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    assert_eq!(fetch(&env, key).total_lamports, total);

    for (i, &amt) in amounts.iter().enumerate() {
        let c = Keypair::new();
        claim(&mut env, key, &c).unwrap();
        assert_eq!(balance(&env, &c.pubkey()), amt, "packet {i}");
    }
    let s = fetch(&env, key);
    assert_eq!(s.claimed_count, 5);
    assert_eq!(s.claims.len(), 5);
}

#[test]
fn packet_too_small_rejected() {
    let mut env = setup();
    let a = args(SplitMode::Lucky, vec![5_000_000, MIN_PACKET_LAMPORTS - 1]);
    assert_err(create(&mut env, &a), AngpaoError::PacketTooSmall);
    // Exactly the minimum is fine.
    let a = args(SplitMode::Lucky, vec![5_000_000, MIN_PACKET_LAMPORTS]);
    create(&mut env, &a).unwrap();
}

#[test]
fn create_input_validation() {
    let mut env = setup();
    assert_err(
        create(&mut env, &args(SplitMode::Lucky, vec![])),
        AngpaoError::InvalidPacketCount,
    );
    assert_err(
        create(&mut env, &args(SplitMode::Equal, equal_amounts(51 * SOL / 100, 51))),
        AngpaoError::InvalidPacketCount,
    );

    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 2));
    a.message = "x".repeat(141);
    assert_err(create(&mut env, &a), AngpaoError::MessageTooLong);

    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 2));
    a.expiry_ts = START_TS; // not in the future
    assert_err(create(&mut env, &a), AngpaoError::InvalidExpiry);
    a.expiry_ts = START_TS + 7 * DAY + 1;
    assert_err(create(&mut env, &a), AngpaoError::InvalidExpiry);

    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 2));
    a.gate_kind = GateKind::Passphrase; // needs a gatekeeper + hash
    assert_err(create(&mut env, &a), AngpaoError::GateConfig);

    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 2));
    a.theme = 8;
    assert_err(create(&mut env, &a), AngpaoError::InvalidTheme);
}

#[test]
fn fifty_packet_create_fits_in_one_transaction() {
    let mut env = setup();
    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 2, 50));
    a.message = "a".repeat(140);
    a.gatekeeper = Some(Pubkey::new_unique());
    // Compute budget ixs, as the app sends them (priority fee + CU limit).
    let cb = solana_sdk::pubkey!("ComputeBudget111111111111111111111111111111");
    let mut price = vec![3u8];
    price.extend_from_slice(&1_000u64.to_le_bytes());
    let mut limit = vec![2u8];
    limit.extend_from_slice(&200_000u32.to_le_bytes());
    let ixs = [
        Instruction::new_with_bytes(cb, &price, vec![]),
        Instruction::new_with_bytes(cb, &limit, vec![]),
        create_ix(&env.creator.pubkey(), &a),
    ];
    let creator = env.creator.insecure_clone();
    let tx = Transaction::new_signed_with_payer(
        &ixs,
        Some(&creator.pubkey()),
        &[&creator],
        env.svm.latest_blockhash(),
    );
    let size = bincode::serialized_size(&tx).unwrap();
    println!("50-packet create tx size: {size} bytes");
    assert!(size <= 1232, "tx too large: {size}");
    env.svm.send_transaction(tx).unwrap();
}

// ---------------------------------------------------------------- claim

#[test]
fn claim_into_fresh_zero_sol_wallet() {
    let mut env = setup();
    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 100, 4))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);

    let fresh = Keypair::new();
    assert!(env.svm.get_account(&fresh.pubkey()).is_none_or(|a| a.lamports == 0));
    let relayer_before = balance(&env, &env.relayer.pubkey());

    claim(&mut env, key, &fresh).unwrap();

    assert_eq!(balance(&env, &fresh.pubkey()), SOL / 400);
    // The relayer paid the fee; the claimer paid nothing.
    assert!(balance(&env, &env.relayer.pubkey()) < relayer_before);
    let s = fetch(&env, key);
    assert_eq!(s.claims[0].claimer, fresh.pubkey());
    assert_eq!(s.claims[0].ts, START_TS);
}

#[test]
fn double_claim_rejected() {
    let mut env = setup();
    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 100, 4))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    let c = Keypair::new();
    claim(&mut env, key, &c).unwrap();
    assert_err(claim(&mut env, key, &c), AngpaoError::AlreadyClaimed);
    assert_eq!(fetch(&env, key).claimed_count, 1);
}

#[test]
fn eleventh_claimer_sees_sold_out() {
    let mut env = setup();
    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 10, 10))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    for _ in 0..10 {
        claim(&mut env, key, &Keypair::new()).unwrap();
    }
    assert_err(claim(&mut env, key, &Keypair::new()), AngpaoError::SoldOut);
}

#[test]
fn expiry_blocks_claims() {
    let mut env = setup();
    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 100, 4))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    warp(&mut env, START_TS + DAY - 1);
    claim(&mut env, key, &Keypair::new()).unwrap();
    warp(&mut env, START_TS + DAY);
    assert_err(claim(&mut env, key, &Keypair::new()), AngpaoError::Expired);
}

#[test]
fn gatekeeper_required_when_set() {
    let mut env = setup();
    let gk = Keypair::new();
    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 4));
    a.gatekeeper = Some(gk.pubkey());
    a.gate_kind = GateKind::Passphrase;
    a.gate_hash = [7; 32];
    create(&mut env, &a).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    let relayer = env.relayer.insecure_clone();

    // No gatekeeper account at all.
    let c = Keypair::new();
    assert_err(claim(&mut env, key, &c), AngpaoError::GatekeeperSignatureMissing);

    // A different key signing as "gatekeeper".
    let imposter = Keypair::new();
    let res = send(
        &mut env,
        &[claim_ix(key, c.pubkey(), Some(imposter.pubkey()))],
        &relayer,
        &[&c, &imposter],
    );
    assert_err(res, AngpaoError::GatekeeperSignatureMissing);

    // The real gatekeeper co-signs → ok.
    send(
        &mut env,
        &[claim_ix(key, c.pubkey(), Some(gk.pubkey()))],
        &relayer,
        &[&c, &gk],
    )
    .unwrap();
    assert_eq!(fetch(&env, key).claimed_count, 1);
}

#[test]
fn allowlist_gate() {
    let mut env = setup();
    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 4));
    a.gate_kind = GateKind::Allowlist;
    a.allowlist_cap = 2;
    create(&mut env, &a).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    let friend = Keypair::new();
    let stranger = Keypair::new();

    let set = |entries: Vec<Pubkey>, creator: Pubkey| Instruction {
        program_id: PROGRAM_ID,
        accounts: angpao::accounts::SetAllowlist {
            creator,
            angpao: key,
        }
        .to_account_metas(None),
        data: angpao::instruction::SetAllowlist { entries }.data(),
    };
    let creator = env.creator.insecure_clone();
    let too_many = vec![Pubkey::new_unique(); 3];
    assert_err(
        send(&mut env, &[set(too_many, creator.pubkey())], &creator, &[]),
        AngpaoError::AllowlistFull,
    );
    send(&mut env, &[set(vec![friend.pubkey()], creator.pubkey())], &creator, &[]).unwrap();

    assert_err(claim(&mut env, key, &stranger), AngpaoError::Unauthorized);
    claim(&mut env, key, &friend).unwrap();

    // Can't change the list once claims have started.
    assert_err(
        send(&mut env, &[set(vec![stranger.pubkey()], creator.pubkey())], &creator, &[]),
        AngpaoError::ClaimsStarted,
    );
}

// ---------------------------------------------------------------- refund / cancel

#[test]
fn refund_after_expiry_returns_remainder_and_closes() {
    let mut env = setup();
    let total = SOL / 10;
    create(&mut env, &args(SplitMode::Equal, equal_amounts(total, 4))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    claim(&mut env, key, &Keypair::new()).unwrap();
    let creator = env.creator.insecure_clone();

    // Too early.
    assert_err(
        send(&mut env, &[close_ix(creator.pubkey(), key)], &creator, &[]),
        AngpaoError::NotExpired,
    );
    // Wrong signer.
    warp(&mut env, START_TS + DAY);
    let mallory = Keypair::new();
    env.svm.airdrop(&mallory.pubkey(), SOL).unwrap();
    assert_err(
        send(&mut env, &[close_ix(mallory.pubkey(), key)], &mallory, &[]),
        AngpaoError::Unauthorized,
    );

    let held = balance(&env, &key);
    let before = balance(&env, &creator.pubkey());
    send(&mut env, &[close_ix(creator.pubkey(), key)], &creator, &[]).unwrap();
    // 3 unclaimed packets + rent come back (minus the 5000-lamport tx fee).
    assert_eq!(held, total * 3 / 4 + env.svm.minimum_balance_for_rent_exemption(Angpao::space(4, 0)));
    assert_eq!(balance(&env, &creator.pubkey()), before + held - 5000);
    assert!(env.svm.get_account(&key).is_none_or(|a| a.lamports == 0));
}

#[test]
fn refund_allowed_early_when_sold_out() {
    let mut env = setup();
    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 100, 2))).unwrap();
    let key = pda(&env.creator.pubkey(), 42);
    claim(&mut env, key, &Keypair::new()).unwrap();
    claim(&mut env, key, &Keypair::new()).unwrap();
    let creator = env.creator.insecure_clone();
    send(&mut env, &[close_ix(creator.pubkey(), key)], &creator, &[]).unwrap();
    assert!(env.svm.get_account(&key).is_none_or(|a| a.lamports == 0));
}

#[test]
fn cancel_only_before_first_claim() {
    let mut env = setup();
    let cancel = |creator: Pubkey, angpao: Pubkey| Instruction {
        program_id: PROGRAM_ID,
        accounts: angpao::accounts::Cancel { creator, angpao }.to_account_metas(None),
        data: angpao::instruction::Cancel {}.data(),
    };
    let creator = env.creator.insecure_clone();

    create(&mut env, &args(SplitMode::Equal, equal_amounts(SOL / 100, 2))).unwrap();
    let key = pda(&creator.pubkey(), 42);
    send(&mut env, &[cancel(creator.pubkey(), key)], &creator, &[]).unwrap();
    assert!(env.svm.get_account(&key).is_none_or(|a| a.lamports == 0));

    let mut a = args(SplitMode::Equal, equal_amounts(SOL / 100, 2));
    a.id = 43;
    create(&mut env, &a).unwrap();
    let key = pda(&creator.pubkey(), 43);
    claim(&mut env, key, &Keypair::new()).unwrap();
    assert_err(
        send(&mut env, &[cancel(creator.pubkey(), key)], &creator, &[]),
        AngpaoError::ClaimsStarted,
    );
}
