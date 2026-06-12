use anchor_lang::prelude::*;

use crate::errors::GateError;
use crate::events::WinnerDrawn;
use crate::state::{Gate, NullifierRecord};

/// Operator selects a winning entry. The winner account proves the nullifier
/// was actually consumed on this gate. The draw stays mutable until the prize
/// is claimed, so the operator can correct a selection.
pub fn draw_winner_handler(ctx: Context<DrawWinner>) -> Result<()> {
    let gate = &mut ctx.accounts.gate;
    require!(!gate.prize_claimed, GateError::PrizeAlreadyClaimed);
    gate.winning_nullifier = Some(ctx.accounts.winner.nullifier);
    emit!(WinnerDrawn {
        gate: gate.key(),
        nullifier: ctx.accounts.winner.nullifier,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    #[account(mut, has_one = operator)]
    pub gate: Account<'info, Gate>,
    pub operator: Signer<'info>,
    /// Proof that this nullifier was actually consumed on this gate.
    #[account(constraint = winner.gate == gate.key() @ GateError::WinnerNotFromGate)]
    pub winner: Account<'info, NullifierRecord>,
}
