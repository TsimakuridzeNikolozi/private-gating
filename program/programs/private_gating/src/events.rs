//! Emitted events. Clients index these to follow gate lifecycle off-chain.

use anchor_lang::prelude::*;

#[event]
pub struct RootPublished {
    pub gate: Pubkey,
    pub root: [u8; 32],
    pub member_count: u32,
}

#[event]
pub struct Passed {
    pub gate: Pubkey,
    pub nullifier: [u8; 32],
    pub pass_count: u64,
}

#[event]
pub struct WinnerDrawn {
    pub gate: Pubkey,
    pub nullifier: [u8; 32],
}

#[event]
pub struct PrizeClaimed {
    pub gate: Pubkey,
    pub nullifier: [u8; 32],
    pub recipient: Pubkey,
    pub lamports: u64,
}
