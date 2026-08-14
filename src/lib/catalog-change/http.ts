import { NextResponse } from "next/server";
import type { FirebaseUserClaims } from "@/lib/firebase/serverAuth";
import { canAccessCatalogWorkspace, getRoleFromClaims } from "@/lib/member/rolePolicy";

export function requireCatalogAccess(claims: FirebaseUserClaims) {
  const role = getRoleFromClaims(claims);
  if (!canAccessCatalogWorkspace(role)) throw new Error("forbidden");
  return role;
}

export function catalogChangeErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "internal_error";
  const status = message === "missing_token" || message === "invalid_token"
    ? 401
    : message === "forbidden" || message === "catalog_change_forbidden"
      ? 403
      : message === "catalog_change_not_found"
        ? 404
        : message === "catalog_change_locked"
          || message === "catalog_change_not_reviewable"
          || message === "catalog_change_review_in_progress"
          || message === "catalog_change_review_conflict"
          ? 409
          : message === "invalid_product"
            || message === "catalog_change_title_required"
            || message === "catalog_change_reason_required"
            || message === "catalog_change_review_reason_required"
            || message === "catalog_change_id_required"
            || message === "catalog_change_invalid_decision"
            ? 400
            : 500;
  return NextResponse.json({ error: status === 500 ? "internal_error" : message }, { status });
}
