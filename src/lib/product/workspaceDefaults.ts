import type { PublishState } from "@/domain/common";

export type WorkspaceProductFormDefaults = {
  publishState: PublishState;
};

export type WorkspaceVariantFormDefaults = {
  originalCurrency: "THB";
};

export function getNewProductFormDefaults(): WorkspaceProductFormDefaults {
  return {
    publishState: "published",
  };
}

export function getNewVariantFormDefaults(): WorkspaceVariantFormDefaults {
  return {
    originalCurrency: "THB",
  };
}
