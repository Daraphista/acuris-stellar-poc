use soroban_sdk::{contracterror, contracttype, Address, Bytes, BytesN};

/// Lifecycle status of a provenance record. See docs/authorization.md for the transition rules.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Active,
    Superseded,
    Revoked,
}

/// A single provenance record: a batch's content digest plus non-identifying metadata.
/// No field here ever holds patient-identifiable content — see docs/privacy-model.md.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Record {
    /// Opaque, Acuris-assigned identifier. Must not encode patient counts or visit dates.
    pub batch_id: Bytes,
    /// SHA-256 digest of the canonical batch manifest (docs/canonicalization.md). Never the
    /// manifest or file contents themselves.
    pub batch_hash: BytesN<32>,
    /// Reference to (or digest of) the usage-rights/terms document, not its content.
    pub terms_ref: Bytes,
    /// Ledger time at registration, set by the contract via `env.ledger().timestamp()`.
    /// Never caller-supplied — a registrar cannot backdate a record.
    pub registered_at: u64,
    /// The Stellar address that submitted this registration.
    pub registrar: Address,
    /// If this record corrects an earlier one, the prior record's `batch_hash`. The prior
    /// record is marked `Superseded`, never deleted or overwritten — history is append-only.
    pub supersedes: Option<BytesN<32>>,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The single admin address. Set once at `init`, immutable thereafter (see
    /// docs/authorization.md — admin rotation is explicit future work, not in this version).
    Admin,
    /// Allow-list entry: is `Address` currently permitted to call `register`?
    Registrar(Address),
    /// Primary record storage, keyed by content digest.
    RecordByHash(BytesN<32>),
    /// Secondary index: latest `batch_hash` registered under a given `batch_id`, so
    /// `get_by_batch_id` can resolve to the current record without an off-chain indexer.
    HashByBatchId(Bytes),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    NotAuthorizedRegistrar = 4,
    DuplicateRecord = 5,
    RecordNotFound = 6,
    SupersedesNotFound = 7,
    SupersedesNotActive = 8,
}
