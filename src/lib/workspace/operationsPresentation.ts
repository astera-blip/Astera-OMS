import type { LocalPayment } from "@/lib/payment/manualBankTransfer";

type OrderReference = {
  id: string;
  orderNumber?: string;
  createdAt?: string;
};

const paymentReviewStatusLabels: Record<LocalPayment["status"], string> = {
  pendingReview: "待確認",
  confirmed: "已確認",
  rejected: "已拒絕",
  reversed: "已撤銷",
};

export function formatOperationsOrderReference(order: OrderReference): string {
  const orderNumber = order.orderNumber?.trim();
  if (orderNumber) {
    return orderNumber;
  }

  const legacyDate = extractLegacyOrderDate(order.id) ?? extractIsoDate(order.createdAt);
  return legacyDate ? `歷史訂單・${legacyDate}` : "歷史訂單";
}

export function paymentReviewStatusLabel(status: LocalPayment["status"]): string {
  return paymentReviewStatusLabels[status];
}

export function formatOperationsRecipientName(recipientName?: string): string {
  const name = recipientName?.trim();
  return name ? `收件人：${name}` : "收件人：未填寫";
}

export function classificationSaveFeedback(input:
  | { state: "saving" }
  | { state: "saved"; label: string }
  | { state: "error"; error?: string },
): string {
  if (input.state === "saving") {
    return "儲存中…";
  }
  if (input.state === "saved") {
    return `已儲存 ${input.label}。`;
  }
  if (input.error === "classification_label_conflict") {
    return "已有相同名稱的分類。";
  }
  if (input.error === "classification_label_required") {
    return "請輸入分類顯示名稱。";
  }
  return "分類儲存失敗，請確認資料與網路後再試一次。";
}

function extractLegacyOrderDate(id: string): string | null {
  const match = /(?:^|_)(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(id);
  return match ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}` : null;
}

function extractIsoDate(value?: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  return match ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}` : null;
}
