import { describe, expect, it, vi } from "vitest";
import {
  assertHmacKeyNameForProject,
  buildSafeMigrationOutput,
  parseMigrationArgs,
  runFingerprintMigration,
} from "../../scripts/migrate-member-account-fingerprints.mjs";
import {
  buildExpiredRefundCleanupPlan,
  parseCleanupArgs,
} from "../../scripts/cleanup-refund-account-temp.mjs";
import {
  buildFingerprintKeyUsageReport,
  parseKeyUsageArgs,
} from "../../scripts/report-fingerprint-key-usage.mjs";

describe("member account fingerprint migration", () => {
  it("derives a fingerprint only for legacy records that still contain a full account", async () => {
    const deriveIdentity = vi.fn(async () => ({
      bankCode: "004",
      accountNumberLast5: "56789",
      accountFingerprint: "safe-fingerprint",
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    }));

    const result = await runFingerprintMigration({
      accounts: [
        {
          id: "account-full",
          bankCode: "004",
          accountNumberFull: "00123456789",
          status: "active",
        },
        {
          id: "account-last-five",
          bankCode: "812",
          accountNumberLast5: "43210",
          status: "active",
        },
      ],
      payments: [],
      dryRun: true,
      deriveIdentity,
    });

    expect(deriveIdentity).toHaveBeenCalledTimes(1);
    expect(result.operations).toContainEqual({
      id: "account-full",
      action: "deriveFingerprint",
      set: {
        bankCode: "004",
        accountNumberLast5: "56789",
        accountFingerprint: "safe-fingerprint",
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
      },
      deleteFields: ["accountNumberFull"],
    });
    expect(result.operations).toContainEqual({
      id: "account-last-five",
      action: "needsReverification",
      set: { status: "needsReverification" },
      deleteFields: [],
    });
  });

  it("keeps dry-run read-only and never includes full account input in its report", async () => {
    const backup = vi.fn();
    const update = vi.fn();
    const fullAccount = "00987654321";

    const result = await runFingerprintMigration({
      accounts: [{
        id: "account-1",
        bankCode: "004",
        accountNumberFull: fullAccount,
      }],
      payments: [{
        id: "payment-without-fingerprint",
        memberPaymentAccount: {
          bankCode: "004",
          accountNumberLast5: "54321",
        },
      }],
      dryRun: true,
      deriveIdentity: async () => ({
        bankCode: "004",
        accountNumberLast5: "54321",
        accountFingerprint: "safe-fingerprint",
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
      }),
      backup,
      update,
    });

    expect(backup).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result.paymentSnapshotsForManualReview).toEqual(["payment-without-fingerprint"]);
    expect(JSON.stringify(result)).not.toContain(fullAccount);
  });

  it("prints only IDs, operation status, key version, and statistics", () => {
    const output = buildSafeMigrationOutput({
      mode: "dry-run",
      accountReport: [{
        id: "account-1",
        status: "wouldDeriveFingerprint",
        fingerprintKeyVersion: 7,
      }],
      paymentSnapshotsForManualReview: ["payment-1"],
      operations: [{
        id: "account-1",
        action: "deriveFingerprint",
        set: {
          accountFingerprint: "sensitive-fingerprint",
          accountNumberLast5: "56789",
        },
        deleteFields: ["accountNumberFull"],
      }],
      immutablePaymentSnapshotsUpdated: 0,
    });

    expect(output).toEqual({
      mode: "dry-run",
      accountReport: [{
        id: "account-1",
        status: "wouldDeriveFingerprint",
        fingerprintKeyVersion: 7,
      }],
      paymentSnapshotsForManualReview: ["payment-1"],
      statistics: {
        accountOperations: 1,
        paymentSnapshotsForManualReview: 1,
        immutablePaymentSnapshotsUpdated: 0,
      },
    });
    expect(JSON.stringify(output)).not.toMatch(/sensitive-fingerprint|56789|accountNumberFull/);
  });

  it("backs up before applying account updates and never rewrites payment snapshots", async () => {
    const calls: string[] = [];
    const backup = vi.fn(async () => {
      calls.push("backup");
    });
    const update = vi.fn(async (operation: { id: string }) => {
      calls.push(`update:${operation.id}`);
    });

    await runFingerprintMigration({
      accounts: [{
        id: "account-1",
        bankCode: "004",
        accountNumberFull: "00123456789",
      }],
      payments: [{
        id: "payment-1",
        memberPaymentAccount: { bankCode: "004", accountNumberLast5: "56789" },
      }],
      dryRun: false,
      deriveIdentity: async () => ({
        bankCode: "004",
        accountNumberLast5: "56789",
        accountFingerprint: "safe-fingerprint",
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
      }),
      backup,
      update,
    });

    expect(calls).toEqual(["backup", "update:account-1"]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("defaults to dry-run and rejects a mismatched project confirmation", () => {
    expect(parseMigrationArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-prod",
    ])).toEqual(expect.objectContaining({
      project: "astera-oms-prod",
      dryRun: true,
    }));
    expect(() => parseMigrationArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-dev",
      "--apply",
    ])).toThrow("project_confirmation_mismatch");
  });

  it("accepts only a complete HMAC key resource in the confirmed project", () => {
    const keyName =
      "projects/astera-oms-prod/locations/global/keyRings/account/cryptoKeys/fingerprint";

    expect(assertHmacKeyNameForProject(keyName, "astera-oms-prod")).toBe(keyName);
    expect(() => assertHmacKeyNameForProject(
      keyName,
      "astera-oms-dev",
    )).toThrow("cloud_kms_mac_not_configured");
  });
});

