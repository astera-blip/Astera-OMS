import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isOwnerClaim, requireFirebaseUser } from "@/lib/firebase/serverAuth";
import type {
  BrandAnnouncement,
  BrandChannel,
  BrandContentBundle,
  BrandFaq,
  SiteSettings,
} from "@/lib/content/brandContent";

type ContentRequestBody = {
  content?: BrandContentBundle;
};

export async function PUT(request: Request) {
  try {
    const claims = await requireFirebaseUser(request);

    if (!isOwnerClaim(claims)) {
      return NextResponse.json({ error: "owner_required" }, { status: 403 });
    }

    const body = (await request.json()) as ContentRequestBody;
    const content = body.content;

    if (!isBrandContentBundle(content)) {
      return NextResponse.json({ error: "invalid_content" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const batch = db.batch();

    if (content.siteSettings) {
      batch.set(db.collection("siteSettings").doc(content.siteSettings.id), content.siteSettings);
    }

    for (const channel of content.channels) {
      batch.set(db.collection("socialLinks").doc(channel.key), channel);
    }

    for (const faq of content.faqs) {
      batch.set(db.collection("faqs").doc(faq.id), faq);
    }

    for (const announcement of content.announcements) {
      batch.set(db.collection("announcements").doc(announcement.id), announcement);
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: message === "missing_token" ? 401 : 500 });
  }
}

function isBrandContentBundle(value: unknown): value is BrandContentBundle {
  const content = value as Partial<BrandContentBundle>;

  return !!content
    && (content.siteSettings === null || isSiteSettings(content.siteSettings))
    && Array.isArray(content.channels)
    && content.channels.every(isBrandChannel)
    && Array.isArray(content.faqs)
    && content.faqs.every(isBrandFaq)
    && Array.isArray(content.announcements)
    && content.announcements.every(isBrandAnnouncement);
}

function isSiteSettings(value: unknown): value is SiteSettings {
  const settings = value as Partial<SiteSettings>;

  return !!settings
    && typeof settings.id === "string"
    && settings.id.length > 0
    && typeof settings.brandName === "string"
    && settings.brandName.length > 0
    && typeof settings.heroTitle === "string"
    && settings.heroTitle.length > 0
    && typeof settings.heroDescription === "string"
    && settings.heroDescription.length > 0
    && typeof settings.contactEmail === "string"
    && settings.contactEmail.length > 0
    && typeof settings.supportHours === "string"
    && settings.supportHours.length > 0
    && typeof settings.shippingNote === "string"
    && settings.shippingNote.length > 0
    && typeof settings.updatedAt === "string";
}

function isBrandChannel(value: unknown): value is BrandChannel {
  const channel = value as Partial<BrandChannel>;

  return !!channel
    && (channel.key === "lineCommunity" || channel.key === "lineOfficial" || channel.key === "instagram")
    && typeof channel.title === "string"
    && channel.title.length > 0
    && typeof channel.url === "string"
    && typeof channel.description === "string"
    && channel.description.length > 0
    && (channel.status === "active" || channel.status === "planned" || channel.status === "disabled");
}

function isBrandFaq(value: unknown): value is BrandFaq {
  const faq = value as Partial<BrandFaq>;

  return !!faq
    && typeof faq.id === "string"
    && faq.id.length > 0
    && typeof faq.question === "string"
    && faq.question.length > 0
    && typeof faq.answer === "string"
    && faq.answer.length > 0
    && typeof faq.order === "number"
    && faq.order >= 0
    && (faq.status === "published" || faq.status === "draft");
}

function isBrandAnnouncement(value: unknown): value is BrandAnnouncement {
  const announcement = value as Partial<BrandAnnouncement>;

  return !!announcement
    && typeof announcement.id === "string"
    && announcement.id.length > 0
    && typeof announcement.title === "string"
    && announcement.title.length > 0
    && typeof announcement.body === "string"
    && announcement.body.length > 0
    && typeof announcement.publishedAt === "string"
    && (announcement.status === "published" || announcement.status === "draft");
}
