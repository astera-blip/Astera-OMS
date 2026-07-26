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
  setDoc,
  serverTimestamp,
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

  it("requires a custom claim for owner-only reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "auditLogs/audit-bootstrap"), {
        id: "audit-bootstrap",
        actorUid: "owner-a",
        targetId: "bootstrap",
      });
    });

    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const memberDb = testEnv.authenticatedContext("member-a", { email: "astera.0920@gmail.com" }).firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "auditLogs/audit-bootstrap")));
    await assertFails(getDoc(doc(memberDb, "auditLogs/audit-bootstrap")));
  });

  it("allows public reads of published product projections but denies internal product reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "productsPublic/prod_001"), {
        id: "prod_001",
        name: "Published Product",
        publishState: "published",
      });
      await setDoc(doc(context.firestore(), "productsInternal/prod_001"), {
        costNote: "hidden",
      });
    });

    const db = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(db, "productsPublic/prod_001")));
    await assertFails(getDoc(doc(db, "productsInternal/prod_001")));
  });

  it("allows owner product writes and denies member product writes", async () => {
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const memberDb = testEnv.authenticatedContext("member-a").firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "productsPublic/prod_001"), {
        id: "prod_001",
        name: "Published Product",
        publicDescription: "Visible",
        publishState: "published",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "productsPublic/prod_002"), {
        id: "prod_002",
        name: "Member Product",
        publicDescription: "No",
        publishState: "published",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("separates public variant and campaign data from internal product costs", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "productVariants/var_001"), {
        id: "var_001",
        productId: "prod_001",
        sku: "STAR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 880,
        publishState: "published",
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(context.firestore(), "saleCampaigns/camp_001"), {
        id: "camp_001",
        productId: "prod_001",
        title: "七夕檔期",
        saleType: "preorder",
        status: "open",
        requiresSupplement: true,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(context.firestore(), "productsInternal/prod_001"), {
        id: "prod_001",
        originalCosts: [{ variantId: "var_001", originalCurrency: "JPY", originalCost: 650 }],
        internalNote: "hidden",
        updatedAt: serverTimestamp(),
      });
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    await assertSucceeds(getDoc(doc(publicDb, "productVariants/var_001")));
    await assertSucceeds(getDoc(doc(publicDb, "saleCampaigns/camp_001")));
    await assertFails(getDoc(doc(memberDb, "productsInternal/prod_001")));
    await assertSucceeds(getDoc(doc(ownerDb, "productsInternal/prod_001")));
  });

  it("allows only owners to create product variants and sale campaigns", async () => {
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const memberDb = testEnv.authenticatedContext("member-a").firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "productVariants/var_001"), {
        id: "var_001",
        productId: "prod_001",
        sku: "STAR-001",
        name: "Default Variant",
        isDefault: true,
        priceTwd: 880,
        publishState: "published",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(ownerDb, "saleCampaigns/camp_001"), {
        id: "camp_001",
        productId: "prod_001",
        title: "七夕檔期",
        saleType: "preorder",
        status: "open",
        requiresSupplement: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "productVariants/var_002"), {
        id: "var_002",
        productId: "prod_001",
        sku: "STAR-002",
        name: "Hidden Cost Variant",
        isDefault: false,
        priceTwd: 990,
        originalCost: 500,
        publishState: "published",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows owners to manage catalog classification masters but denies member writes", async () => {
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const memberDb = testEnv.authenticatedContext("member-a").firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "catalogCompanies/company_001"), {
        id: "company_001",
        label: "Astera Goods",
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "catalogArtists/artist_001"), {
        id: "artist_001",
        label: "Luna",
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows product projections to include public classifications", async () => {
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "productsPublic/prod_003"), {
        id: "prod_003",
        name: "應援手燈",
        publicDescription: "小圈測試商品",
        publishState: "published",
        classifications: {
          company: { id: "company_001", label: "Astera Goods" },
          artist: { id: "artist_001", label: "Luna" },
        },
        variants: [],
        campaigns: [],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(publicDb, "productsPublic/prod_003")));
  });

  it("keeps notification events owner-only", async () => {
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();
    const memberDb = testEnv.authenticatedContext("member-a").firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "notificationEvents/notif_order_001"), {
        id: "notif_order_001",
        type: "order.created",
        channel: "email",
        status: "recorded",
        provider: "manual",
        memberUid: "member-a",
        orderId: "order_001",
        paymentRequestId: "pr_order_001",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(memberDb, "notificationEvents/notif_order_001")));
  });

  it("allows members to read and write only their own cart", async () => {
    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();

    await assertSucceeds(
      setDoc(doc(memberDb, "carts/member-a"), {
        memberUid: "member-a",
        items: [
          {
            productId: "prod_001",
            variantId: "var_001",
            saleCampaignId: "camp_001",
            quantity: 1,
          },
        ],
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(getDoc(doc(memberDb, "carts/member-a")));
    await assertFails(getDoc(doc(otherMemberDb, "carts/member-a")));
    await assertFails(
      setDoc(doc(memberDb, "carts/member-b"), {
        memberUid: "member-b",
        items: [],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows members to read only their own orders and order items", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "orders/order-a"), {
        id: "order-a",
        memberUid: "member-a",
        status: "awaitingPayment",
        totalTwd: 880,
        createdAt: serverTimestamp(),
        createdBy: "member-a",
      });
      await setDoc(doc(context.firestore(), "orderItems/item-a"), {
        id: "item-a",
        orderId: "order-a",
        memberUid: "member-a",
        status: "awaitingPayment",
      });
    });

    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();

    await assertSucceeds(getDoc(doc(memberDb, "orders/order-a")));
    await assertSucceeds(getDoc(doc(memberDb, "orderItems/item-a")));
    await assertFails(getDoc(doc(otherMemberDb, "orders/order-a")));
    await assertFails(getDoc(doc(otherMemberDb, "orderItems/item-a")));
  });

  it("allows members to create their own orders but denies changing another member order", async () => {
    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();

    await assertSucceeds(
      setDoc(doc(memberDb, "orders/order-a"), {
        id: "order-a",
        memberUid: "member-a",
        status: "awaitingPayment",
        totalTwd: 880,
        recipientName: "Example Member",
        recipientPhone: "0912345678",
        shippingMethod: "address",
        shippingAddress: "台北市信義區測試路 1 號",
        createdAt: serverTimestamp(),
        createdBy: "member-a",
      }),
    );
    await assertFails(
      setDoc(doc(otherMemberDb, "orders/order-a"), {
        id: "order-a",
        memberUid: "member-a",
        status: "awaitingPayment",
        totalTwd: 880,
        recipientName: "Example Member",
        recipientPhone: "0912345678",
        shippingMethod: "address",
        shippingAddress: "台北市信義區測試路 1 號",
        createdAt: serverTimestamp(),
        createdBy: "member-b",
      }),
    );
  });

  it("denies extra fields when members create orders, order items, payment requests, and consents", async () => {
    const memberDb = testEnv.authenticatedContext("member-a").firestore();

    await assertFails(
      setDoc(doc(memberDb, "orders/order-extra"), {
        id: "order-extra",
        memberUid: "member-a",
        status: "awaitingPayment",
        totalTwd: 880,
        recipientName: "Example Member",
        recipientPhone: "0912345678",
        shippingMethod: "address",
        shippingAddress: "台北市信義區測試路 1 號",
        createdAt: serverTimestamp(),
        createdBy: "member-a",
        internalNote: "hidden",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "orderItems/item-extra"), {
        id: "item-extra",
        orderId: "order-extra",
        memberUid: "member-a",
        status: "awaitingPayment",
        costTwd: 500,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "paymentRequests/pr-extra"), {
        id: "pr-extra",
        memberUid: "member-a",
        orderId: "order-extra",
        amountTwd: 880,
        status: "open",
        method: "bankTransfer",
        internalBankMemo: "hidden",
        createdAt: serverTimestamp(),
        createdBy: "member-a",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "consentRecords/consent-extra"), {
        id: "consent-extra",
        memberUid: "member-a",
        orderId: "order-extra",
        legalVersionIds: ["terms-v1"],
        acceptedAt: "2026-07-26T00:00:00.000Z",
        marketingOptIn: true,
      }),
    );
  });

  it("allows member payment request reads but only owner payment writes and audit reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "paymentRequests/pr-a"), {
        id: "pr-a",
        memberUid: "member-a",
        orderId: "order-a",
        amountTwd: 880,
        status: "open",
        method: "bankTransfer",
        createdAt: serverTimestamp(),
        createdBy: "system",
      });
      await setDoc(doc(context.firestore(), "auditLogs/audit-a"), {
        id: "audit-a",
        actorUid: "owner-a",
        targetId: "pr-a",
      });
    });

    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    await assertSucceeds(getDoc(doc(memberDb, "paymentRequests/pr-a")));
    await assertFails(getDoc(doc(otherMemberDb, "paymentRequests/pr-a")));
    await assertFails(getDoc(doc(memberDb, "auditLogs/audit-a")));
    await assertSucceeds(getDoc(doc(ownerDb, "auditLogs/audit-a")));
    await assertSucceeds(
      setDoc(doc(ownerDb, "payments/pay-a"), {
        id: "pay-a",
        memberUid: "member-a",
        paymentRequestId: "pr-a",
        receivedAmountTwd: 880,
        receivedAt: "2026-07-26T00:00:00.000Z",
        status: "confirmed",
        createdAt: serverTimestamp(),
        createdBy: "owner-a",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "payments/pay-b"), {
        id: "pay-b",
        memberUid: "member-a",
        paymentRequestId: "pr-a",
        receivedAmountTwd: 880,
        receivedAt: "2026-07-26T00:00:00.000Z",
        status: "confirmed",
        createdAt: serverTimestamp(),
        createdBy: "member-a",
      }),
    );
  });

  it("allows members to read only their own consent records", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "consentRecords/consent-a"), {
        id: "consent-a",
        memberUid: "member-a",
        orderId: "order-a",
        legalVersionIds: ["terms-v1"],
        acceptedAt: "2026-07-26T00:00:00.000Z",
      });
      await setDoc(doc(context.firestore(), "legalDocumentVersions/terms-v1"), {
        id: "terms-v1",
        documentType: "terms",
        title: "Terms",
        version: "v1",
        body: "Terms",
        effectiveAt: "2026-07-26T00:00:00.000Z",
      });
    });

    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(memberDb, "consentRecords/consent-a")));
    await assertFails(getDoc(doc(otherMemberDb, "consentRecords/consent-a")));
    await assertSucceeds(getDoc(doc(publicDb, "legalDocumentVersions/terms-v1")));
  });

  it("allows members to create their own cancellation request and denies others", async () => {
    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const otherMemberDb = testEnv.authenticatedContext("member-b").firestore();
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    await assertSucceeds(
      setDoc(doc(memberDb, "cancellationRequests/cancel-a"), {
        id: "cancel-a",
        orderId: "order-a",
        orderItemIds: ["item-a"],
        memberUid: "member-a",
        reason: "不需要了",
        status: "pending",
        createdAt: serverTimestamp(),
        createdBy: "member-a",
      }),
    );
    await assertFails(
      setDoc(doc(otherMemberDb, "cancellationRequests/cancel-b"), {
        id: "cancel-b",
        orderId: "order-a",
        orderItemIds: ["item-a"],
        memberUid: "member-a",
        reason: "不需要了",
        status: "pending",
        createdAt: serverTimestamp(),
        createdBy: "member-b",
      }),
    );
    await assertSucceeds(getDoc(doc(ownerDb, "cancellationRequests/cancel-a")));
  });

  it("keeps member private notes owner-only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "memberPrivateNotes/member-a"), {
        uid: "member-a",
        riskState: "watch",
        internalNote: "duplicate phone warning",
      });
    });

    const memberDb = testEnv.authenticatedContext("member-a").firestore();
    const ownerDb = testEnv
      .authenticatedContext("owner-a", { role: "owner" })
      .firestore();

    await assertFails(getDoc(doc(memberDb, "memberPrivateNotes/member-a")));
    await assertSucceeds(getDoc(doc(ownerDb, "memberPrivateNotes/member-a")));
    await assertSucceeds(
      setDoc(doc(ownerDb, "memberPrivateNotes/member-a"), {
        uid: "member-a",
        riskState: "blacklisted",
        internalNote: "blocked for small-circle test",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
