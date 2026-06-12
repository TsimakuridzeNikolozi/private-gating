pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Raffle-claim proof: I know the secret behind the winning nullifier.
 *
 * The payout recipient is bound into the proof as two 128-bit limbs of the
 * 32-byte Solana pubkey (a single field element cannot hold 256 bits without
 * reduction, since r ≈ 2^253.6). The program reconstructs the limbs from the
 * actual recipient account and rejects a mismatch, so a relayer or onlooker
 * cannot redirect the prize.
 *
 * Public signals: [nullifier, gateId, recipientHi, recipientLo]
 */
template Claim() {
    // public
    signal input nullifier;
    signal input gateId;
    signal input recipientHi;
    signal input recipientLo;

    // private
    signal input secret;

    component marker = Poseidon(2);
    marker.inputs[0] <== secret;
    marker.inputs[1] <== gateId;
    marker.out === nullifier;

    // range-check the limbs (also keeps these public inputs constrained)
    component hiBits = Num2Bits(128);
    hiBits.in <== recipientHi;
    component loBits = Num2Bits(128);
    loBits.in <== recipientLo;
}

component main {public [nullifier, gateId, recipientHi, recipientLo]} = Claim();
