import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-astera-oms",
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

describe("product image Storage rules", () => {
  it("allows owner image uploads and public reads in the product image namespace", async () => {
    const ownerStorage = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .storage("demo-astera-oms.appspot.com");
    const publicStorage = testEnv
      .unauthenticatedContext()
      .storage("demo-astera-oms.appspot.com");
    const path = "product-images/prod_001/image_001.webp";

    await assertSucceeds(
      uploadBytes(
        ref(ownerStorage, path),
        new Blob(["webp"], { type: "image/webp" }),
        { contentType: "image/webp" },
      ),
    );
    await assertSucceeds(getDownloadURL(ref(publicStorage, path)));
  });

  it("denies anonymous and member writes", async () => {
    const publicStorage = testEnv
      .unauthenticatedContext()
      .storage("demo-astera-oms.appspot.com");
    const memberStorage = testEnv
      .authenticatedContext("member-a", { role: "member" })
      .storage("demo-astera-oms.appspot.com");

    await assertFails(
      uploadBytes(
        ref(publicStorage, "product-images/prod_001/public.webp"),
        new Blob(["webp"], { type: "image/webp" }),
        { contentType: "image/webp" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(memberStorage, "product-images/prod_001/member.webp"),
        new Blob(["webp"], { type: "image/webp" }),
        { contentType: "image/webp" },
      ),
    );
  });

  it("denies invalid file type, oversize object, and non-product paths", async () => {
    const ownerStorage = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .storage("demo-astera-oms.appspot.com");

    await assertFails(
      uploadBytes(
        ref(ownerStorage, "product-images/prod_001/file.gif"),
        new Blob(["gif"], { type: "image/gif" }),
        { contentType: "image/gif" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(ownerStorage, "product-images/prod_001/large.webp"),
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/webp" }),
        { contentType: "image/webp" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(ownerStorage, "private/prod_001/image.webp"),
        new Blob(["webp"], { type: "image/webp" }),
        { contentType: "image/webp" },
      ),
    );
  });
});
