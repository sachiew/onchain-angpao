use anchor_lang::prelude::*;

#[error_code]
pub enum AngpaoError {
    #[msg("All packets have been claimed")]
    SoldOut,
    #[msg("This angpao has expired")]
    Expired,
    #[msg("This angpao has not expired yet and still has packets left")]
    NotExpired,
    #[msg("This wallet has already claimed a packet")]
    AlreadyClaimed,
    #[msg("Packet amounts do not match the chosen split")]
    InvalidSplit,
    #[msg("Each packet must be at least 0.001 SOL")]
    PacketTooSmall,
    #[msg("Message is longer than 140 bytes")]
    MessageTooLong,
    #[msg("This angpao requires the gatekeeper's co-signature")]
    GatekeeperSignatureMissing,
    #[msg("Not allowed")]
    Unauthorized,
    #[msg("Packet count must be between 1 and 50")]
    InvalidPacketCount,
    #[msg("Expiry must be in the future and at most 7 days away")]
    InvalidExpiry,
    #[msg("Invalid gate configuration")]
    GateConfig,
    #[msg("Invalid theme")]
    InvalidTheme,
    #[msg("Invalid fiat currency code")]
    InvalidFiatCode,
    #[msg("Allowlist is full")]
    AllowlistFull,
    #[msg("Claims have already started")]
    ClaimsStarted,
    #[msg("Arithmetic overflow")]
    Overflow,
}
