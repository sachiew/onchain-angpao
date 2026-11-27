use anchor_lang::prelude::*;

use crate::errors::AngpaoError;
use crate::events::Claimed;
use crate::state::*;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub angpao: Account<'info, Angpao>,

    /// The wallet receiving the packet. It must sign (proving it controls the key), but it does
    /// NOT pay the fee: the relayer is the transaction's fee payer, so a 0-SOL wallet works.
    ///
    /// Solana note — fee payer: every tx names one fee-payer signer. It can be anyone, which
    /// is what makes "gasless" possible natively (no ERC-4337 needed).
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// Required only when `angpao.gatekeeper` is set; must be that key and must sign.
    pub gatekeeper: Option<Signer<'info>>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let claimer_key = ctx.accounts.claimer.key();
    let angpao = &mut ctx.accounts.angpao;

    require!(now < angpao.expiry_ts, AngpaoError::Expired);
    require!(
        angpao.claimed_count < angpao.num_packets,
        AngpaoError::SoldOut
    );
    require!(
        !angpao.has_claimed(&claimer_key),
        AngpaoError::AlreadyClaimed
    );
    if let Some(expected) = angpao.gatekeeper {
        let ok = ctx
            .accounts
            .gatekeeper
            .as_ref()
            .is_some_and(|g| g.key() == expected);
        require!(ok, AngpaoError::GatekeeperSignatureMissing);
    }
    if angpao.gate_kind == GateKind::Allowlist {
        require!(
            angpao.allowlist.contains(&claimer_key),
            AngpaoError::Unauthorized
        );
    }

    let index = angpao.claimed_count;
    let amount = angpao.amounts[index as usize];
    angpao.claims.push(ClaimRecord {
        claimer: claimer_key,
        ts: now,
    });
    angpao.claimed_count = index + 1;
    let remaining = angpao.num_packets - angpao.claimed_count;

    // Move lamports directly. This program owns the angpao account, so it may debit it
    // without a CPI; any program may credit any writable account. The angpao keeps its rent
    // deposit, which stays on top of the packet funds, so it remains rent-exempt.
    ctx.accounts.angpao.sub_lamports(amount)?;
    ctx.accounts.claimer.add_lamports(amount)?;

    emit!(Claimed {
        angpao: ctx.accounts.angpao.key(),
        claimer: claimer_key,
        index,
        amount,
        remaining,
    });
    Ok(())
}
