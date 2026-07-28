import { pathToFileURL } from "node:url";

const PRODUCT_SKU = /^AST-P\d{6}$/;
const VARIANT_SKU = /^AST-P\d{6}-V\d{3}$/;
const PRIVATE_FIELDS = ["sku", "internalNote", "originalCosts", "cost", "createdBy", "updatedBy"];

export function parseProductionArgs(argv) {
  const values = parseNamedArgs(argv);
  if (!values.project || !values.confirmProject) {
    throw new Error("project_confirmation_required");
  }
  if (values.project !== values.confirmProject) {
    throw new Error("project_confirmation_mismatch");
  }
  return { project: values.project };
}

export function auditProductProjection(internalProducts, publicProducts) {
  const issues = [];
  const publicById = new Map(publicProducts.map((item) => [item.id, item]));
  if (internalProducts.length !== publicProducts.length) {
    issues.push(`product_count_mismatch:${internalProducts.length}:${publicProducts.length}`);
  }

  for (const internal of internalProducts) {
    if (!PRODUCT_SKU.test(String(internal.sku ?? ""))) {
      issues.push(`invalid_product_sku:${internal.id}`);
    }
    const projected = publicById.get(internal.id);
    if (!projected) {
      issues.push(`missing_public_product:${internal.id}`);
      continue;
    }
    for (const field of PRIVATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(projected, field)) {
        issues.push(`private_field_exposed:${internal.id}:${field}`);
      }
    }
    compareCollection(internal, projected, "variants", issues, (source, target) => {
      if (!VARIANT_SKU.test(String(source.sku ?? ""))) {
        issues.push(`invalid_variant_sku:${internal.id}:${source.id}`);
      }
      if (Number(source.priceTwd) !== Number(target?.priceTwd)) {
        issues.push(`price_mismatch:${internal.id}:${source.id}`);
      }
    });
    compareCollection(internal, projected, "campaigns", issues, (source, target) => {
      if (Number(source.salePriceTwd ?? 0) !== Number(target?.salePriceTwd ?? 0)) {
        issues.push(`price_mismatch:${internal.id}:${source.id}`);
      }
    });
    compareCollection(internal, projected, "images", issues, (source, target) => {
      if (
        source.objectPath !== target?.objectPath
        || source.sortOrder !== target?.sortOrder
        || typeof target?.url !== "string"
      ) {
        issues.push(`image_projection_mismatch:${internal.id}:${source.objectPath}`);
      }
    });
  }

  for (const projected of publicProducts) {
    if (!internalProducts.some((item) => item.id === projected.id)) {
      issues.push(`orphan_public_product:${projected.id}`);
    }
  }
  return {
    ok: issues.length === 0,
    internalCount: internalProducts.length,
    publicCount: publicProducts.length,
    issues,
  };
}

function compareCollection(internal, projected, field, issues, compare) {
  const source = Array.isArray(internal[field]) ? internal[field] : [];
  const target = Array.isArray(projected[field]) ? projected[field] : [];
  if (source.length !== target.length) {
    issues.push(`${field.slice(0, -1)}_count_mismatch:${internal.id}:${source.length}:${target.length}`);
  }
  const targetById = new Map(target.map((item) => [
    item.id ?? item.objectPath,
    item,
  ]));
  for (const item of source) {
    compare(item, targetById.get(item.id ?? item.objectPath));
  }
}

function parseNamedArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error("invalid_arguments");
    }
    result[name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return result;
}

async function loadProjectionData(project) {
  const [{ applicationDefault, getApps, initializeApp }, { getFirestore }] =
    await Promise.all([import("firebase-admin/app"), import("firebase-admin/firestore")]);
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: project });
  const db = getFirestore(app);
  const [internal, publicSnapshot, variants, campaigns] = await Promise.all([
    db.collection("productsInternal").get(),
    db.collection("productsPublic").get(),
    db.collection("productVariants").get(),
    db.collection("saleCampaigns").get(),
  ]);
  const variantData = variants.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const campaignData = campaigns.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return {
    internalProducts: internal.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      variants: variantData.filter((item) => item.productId === doc.id),
      campaigns: campaignData.filter((item) => item.productId === doc.id),
    })),
    publicProducts: publicSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { project } = parseProductionArgs(process.argv.slice(2));
    const data = await loadProjectionData(project);
    const report = auditProductProjection(data.internalProducts, data.publicProducts);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "product_audit_failed");
    process.exitCode = 1;
  }
}
