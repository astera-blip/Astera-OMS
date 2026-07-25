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
  riskState: "normal" | "watch" | "blacklisted";
};
