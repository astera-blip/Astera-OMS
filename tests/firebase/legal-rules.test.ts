import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { saveConsentRecord } from "@/lib/legal/repository";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-astera-oms",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("legal firestore rules", () => {
  it("allows anyone to read published legal document versions", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "legalDocumentVersions/terms-v1"), {
        title: "Member Terms",
        version: "v1",
        status: "published",
        content: "published terms",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "legalDocumentVersions/terms-v1")));
  });

  it("denies helper writes to legal document versions", async () => {
    const db = testEnv
      .authenticatedContext("helper-a", { role: "helper" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "legalDocumentVersions/terms-v1"), {
        title: "Member Terms",
        version: "v1",
        status: "published",
        content: "published terms",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("persists consent records for the signed-in member", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    const result = await saveConsentRecord(db as unknown as Firestore, "consent-a", {
      memberUid: "member-a",
      legalDocumentVersion: "terms-v1",
      consentedAt: "2026-07-26T12:00:00.000Z",
      contentSnapshot: "published terms",
    });

    const snapshot = await getDoc(doc(db, "consentRecords/consent-a"));

    expect(result).toEqual({ ok: true, consentId: "consent-a" });
    expect(snapshot.data()).toMatchObject({
      memberUid: "member-a",
      legalDocumentVersion: "terms-v1",
      consentedAt: "2026-07-26T12:00:00.000Z",
      contentSnapshot: "published terms",
    });
  });
});
