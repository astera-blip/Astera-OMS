export type CartItemDraft = {
  productId: string;
  variantId: string;
  saleCampaignId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPriceTwd: number;
  quantity: number;
  publicSaleNotes?: string;
};

export type CartDraft = {
  memberUid?: string;
  items: CartItemDraft[];
};

export function normalizeCartDraft(draft: CartDraft) {
  const items = draft.items
    .map((item) => ({
      productId: item.productId.trim(),
      variantId: item.variantId.trim(),
      saleCampaignId: item.saleCampaignId.trim(),
      productName: item.productName.trim(),
      variantName: item.variantName.trim(),
      sku: item.sku.trim(),
      unitPriceTwd: Number(item.unitPriceTwd),
      quantity: Math.trunc(Number(item.quantity)),
      publicSaleNotes: item.publicSaleNotes?.trim(),
    }))
    .filter((item) => item.productId && item.variantId && item.saleCampaignId && item.productName && item.variantName && item.sku && item.unitPriceTwd > 0 && item.quantity > 0);

  return {
    memberUid: draft.memberUid?.trim(),
    items,
  };
}
