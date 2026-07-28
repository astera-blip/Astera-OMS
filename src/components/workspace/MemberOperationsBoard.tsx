"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { DuplicatePhoneGroup } from "@/lib/member/duplicatePhones";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";

type MemberSummary = {
  uid: string;
  email: string;
  displayName: string;
  communityId: string;
  mobilePhone: string;
  birthday?: string;
};

const riskLabels: Record<MemberPrivateNote["riskState"], string> = {
  normal: "Normal（正常）",
  watch: "Watch（注意）",
  blacklisted: "Blacklisted（黑名單）",
};

export function MemberOperationsBoard() {
  const { role, user } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MemberPrivateNote>>({});
  const [duplicatePhoneGroups, setDuplicatePhoneGroups] =
    useState<DuplicatePhoneGroup[]>([]);
  const [message, setMessage] = useState("會員營運資料尚未載入。");

  useEffect(() => {
    async function loadMemberOperations() {
      if (role !== "owner" || !user) {
        setMessage("僅 Owner 可查看會員營運資料。");
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/workspace/members", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("load_members_failed");
      }
      const payload = (await response.json()) as {
        members?: MemberSummary[];
        privateNotes?: MemberPrivateNote[];
        duplicatePhoneGroups?: DuplicatePhoneGroup[];
      };
      const memberRecords = payload.members ?? [];
      const privateNotes = payload.privateNotes ?? [];
      setMembers(memberRecords);
      setDrafts(Object.fromEntries(memberRecords.map((member) => {
        const note = privateNotes.find((entry) => entry.uid === member.uid);
        return [member.uid, note ?? {
          uid: member.uid,
          riskState: "normal",
          internalNote: "",
        }];
      })));
      setDuplicatePhoneGroups(payload.duplicatePhoneGroups ?? []);
      setMessage(`已載入 ${memberRecords.length} 位會員。`);
    }
    void loadMemberOperations().catch(() =>
      setMessage("無法載入會員營運資料，請確認網路後再試一次。"));
  }, [role, user]);

  const duplicateUids = useMemo(
    () => new Set(duplicatePhoneGroups.flatMap((group) => group.memberUids)),
    [duplicatePhoneGroups],
  );

  async function saveNote(uid: string) {
    const note = drafts[uid];
    const token = await user?.getIdToken();
    if (!note || !token) {
      setMessage("需要 Owner 權限才能更新會員營運資料。");
      return;
    }
    const response = await fetch("/api/workspace/member-private-notes", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(note),
    });
    const payload = (await response.json().catch(() => null)) as {
      note?: MemberPrivateNote;
    } | null;
    if (!response.ok || !payload?.note) {
      setMessage("會員風險與內部備註更新失敗，請稍後再試一次。");
      return;
    }
    setDrafts((current) => ({ ...current, [uid]: payload.note! }));
    setMessage(`已更新 ${uid}；本次變更已寫入 Audit Log。`);
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Members（會員）
        </p>
        <h2 className="mt-2 text-2xl font-semibold">會員營運管理</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Owner 可查看會員資料、風險狀態與內部備註；會員本人不能讀取私密營運資料。
          疑似重複手機只顯示警示，不會阻止註冊。
        </p>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      </div>

      {duplicatePhoneGroups.length > 0 ? (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">疑似重複會員</h3>
          <div className="mt-3 grid gap-2 text-sm text-amber-900">
            {duplicatePhoneGroups.map((group) => (
              <p key={group.mobilePhone}>
                {group.mobilePhone}：{group.memberUids.map((uid) =>
                  members.find((member) => member.uid === uid)?.displayName || uid).join("、")}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4">
        {members.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            尚未有可顯示的會員。
          </div>
        ) : (
          members.map((member) => {
            const draft = drafts[member.uid] ?? {
              uid: member.uid,
              riskState: "normal" as const,
              internalNote: "",
            };
            return (
              <article key={member.uid} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{member.displayName}</h3>
                      {duplicateUids.has(member.uid) ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                          疑似重複會員
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {member.email} · {member.mobilePhone} · {member.communityId}
                    </p>
                  </div>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Risk Status（風險狀態）</span>
                    <select
                      value={draft.riskState}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [member.uid]: {
                          ...draft,
                          riskState: event.target.value as MemberPrivateNote["riskState"],
                        },
                      }))}
                      className="rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(riskLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-4 grid gap-2 text-sm">
                  <span className="font-medium">Internal Note（內部備註）</span>
                  <textarea
                    value={draft.internalNote ?? ""}
                    maxLength={2000}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [member.uid]: { ...draft, internalNote: event.target.value },
                    }))}
                    className="min-h-24 rounded-2xl border border-slate-300 px-4 py-3"
                    placeholder="僅供後台作業使用，會員無法讀取。"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveNote(member.uid)}
                  className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                >
                  儲存會員營運資料
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
