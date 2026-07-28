pub mod create_profile;
pub mod create_contract;
pub mod submit_milestone;
pub mod approve_milestone;
pub mod reject_milestone;
pub mod raise_dispute;

// Re-export only the Accounts structs so lib.rs can reference them in Context<T>.
// Handler functions stay namespaced (e.g. `create_profile::handler`) to avoid
// ambiguous glob re-export warnings from the six identically-named `handler` fns.
pub use create_profile::CreateProfile;
pub use create_contract::CreateContract;
pub use submit_milestone::SubmitMilestone;
pub use approve_milestone::ApproveMilestone;
pub use reject_milestone::RejectMilestone;
pub use raise_dispute::RaiseDispute;
