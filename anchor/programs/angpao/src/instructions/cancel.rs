use anchor_lang::prelude::*;

use crate::errors::AngpaoError;
use crate::events::AngpaoClosed;
use crate::state::*;

/// Creator changes their mind before anyone claims: refund everything and close.
#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, has_one = creator @ AngpaoError::Unauthorized, close = creator)]
    pub angpao: Account<'info, Angpao>,
}

pub fn handler(ctx: Context<Cancel>) -> Result<()> {
    let angpao = &ctx.accounts.angpao;
    require!(angpao.claimed_count == 0, AngpaoError::ClaimsStarted);

    emit!(AngpaoClosed {
        angpao: angpao.key(),
        refunded_lamports: angpao.to_account_info().lamports(),
    });
    Ok(())
}
