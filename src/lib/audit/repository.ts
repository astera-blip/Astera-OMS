export type OwnerAuditLogSnapshot =
  | {
      id: string;
      action: "refund.account.mismatch";
      actorUid: string;
      requestReference: string;
      attemptCount: number;
      result: "mismatch" | "needsReverification";
      createdAt: unknown;
    }
  | {
      id: string;
      action: string;
      actorUid: string;
      targetType: string;
      targetId: string;
      reason?: string;
      createdAt: unknown;
    };

export function sanitizeOwnerAuditLog(
  id: string,
  value: Record<string, unknown>,
): OwnerAuditLogSnapshot | null {
  const action = typeof value.action === "string" ? value.action : "unknown";
  const actorUid = typeof value.actorUid === "string" ? value.actorUid : "system";
  const createdAt = value.createdAt ?? "";

  if (action === "refund.verification.reservation") {
    return null;
  }

  if (action === "refund.account.mismatch") {
    return {
      id,
      action,
      actorUid,
      requestReference: id,
      attemptCount: typeof value.attemptCount === "number" ? value.attemptCount : 0,
      result: value.result === "needsReverification" ? "needsReverification" : "mismatch",
      createdAt,
    };
  }

  return {
    id,
    action,
    actorUid,
    targetType: typeof value.targetType === "string" ? value.targetType : "unknown",
    targetId: typeof value.targetId === "string" ? value.targetId : id,
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    createdAt,
  };
}
