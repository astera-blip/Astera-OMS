export type FingerprintIdentityLike = {
  accountFingerprint?: unknown;
  fingerprintAlgorithm?: unknown;
  fingerprintKeyVersion?: unknown;
};

export function isUsableFingerprintIdentity(
  value: FingerprintIdentityLike | null | undefined,
): boolean;
