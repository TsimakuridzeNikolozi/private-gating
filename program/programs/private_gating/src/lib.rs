use anchor_lang::prelude::*;

pub mod constants;
pub mod crypto;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
mod verifying_keys;

pub use instructions::*;
pub use state::*;

declare_id!("HHvAWv65zH5gXBj6qdHQE1YJ3R9KE8wvtkX7pSwoViwZ");

#[program]
pub mod private_gating {
    use super::*;

    pub fn create_gate(
        ctx: Context<CreateGate>,
        label_hash: [u8; 32],
        label: String,
        gate_type: GateType,
        target: Pubkey,
        threshold: u64,
    ) -> Result<()> {
        crate::instructions::create_gate::create_gate_handler(
            ctx, label_hash, label, gate_type, target, threshold,
        )
    }

    /// Publish the snapshot's Merkle root; the gate becomes live.
    pub fn publish_root(
        ctx: Context<OperatorOnly>,
        root: [u8; 32],
        member_count: u32,
    ) -> Result<()> {
        crate::instructions::publish_root::publish_root_handler(ctx, root, member_count)
    }

    /// Verify a gate proof and consume its nullifier. The only signer is the
    /// relayer (fee payer); the proof itself is the authorization.
    pub fn verify_and_pass(
        ctx: Context<VerifyAndPass>,
        nullifier: [u8; 32],
        proof: [u8; 256],
        public_signals: [[u8; 32]; 4],
    ) -> Result<()> {
        crate::instructions::verify_and_pass::verify_and_pass_handler(
            ctx,
            nullifier,
            proof,
            public_signals,
        )
    }

    /// Operator selects a winning entry from the consumed nullifiers.
    pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
        crate::instructions::draw_winner::draw_winner_handler(ctx)
    }

    /// Claim the prize by proving knowledge of the secret behind the winning
    /// nullifier; the recipient is bound inside the proof.
    pub fn claim_prize(
        ctx: Context<ClaimPrize>,
        proof: [u8; 256],
        public_signals: [[u8; 32]; 4],
    ) -> Result<()> {
        crate::instructions::claim_prize::claim_prize_handler(ctx, proof, public_signals)
    }
}
