import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { canReviewCatalogDraft, getRoleFromClaims } from "@/lib/member/rolePolicy";
import { catalogChangeErrorResponse } from "@/lib/catalog-change/http";
import { reviewCatalogChangeRequestServer } from "@/lib/catalog-change/serverCatalogChangeRequests";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!canReviewCatalogDraft(getRoleFromClaims(claims))) throw new Error("forbidden");
    const { id } = await context.params;
    const body = await request.json() as { decision?: unknown; reason?: unknown };
    if (body.decision !== "approve" && body.decision !== "reject") {
      throw new Error("catalog_change_invalid_decision");
    }
    const changeRequest = await reviewCatalogChangeRequestServer(
      getAdminFirestore(),
      id,
      claims.uid,
      body.decision,
      typeof body.reason === "string" ? body.reason : "",
    );
    return NextResponse.json({ request: changeRequest });
  } catch (error) {
    return catalogChangeErrorResponse(error);
  }
}
