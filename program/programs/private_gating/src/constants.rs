//! BN254 field constants and snarkjs public-signal indices.

/// BN254 scalar field modulus r, big-endian. Public signals live in this field.
pub const FR_MODULUS_BE: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58,
    0x5d, 0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00,
    0x00, 0x01,
];

/// Gate proof public signals, in snarkjs order (circuit outputs first):
/// `[nullifier, merkleRoot, threshold, gateId]`.
pub const SIG_NULLIFIER: usize = 0;
pub const SIG_ROOT: usize = 1;
pub const SIG_THRESHOLD: usize = 2;
pub const SIG_GATE_ID: usize = 3;

/// Claim proof public signals: `[nullifier, gateId, recipientHi, recipientLo]`.
pub const CLAIM_SIG_NULLIFIER: usize = 0;
pub const CLAIM_SIG_GATE_ID: usize = 1;
pub const CLAIM_SIG_RECIPIENT_HI: usize = 2;
pub const CLAIM_SIG_RECIPIENT_LO: usize = 3;
