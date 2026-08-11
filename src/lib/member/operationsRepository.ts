export type MemberPrivateNote = {
  uid: string;
  riskState: "normal" | "watch" | "blacklisted";
  internalNote?: string;
};
