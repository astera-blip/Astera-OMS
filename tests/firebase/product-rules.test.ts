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

describe("product firestore rules", () => {
  it("denies unauthenticated product reads", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "products/product-a")));
  });

  it("allows the owner to create a product with its default variant", async () => {
    const db = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, "products/product-a"), {
        name: "Stray Kids Light Stick",
        slug: "skz-light-stick",
        status: "draft",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, "productVariants/variant-a"), {
        productId: "product-a",
        name: "Default",
        sku: "product-a-default",
        isDefault: true,
        isSellable: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(getDoc(doc(db, "products/product-a")));
  });

  it("denies helper access to product master data", async () => {
    const db = testEnv
      .authenticatedContext("helper-a", { role: "helper" })
      .firestore();

    await assertFails(getDoc(doc(db, "products/product-a")));
  });

  it("persists a product and its variant through the repository", async () => {
    const db = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    const result = await saveProductWithVariants(
      db as unknown as Firestore,
      {
        product: {
          name: "  Stray Kids Light Stick  ",
          slug: "  skz-light-stick  ",
          status: "draft",
        },
        variants: [],
      },
    );

    expect(result).toEqual({
      ok: true,
      productId: "skz-light-stick",
      variantId: "skz-light-stick-default",
      product: expect.objectContaining({
        name: "Stray Kids Light Stick",
        slug: "skz-light-stick",
        status: "draft",
      }),
    });
  });
});
