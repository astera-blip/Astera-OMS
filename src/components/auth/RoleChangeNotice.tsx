"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { roleLabels, type AssignableRoleKey } from "@/lib/member/rolePolicy";

type RoleNotification = {
  id: string;
  previousRole: string;
  nextRole: AssignableRoleKey;
  changedAt: string;
};

export function RoleChangeNotice() {
  const { status, user } = useAuth();
  const [notification, setNotification] = useState<RoleNotification | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    let active = true;
    if (status !== "signedIn" || !user) {
      setNotification(null);
      return () => { active = false; };
    }
    void user.getIdToken().then((token) => fetch("/api/member/role-notifications", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    })).then(async (response) => {
      if (!response.ok) return null;
      return response.json() as Promise<{ notification: RoleNotification | null }>;
    }).then((payload) => {
      if (active && payload) setNotification(payload.notification);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [status, user]);

  if (!notification || !user) return null;

  async function acknowledge() {
    const notificationId = notification?.id;
    if (!user || !notificationId || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/member/role-notifications", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: notificationId }),
      });
      if (response.ok) setNotification(null);
    } finally {
      setIsAcknowledging(false);
    }
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="mx-auto mt-3 flex w-[min(100%-2rem,72rem)] flex-col gap-3 rounded-2xl border border-[var(--astera-service)] bg-white px-4 py-3 text-[var(--astera-ink)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm">
        你的帳號角色已更新為 {roleLabels[notification.nextRole]}，新的權限已生效。
      </p>
      <button
        type="button"
        onClick={() => void acknowledge()}
        disabled={isAcknowledging}
        className="min-h-11 rounded-xl bg-[var(--astera-service)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isAcknowledging ? "確認中…" : "我知道了"}
      </button>
    </aside>
  );
}
