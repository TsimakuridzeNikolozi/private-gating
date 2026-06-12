use anchor_lang::prelude::*;

use crate::constants::{
    CLAIM_SIG_GATE_ID, CLAIM_SIG_NULLIFIER, CLAIM_SIG_RECIPIENT_HI, CLAIM_SIG_RECIPIENT_LO,
};
use crate::crypto::{gate_id_for, limb_matches, verify_groth16};
use crate::errors::GateError;
use crate::events::PrizeClaimed;
use crate::state::Gate;
use crate::verifying_keys::CLAIM_VERIFYING_KEY;

/// Claim the prize by proving knowledge of the secret behind the winning
/// nullifier. The recipient is bound inside the proof (two 128-bit limbs of the
/// pubkey), so the relayer that submits this cannot redirect it.
pub fn claim_prize_handler(
    ctx: Context<ClaimPrize>,
    proof: [u8; 256],
    public_signals: [[u8; 32]; 4],
) -> Result<()> {
    let gate = &mut ctx.accounts.gate;
    require!(!gate.prize_claimed, GateError::PrizeAlreadyClaimed);
    require!(
        gate.winning_nullifier == Some(public_signals[CLAIM_SIG_NULLIFIER]),
        GateError::NotWinningNullifier
    );
    require!(
        public_signals[CLAIM_SIG_GATE_ID] == gate_id_for(&gate.key()),
        GateError::GateIdMismatch
    );

    let recipient_key = ctx.accounts.recipient.key().to_bytes();
    require!(
        limb_matches(&public_signals[CLAIM_SIG_RECIPIENT_HI], &recipient_key[0..16])
            && limb_matches(&public_signals[CLAIM_SIG_RECIPIENT_LO], &recipient_key[16..32]),
        GateError::RecipientMismatch
    );

    verify_groth16(&proof, &public_signals, &CLAIM_VERIFYING_KEY)?;

    // Pay out everything above the gate account's rent-exempt minimum. Refuse a
    // claim against an unfunded pot: `prize_claimed` is a one-way latch, so a
    // claim that landed before the operator funded the gate would otherwise
    // burn the winner's entitlement and block every later top-up.
    let gate_info = gate.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(gate_info.data_len());
    let prize = gate_info.lamports().saturating_sub(rent_min);
    require!(prize > 0, GateError::PrizePotEmpty);

    gate.prize_claimed = true;
    **gate_info.try_borrow_mut_lamports()? -= prize;
    **ctx.accounts.recipient.try_borrow_mut_lamports()? += prize;

    emit!(PrizeClaimed {
        gate: gate.key(),
        nullifier: public_signals[CLAIM_SIG_NULLIFIER],
        recipient: ctx.accounts.recipient.key(),
        lamports: prize,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub gate: Account<'info, Gate>,
    /// CHECK: any account may receive the prize; it is bound inside the proof.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// The relayer — pays the fee only.
    pub payer: Signer<'info>,
}
