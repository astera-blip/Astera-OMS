export type EntityId = string;
export type FirebaseUid = string;
export type IsoDateTime = string;

export type AuditMetadata = {
  createdAt: IsoDateTime;
  createdBy: FirebaseUid | "system";
  updatedAt?: IsoDateTime;
  updatedBy?: FirebaseUid | "system";
};

export type PublishState = "draft" | "published" | "archived";
export type CurrencyCode = "TWD" | "THB" | "JPY" | "KRW" | "USD";
