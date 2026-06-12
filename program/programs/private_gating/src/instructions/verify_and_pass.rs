use anchor_lang::prelude::*;

use crate::constants::{SIG_GATE_ID, SIG_NULLIFIER, SIG_ROOT, SIG_THRESHOLD};
use crate::crypto::{gate_id_for, u64_to_be32, verify_groth16};
use crate::errors::GateError;
use crate::events::Passed;
use crate::state::{Gate, GateStatus, NullifierRecord};
use crate::verifying_keys::GATE_VERIFYING_KEY;

/// Verify a gate proof and consume its nullifier.
///
/// The only signer is the fee payer (the relayer) — the holder's wallet never
/// appears in this transaction. The proof itself is the authorization:
/// membership in the published tree, attribute >= threshold, and a correctly
/// derived one-time nullifier.
pub fn verify_and_pass_handler(
    ctx: Context<VerifyAndPass>,
    nullifier: [u8; 32],
    proof: [u8; 256],
    public_signals: [[u8; 32]; 4],
) -> Result<()> {
    let gate = &mut ctx.accounts.gate;
    require!(gate.status == GateStatus::Live, GateError::GateNotLive);
    // SECURITY INVARIANT: the nullifier PDA seed (the `nullifier` arg) must be
    // exactly the proof's verified nullifier signal — otherwise a valid proof
    // could be replayed under an arbitrary unused seed.
    require!(
        nullifier == public_signals[SIG_NULLIFIER],
        GateError::NullifierSeedMismatch
    );
    require!(
        public_signals[SIG_ROOT] == gate.merkle_root,
        GateError::RootMismatch
    );
    require!(
        public_signals[SIG_THRESHOLD] == u64_to_be32(gate.threshold),
        GateError::ThresholdMismatch
    );
    require!(
        public_signals[SIG_GATE_ID] == gate_id_for(&gate.key()),
        GateError::GateIdMismatch
    );

    verify_groth16(&proof, &public_signals, &GATE_VERIFYING_KEY)?;

    // The PDA's seed is public_signals[SIG_NULLIFIER] itself (enforced by the
    // account constraint), so a verified proof can only ever consume its own
    // nullifier — and `init` fails on reuse.
    let record = &mut ctx.accounts.nullifier_record;
    record.gate = gate.key();
    record.nullifier = public_signals[SIG_NULLIFIER];

    gate.pass_count = gate.pass_count.checked_add(1).unwrap();
    emit!(Passed {
        gate: gate.key(),
        nullifier: public_signals[SIG_NULLIFIER],
        pass_count: gate.pass_count,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct VerifyAndPass<'info> {
    #[account(mut)]
    pub gate: Account<'info, Gate>,
    /// Replay protection: seeded by the proof's own nullifier signal (the
    /// handler requires nullifier == public_signals[SIG_NULLIFIER]).
    #[account(
        init,
        payer = payer,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [b"nullifier", gate.key().as_ref(), nullifier.as_ref()],
        bump
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,
    /// The relayer — pays fees and rent; carries no authorization meaning.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
