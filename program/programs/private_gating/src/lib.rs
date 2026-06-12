use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifyingkey;
use solana_sha256_hasher::hash;

declare_id!("HHvAWv65zH5gXBj6qdHQE1YJ3R9KE8wvtkX7pSwoViwZ");

#[program]
pub mod private_gating {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        let _ = hash(b"private-gating");
        Ok(())
    }
}

// Phase 1 link check: reference both syscall-backed crates so `anchor build`
// proves they compile and link against this exact Anchor/Agave toolchain.
// Real verification logic arrives in Phase 3.
#[allow(dead_code)]
fn groth16_link_check(vk: &Groth16Verifyingkey) -> usize {
    vk.nr_pubinputs
}

#[derive(Accounts)]
pub struct Initialize {}
