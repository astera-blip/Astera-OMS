import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { canAccessCatalogWorkspace, getRoleFromClaims } from "@/lib/member/rolePolicy";
import {
  listWorkspaceProductsServer,
  saveWorkspaceProductServer,
} from "@/lib/product/serverCatalog";
import type { ProductDraft } from "@/lib/product/catalog";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!canAccessCatalogWorkspace(getRoleFromClaims(claims))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const products = await listWorkspaceProductsServer(getAdminFirestore());

    return NextResponse.json({ products });
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

    const body = (await request.json()) as Partial<ProductDraft & { internalNote?: string }>;
    if (!body.product || !Array.isArray(body.variants) || !Array.isArray(body.campaigns)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const product = await saveWorkspaceProductServer(
      getAdminFirestore(),
      {
        product: body.product,
        variants: body.variants,
        campaigns: body.campaigns,
        internalNote: body.internalNote,
      },
      claims.uid,
    );

    return NextResponse.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" ? 401 : message === "invalid_product" ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