describe("refund account expiry cleanup", () => {
  it("only targets expired ciphertext and preserves unrelated plaintext fields", () => {
    const plan = buildExpiredRefundCleanupPlan([
      {
        id: "expired",
        status: "pending",
        refundAccountCiphertext: "ciphertext",
        refundEncryptionKeyVersion: 4,
        refundAccountExpiresAt: "2026-08-01T00:00:00.000Z",
        ownerNote: "keep this",
      },
      {
        id: "future",
        status: "pending",
        refundAccountCiphertext: "ciphertext",
        refundEncryptionKeyVersion: 4,
        refundAccountExpiresAt: "2026-08-20T00:00:00.000Z",
      },
      {
        id: "unrelated-plaintext",
        status: "pending",
        legacyRefundAccountNumber: "do-not-delete",
        refundAccountExpiresAt: "2026-08-01T00:00:00.000Z",
      },
    ], new Date("2026-08-04T00:00:00.000Z"));

    expect(plan).toEqual([{
      id: "expired",
      set: { status: "needsReverification" },
      deleteFields: [
        "refundAccountCiphertext",
        "refundEncryptionKeyVersion",
        "refundAccountExpiresAt",
      ],
    }]);
  });

  it("requires exact project confirmation before cleanup can run", () => {
    expect(parseCleanupArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-prod",
    ])).toEqual({ project: "astera-oms-prod" });
    expect(() => parseCleanupArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "other-project",
    ])).toThrow("project_confirmation_mismatch");
  });
});

describe("monthly fingerprint key usage report", () => {
  it("counts member and payment references with earliest, latest, and unreferenced versions", () => {
    const report = buildFingerprintKeyUsageReport({
      memberAccounts: [
        { id: "account-1", fingerprintKeyVersion: 2, createdAt: "2026-01-03T00:00:00.000Z" },
        { id: "account-2", fingerprintKeyVersion: 2, createdAt: "2026-03-03T00:00:00.000Z" },
        { id: "account-unknown", createdAt: "2026-02-03T00:00:00.000Z" },
      ],
      payments: [
        {
          id: "payment-1",
          createdAt: "2026-02-03T00:00:00.000Z",
          memberPaymentAccount: { fingerprintKeyVersion: 2 },
        },
        {
          id: "payment-2",
          createdAt: "2026-04-03T00:00:00.000Z",
          memberPaymentAccount: { fingerprintKeyVersion: 3 },
        },
      ],
      knownKeyVersions: [1, 2, 3],
      generatedAt: "2026-08-04T00:00:00.000Z",
    });

    expect(report.versions).toEqual([
      {
        fingerprintKeyVersion: 1,
        memberAccountReferences: 0,
        paymentSnapshotReferences: 0,
        earliestReferenceAt: null,
        latestReferenceAt: null,
        disposition: "eligibleForEvaluation",
      },
      {
        fingerprintKeyVersion: 2,
        memberAccountReferences: 2,
        paymentSnapshotReferences: 1,
        earliestReferenceAt: "2026-01-03T00:00:00.000Z",
        latestReferenceAt: "2026-03-03T00:00:00.000Z",
        disposition: "retain",
      },
      {
        fingerprintKeyVersion: 3,
        memberAccountReferences: 0,
        paymentSnapshotReferences: 1,
        earliestReferenceAt: "2026-04-03T00:00:00.000Z",
        latestReferenceAt: "2026-04-03T00:00:00.000Z",
        disposition: "retain",
      },
    ]);
    expect(report.unclassifiedDocuments).toEqual({
      memberAccounts: ["account-unknown"],
      paymentSnapshots: [],
    });
    expect(report.autoDisabledVersions).toEqual([]);
  });

  it("requires an exact project confirmation", () => {
    expect(parseKeyUsageArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "astera-oms-prod",
    ])).toEqual({ project: "astera-oms-prod" });
    expect(() => parseKeyUsageArgs([
      "--project", "astera-oms-prod",
      "--confirm-project", "another-project",
    ])).toThrow("project_confirmation_mismatch");
  });
});
