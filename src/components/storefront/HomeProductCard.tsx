import Link from "next/link";
import { ProductCoverImage } from "@/components/storefront/ProductCoverImage";
import {
  getDefaultVariant,
  getEffectiveCatalogPriceTwd,
  type PublicCatalogItem,
} from "@/lib/catalog/publicCatalog";
import {
  featuredCampaign,
  formatCampaignDeadline,
  saleTypeCustomerLabels,
} from "@/lib/catalog/featuredProducts";

export function HomeProductCard({
  item,
  showDeadline,
  submitting,
  signedIn,
  onAddToCart,
}: {
  item: PublicCatalogItem;
  showDeadline: boolean;
  submitting: boolean;
  signedIn: boolean;
  onAddToCart: (item: PublicCatalogItem) => void;
}) {
  const variant = getDefaultVariant(item);
  const campaign = featuredCampaign(item);
  const price = variant ? getEffectiveCatalogPriceTwd(variant, campaign) : 0;
  const canBuy = campaign?.status === "open" && !!variant;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-astera-border bg-astera-surface p-2.5 transition-colors hover:border-astera-brand sm:p-3">
      <Link href={`/products/${item.product.id}`} className="block rounded-lg">
        <ProductCoverImage image={item.product.images?.[0]} productName={item.product.name} />
      </Link>
      <div className="mt-3 flex min-h-6 flex-wrap gap-1">
        {campaign ? (
          <span className="rounded-full bg-astera-campaign px-2 py-1 text-[10px] font-semibold sm:text-xs">
            {saleTypeCustomerLabels[campaign.saleType]}
          </span>
        ) : null}
        {campaign?.requiresSupplement ? (
          <span className="rounded-full bg-astera-brand-soft px-2 py-1 text-[10px] font-semibold text-astera-service sm:text-xs">二補</span>
        ) : null}
      </div>
      <Link href={`/products/${item.product.id}`} className="mt-2 line-clamp-2 text-sm font-semibold leading-5 hover:text-astera-brand sm:text-base">
        {item.product.name}
      </Link>
      <p className="mt-2 text-base font-semibold tabular-nums sm:text-lg">NT$ {price.toLocaleString()}</p>
      <p className="mt-1 line-clamp-1 text-xs text-astera-secondary">{campaign?.title ?? "販售活動準備中"}</p>
      {showDeadline ? (
        <p className="mt-1 min-h-10 text-xs font-medium leading-5 text-astera-service">
          {formatCampaignDeadline(campaign?.endsAt)}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canBuy || submitting}
        onClick={() => onAddToCart(item)}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-astera-brand px-2 text-xs font-semibold text-white transition-colors hover:bg-astera-ink disabled:cursor-not-allowed disabled:bg-astera-border disabled:text-astera-secondary sm:text-sm"
      >
        {submitting ? "加入中…" : canBuy ? (signedIn ? "加入購物車" : "登入後加入") : "目前無法購買"}
      </button>
    </article>
  );
}
