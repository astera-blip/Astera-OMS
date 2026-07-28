import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "demo-astera-oms";
const password = "Password123!";

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_USE_FIREBASE_EMULATORS !== "true") {
    return;
  }

  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT ??= projectId;
  process.env.GOOGLE_CLOUD_PROJECT ??= projectId;

  if (getApps().length === 0) {
    initializeApp({ projectId });
  }

  const auth = getAuth();
  const db = getFirestore();

  await Promise.all([
    seedUser(auth, {
      uid: "owner-e2e",
      email: "owner-e2e@example.test",
      displayName: "Owner E2E",
      role: "owner",
    }),
    seedUser(auth, {
      uid: "member-e2e",
      email: "member-e2e@example.test",
      displayName: "Member E2E",
      role: "member",
    }),
  ]);

  await Promise.all([
    db.collection("members").doc("owner-e2e").set({
      uid: "owner-e2e",
      email: "owner-e2e@example.test",
      displayName: "Owner E2E",
      communityId: "owner-e2e",
      mobilePhone: "0911111111",
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    db.collection("members").doc("member-e2e").set({
      uid: "member-e2e",
      email: "member-e2e@example.test",
      displayName: "Member E2E",
      communityId: "member-e2e",
      mobilePhone: "0922222222",
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ]);

  await Promise.all([
    db.collection("productsPublic").doc("prod_e2e_flow").set({
      id: "prod_e2e_flow",
      name: "E2E 流程商品",
      publicDescription: "用於 checkout、付款與取消流程的 emulator 測試商品。",
      publishState: "published",
      variants: [
        {
          id: "var_e2e_flow_default",
          productId: "prod_e2e_flow",
          name: "預設款",
          isDefault: true,
          priceTwd: 800,
        },
      ],
      campaigns: [
        {
          id: "camp_e2e_flow_preorder",
          productId: "prod_e2e_flow",
          title: "E2E 預購",
          saleType: "preorder",
          status: "open",
          salePriceTwd: 640,
          requiresSupplement: true,
        },
        {
          id: "camp_e2e_flow_rush",
          productId: "prod_e2e_flow",
          title: "E2E 代搶",
          saleType: "rushPurchase",
          status: "open",
          salePriceTwd: 750,
          requiresSupplement: true,
        },
      ],
      updatedAt: new Date(),
    }),
    db.collection("productVariants").doc("var_e2e_flow_default").set({
      id: "var_e2e_flow_default",
      productId: "prod_e2e_flow",
      sku: "AST-P999001-V001",
      name: "預設款",
      isDefault: true,
      priceTwd: 800,
      publishState: "published",
      updatedAt: new Date(),
    }),
  ]);
}

async function seedUser(
  auth: ReturnType<typeof getAuth>,
  input: { uid: string; email: string; displayName: string; role: "owner" | "member" },
) {
  try {
    await auth.updateUser(input.uid, {
      email: input.email,
      password,
      displayName: input.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch {
    await auth.createUser({
      uid: input.uid,
      email: input.email,
      password,
      displayName: input.displayName,
      emailVerified: true,
    });
  }

  await auth.setCustomUserClaims(input.uid, { role: input.role });
}
