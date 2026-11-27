use anchor_lang::prelude::*;

use crate::constants::MAX_ALLOWLIST_CHUNK;
use crate::errors::AngpaoError;
use crate::state::*;

/// Appends wallets to an allowlist-gated angpao. Call once or more right after
/// `create_angpao`, before anyone claims. Space was reserved at creation (`allowlist_cap`).
#[derive(Accounts)]
pub struct SetAllowlist<'info> {
    pub creator: Signer<'info>,

    #[account(mut, has_one = creator @ AngpaoError::Unauthorized)]
    pub angpao: Account<'info, Angpao>,
}

pub fn handler(ctx: Context<SetAllowlist>, entries: Vec<Pubkey>) -> Result<()> {
    let angpao = &mut ctx.accounts.angpao;
    require!(
        angpao.gate_kind == GateKind::Allowlist,
        AngpaoError::GateConfig
    );
    require!(angpao.claimed_count == 0, AngpaoError::ClaimsStarted);
    require!(
        entries.len() <= MAX_ALLOWLIST_CHUNK,
        AngpaoError::AllowlistFull
    );
    require!(
        angpao.allowlist.len() + entries.len() <= angpao.allowlist_cap as usize,
        AngpaoError::AllowlistFull
    );
    for e in entries {
        if !angpao.allowlist.contains(&e) {
            angpao.allowlist.push(e);
        }
    }
    Ok(())
}
