use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::errors::GateError;
use crate::state::{Gate, GateStatus, GateType};

pub fn create_gate_handler(
    ctx: Context<CreateGate>,
    label_hash: [u8; 32],
    label: String,
    gate_type: GateType,
    target: Pubkey,
    threshold: u64,
) -> Result<()> {
    require!(label.len() <= Gate::MAX_LABEL_LEN, GateError::LabelTooLong);
    require!(threshold > 0, GateError::ZeroThreshold);
    // label_hash is a PDA seed; bind it to the actual label
    require!(
        hash(label.as_bytes()).to_bytes() == label_hash,
        GateError::LabelHashMismatch
    );
    let gate = &mut ctx.accounts.gate;
    gate.operator = ctx.accounts.operator.key();
    gate.label = label;
    gate.gate_type = gate_type;
    gate.target = target;
    gate.threshold = threshold;
    gate.merkle_root = [0u8; 32];
    gate.member_count = 0;
    gate.snapshot_ts = 0;
    gate.pass_count = 0;
    gate.status = GateStatus::Registering;
    gate.winning_nullifier = None;
    gate.prize_claimed = false;
    gate.bump = ctx.bumps.gate;
    Ok(())
}

#[derive(Accounts)]
#[instruction(label_hash: [u8; 32])]
pub struct CreateGate<'info> {
    #[account(
        init,
        payer = operator,
        space = 8 + Gate::INIT_SPACE,
        seeds = [b"gate", operator.key().as_ref(), label_hash.as_ref()],
        bump
    )]
    pub gate: Account<'info, Gate>,
    #[account(mut)]
    pub operator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
