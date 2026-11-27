use anchor_lang::prelude::*;

/// PDA seed prefix. Full seeds: `["angpao", creator, id.to_le_bytes()]`.
///
/// Solana note: a PDA (Program Derived Address) is an address derived from seeds + the
/// program ID that has no private key. Only this program can "sign" for it. Think of it as
/// a deterministic CREATE2-style address that the contract itself controls.
#[constant]
pub const ANGPAO_SEED: &[u8] = b"angpao";

/// Minimum lamports per packet (0.001 SOL).
///
/// Why: an account that receives SOL must end up rent-exempt (≈ 0.00089 SOL for a 0-byte
/// account). A brand-new 0-SOL wallet receiving less than that would make the whole claim
/// fail, so every packet must be at least this big.
#[constant]
pub const MIN_PACKET_LAMPORTS: u64 = 1_000_000;

/// Packet cap. `create_angpao` carries 8 bytes per packet in a single transaction (max
/// 1,232 bytes); 50 packets + a 140-byte message ≈ 943 bytes, leaving headroom for
/// compute-budget instructions.
#[constant]
pub const MAX_PACKETS: u8 = 50;

#[constant]
pub const MAX_MESSAGE_BYTES: u16 = 140;

/// Allowlist cap (only used when `gate_kind == Allowlist`).
#[constant]
pub const MAX_ALLOWLIST: u8 = 50;

/// Max entries appended per `set_allowlist` call (keeps the tx well under 1,232 bytes).
pub const MAX_ALLOWLIST_CHUNK: usize = 25;

/// Max lifetime of an angpao.
pub const MAX_EXPIRY_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Number of themes the UI knows (0..NUM_THEMES). 7 = Custom.
pub const NUM_THEMES: u8 = 8;
