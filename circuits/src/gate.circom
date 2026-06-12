pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Merkle inclusion proof with Poseidon(2) nodes.
 * pathIndices[i] is the position bit of the current node at level i:
 * 0 = current node is the left child, 1 = right child.
 */
template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component hashers[depth];
    signal cur[depth + 1];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // force each index to be a bit
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon(2);
        // bit = 0 -> (cur, sibling); bit = 1 -> (sibling, cur)
        hashers[i].inputs[0] <== cur[i] + pathIndices[i] * (pathElements[i] - cur[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);
        cur[i + 1] <== hashers[i].out;
    }

    root <== cur[depth];
}

/*
 * The single proof behind every gate type:
 *   1. My leaf Poseidon(Poseidon(secret), attribute) is in the published tree.
 *   2. attribute >= threshold (both range-bound to 64 bits).
 *   3. nullifier == Poseidon(secret, gateId) — the one-time, unlinkable marker.
 *
 * Public signals (snarkjs order — outputs first, then declared public inputs):
 *   [nullifier, merkleRoot, threshold, gateId]
 */
template Gate(depth) {
    // public
    signal input merkleRoot;
    signal input threshold;
    signal input gateId;

    // private
    signal input secret;
    signal input attribute;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal output nullifier;

    // commitment and leaf
    component commitment = Poseidon(1);
    commitment.inputs[0] <== secret;

    component leaf = Poseidon(2);
    leaf.inputs[0] <== commitment.out;
    leaf.inputs[1] <== attribute;

    // membership in the snapshot tree
    component tree = MerkleInclusion(depth);
    tree.leaf <== leaf.out;
    for (var i = 0; i < depth; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === merkleRoot;

    // range-bound both sides so the u64 comparison is sound in the field
    component attributeBits = Num2Bits(64);
    attributeBits.in <== attribute;
    component thresholdBits = Num2Bits(64);
    thresholdBits.in <== threshold;

    // attribute >= threshold
    component ge = GreaterEqThan(64);
    ge.in[0] <== attribute;
    ge.in[1] <== threshold;
    ge.out === 1;

    // one-time marker, derived from the secret so even the snapshot service
    // (which knows commitments) cannot link it to a member
    component marker = Poseidon(2);
    marker.inputs[0] <== secret;
    marker.inputs[1] <== gateId;
    nullifier <== marker.out;
}

component main {public [merkleRoot, threshold, gateId]} = Gate(20);
