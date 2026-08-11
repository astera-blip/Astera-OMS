import Image from "next/image";
import type { ProductImage } from "@/lib/product/images";

export function ProductCoverImage({
  image,
  productName,
  priority = false,
}: {
  image?: ProductImage;
  productName: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-slate-100 px-4 text-center text-sm text-slate-500">
        {productName}
        <br />
        圖片準備中
      </div>
    );
  }
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
      <Image
        src={image.url}
        alt={image.altText || productName}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 420px"
        className="object-cover"
      />
    </div>
  );
}
