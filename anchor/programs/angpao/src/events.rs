use anchor_lang::prelude::*;

// Solana note: events are written to the transaction logs (like EVM `emit Event(...)`).
// The app's live feed reads the account itself via `accountSubscribe`, so events are a
// convenience for indexers, not something the UI depends on.

#[event]
pub struct AngpaoCreated {
    pub angpao: Pubkey,
    pub creator: Pubkey,
    pub total_lamports: u64,
    pub num_packets: u8,
    pub expiry_ts: i64,
}

#[event]
pub struct Claimed {
    pub angpao: Pubkey,
    pub claimer: Pubkey,
    pub index: u8,
    pub amount: u64,
    pub remaining: u8,
}

#[event]
pub struct AngpaoClosed {
    pub angpao: Pubkey,
    pub refunded_lamports: u64,
}
