//! Program-internal cryptography: Groth16 verification, gateId derivation, and
//! big-endian field-element arithmetic over the BN254 scalar field.

use anchor_lang::prelude::*;
use groth16_solana::groth16::{Groth16Verifier, Groth16Verifyingkey};
use solana_sha256_hasher::hash;

use crate::constants::FR_MODULUS_BE;
use crate::errors::GateError;

/// Verify a 256-byte Groth16 proof (A‖B‖C) against `vk` and 4 public signals.
///
/// `verify()` (not `verify_unchecked`) is used deliberately: it rejects any
/// public signal >= r, which is what blocks a `signal + r` malleability replay
/// on the nullifier (the only signal whose value is not pinned to an on-chain
/// constant).
pub fn verify_groth16(
    proof: &[u8; 256],
    public_signals: &[[u8; 32]; 4],
    vk: &Groth16Verifyingkey,
) -> Result<()> {
    // Proof A arrives pre-negated from the client (shared/encoding.ts).
    let proof_a: &[u8; 64] = proof[0..64].try_into().unwrap();
    let proof_b: &[u8; 128] = proof[64..192].try_into().unwrap();
    let proof_c: &[u8; 64] = proof[192..256].try_into().unwrap();
    let mut verifier = Groth16Verifier::new(proof_a, proof_b, proof_c, public_signals, vk)
        .map_err(|_| error!(GateError::InvalidProof))?;
    verifier.verify().map_err(|_| error!(GateError::InvalidProof))
}

/// gateId = sha256(gate pubkey) reduced into the BN254 scalar field, BE.
/// Mirrors gateIdFromPubkey in packages/shared.
pub fn gate_id_for(gate: &Pubkey) -> [u8; 32] {
    let mut h = hash(gate.as_ref()).to_bytes();
    while !is_less_than_fr(&h) {
        be_sub_in_place(&mut h, &FR_MODULUS_BE);
    }
    h
}

/// Canonical-field-element check: `a < r` as a 32-byte big-endian integer.
pub fn is_less_than_fr(a: &[u8; 32]) -> bool {
    for i in 0..32 {
        if a[i] != FR_MODULUS_BE[i] {
            return a[i] < FR_MODULUS_BE[i];
        }
    }
    false
}

/// In-place big-endian subtraction `a -= b`; the caller guarantees `a >= b`.
fn be_sub_in_place(a: &mut [u8; 32], b: &[u8; 32]) {
    let mut borrow = 0i16;
    for i in (0..32).rev() {
        let d = a[i] as i16 - b[i] as i16 - borrow;
        if d < 0 {
            a[i] = (d + 256) as u8;
            borrow = 1;
        } else {
            a[i] = d as u8;
            borrow = 0;
        }
    }
}

/// Encode a u64 as a 32-byte big-endian field element.
pub fn u64_to_be32(v: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&v.to_be_bytes());
    out
}

/// A 128-bit limb signal must be zero-padded in its top 16 bytes and match the
/// corresponding half of the recipient pubkey in its low 16 bytes.
pub fn limb_matches(signal: &[u8; 32], pubkey_half: &[u8]) -> bool {
    signal[0..16] == [0u8; 16] && &signal[16..32] == pubkey_half
}
