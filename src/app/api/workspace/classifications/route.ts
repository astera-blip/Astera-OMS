import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  classificationCollections,
  normalizeCatalogClassification,
  type CatalogClassification,
} from "@/lib/product/classifications";
import type { ProductClassificationKey } from "@/lib/product/catalog";

const classificationKeys = Object.keys(classificationCollections) as ProductClassificationKey[];

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      key?: ProductClassificationKey;
      classification?: CatalogClassification;
    };
    if (!body.key || !classificationKeys.includes(body.key) || !body.classification) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const value = normalizeCatalogClassification(body.classification);
    if (!value.id || !value.label) {
      return NextResponse.json({ error: "invalid_classification" }, { status: 400 });
    }

    await getAdminFirestore()
      .collection(classificationCollections[body.key])
      .doc(value.id)
      .set({
        ...value,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });

    return NextResponse.json({ classification: value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}
