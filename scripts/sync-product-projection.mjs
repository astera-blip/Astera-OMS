import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { auditProductProjection } from "./audit-product-projection.mjs";

const PRIVATE_FIELDS = new Set([
  "sku",
  "internalNote",
  "originalCost",
  "originalCosts",
  "cost",
  "createdBy",
  "updatedBy",
]);

export function parseSyncArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") {
      values.apply = true;
      continue;
    }
    if (!token?.startsWith("--") || !argv[index + 1]) {
      throw new Error("invalid_arguments");
    }
    values[token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[index + 1];
    index += 1;
  }
  if (!values.project || values.project !== values.confirmProject) {
    throw new Error("project_confirmation_required");
  }
  if (!values.apply) {
    throw new Error("apply_confirmation_required");
  }
  return {
    project: values.project,
    backupDir: values.backupDir ?? `.local-backups/production-product-sync-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  };
}

function stripPrivateFields(value) {
  if (Array.isArray(value)) return value.map(stripPrivateFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_FIELDS.has(key))
      .map(([key, nested]) => [key, stripPrivateFields(nested)]),
  );
}

export function buildProjectionFromInternalProduct(data) {
  const projection = stripPrivateFields({
    id: data.id,
    name: data.name,
    publicDescription: data.publicDescription,
    publishState: data.publishState,
    ...(data.classifications ? { classifications: data.classifications } : {}),
    ...(data.images ? { images: data.images } : {}),
    variants: Array.isArray(data.variants) ? data.variants : [],
    campaigns: Array.isArray(data.campaigns) ? data.campaigns : [],
  });
  return projection;
}

export function buildDesiredPublicProducts(internalProducts) {
  return internalProducts.map(buildProjectionFromInternalProduct);
}

export function buildProjectionSyncPlan(internalProducts, currentPublicProducts) {
  const desiredPublicProducts = buildDesiredPublicProducts(internalProducts);
  const desiredIds = new Set(desiredPublicProducts.map((product) => product.id));
  return {
    desiredPublicProducts,
    deletePublicProductIds: currentPublicProducts
      .map((product) => product.id)
      .filter((id) => !desiredIds.has(id)),
  };
}

export function buildProductProjectionSyncPlan(internalProducts, publicProducts) {
  const desiredPublicProducts = internalProducts.map(buildProjectionFromInternalProduct);
  const internalIds = new Set(internalProducts.map((product) => product.id));

  return {
    desiredPublicProducts,
    operations: [
      ...desiredPublicProducts.map((data) => ({ type: "set", id: data.id, data })),
      ...publicProducts
        .filter((product) => !internalIds.has(product.id))
        .map((product) => ({ type: "delete", id: product.id })),
    ],
  };
}

function serializeForBackup(value) {
  if (value && typeof value.toDate === "function") {
    return { __type: "timestamp", value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeForBackup);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeForBackup(nested)]));
  }
  return value;
}

async function readProductionData(db) {
  const [internalSnapshot, publicSnapshot, variantSnapshot, campaignSnapshot] = await Promise.all([
    db.collection("productsInternal").get(),
    db.collection("productsPublic").get(),
    db.collection("productVariants").get(),
    db.collection("saleCampaigns").get(),
  ]);
  const variants = variantSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const campaigns = campaignSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const internalProducts = internalSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    variants: variants.filter((item) => item.productId === doc.id),
    campaigns: campaigns.filter((item) => item.productId === doc.id),
  }));
  const publicProducts = publicSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { internalProducts, publicProducts, variants, campaigns };
}

async function createBackup(data, backupDir) {
  const destination = resolve(backupDir);
  await mkdir(destination, { recursive: true });
  const backupFile = resolve(destination, "product-projection-backup.json");
  await writeFile(backupFile, `${JSON.stringify(serializeForBackup(data), null, 2)}\n`, "utf8");
  return backupFile;
}

async function syncProjection(db, plan) {
  let batch = db.batch();
  let writes = 0;
  for (const operation of plan.operations) {
    const ref = db.collection("productsPublic").doc(operation.id);
    if (operation.type === "set") {
      batch.set(ref, {
        ...operation.data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      batch.delete(ref);
    }
    writes += 1;
    if (writes % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (writes % 450 !== 0) await batch.commit();
  return writes;
}

async function main(argv) {
  const { project, backupDir } = parseSyncArgs(argv);
  const [{ applicationDefault, getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: project });
  const db = getFirestore(app);
  const data = await readProductionData(db);
  const beforeAudit = auditProductProjection(data.internalProducts, data.publicProducts);
  const plan = buildProductProjectionSyncPlan(data.internalProducts, data.publicProducts);
  const desiredAudit = auditProductProjection(data.internalProducts, plan.desiredPublicProducts);
  if (!desiredAudit.ok) {
    throw new Error(`projection_build_audit_failed:${JSON.stringify(desiredAudit.issues)}`);
  }
  const backupFile = await createBackup(data, backupDir);
  const writes = await syncProjection(db, plan);
  const refreshed = await readProductionData(db);
  const afterAudit = auditProductProjection(refreshed.internalProducts, refreshed.publicProducts);
  if (!afterAudit.ok) {
    throw new Error(`projection_post_audit_failed:${JSON.stringify(afterAudit.issues)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    project,
    backupFile,
    writes,
    beforeAudit,
    afterAudit,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "product_projection_sync_failed");
    process.exitCode = 1;
  }
}
