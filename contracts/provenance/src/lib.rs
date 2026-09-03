#![no_std]

#[cfg(test)]
extern crate std;

mod types;
pub use types::{DataKey, Error, Record, Status};

#[cfg(test)]
mod canonical_check;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env};

/// ~5s per ledger close on Testnet/Mainnet; used only to size TTL extensions below.
const LEDGERS_PER_DAY: u32 = 17_280;
/// Extend a storage entry's TTL out to ~30 days from now on every write that touches it —
/// matched to this Instaward's engagement window. Re-extending on write (rather than once at
/// creation) keeps actively-referenced records alive for as long as they're being used.
const TTL_EXTEND_TO: u32 = LEDGERS_PER_DAY * 30;
/// Trigger the extension once remaining TTL drops below ~7 days, rather than on every single
/// write, to avoid unnecessary ledger churn.
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 7;

#[contract]
pub struct ProvenanceContract;

#[contractimpl]
impl ProvenanceContract {
    /// Set the admin address. Callable exactly once; every later call fails closed.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// Admin-only: add or remove `registrar` from the allow-list that `register` checks.
    pub fn set_registrar(
        env: Env,
        admin: Address,
        registrar: Address,
        allowed: bool,
    ) -> Result<(), Error> {
        Self::require_admin(&env, &admin)?;
        env.storage()
            .instance()
            .set(&DataKey::Registrar(registrar), &allowed);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// Registrar-only: register a new provenance record. Fails closed on a duplicate
    /// `batch_hash` rather than overwriting — see docs/authorization.md, "Duplicate and
    /// revision handling". If `supersedes` is set, the prior Active record transitions to
    /// Superseded; it is never deleted.
    pub fn register(
        env: Env,
        registrar: Address,
        batch_id: Bytes,
        batch_hash: BytesN<32>,
        terms_ref: Bytes,
        supersedes: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        registrar.require_auth();
        let is_allowed: bool = env
            .storage()
            .instance()
            .get(&DataKey::Registrar(registrar.clone()))
            .unwrap_or(false);
        if !is_allowed {
            return Err(Error::NotAuthorizedRegistrar);
        }

        let record_key = DataKey::RecordByHash(batch_hash.clone());
        if env.storage().persistent().has(&record_key) {
            return Err(Error::DuplicateRecord);
        }

        if let Some(prior_hash) = supersedes.clone() {
            let prior_key = DataKey::RecordByHash(prior_hash);
            let mut prior: Record = env
                .storage()
                .persistent()
                .get(&prior_key)
                .ok_or(Error::SupersedesNotFound)?;
            if prior.status != Status::Active {
                return Err(Error::SupersedesNotActive);
            }
            prior.status = Status::Superseded;
            env.storage().persistent().set(&prior_key, &prior);
            env.storage()
                .persistent()
                .extend_ttl(&prior_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        }

        let record = Record {
            batch_id: batch_id.clone(),
            batch_hash: batch_hash.clone(),
            terms_ref,
            registered_at: env.ledger().timestamp(),
            registrar,
            supersedes,
            status: Status::Active,
        };
        env.storage().persistent().set(&record_key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&record_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        let batch_id_key = DataKey::HashByBatchId(batch_id);
        env.storage().persistent().set(&batch_id_key, &batch_hash);
        env.storage()
            .persistent()
            .extend_ttl(&batch_id_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    /// Public, unauthenticated read: fetch a record by its content digest.
    pub fn get(env: Env, batch_hash: BytesN<32>) -> Result<Record, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::RecordByHash(batch_hash))
            .ok_or(Error::RecordNotFound)
    }

    /// Public, unauthenticated read: resolve `batch_id` to its most recently registered
    /// `batch_hash`, then fetch that record. If the batch was corrected, this returns the
    /// newest record in the `supersedes` chain, not necessarily an Active one — callers that
    /// care should check `.status`.
    pub fn get_by_batch_id(env: Env, batch_id: Bytes) -> Result<Record, Error> {
        let hash: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::HashByBatchId(batch_id))
            .ok_or(Error::RecordNotFound)?;
        Self::get(env, hash)
    }

    /// Admin-only: mark a record Revoked. Non-destructive — `get` still returns it.
    pub fn revoke(env: Env, admin: Address, batch_hash: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(&env, &admin)?;
        let key = DataKey::RecordByHash(batch_hash);
        let mut record: Record = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::RecordNotFound)?;
        record.status = Status::Revoked;
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if admin != *caller {
            return Err(Error::NotAdmin);
        }
        caller.require_auth();
        Ok(())
    }
}
