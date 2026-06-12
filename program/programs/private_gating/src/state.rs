//! On-chain account state and the enums they embed.

use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum GateType {
    TokenBalance,
    NftCollection,
    SybilAction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum GateStatus {
    Registering,
    Live,
}

#[account]
#[derive(InitSpace)]
pub struct Gate {
    pub operator: Pubkey,
    #[max_len(64)]
    pub label: String,
    pub gate_type: GateType,
    pub target: Pubkey,
    pub threshold: u64,
    pub merkle_root: [u8; 32],
    pub member_count: u32,
    pub snapshot_ts: i64,
    pub pass_count: u64,
    pub status: GateStatus,
    pub winning_nullifier: Option<[u8; 32]>,
    pub prize_claimed: bool,
    pub bump: u8,
}

impl Gate {
    pub const MAX_LABEL_LEN: usize = 64;
}

#[account]
#[derive(InitSpace)]
pub struct NullifierRecord {
    pub gate: Pubkey,
    pub nullifier: [u8; 32],
}
