//! One module per instruction: each holds its `Accounts` context and a
//! `handler` the thin `#[program]` entrypoints in `lib.rs` delegate to.
//!
//! The glob re-exports lift each context struct — and the helper modules the
//! `#[derive(Accounts)]` macro generates beside it — to the crate root, where
//! the `#[program]` macro expects to find them. (Each module's `handler` is
//! reached by full path, so the duplicated name is never referenced bare.)

pub mod claim_prize;
pub mod create_gate;
pub mod draw_winner;
pub mod publish_root;
pub mod verify_and_pass;

pub use claim_prize::*;
pub use create_gate::*;
pub use draw_winner::*;
pub use publish_root::*;
pub use verify_and_pass::*;
