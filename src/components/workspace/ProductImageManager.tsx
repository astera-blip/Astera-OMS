"use client";

import Image from "next/image";
import { useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "@/components/auth/AuthProvider";
import { storage } from "@/lib/firebase/client";
import type { ProductImage } from "@/lib/product/images";

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ProductImageManager({
  productId,
  images,
  onChanged,
}: {
  productId: string;
  images: ProductImage[];
  onChanged: (images: ProductImage[]) => void;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!productId) {
      setMessage("請先儲存商品，再上傳圖片。");
      return;
    }
    if (!extensionByType[file.type] || file.size > 5 * 1024 * 1024) {
      setMessage("僅接受 5 MB 以內的 JPEG、PNG 或 WebP 圖片。");
      return;
    }
    if (images.length >= 8) {
      setMessage("每項商品最多 8 張圖片。");
      return;
    }
    const token = await user?.getIdToken();
    if (!token) {
      setMessage("需要 Owner 權限才能上傳圖片。");
      return;
    }

    setUploading(true);
    let stage = "圖片讀取";
    try {
      const dimensions = await readImageDimensions(file);
      const imageId = crypto.randomUUID();
      const objectPath = `product-images/${productId}/${imageId}.${extensionByType[file.type]}`;
      const objectRef = ref(storage, objectPath);
      stage = "Storage 上傳";
      await uploadBytes(objectRef, file, {
        contentType: file.type,
        customMetadata: { productId },
      });
      const url = await getDownloadURL(objectRef);
      stage = "Server 驗證";
      const response = await fetch(`/api/workspace/products/${productId}/images/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          objectPath,
          url,
          altText: "",
          width: dimensions.width,
          height: dimensions.height,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        images?: ProductImage[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.images) {
        throw new Error(payload?.error ?? "register_image_failed");
      }
      onChanged(payload.images);
      setMessage("圖片已上傳；第一張圖片會作為商品封面。");
    } catch (error) {
      console.error("product_image_upload_failed", error);
      setMessage(`${stage}失敗，請確認格式、權限與連線後再試一次。`);
    } finally {
      setUploading(false);
    }
  }

  async function save(nextImages: ProductImage[]) {
    const token = await user?.getIdToken();
    if (!token) {
      setMessage("需要 Owner 權限才能更新圖片。");
      return;
    }
    const response = await fetch(`/api/workspace/products/${productId}/images`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ images: nextImages }),
    });
    const payload = (await response.json().catch(() => null)) as {
      images?: ProductImage[];
    } | null;
    if (!response.ok || !payload?.images) {
      setMessage("圖片更新失敗，請稍後再試一次。");
      return;
    }
    onChanged(payload.images);
    setMessage("圖片順序與替代文字已更新。移除的圖片只解除商品引用，不會刪除原始檔。");
  }

  function patchImage(index: number, patch: Partial<ProductImage>) {
    onChanged(images.map((image, currentIndex) =>
      currentIndex === index ? { ...image, ...patch } : image));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) {
      return;
    }
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChanged(next.map((image, currentIndex) => ({ ...image, sortOrder: currentIndex + 1 })));
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Product Images（商品圖片）</h3>
          <p className="mt-2 text-sm text-slate-600">
            最多 8 張；支援 JPEG、PNG、WebP，單檔 5 MB。第一張為封面，可調整順序與替代文字。
          </p>
        </div>
        <label className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          {uploading ? "上傳中…" : "上傳圖片"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || !productId || images.length >= 8}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void upload(file);
              }
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      <div className="mt-5 grid gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[120px_minmax(0,1fr)_auto]"
          >
            <Image
              src={image.url}
              alt={image.altText || "商品圖片預覽"}
              width={120}
              height={120}
              unoptimized
              className="aspect-square rounded-xl object-cover"
            />
            <label className="grid gap-2 text-sm">
              <span className="font-medium">
                Alt Text（替代文字）{index === 0 ? " · Cover（封面）" : ""}
              </span>
              <input
                value={image.altText}
                maxLength={200}
                onChange={(event) => patchImage(index, { altText: event.target.value })}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>上移</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1}>下移</button>
              <button
                type="button"
                onClick={() => onChanged(images.filter((_, currentIndex) => currentIndex !== index))}
                className="text-rose-700"
              >
                解除引用
              </button>
            </div>
          </div>
        ))}
        {images.length === 0 ? <p className="text-sm text-slate-600">尚未上傳商品圖片。</p> : null}
      </div>
      {images.length > 0 ? (
        <button
          type="button"
          onClick={() => void save(images)}
          className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          儲存圖片設定
        </button>
      ) : null}
    </section>
  );
}

async function readImageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}
