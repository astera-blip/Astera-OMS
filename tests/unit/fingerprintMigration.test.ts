import { describe, expect, it, vi } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertHmacKeyNameForProject,
  buildSafeMigrationOutput,
  parseMigrationArgs,
  runFingerprintMigration,
  writeMigrationBackup,
} from "../../scripts/migrate-member-account-fingerprints.mjs";
import {
  buildExpiredRefundCleanupPlan,
  parseCleanupArgs,
} from "../../scripts/cleanup-refund-account-temp.mjs";
import {
  buildFingerprintKeyUsageReport,
  parseKeyUsageArgs,
} from "../../scripts/report-fingerprint-key-usage.mjs";

const validFingerprint = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const anotherValidFingerprint = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";

describe("member account fingerprint migration", () => {
  it("derives a fingerprint only for legacy records that still contain a full account", async () => {
    const deriveIdentity = vi.fn(async () => ({
      bankCode: "004",
      accountNumberLast5: "56789",
      accountFingerprint: validFingerprint,
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
        accountFingerprint: validFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
        verificationStatus: "verified",
      },
      deleteFields: ["accountNumberFull"],
    });
    expect(result.operations).toContainEqual({
      id: "account-last-five",
      action: "needsReverification",
      set: { verificationStatus: "needsReverification" },
      deleteFields: [],
    });
  });

  it.each(["inactive", "pendingDeletion", "archived"])(
    "preserves the %s lifecycle while marking legacy identity for re-verification",
    async (status) => {
      const result = await runFingerprintMigration({
        accounts: [{
          id: `account-${status}`,
          bankCode: "004",
          accountNumberLast5: "56789",
          status,
        }],
        payments: [],
        dryRun: true,
        deriveIdentity: vi.fn(),
      });

      expect(result.operations).toEqual([{
        id: `account-${status}`,
        action: "needsReverification",
        set: { verificationStatus: "needsReverification" },
        deleteFields: [],
      }]);
      expect(result.operations[0]?.set).not.toHaveProperty("status");
    },
  );

  it("removes legacy plaintext from an already fingerprinted record without replacing its identity", async () => {
    const deriveIdentity = vi.fn();
    const result = await runFingerprintMigration({
      accounts: [{
        id: "account-protected",
        bankCode: "004",
        accountNumberFull: "sensitive-full-account",
        accountNumberLast5: "56789",
        accountFingerprint: validFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 3,
        status: "pendingDeletion",
      }],
      payments: [],
      dryRun: true,
      deriveIdentity,
    });

    expect(deriveIdentity).not.toHaveBeenCalled();
    expect(result.operations).toEqual([{
      id: "account-protected",
      action: "removeLegacyPlaintext",
      set: {},
      deleteFields: ["accountNumberFull"],
    }]);
    expect(result.accountReport).toEqual([{
      id: "account-protected",
      status: "wouldRemoveLegacyPlaintext",
      fingerprintKeyVersion: 3,
    }]);
  });

  it("re-derives identity before deleting plaintext when existing fingerprint metadata is unusable", async () => {
    const deriveIdentity = vi.fn().mockResolvedValue({
      bankCode: "004",
      accountNumberLast5: "56789",
      accountFingerprint: anotherValidFingerprint,
      fingerprintAlgorithm: "HMAC-SHA-256",
      fingerprintKeyVersion: 7,
    });
    const result = await runFingerprintMigration({
      accounts: [{
        id: "account-invalid-fingerprint",
        bankCode: "004",
        accountNumberFull: "sensitive-full-account",
        accountNumberLast5: "56789",
        accountFingerprint: "legacy-unsupported-fingerprint",
        fingerprintAlgorithm: "SHA-256",
        fingerprintKeyVersion: 3,
        status: "active",
      }],
      payments: [],
      dryRun: true,
      deriveIdentity,
    });

    expect(deriveIdentity).toHaveBeenCalledOnce();
    expect(result.operations).toEqual([{
      id: "account-invalid-fingerprint",
      action: "deriveFingerprint",
      set: {
        bankCode: "004",
        accountNumberLast5: "56789",
        accountFingerprint: anotherValidFingerprint,
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
        verificationStatus: "verified",
      },
      deleteFields: ["accountNumberFull"],
    }]);
  });

  it("removes recognized non-string plaintext after backup and requires re-verification", async () => {
    const deriveIdentity = vi.fn();
    const result = await runFingerprintMigration({
      accounts: [{
        id: "account-invalid-unrecoverable",
        bankCode: "004",
        accountNumberFull: 123456789,
        accountNumberLast5: "56789",
        accountFingerprint: "not-canonical-base64",
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 3,
        status: "active",
      }],
      payments: [],
      dryRun: true,
      deriveIdentity,
    });

    expect(deriveIdentity).not.toHaveBeenCalled();
    expect(result.operations).toEqual([{
      id: "account-invalid-unrecoverable",
      action: "needsReverification",
      set: { verificationStatus: "needsReverification" },
      deleteFields: ["accountNumberFull"],
    }]);
  });

  it("does not delete plaintext when the newly derived identity is malformed", async () => {
    const result = await runFingerprintMigration({
      accounts: [{
        id: "account-invalid-derived",
        bankCode: "004",
        accountNumberFull: "00123456789",
        status: "active",
      }],
      payments: [],
      dryRun: true,
      deriveIdentity: vi.fn().mockResolvedValue({
        bankCode: "004",
        accountNumberLast5: "56789",
        accountFingerprint: "not-canonical-base64",
        fingerprintAlgorithm: "HMAC-SHA-256",
        fingerprintKeyVersion: 7,
      }),
    });

    expect(result.operations).toEqual([{
      id: "account-invalid-derived",
      action: "needsReverification",
      set: { verificationStatus: "needsReverification" },
      deleteFields: [],
    }]);
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
        accountFingerprint: validFingerprint,
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

  it("reports a payment snapshot with malformed fingerprint bytes for manual review", async () => {
    const result = await runFingerprintMigration({
      accounts: [],
      payments: [{
        id: "payment-malformed-fingerprint",
        memberPaymentAccount: {
          accountFingerprint: "not-canonical-base64",
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 7,
        },
      }],
      dryRun: true,
      deriveIdentity: vi.fn(),
    });

    expect(result.paymentSnapshotsForManualReview).toEqual([
      "payment-malformed-fingerprint",
    ]);
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
        accountFingerprint: validFingerprint,
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

  it("refuses to overwrite an existing rollback backup", async () => {
    const backupDir = resolve(
      ".local-backups",
      `fingerprint-test-${process.pid}-${Date.now()}`,
    );
    const backupFile = resolve(backupDir, "member-account-fingerprint-backup.json");
    await mkdir(backupDir, { recursive: true });
    await writeFile(backupFile, "original-backup\n", "utf8");
    try {
      await expect(writeMigrationBackup({
        accounts: [],
        payments: [],
      }, backupDir)).rejects.toMatchObject({ code: "EEXIST" });
      await expect(readFile(backupFile, "utf8")).resolves.toBe("original-backup\n");
    } finally {
      await rm(backupDir, { recursive: true, force: true });
    }
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
        {
          id: "account-1",
          accountFingerprint: validFingerprint,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 2,
          createdAt: "2026-01-03T00:00:00.000Z",
        },
        {
          id: "account-2",
          accountFingerprint: anotherValidFingerprint,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 2,
          createdAt: "2026-03-03T00:00:00.000Z",
        },
        { id: "account-unknown", createdAt: "2026-02-03T00:00:00.000Z" },
      ],
      payments: [
        {
          id: "payment-1",
          createdAt: "2026-02-03T00:00:00.000Z",
          memberPaymentAccount: {
            accountFingerprint: validFingerprint,
            fingerprintAlgorithm: "HMAC-SHA-256",
            fingerprintKeyVersion: 2,
          },
        },
        {
          id: "payment-2",
          createdAt: "2026-04-03T00:00:00.000Z",
          memberPaymentAccount: {
            accountFingerprint: anotherValidFingerprint,
            fingerprintAlgorithm: "HMAC-SHA-256",
            fingerprintKeyVersion: 3,
          },
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
    expect(JSON.stringify(report)).not.toContain(validFingerprint);
    expect(JSON.stringify(report)).not.toContain(anotherValidFingerprint);
  });

  it("classifies malformed identities separately and counts overdue references", () => {
    const report = buildFingerprintKeyUsageReport({
      memberAccounts: [
        {
          id: "account-overdue",
          accountFingerprint: validFingerprint,
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 2,
          createdAt: "2025-01-01T00:00:00.000Z",
          retentionExpiresAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "account-version-only",
          fingerprintKeyVersion: 3,
        },
        {
          id: "account-malformed-base64",
          accountFingerprint: "not-canonical-base64",
          fingerprintAlgorithm: "HMAC-SHA-256",
          fingerprintKeyVersion: 2,
        },
      ],
      payments: [
        {
          id: "payment-fingerprint-only",
          memberPaymentAccount: {
            accountFingerprint: "missing-version",
            fingerprintAlgorithm: "HMAC-SHA-256",
          },
        },
        {
          id: "payment-wrong-algorithm",
          memberPaymentAccount: {
            accountFingerprint: "private",
            fingerprintAlgorithm: "SHA-256",
            fingerprintKeyVersion: 4,
          },
        },
      ],
      knownKeyVersions: [2, 3, 4],
      generatedAt: "2026-08-04T00:00:00.000Z",
    });

    expect(report.versions).toEqual([
      expect.objectContaining({
        fingerprintKeyVersion: 2,
        memberAccountReferences: 1,
        paymentSnapshotReferences: 0,
        disposition: "retain",
      }),
      expect.objectContaining({
        fingerprintKeyVersion: 3,
        memberAccountReferences: 0,
        paymentSnapshotReferences: 0,
        disposition: "eligibleForEvaluation",
      }),
      expect.objectContaining({
        fingerprintKeyVersion: 4,
        memberAccountReferences: 0,
        paymentSnapshotReferences: 0,
        disposition: "eligibleForEvaluation",
      }),
    ]);
    expect(report.unclassifiedDocuments).toEqual({
      memberAccounts: ["account-version-only", "account-malformed-base64"],
      paymentSnapshots: ["payment-fingerprint-only", "payment-wrong-algorithm"],
    });
    expect(report.documentStatistics).toEqual({
      malformedMemberAccounts: 2,
      malformedPaymentSnapshots: 2,
      overdueMemberAccounts: 1,
      overduePaymentSnapshots: 0,
    });
    expect(JSON.stringify(report)).not.toContain(validFingerprint);
    expect(JSON.stringify(report)).not.toMatch(/missing-version|private/);
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
