//! Program error codes.

use anchor_lang::prelude::*;

#[error_code]
pub enum GateError {
    #[msg("label exceeds 64 bytes")]
    LabelTooLong,
    #[msg("label hash does not match label")]
    LabelHashMismatch,
    #[msg("nullifier seed does not match proof signal")]
    NullifierSeedMismatch,
    #[msg("threshold must be positive")]
    ZeroThreshold,
    #[msg("value is not a canonical BN254 field element")]
    InvalidFieldElement,
    #[msg("gate has no published snapshot root")]
    GateNotLive,
    #[msg("proof root does not match the published snapshot root")]
    RootMismatch,
    #[msg("proof threshold does not match the gate threshold")]
    ThresholdMismatch,
    #[msg("proof is bound to a different gate")]
    GateIdMismatch,
    #[msg("zero-knowledge proof verification failed")]
    InvalidProof,
    #[msg("nullifier record does not belong to this gate")]
    WinnerNotFromGate,
    #[msg("nullifier is not the drawn winner")]
    NotWinningNullifier,
    #[msg("recipient does not match the proof binding")]
    RecipientMismatch,
    #[msg("prize already claimed")]
    PrizeAlreadyClaimed,
    #[msg("prize pot is empty; fund the gate before claiming")]
    PrizePotEmpty,
}
