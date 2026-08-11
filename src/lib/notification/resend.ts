import {
  markNotificationEventFailed,
  markNotificationEventSent,
  type NotificationEvent,
} from "@/lib/notification/events";

export type ResendNotificationConfig = {
  apiKey?: string;
  from?: string;
  replyTo?: string;
};

export type ResendSendPayload = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
};

export type ResendSendResult = {
  id: string;
};

export async function deliverNotificationEvent(
  event: NotificationEvent,
  input: {
    attemptedAt: string;
    config: ResendNotificationConfig;
    send?: (payload: ResendSendPayload, apiKey: string) => Promise<ResendSendResult>;
  },
): Promise<NotificationEvent> {
  if (!input.config.apiKey || !input.config.from) {
    return markNotificationEventFailed(event, {
      attemptedAt: input.attemptedAt,
      error: "Resend is not configured.",
    });
  }

  try {
    const send = input.send ?? sendWithResendApi;
    const result = await send(buildResendPayload(event, input.config), input.config.apiKey);

    return markNotificationEventSent(event, {
      attemptedAt: input.attemptedAt,
      providerMessageId: result.id,
    });
  } catch (error) {
    return markNotificationEventFailed(event, {
      attemptedAt: input.attemptedAt,
      error: error instanceof Error ? error.message : "Unknown Resend error.",
    });
  }
}

export function getResendNotificationConfig(): ResendNotificationConfig {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL ?? "Astera <orders@updates.asteratw.com>",
    replyTo: process.env.RESEND_REPLY_TO_EMAIL ?? process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  };
}

function buildResendPayload(event: NotificationEvent, config: ResendNotificationConfig): ResendSendPayload {
  const orderLabel = event.orderNumber ?? event.orderId;
  const subject = event.type === "order.created"
    ? `Astera 訂單 ${orderLabel} 已成立`
    : `Astera 訂單 ${orderLabel} 付款已確認`;

  return {
    from: config.from ?? "Astera <orders@updates.asteratw.com>",
    to: event.recipientEmail,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    subject,
    text: event.message,
  };
}

async function sendWithResendApi(payload: ResendSendPayload, apiKey: string): Promise<ResendSendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      subject: payload.subject,
      text: payload.text,
    }),
  });

  const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok || !body?.id) {
    throw new Error(body?.message ?? `Resend request failed with HTTP ${response.status}.`);
  }

  return { id: body.id };
}
