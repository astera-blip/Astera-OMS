import type { AuditMetadata, FirebaseUid, IsoDateTime } from "./common";
import type { NormalizedTaiwanMobile } from "@/lib/phone/taiwanMobile";

export type RoleKey = "owner" | "helper" | "member";

export type MemberProfile = AuditMetadata & {
  uid: FirebaseUid;
  displayName: string;
  email: string;
  communityId: string;
  mobilePhone: NormalizedTaiwanMobile;
  birthday?: string;
  completedAt: IsoDateTime;
};

export type MemberPrivateProfile = AuditMetadata & {
  uid: FirebaseUid;
  riskState: "normal" | "watch" | "blacklisted";
  internalNote?: string;
};
