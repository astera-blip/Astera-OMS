"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { StoredMemberProfile } from "@/lib/member/repository";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";

export function MemberOperationsBoard() {
  const { role, user } = useAuth();
  const [members, setMembers] = useState<StoredMemberProfile[]>([]);
  const [notes, setNotes] = useState<MemberPrivateNote[]>([]);
  const [message, setMessage] = useState("會員營運資料尚未載入。");

  useEffect(() => {
    async function loadMemberOperations() {
      if (role !== "owner") {
        setMessage("僅 owner 可查看會員營運資料。");
        return;
      }

      const [{ db }, { listMembers, listMemberPrivateNotes }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/member/operationsRepository"),
      ]);
      const [memberRecords, privateNotes] = await Promise.all([
        listMembers(db),
        listMemberPrivateNotes(db),
      ]);

      setMembers(memberRecords);
      setNotes(privateNotes);
      setMessage(`已載入 ${memberRecords.length} 位會員。`);
    }

    void loadMemberOperations().catch(() => setMessage("無法載入會員營運資料。"));
  }, [role]);

  async function updateRisk(uid: string, riskState: MemberPrivateNote["riskState"]) {
    const current = notes.find((note) => note.uid === uid);
    const next = {
      uid,
      riskState,
      internalNote: current?.internalNote ?? "",
    };
    setNotes((items) => [next, ...items.filter((item) => item.uid !== uid)]);

    try {
      const token = await user?.getIdToken();

      if (!token) {
        throw new Error("missing_token");
      }

      const response = await fetch("/api/workspace/member-private-notes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: next }),
      });

      if (!response.ok) {
        throw new Error("save_note_failed");
      }

      setMessage(`已更新 ${uid} 的風險狀態。`);
    } catch {
      setMessage("風險狀態已暫存在畫面，Firestore 同步失敗。");
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Members
        </p>
        <h2 className="mt-2 text-2xl font-semibold">會員營運管理</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Owner 可查看會員資料、風險狀態與內部備註；會員本人不能讀取這些私密營運資料。
        </p>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      </div>

      <div className="grid gap-4">
        {members.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            尚未有可顯示的會員。
          </div>
        ) : (
          members.map((member) => {
            const note = notes.find((item) => item.uid === member.uid);

            return (
              <article key={member.uid} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{member.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {member.email} · {member.mobilePhone} · {member.communityId}
                    </p>
                  </div>
                  <select
                    value={note?.riskState ?? "normal"}
                    onChange={(event) =>
                      void updateRisk(member.uid, event.target.value as MemberPrivateNote["riskState"])
                    }
                    className="rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="normal">normal</option>
                    <option value="watch">watch</option>
                    <option value="blacklisted">blacklisted</option>
                  </select>
                </div>
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  內部備註：{note?.internalNote || "未設定"}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
