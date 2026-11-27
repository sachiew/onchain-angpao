//! Onchain Angpao: a sender splits SOL into Lucky (random) or Equal packets; friends claim
//! one each, straight into a wallet, with a relayer paying fees so 0-SOL wallets work.
//!
//! Solana for EVM devs, in one paragraph: this crate is the "contract", but it holds no
//! storage of its own. Each angpao is a separate account at a PDA, created and owned by this
//! program. The SOL for the packets sits in that account's own lamport balance. Transactions
//! must list every account they touch up front, which is why each instruction below has an
//! `Accounts` struct.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("BQGTxcw15XCWThc3qt1gMs6GRYQscXBTSfoEEGZuXsmd");

#[program]
pub mod angpao {
    use super::*;

    /// Create and fund an angpao. Amounts are pre-computed by the client (Lucky = random).
    pub fn create_angpao(ctx: Context<CreateAngpao>, args: CreateAngpaoArgs) -> Result<()> {
        instructions::create_angpao::handler(ctx, args)
    }

    /// Add wallets to an allowlist-gated angpao (before the first claim).
    pub fn set_allowlist(ctx: Context<SetAllowlist>, entries: Vec<Pubkey>) -> Result<()> {
        instructions::set_allowlist::handler(ctx, entries)
    }

    /// Claim the next packet.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    /// Creator reclaims leftovers + rent after expiry or sell-out; closes the account.
    pub fn refund_and_close(ctx: Context<RefundAndClose>) -> Result<()> {
        instructions::refund_and_close::handler(ctx)
    }

    /// Creator cancels before anyone claims; closes the account.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }
}
