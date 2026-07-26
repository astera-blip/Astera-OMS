import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { saveProductWithVariants } from "@/lib/product/repository";

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

describe("public product firestore rules", () => {
  it("allows unauthenticated reads of public product projections", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "productsPublic/product-a"), {
        id: "product-a",
        name: "Stray Kids Light Stick",
        slug: "skz-light-stick",
        status: "active",
        defaultVariantName: "Default",
        defaultVariantSku: "skz-light-stick-default",
      });
    });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "productsPublic/product-a")));
  });

  it("persists a public projection through the product repository", async () => {
    const db = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    const result = await saveProductWithVariants(
      db as unknown as Firestore,
      {
        product: {
          name: "Stray Kids Light Stick",
          slug: "skz-light-stick",
          status: "active",
        },
        variants: [],
      },
    );

    expect(result).toEqual({
      ok: true,
      productId: "skz-light-stick",
      variantId: "skz-light-stick-default",
      product: expect.objectContaining({
        id: "skz-light-stick",
        name: "Stray Kids Light Stick",
        slug: "skz-light-stick",
        status: "active",
        defaultVariantName: "Default",
        defaultVariantSku: "skz-light-stick-default",
      }),
    });
  });
});
