import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  classificationCollections,
  isProductClassificationKey,
  normalizeClassificationLabelKey,
  validateClassificationLabel,
  validateClassificationStatus,
  type CatalogClassification,
} from "@/lib/product/classifications";
import type { ProductClassificationKey } from "@/lib/product/catalog";
import { canAccessCatalogWorkspace, getRoleFromClaims } from "@/lib/member/rolePolicy";

const classificationKeys = Object.keys(classificationCollections) as ProductClassificationKey[];

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!canAccessCatalogWorkspace(getRoleFromClaims(claims))) {
      throw new Error("forbidden");
    }
    const db = getAdminFirestore();
    const entries = await Promise.all(
      classificationKeys.map(async (key) => {
        const snapshot = await db.collection(classificationCollections[key]).get();
        return [key, snapshot.docs.map((doc) => doc.data() as CatalogClassification)] as const;
      }),
    );
    return NextResponse.json({ classifications: Object.fromEntries(entries) });
  } catch (error) {
    return classificationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireOwner(request);
    const body = (await request.json()) as {
      key?: ProductClassificationKey;
      label?: unknown;
    };
    const key = requireClassificationKey(body.key);
    const labelResult = validateClassificationLabel(body.label);
    if (!labelResult.ok) {
      throw new Error(labelResult.error);
    }

    const db = getAdminFirestore();
    const collection = db.collection(classificationCollections[key]);
    const normalizedLabelKey = normalizeClassificationLabelKey(labelResult.value);
    await assertUniqueLabel(collection, normalizedLabelKey);
    const ref = collection.doc();
    const classification: CatalogClassification = {
      id: ref.id,
      label: labelResult.value,
      normalizedLabelKey,
      status: "active",
    };
    await ref.set({
      ...classification,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: claims.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
    return NextResponse.json({ classification }, { status: 201 });
  } catch (error) {
    return classificationErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const claims = await requireOwner(request);
    const body = (await request.json()) as {
      key?: ProductClassificationKey;
      id?: unknown;
      label?: unknown;
      status?: unknown;
    };
    const key = requireClassificationKey(body.key);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      throw new Error("invalid_classification_id");
    }
    const labelResult = validateClassificationLabel(body.label);
    if (!labelResult.ok) {
      throw new Error(labelResult.error);
    }
    const statusResult = validateClassificationStatus(body.status);
    if (!statusResult.ok) {
      throw new Error(statusResult.error);
    }

    const db = getAdminFirestore();
    const collection = db.collection(classificationCollections[key]);
    const ref = collection.doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error("classification_not_found");
    }
    const normalizedLabelKey = normalizeClassificationLabelKey(labelResult.value);
    await assertUniqueLabel(collection, normalizedLabelKey, id);
    const classification: CatalogClassification = {
      id,
      label: labelResult.value,
      normalizedLabelKey,
      status: statusResult.value,
    };
    await ref.update({
      ...classification,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
    return NextResponse.json({ classification });
  } catch (error) {
    return classificationErrorResponse(error);
  }
}

async function requireOwner(request: Request) {
  const claims = await requireFirebaseUser(request);
  if (!isOwnerClaim(claims)) {
    throw new Error("forbidden");
  }
  return claims;
}

function requireClassificationKey(key: unknown): ProductClassificationKey {
  if (!isProductClassificationKey(key)) {
    throw new Error("invalid_classification_key");
  }
  return key;
}

async function assertUniqueLabel(
  collection: FirebaseFirestore.CollectionReference,
  normalizedLabelKey: string,
  exceptId?: string,
) {
  const snapshot = await collection.get();
  const duplicate = snapshot.docs.some((document) => {
    if (document.id === exceptId) {
      return false;
    }
    const data = document.data() as { label?: string; normalizedLabelKey?: string };
    return (
      data.normalizedLabelKey
      ?? normalizeClassificationLabelKey(data.label ?? "")
    ) === normalizedLabelKey;
  });
  if (duplicate) {
    throw new Error("classification_label_conflict");
  }
}

function classificationErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status =
    message === "missing_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "classification_not_found"
          ? 404
          : message === "classification_label_conflict"
            ? 409
            : message.startsWith("classification_")
              || message.startsWith("invalid_classification_")
              ? 400
              : 500;
  return NextResponse.json(
    { error: status === 500 ? "internal_error" : message },
    { status },
  );
}
