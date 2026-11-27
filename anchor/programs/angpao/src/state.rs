use anchor_lang::prelude::*;

use crate::constants::MAX_MESSAGE_BYTES;

/// Solana note — accounts vs contract storage:
/// In EVM, a contract owns its storage slots. On Solana, programs are stateless; data lives
/// in separate *accounts* that the program owns. Each angpao is its own account (a PDA),
/// sized up front, and the creator pays a refundable "rent" deposit proportional to its size.
///
/// Layout note: fixed-size fields come first so off-chain code can filter with `memcmp`
/// (e.g. the dashboard finds a creator's angpaos with `creator` at byte offset 8, right
/// after the 8-byte Anchor discriminator).
#[account]
pub struct Angpao {
    pub creator: Pubkey,
    pub id: u64,
    pub bump: u8,
    pub mode: SplitMode,
    pub theme: u8,
    pub num_packets: u8,
    pub claimed_count: u8,
    /// Sum of `amounts`; the SOL held for packets (rent is held on top of this).
    pub total_lamports: u64,
    pub created_ts: i64,
    pub expiry_ts: i64,
    /// If set, every claim must also be signed by this key (the server checks a passphrase /
    /// rate limits before co-signing).
    pub gatekeeper: Option<Pubkey>,
    pub gate_kind: GateKind,
    /// Passphrase gate: `sha256("angpao-gate" || angpao_pda || passphrase)`. The server checks
    /// it before co-signing. Zero when unused. Note: short passphrases can be brute-forced
    /// offline from this hash; it is a demo-grade gate.
    pub gate_hash: [u8; 32],
    /// Local currency at creation, lowercase ASCII (e.g. `myr`). All zeros = none.
    pub fiat_code: [u8; 3],
    /// Value at creation in fiat minor units (e.g. 8800 = RM 88.00).
    pub fiat_total_minor: u64,
    pub allowlist_cap: u8,
    pub message: String,
    /// Pre-computed packet amounts; packet `i` goes to the `i`-th claimer.
    pub amounts: Vec<u64>,
    /// Claims are stored inline (max `num_packets`) so a claim never creates a new account.
    /// That's what lets a 0-SOL wallet claim when a relayer pays the fee.
    pub claims: Vec<ClaimRecord>,
    pub allowlist: Vec<Pubkey>,
}

impl Angpao {
    /// Fixed part of the account, including the 8-byte discriminator and the 4-byte length
    /// prefixes of the four variable fields (message sized at its max).
    pub const FIXED_SPACE: usize = 8 // discriminator
        + 32 // creator
        + 8 // id
        + 1 // bump
        + 1 // mode
        + 1 // theme
        + 1 // num_packets
        + 1 // claimed_count
        + 8 // total_lamports
        + 8 // created_ts
        + 8 // expiry_ts
        + 33 // gatekeeper: Option<Pubkey>
        + 1 // gate_kind
        + 32 // gate_hash
        + 3 // fiat_code
        + 8 // fiat_total_minor
        + 1 // allowlist_cap
        + 4 + MAX_MESSAGE_BYTES as usize // message
        + 4 // amounts len
        + 4 // claims len
        + 4; // allowlist len

    /// Total account size = 311 + 48·packets + 32·allowlist.
    pub fn space(num_packets: usize, allowlist_cap: usize) -> usize {
        Self::FIXED_SPACE
            + num_packets * 8 // amounts
            + num_packets * ClaimRecord::SIZE // claims
            + allowlist_cap * 32 // allowlist
    }

    pub fn has_claimed(&self, who: &Pubkey) -> bool {
        self.claims.iter().any(|c| &c.claimer == who)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ClaimRecord {
    pub claimer: Pubkey,
    pub ts: i64,
}

impl ClaimRecord {
    pub const SIZE: usize = 32 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SplitMode {
    Equal,
    Lucky,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum GateKind {
    None,
    Passphrase,
    Allowlist,
}
