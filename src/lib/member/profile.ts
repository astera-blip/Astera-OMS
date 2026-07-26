import {
  normalizeTaiwanMobile,
  type NormalizedTaiwanMobile,
} from "@/lib/phone/taiwanMobile";

export type MemberProfileDraft = {
  displayName: string;
  communityId: string;
  mobilePhone: string;
  birthday: string;
};

export type ValidMemberProfileDraft = {
  displayName: string;
  communityId: string;
  mobilePhone: NormalizedTaiwanMobile;
  birthday?: string;
};

export type MemberProfileField = keyof MemberProfileDraft;

export type MemberProfileValidationResult =
  | { ok: true; value: ValidMemberProfileDraft }
  | { ok: false; errors: Partial<Record<MemberProfileField, string>> };

export function validateMemberProfileDraft(
  draft: MemberProfileDraft,
): MemberProfileValidationResult {
  const displayName = draft.displayName.trim();
  const communityId = draft.communityId.trim();
  const mobilePhone = normalizeTaiwanMobile(draft.mobilePhone);
  const birthday = draft.birthday.trim();
  const errors: Partial<Record<MemberProfileField, string>> = {};

  if (!displayName) {
    errors.displayName = "請填寫姓名。";
  } else if (displayName.length > 80) {
    errors.displayName = "姓名不可超過 80 個字元。";
  }

  if (!communityId) {
    errors.communityId = "請填寫社群內 ID。";
  } else if (communityId.length > 80) {
    errors.communityId = "社群內 ID 不可超過 80 個字元。";
  }

  if (!mobilePhone) {
    errors.mobilePhone = "請輸入有效的台灣手機號碼。";
  }

  if (birthday && !isIsoCalendarDate(birthday)) {
    errors.birthday = "請輸入有效日期。";
  }

  if (Object.keys(errors).length > 0 || !mobilePhone) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      displayName,
      communityId,
      mobilePhone,
      ...(birthday ? { birthday } : {}),
    },
  };
}

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
