//! Cross-language parity check for docs/canonicalization.md.
//!
//! This module is a from-scratch Rust reimplementation of the same encoding rules
//! `packages/canonical` implements in TypeScript. It is deliberately independent — it does not
//! call into, wrap, or share code with the TS package. Both suites assert against the *same*
//! committed vector files (`fixtures/vectors/*.json`); a mismatch here means the two languages
//! have diverged on how a value gets turned into bytes before hashing, which is the single
//! largest technical risk this project's canonicalization spec exists to rule out.
//!
//! Test-only: gated behind `#[cfg(test)]` in lib.rs, so none of this — or its dependencies
//! (serde_json, unicode-normalization, sha2) — is compiled into the deployed contract wasm.
//! The deployed contract never computes a digest; it only stores one supplied by the caller
//! (see docs/canonicalization.md, "On-chain fields are out of scope for this document").

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::string::String;
use std::vec::Vec;
use unicode_normalization::UnicodeNormalization;

const DOMAIN_BATCH_MANIFEST: &str = "acuris.batch-manifest.v1";
const DOMAIN_SETTLEMENT: &str = "acuris.settlement.v1";

fn normalize_string(value: &str) -> String {
    let normalized: String = value.nfc().collect();
    for c in normalized.chars() {
        let cp = c as u32;
        assert!(
            !((0x00..=0x1F).contains(&cp) || cp == 0x7F),
            "control character in string: {value:?}"
        );
    }
    normalized
}

/// LP(value) = uint32_BE(byte_length(utf8(value))) || utf8(value)
fn length_prefixed(value: &str) -> Vec<u8> {
    let bytes = value.as_bytes();
    let len = u32::try_from(bytes.len()).expect("value too long to length-prefix with a u32");
    let mut out = Vec::with_capacity(4 + bytes.len());
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(bytes);
    out
}

fn digest(domain_tag: &str, canonical_bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(domain_tag.as_bytes());
    hasher.update([0x00]);
    hasher.update(canonical_bytes);
    hasher.finalize().into()
}

fn to_hex(bytes: &[u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for b in bytes {
        s.push_str(&std::format!("{:02x}", b));
    }
    s
}

#[derive(Deserialize)]
struct ManifestEntryVector {
    #[serde(rename = "relativePath")]
    relative_path: String,
    #[serde(rename = "sha256Hex")]
    sha256_hex: String,
}

#[derive(Deserialize)]
struct BatchManifestVector {
    name: String,
    entries: Vec<ManifestEntryVector>,
    expected_domain_tag: String,
    expected_digest_hex: String,
}

fn batch_hash(entries: &[ManifestEntryVector]) -> [u8; 32] {
    let mut normalized: Vec<(String, String)> = entries
        .iter()
        .map(|e| (normalize_string(&e.relative_path), e.sha256_hex.to_lowercase()))
        .collect();

    normalized.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));

    for w in normalized.windows(2) {
        assert_ne!(w[0].0, w[1].0, "duplicate relativePath in manifest: {}", w[0].0);
    }
    for (_, hex) in &normalized {
        assert!(
            hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()),
            "sha256Hex must be 64 lowercase hex chars: {hex}"
        );
    }

    let mut payload = Vec::new();
    for (path, hex) in &normalized {
        payload.extend(length_prefixed(path));
        payload.extend(length_prefixed(hex));
    }
    digest(DOMAIN_BATCH_MANIFEST, &payload)
}

#[derive(Deserialize)]
struct RevenueEventVector {
    #[serde(rename = "eventId")]
    event_id: String,
    source: String,
    #[serde(rename = "assetCode")]
    asset_code: String,
    #[serde(rename = "grossAmountMinor")]
    gross_amount_minor: serde_json::Value,
    #[serde(rename = "occurredAt")]
    occurred_at: String,
    #[serde(rename = "partnerRef")]
    partner_ref: String,
}

#[derive(Deserialize)]
struct SettlementVector {
    name: String,
    event: RevenueEventVector,
    expected_domain_tag: String,
    expected_digest_hex: String,
}

fn gross_amount_as_canonical_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => std::format!("{n}"),
        other => panic!("grossAmountMinor must be a string or number, got {other:?}"),
    }
}

fn settlement_digest(event: &RevenueEventVector) -> [u8; 32] {
    let event_id = normalize_string(&event.event_id);
    let source = normalize_string(&event.source);
    let asset_code = normalize_string(&event.asset_code);
    let gross_amount_minor = gross_amount_as_canonical_string(&event.gross_amount_minor);
    let occurred_at = event.occurred_at.clone(); // RFC3339 shape validated by the TS side / spec
    let partner_ref = normalize_string(&event.partner_ref);

    let mut payload = Vec::new();
    payload.extend(length_prefixed(&event_id));
    payload.extend(length_prefixed(&source));
    payload.extend(length_prefixed(&asset_code));
    payload.extend(length_prefixed(&gross_amount_minor));
    payload.extend(length_prefixed(&occurred_at));
    payload.extend(length_prefixed(&partner_ref));

    digest(DOMAIN_SETTLEMENT, &payload)
}

fn read_vector_file(filename: &str) -> String {
    let path = std::format!(
        "{}/../../fixtures/vectors/{}",
        env!("CARGO_MANIFEST_DIR"),
        filename
    );
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path}: {e}"))
}

#[test]
fn batch_manifest_vectors_match_fixtures() {
    let raw = read_vector_file("batch-manifest-vectors.json");
    let vectors: Vec<BatchManifestVector> =
        serde_json::from_str(&raw).expect("valid batch-manifest-vectors.json");
    assert!(!vectors.is_empty(), "vector file must not be empty");
    for v in &vectors {
        assert_eq!(v.expected_domain_tag, DOMAIN_BATCH_MANIFEST, "{}", v.name);
        let got = to_hex(&batch_hash(&v.entries));
        assert_eq!(got, v.expected_digest_hex, "vector {} diverged", v.name);
    }
}

#[test]
fn settlement_vectors_match_fixtures() {
    let raw = read_vector_file("settlement-vectors.json");
    let vectors: Vec<SettlementVector> =
        serde_json::from_str(&raw).expect("valid settlement-vectors.json");
    assert!(!vectors.is_empty(), "vector file must not be empty");
    for v in &vectors {
        assert_eq!(v.expected_domain_tag, DOMAIN_SETTLEMENT, "{}", v.name);
        let got = to_hex(&settlement_digest(&v.event));
        assert_eq!(got, v.expected_digest_hex, "vector {} diverged", v.name);
    }
}
