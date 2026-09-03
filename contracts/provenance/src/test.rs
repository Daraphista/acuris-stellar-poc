use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Bytes, BytesN, Env,
};

use crate::{Error, ProvenanceContract, ProvenanceContractClient, Status};

struct Fixture<'a> {
    env: Env,
    client: ProvenanceContractClient<'a>,
    admin: Address,
    registrar: Address,
    outsider: Address,
}

// Takes `env` by reference rather than owning it, so `client` (which borrows `env`) and the
// returned `Fixture` don't end up self-referential. Each test owns its `Env` locally and passes
// it in; `Fixture` keeps its own cheap clone alongside for convenience (`f.env.ledger()...`).
fn setup(env: &Env) -> Fixture<'_> {
    env.mock_all_auths();

    let contract_id = env.register(ProvenanceContract, ());
    let client = ProvenanceContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let registrar = Address::generate(env);
    let outsider = Address::generate(env);

    client.init(&admin);
    client.set_registrar(&admin, &registrar, &true);

    Fixture { env: env.clone(), client, admin, registrar, outsider }
}

fn hash_of(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn batch_id(env: &Env, s: &str) -> Bytes {
    Bytes::from_slice(env, s.as_bytes())
}

#[test]
fn init_sets_admin_and_is_callable_once() {
    let env = Env::default();
    let f = setup(&env);
    let result = f.client.try_init(&f.admin);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn only_admin_can_manage_registrar_allowlist() {
    let env = Env::default();
    let f = setup(&env);
    let result = f.client.try_set_registrar(&f.outsider, &f.registrar, &true);
    assert_eq!(result, Err(Ok(Error::NotAdmin)));
}

#[test]
fn register_happy_path_is_readable_by_hash_and_batch_id() {
    let env = Env::default();
    let f = setup(&env);
    let h = hash_of(&f.env, 1);
    let id = batch_id(&f.env, "batch-0001");
    let terms = Bytes::from_slice(&f.env, b"terms-v1");

    f.client.register(&f.registrar, &id, &h, &terms, &None);

    let record = f.client.get(&h);
    assert_eq!(record.batch_hash, h);
    assert_eq!(record.batch_id, id);
    assert_eq!(record.terms_ref, terms);
    assert_eq!(record.registrar, f.registrar);
    assert_eq!(record.status, Status::Active);
    assert_eq!(record.supersedes, None);
    assert_eq!(record.registered_at, f.env.ledger().timestamp());

    let by_id = f.client.get_by_batch_id(&id);
    assert_eq!(by_id.batch_hash, h);
}

#[test]
fn registered_at_is_ledger_time_not_caller_supplied() {
    // The contract signature has no caller-supplied timestamp parameter at all — this test
    // documents that guarantee structurally: registered_at can only ever come from the ledger.
    let env = Env::default();
    let f = setup(&env);
    f.env.ledger().set_timestamp(1_893_456_000); // 2030-01-01T00:00:00Z, arbitrary fixed value
    let h = hash_of(&f.env, 1);
    f.client
        .register(&f.registrar, &batch_id(&f.env, "b"), &h, &Bytes::from_slice(&f.env, b"t"), &None);
    assert_eq!(f.client.get(&h).registered_at, 1_893_456_000);
}

#[test]
fn unauthorized_registrar_is_rejected() {
    let env = Env::default();
    let f = setup(&env);
    let h = hash_of(&f.env, 1);
    let result = f.client.try_register(
        &f.outsider,
        &batch_id(&f.env, "batch-0001"),
        &h,
        &Bytes::from_slice(&f.env, b"terms-v1"),
        &None,
    );
    assert_eq!(result, Err(Ok(Error::NotAuthorizedRegistrar)));
}

#[test]
fn duplicate_batch_hash_is_rejected_not_overwritten() {
    let env = Env::default();
    let f = setup(&env);
    let h = hash_of(&f.env, 1);
    let terms = Bytes::from_slice(&f.env, b"terms-v1");
    f.client.register(&f.registrar, &batch_id(&f.env, "batch-0001"), &h, &terms, &None);

    let result = f.client.try_register(
        &f.registrar,
        &batch_id(&f.env, "batch-0001-retry"),
        &h,
        &terms,
        &None,
    );
    assert_eq!(result, Err(Ok(Error::DuplicateRecord)));
}

#[test]
fn supersession_marks_prior_record_superseded_and_keeps_it_readable() {
    let env = Env::default();
    let f = setup(&env);
    let terms = Bytes::from_slice(&f.env, b"terms-v1");
    let original = hash_of(&f.env, 1);
    let corrected = hash_of(&f.env, 2);
    let id = batch_id(&f.env, "batch-0001");

    f.client.register(&f.registrar, &id, &original, &terms, &None);
    f.client
        .register(&f.registrar, &id, &corrected, &terms, &Some(original.clone()));

    let prior = f.client.get(&original);
    assert_eq!(prior.status, Status::Superseded);

    let latest = f.client.get(&corrected);
    assert_eq!(latest.status, Status::Active);
    assert_eq!(latest.supersedes, Some(original));

    // get_by_batch_id resolves to the newest record in the chain.
    assert_eq!(f.client.get_by_batch_id(&id).batch_hash, corrected);
}

#[test]
fn supersedes_must_point_at_an_existing_record() {
    let env = Env::default();
    let f = setup(&env);
    let nonexistent = hash_of(&f.env, 99);
    let result = f.client.try_register(
        &f.registrar,
        &batch_id(&f.env, "batch-0002"),
        &hash_of(&f.env, 2),
        &Bytes::from_slice(&f.env, b"terms-v1"),
        &Some(nonexistent),
    );
    assert_eq!(result, Err(Ok(Error::SupersedesNotFound)));
}

#[test]
fn supersedes_must_point_at_an_active_record() {
    let env = Env::default();
    let f = setup(&env);
    let terms = Bytes::from_slice(&f.env, b"terms-v1");
    let original = hash_of(&f.env, 1);
    let corrected = hash_of(&f.env, 2);
    let id = batch_id(&f.env, "batch-0001");

    f.client.register(&f.registrar, &id, &original, &terms, &None);
    f.client.register(&f.registrar, &id, &corrected, &terms, &Some(original.clone()));
    // `original` is now Superseded. A second attempt to supersede it must fail closed.
    let result = f.client.try_register(
        &f.registrar,
        &batch_id(&f.env, "batch-0003"),
        &hash_of(&f.env, 3),
        &terms,
        &Some(original),
    );
    assert_eq!(result, Err(Ok(Error::SupersedesNotActive)));
}

#[test]
fn get_unknown_hash_fails_closed() {
    let env = Env::default();
    let f = setup(&env);
    let result = f.client.try_get(&hash_of(&f.env, 42));
    assert_eq!(result, Err(Ok(Error::RecordNotFound)));
}

#[test]
fn get_by_unknown_batch_id_fails_closed() {
    let env = Env::default();
    let f = setup(&env);
    let result = f.client.try_get_by_batch_id(&batch_id(&f.env, "no-such-batch"));
    assert_eq!(result, Err(Ok(Error::RecordNotFound)));
}

#[test]
fn revoke_is_admin_only_and_non_destructive() {
    let env = Env::default();
    let f = setup(&env);
    let h = hash_of(&f.env, 1);
    f.client.register(
        &f.registrar,
        &batch_id(&f.env, "batch-0001"),
        &h,
        &Bytes::from_slice(&f.env, b"terms-v1"),
        &None,
    );

    let unauthorized = f.client.try_revoke(&f.outsider, &h);
    assert_eq!(unauthorized, Err(Ok(Error::NotAdmin)));

    f.client.revoke(&f.admin, &h);
    let record = f.client.get(&h);
    assert_eq!(record.status, Status::Revoked);
}

#[test]
fn revoking_unknown_hash_fails_closed() {
    let env = Env::default();
    let f = setup(&env);
    let result = f.client.try_revoke(&f.admin, &hash_of(&f.env, 7));
    assert_eq!(result, Err(Ok(Error::RecordNotFound)));
}
