import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type { ProductImage } from "@/lib/product/images";
import {
  listProductImages,
  saveProductImages,
} from "@/lib/product/serverImages";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    return NextResponse.json({ images: await listProductImages(getAdminFirestore(), id) });
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = (await request.json()) as { images?: ProductImage[] };
    if (!Array.isArray(body.images)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const existing = await listProductImages(getAdminFirestore(), id);
    const existingPaths = new Set(existing.map((image) => image.objectPath));
    if (body.images.some((image) => !existingPaths.has(image.objectPath))) {
      return NextResponse.json({ error: "unregistered_product_image" }, { status: 400 });
    }
    const images = await saveProductImages(getAdminFirestore(), id, body.images, claims.uid);
    return NextResponse.json({ images });
  } catch (error) {
    return responseForError(error);
  }
}

function responseForError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status =
    message === "missing_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "product_not_found"
          ? 404
          : message.includes("image")
            || message === "too_many_product_images"
            || message === "duplicate_product_image"
            ? 400
            : 500;
  return NextResponse.json(
    { error: status === 500 ? "internal_error" : message },
    { status },
  );
}
