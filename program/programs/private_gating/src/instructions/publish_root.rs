use anchor_lang::prelude::*;

use crate::crypto::is_less_than_fr;
use crate::errors::GateError;
use crate::events::RootPublished;
use crate::state::{Gate, GateStatus};

/// Publish the snapshot's Merkle root; the gate becomes live.
pub fn publish_root_handler(
    ctx: Context<OperatorOnly>,
    root: [u8; 32],
    member_count: u32,
) -> Result<()> {
    require!(is_less_than_fr(&root), GateError::InvalidFieldElement);
    let gate = &mut ctx.accounts.gate;
    gate.merkle_root = root;
    gate.member_count = member_count;
    gate.snapshot_ts = Clock::get()?.unix_timestamp;
    gate.status = GateStatus::Live;
    emit!(RootPublished {
        gate: gate.key(),
        root,
        member_count,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct OperatorOnly<'info> {
    #[account(mut, has_one = operator)]
    pub gate: Account<'info, Gate>,
    pub operator: Signer<'info>,
}
