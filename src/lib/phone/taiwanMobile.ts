export type NormalizedTaiwanMobile = `09${string}`;

const taiwanMobilePattern = /^09\d{8}$/;

export function normalizeTaiwanMobile(
  input: string,
): NormalizedTaiwanMobile | null {
  const compact = input.trim().replace(/[\s\-()]/g, "");

  if (compact.startsWith("+886")) {
    return normalizeDomesticMobile(`0${compact.slice(4)}`);
  }

  if (compact.startsWith("886")) {
    return normalizeDomesticMobile(`0${compact.slice(3)}`);
  }

  return normalizeDomesticMobile(compact);
}

export function isTaiwanMobile(input: string) {
  return normalizeTaiwanMobile(input) !== null;
}

export function requireTaiwanMobile(input: string): NormalizedTaiwanMobile {
  const normalized = normalizeTaiwanMobile(input);

  if (!normalized) {
    throw new Error("Invalid Taiwan mobile phone number.");
  }

  return normalized;
}

function normalizeDomesticMobile(input: string): NormalizedTaiwanMobile | null {
  if (!taiwanMobilePattern.test(input)) {
    return null;
  }

  return input as NormalizedTaiwanMobile;
}
