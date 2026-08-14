import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { getRoleFromClaims } from "@/lib/member/rolePolicy";
import { catalogChangeErrorResponse, requireCatalogAccess } from "@/lib/catalog-change/http";
import {
  createCatalogChangeRequestServer,
  listCatalogChangeRequestsServer,
} from "@/lib/catalog-change/serverCatalogChangeRequests";

export async function GET(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    requireCatalogAccess(claims);
    const requests = await listCatalogChangeRequestsServer(getAdminFirestore());
    return NextResponse.json({ requests });
  } catch (error) {
    return catalogChangeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);
    if (getRoleFromClaims(claims) !== "partner") throw new Error("forbidden");
    const body = await request.json() as Record<string, unknown>;
    const changeRequest = await createCatalogChangeRequestServer(
      getAdminFirestore(),
      body,
      claims.uid,
    );
    return NextResponse.json({ request: changeRequest }, { status: 201 });
  } catch (error) {
    return catalogChangeErrorResponse(error);
  }
}
