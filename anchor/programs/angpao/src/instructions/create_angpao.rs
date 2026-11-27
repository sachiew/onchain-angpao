use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::*;
use crate::errors::AngpaoError;
use crate::events::AngpaoCreated;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateAngpaoArgs {
    /// Random u64 picked by the client; lets one creator have many angpaos.
    pub id: u64,
    pub mode: SplitMode,
    pub theme: u8,
    pub message: String,
    /// Packet amounts in lamports. `num_packets` and the total are derived from this.
    pub amounts: Vec<u64>,
    pub expiry_ts: i64,
    pub gatekeeper: Option<Pubkey>,
    pub gate_kind: GateKind,
    pub gate_hash: [u8; 32],
    pub fiat_code: [u8; 3],
    pub fiat_total_minor: u64,
    /// Room reserved for allowlist entries (0 unless `gate_kind == Allowlist`).
    pub allowlist_cap: u8,
}

#[derive(Accounts)]
#[instruction(args: CreateAngpaoArgs)]
pub struct CreateAngpao<'info> {
    /// Pays the packet total plus the account's rent deposit (refunded on close).
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Angpao::space(args.amounts.len(), args.allowlist_cap as usize),
        seeds = [ANGPAO_SEED, creator.key().as_ref(), &args.id.to_le_bytes()],
        bump,
    )]
    pub angpao: Account<'info, Angpao>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAngpao>, args: CreateAngpaoArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let n = args.amounts.len();

    // --- validation (mirrored in the UI) ---
    require!(
        n >= 1 && n <= MAX_PACKETS as usize,
        AngpaoError::InvalidPacketCount
    );
    require!(
        args.message.len() <= MAX_MESSAGE_BYTES as usize,
        AngpaoError::MessageTooLong
    );
    require!(args.theme < NUM_THEMES, AngpaoError::InvalidTheme);
    require!(
        args.expiry_ts > now && args.expiry_ts <= now + MAX_EXPIRY_SECONDS,
        AngpaoError::InvalidExpiry
    );
    require!(
        args.amounts.iter().all(|&a| a >= MIN_PACKET_LAMPORTS),
        AngpaoError::PacketTooSmall
    );
    let total = args
        .amounts
        .iter()
        .try_fold(0u64, |acc, &a| acc.checked_add(a))
        .ok_or(AngpaoError::Overflow)?;
    if args.mode == SplitMode::Equal {
        // Equal: floor(total / n) each, remainder on the last packet.
        let base = total / n as u64;
        let (last, rest) = args.amounts.split_last().unwrap();
        require!(
            rest.iter().all(|&a| a == base) && *last == total - base * (n as u64 - 1),
            AngpaoError::InvalidSplit
        );
    }
    let fiat_ok = args.fiat_code == [0; 3] || args.fiat_code.iter().all(u8::is_ascii_lowercase);
    require!(fiat_ok, AngpaoError::InvalidFiatCode);
    match args.gate_kind {
        GateKind::None => require!(
            args.allowlist_cap == 0 && args.gate_hash == [0; 32],
            AngpaoError::GateConfig
        ),
        GateKind::Passphrase => require!(
            args.gatekeeper.is_some() && args.allowlist_cap == 0 && args.gate_hash != [0; 32],
            AngpaoError::GateConfig
        ),
        GateKind::Allowlist => require!(
            args.allowlist_cap >= 1
                && args.allowlist_cap <= MAX_ALLOWLIST
                && args.gate_hash == [0; 32],
            AngpaoError::GateConfig
        ),
    }

    // --- write state ---
    let angpao = &mut ctx.accounts.angpao;
    angpao.creator = ctx.accounts.creator.key();
    angpao.id = args.id;
    angpao.bump = ctx.bumps.angpao;
    angpao.mode = args.mode;
    angpao.theme = args.theme;
    angpao.num_packets = n as u8;
    angpao.claimed_count = 0;
    angpao.total_lamports = total;
    angpao.created_ts = now;
    angpao.expiry_ts = args.expiry_ts;
    angpao.gatekeeper = args.gatekeeper;
    angpao.gate_kind = args.gate_kind;
    angpao.gate_hash = args.gate_hash;
    angpao.fiat_code = args.fiat_code;
    angpao.fiat_total_minor = args.fiat_total_minor;
    angpao.allowlist_cap = args.allowlist_cap;
    angpao.message = args.message;
    angpao.amounts = args.amounts;
    angpao.claims = Vec::with_capacity(n);
    angpao.allowlist = Vec::new();

    // --- fund it ---
    // `init` above already moved the rent deposit in. Now move the packet total in via a
    // System Program CPI (the creator signed this tx, so the System Program will debit them).
    transfer(
        CpiContext::new(
            System::id(),
            Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.angpao.to_account_info(),
            },
        ),
        total,
    )?;

    emit!(AngpaoCreated {
        angpao: ctx.accounts.angpao.key(),
        creator: ctx.accounts.creator.key(),
        total_lamports: total,
        num_packets: n as u8,
        expiry_ts: args.expiry_ts,
    });
    Ok(())
}
