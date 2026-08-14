import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAdminAuth } from "@/lib/firebase/adminAuth";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import { assignMemberRole } from "@/lib/member/roleAssignment";

export async function PUT(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const claims = await requireFirebaseUser(request);
    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { uid } = await context.params;
    const body = await request.json() as { role?: unknown };
    const assignment = await assignMemberRole({
      actorClaims: claims,
      targetUid: uid,
      nextRole: body.role,
      auth: getAdminAuth(),
      db: getAdminFirestore(),
    });
    return NextResponse.json({ assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_token" || message === "invalid_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "member_not_found"
          ? 404
          : message === "role_unchanged"
            ? 409
            : message === "role_assignment_persistence_failed"
              ? 503
              : message === "role_assignment_auth_failed"
                ? 503
              : [
                  "invalid_role",
                  "owner_assignment_forbidden",
                  "owner_target_forbidden",
                  "self_assignment_forbidden",
                  "member_profile_incomplete",
                ].includes(message)
                ? 400
                : 500;
    return NextResponse.json(
      { error: status === 500 ? "internal_error" : message },
      { status },
    );
  }
}
