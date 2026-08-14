import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { getRoleFromClaims } from "@/lib/member/rolePolicy";
import { catalogChangeErrorResponse } from "@/lib/catalog-change/http";
import { updateOwnCatalogChangeRequestServer } from "@/lib/catalog-change/serverCatalogChangeRequests";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (getRoleFromClaims(claims) !== "partner") throw new Error("forbidden");
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const changeRequest = await updateOwnCatalogChangeRequestServer(
      getAdminFirestore(),
      id,
      body,
      claims.uid,
    );
    return NextResponse.json({ request: changeRequest });
  } catch (error) {
    return catalogChangeErrorResponse(error);
  }
}
