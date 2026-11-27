use anchor_lang::prelude::*;

use crate::errors::AngpaoError;
use crate::events::AngpaoClosed;
use crate::state::*;

/// Returns everything left in the angpao (unclaimed packets + the rent deposit) to the
/// creator and deletes the account. Allowed after expiry, or once every packet is claimed.
#[derive(Accounts)]
pub struct RefundAndClose<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    // Solana note — `close = creator`: Anchor moves all lamports to `creator` and wipes the
    // account at the end of the instruction. That's how the rent deposit comes back.
    #[account(mut, has_one = creator @ AngpaoError::Unauthorized, close = creator)]
    pub angpao: Account<'info, Angpao>,
}

pub fn handler(ctx: Context<RefundAndClose>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let angpao = &ctx.accounts.angpao;
    let sold_out = angpao.claimed_count == angpao.num_packets;
    require!(now >= angpao.expiry_ts || sold_out, AngpaoError::NotExpired);

    emit!(AngpaoClosed {
        angpao: angpao.key(),
        refunded_lamports: angpao.to_account_info().lamports(),
    });
    Ok(())
}
