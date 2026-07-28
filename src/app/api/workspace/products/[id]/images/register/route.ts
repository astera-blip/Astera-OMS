import { NextResponse } from "next/server";
import { getAdminFirestore, getAdminStorageBucket } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import {
  validateProductImageCandidate,
  type ProductImage,
} from "@/lib/product/images";
import {
  listProductImages,
  saveProductImages,
} from "@/lib/product/serverImages";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { id: productId } = await context.params;
    const body = (await request.json()) as Partial<ProductImage> & { objectPath?: string };
    const objectPath = body.objectPath?.trim() ?? "";
    const [metadata] = await getAdminStorageBucket().file(objectPath).getMetadata();
    const check = validateProductImageCandidate({
      productId,
      objectPath,
      contentType: metadata.contentType ?? "",
      size: Number(metadata.size ?? 0),
      url: body.url?.trim() ?? "",
      altText: body.altText ?? "",
      width: Number(body.width ?? 0),
      height: Number(body.height ?? 0),
    });
    if (!check.ok) {
      throw new Error(check.error);
    }
    const current = await listProductImages(getAdminFirestore(), productId);
    const filename = objectPath.slice(objectPath.lastIndexOf("/") + 1);
    const image: ProductImage = {
      id: filename.replace(/\.[^.]+$/, ""),
      objectPath,
      url: body.url!.trim(),
      altText: body.altText?.trim() ?? "",
      width: Number(body.width),
      height: Number(body.height),
      sortOrder: current.length + 1,
    };
    const images = await saveProductImages(
      getAdminFirestore(),
      productId,
      [...current, image],
      claims.uid,
    );
    return NextResponse.json({ image, images }, { status: 201 });
  } catch (error) {
    return imageErrorResponse(error);
  }
}

function imageErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status =
    message === "missing_token"
      ? 401
      : message === "product_not_found"
        ? 404
        : message === "forbidden"
          ? 403
          : message.includes("image") || message === "too_many_product_images"
            ? 400
            : 500;
  return NextResponse.json(
    { error: status === 500 ? "internal_error" : message },
    { status },
  );
}
