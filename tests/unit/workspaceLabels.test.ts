import { describe, expect, it } from "vitest";
import {
  campaignStatusLabels,
  classificationStatusLabels,
  currencyOptions,
  publishStateLabels,
  saleTypeLabels,
} from "@/lib/product/workspaceLabels";

describe("product workspace labels", () => {
  it("uses the approved bilingual status and sale labels", () => {
    expect(publishStateLabels).toEqual({
      draft: "Draft（草稿）",
      published: "Published（已刊登）",
      archived: "Archived（已封存）",
    });
    expect(saleTypeLabels.rushPurchase).toBe("Rush Purchase（代搶）");
    expect(campaignStatusLabels.archived).toBe("Archived（已封存）");
    expect(classificationStatusLabels.active).toBe("Active（啟用）");
  });

  it("places THB first and includes every approved currency", () => {
    expect(currencyOptions[0]).toEqual({ value: "THB", label: "THB（泰銖）" });
    expect(currencyOptions).toEqual([
      { value: "THB", label: "THB（泰銖）" },
      { value: "TWD", label: "TWD（新台幣）" },
      { value: "JPY", label: "JPY（日圓）" },
      { value: "KRW", label: "KRW（韓元）" },
      { value: "USD", label: "USD（美元）" },
    ]);
  });
});
