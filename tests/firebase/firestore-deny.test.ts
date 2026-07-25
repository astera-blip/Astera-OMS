import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

describe("Day 1 Firestore rules", () => {
  it("deny unauthenticated reads", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "members/example")));
  });

  it("deny authenticated writes until role-aware rules exist", async () => {
    const db = testEnv.authenticatedContext("member-a").firestore();

    await assertFails(
      setDoc(doc(db, "members/member-a"), {
        displayName: "Example",
      }),
    );
  });
});
