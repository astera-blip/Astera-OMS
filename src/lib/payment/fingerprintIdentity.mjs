const CANONICAL_HMAC_SHA_256_BASE64 =
  /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

export function isUsableFingerprintIdentity(value) {
  return Boolean(
    value
    && typeof value.accountFingerprint === "string"
    && CANONICAL_HMAC_SHA_256_BASE64.test(value.accountFingerprint)
    && value.fingerprintAlgorithm === "HMAC-SHA-256"
    && Number.isSafeInteger(value.fingerprintKeyVersion)
    && value.fingerprintKeyVersion > 0
  );
}
