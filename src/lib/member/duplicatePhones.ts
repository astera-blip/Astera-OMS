import { normalizeTaiwanMobile } from "@/lib/phone/taiwanMobile";

export type DuplicatePhoneGroup = {
  mobilePhone: string;
  memberUids: string[];
};

export function groupDuplicatePhones(
  members: readonly { uid: string; mobilePhone?: string }[],
): DuplicatePhoneGroup[] {
  const grouped = new Map<string, string[]>();
  for (const member of members) {
    const phone = normalizeTaiwanMobile(member.mobilePhone ?? "");
    if (!phone) {
      continue;
    }
    grouped.set(phone, [...(grouped.get(phone) ?? []), member.uid]);
  }
  return [...grouped.entries()]
    .filter(([, memberUids]) => memberUids.length >= 2)
    .map(([mobilePhone, memberUids]) => ({
      mobilePhone,
      memberUids: [...memberUids].sort(),
    }))
    .sort((left, right) => left.mobilePhone.localeCompare(right.mobilePhone));
}
