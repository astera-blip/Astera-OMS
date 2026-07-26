import { collection, doc, getDocs, setDoc, type Firestore } from "firebase/firestore";
import {
  fallbackBrandContent,
  sortBrandFaqs,
  type BrandAnnouncement,
  type BrandChannel,
  type BrandContentBundle,
  type BrandFaq,
  type SiteSettings,
} from "./brandContent";

export async function loadBrandContent(db: Firestore): Promise<BrandContentBundle> {
  const [siteSettingsSnapshot, channelsSnapshot, faqsSnapshot, announcementsSnapshot] = await Promise.all([
    getDocs(collection(db, "siteSettings")),
    getDocs(collection(db, "socialLinks")),
    getDocs(collection(db, "faqs")),
    getDocs(collection(db, "announcements")),
  ]);

  const siteSettings = siteSettingsSnapshot.docs[0]
    ? (siteSettingsSnapshot.docs[0].data() as SiteSettings)
    : fallbackBrandContent.siteSettings;
  const channels = channelsSnapshot.docs.map((snapshot) => snapshot.data() as BrandChannel);
  const faqs = sortBrandFaqs(faqsSnapshot.docs.map((snapshot) => snapshot.data() as BrandFaq));
  const announcements = announcementsSnapshot.docs
    .map((snapshot) => snapshot.data() as BrandAnnouncement)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return {
    siteSettings,
    channels: channels.length > 0 ? channels : fallbackBrandContent.channels,
    faqs: faqs.length > 0 ? faqs : fallbackBrandContent.faqs,
    announcements: announcements.length > 0 ? announcements : fallbackBrandContent.announcements,
  };
}

export async function saveBrandContent(db: Firestore, content: BrandContentBundle) {
  if (content.siteSettings) {
    await setDoc(doc(db, "siteSettings", content.siteSettings.id), content.siteSettings);
  }

  await Promise.all([
    ...content.channels.map((channel) => setDoc(doc(db, "socialLinks", channel.key), channel)),
    ...content.faqs.map((faq) => setDoc(doc(db, "faqs", faq.id), faq)),
    ...content.announcements.map((announcement) => setDoc(doc(db, "announcements", announcement.id), announcement)),
  ]);
}
