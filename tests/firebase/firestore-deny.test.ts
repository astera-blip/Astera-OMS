import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { saveMemberProfile } from "@/lib/member/repository";

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

describe("Day 1 Firestore rules", () => {
  it("deny unauthenticated reads", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "members/example")));
  });

  it("allows a member to create and read their own valid profile", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "members/member-a"), {
        uid: "member-a",
        email: "member@example.com",
        displayName: "Example Member",
        communityId: "example-01",
        mobilePhone: "0912345678",
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(getDoc(doc(db, "members/member-a")));
  });

  it("denies reading another member profile", async () => {
    const db = testEnv.authenticatedContext("member-a").firestore();

    await assertFails(getDoc(doc(db, "members/member-b")));
  });

  it("denies profile fields that belong in private member data", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "members/member-a"), {
        uid: "member-a",
        email: "member@example.com",
        displayName: "Example Member",
        communityId: "example-01",
        mobilePhone: "0912345678",
        riskState: "normal",
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies changing profile ownership", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "members/member-a"), {
        uid: "member-b",
        email: "member@example.com",
        displayName: "Example Member",
        communityId: "example-01",
        mobilePhone: "0912345678",
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies using an email that does not match the auth token", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "members/member-a"), {
        uid: "member-a",
        email: "other@example.com",
        displayName: "Example Member",
        communityId: "example-01",
        mobilePhone: "0912345678",
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("persists a normalized profile through the member repository", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();

    const result = await saveMemberProfile(
      db as unknown as Firestore,
      { uid: "member-a", email: "member@example.com" },
      {
        displayName: "  Example Member  ",
        communityId: "  example-01  ",
        mobilePhone: "+886 912-345-678",
        birthday: "",
      },
    );

    const snapshot = await getDoc(doc(db, "members/member-a"));

    expect(result).toEqual({ ok: true });
    expect(snapshot.data()).toMatchObject({
      uid: "member-a",
      email: "member@example.com",
      displayName: "Example Member",
      communityId: "example-01",
      mobilePhone: "0912345678",
    });
    expect(snapshot.data()).not.toHaveProperty("birthday");
  });

  it("updates only editable profile fields through the member repository", async () => {
    const db = testEnv
      .authenticatedContext("member-a", { email: "member@example.com" })
      .firestore();
    const firestore = db as unknown as Firestore;

    await saveMemberProfile(
      firestore,
      { uid: "member-a", email: "member@example.com" },
      {
        displayName: "Original Name",
        communityId: "original-id",
        mobilePhone: "0912345678",
        birthday: "",
      },
    );
    const before = await getDoc(doc(db, "members/member-a"));

    const result = await saveMemberProfile(
      firestore,
      { uid: "member-a", email: "member@example.com" },
      {
        displayName: "Updated Name",
        communityId: "updated-id",
        mobilePhone: "0987654321",
        birthday: "1995-09-20",
      },
    );
    const after = await getDoc(doc(db, "members/member-a"));

    expect(result).toEqual({ ok: true });
    expect(after.data()).toMatchObject({
      uid: "member-a",
      email: "member@example.com",
      displayName: "Updated Name",
      communityId: "updated-id",
      mobilePhone: "0987654321",
      birthday: "1995-09-20",
    });
    expect(after.data()?.createdAt).toEqual(before.data()?.createdAt);
    expect(after.data()?.completedAt).toEqual(before.data()?.completedAt);
  });

  it("allows owner reads but denies helper access to another member", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "members/member-a"), {
        uid: "member-a",
      });
    });

    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const helperDb = testEnv
      .authenticatedContext("helper-a", { role: "helper" })
      .firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "members/member-a")));
    await assertFails(getDoc(doc(helperDb, "members/member-a")));
  });
});
