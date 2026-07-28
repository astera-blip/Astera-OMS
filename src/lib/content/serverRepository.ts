import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  emptyBrandContent,
  sortBrandFaqs,
  type BrandAnnouncement,
  type BrandChannel,
  type BrandContentBundle,
  type BrandFaq,
  type SiteSettings,
} from "./brandContent";

export async function loadBrandContentServer(): Promise<BrandContentBundle> {
  if (!canUseAdminContentRuntime()) {
    return emptyBrandContent;
  }

  const db = getAdminFirestore();

  const [siteSettingsSnapshot, channelsSnapshot, faqsSnapshot, announcementsSnapshot] = await Promise.all([
    db.collection("siteSettings").doc("site-default").get(),
    db.collection("socialLinks").get(),
    db.collection("faqs").get(),
    db.collection("announcements").get(),
  ]);

  const siteSettings = siteSettingsSnapshot.exists
    ? (siteSettingsSnapshot.data() as SiteSettings)
    : null;
  const channels = channelsSnapshot.docs.map((snapshot) => snapshot.data() as BrandChannel);
  const faqs = sortBrandFaqs(faqsSnapshot.docs.map((snapshot) => snapshot.data() as BrandFaq));
  const announcements = announcementsSnapshot.docs
    .map((snapshot) => snapshot.data() as BrandAnnouncement)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return {
    ...emptyBrandContent,
    siteSettings,
    channels,
    faqs,
    announcements,
  };
}

function canUseAdminContentRuntime() {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
      || process.env.GOOGLE_APPLICATION_CREDENTIALS
      || (process.env.VERCEL && process.env.VERCEL_OIDC_TOKEN),
  );
}
