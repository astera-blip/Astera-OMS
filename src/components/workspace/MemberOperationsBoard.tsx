"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { RoleKey } from "@/domain/identity";
import type { DuplicatePhoneGroup } from "@/lib/member/duplicatePhones";
import type { MemberPrivateNote } from "@/lib/member/operationsRepository";
import {
  ASSIGNABLE_ROLE_KEYS,
  roleLabels,
  type AssignableRoleKey,
} from "@/lib/member/rolePolicy";

type MemberSummary = {
  uid: string;
  email: string;
  displayName: string;
  communityId: string;
  mobilePhone: string;
  birthday?: string;
  role: RoleKey;
};

type PendingRoleChange = {
  uid: string;
  displayName: string;
  currentRole: RoleKey;
  nextRole: AssignableRoleKey;
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
  const [savingMemberUid, setSavingMemberUid] = useState("");
  const [memberSaveFeedback, setMemberSaveFeedback] = useState<Record<string, string>>({});
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  async function fetchMemberOperations(currentUser: NonNullable<typeof user>) {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/workspace/members", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("load_members_failed");
    return (await response.json()) as {
      members?: MemberSummary[];
      privateNotes?: MemberPrivateNote[];
      duplicatePhoneGroups?: DuplicatePhoneGroup[];
    };
  }

  function applyMemberOperations(payload: {
    members?: MemberSummary[];
    privateNotes?: MemberPrivateNote[];
    duplicatePhoneGroups?: DuplicatePhoneGroup[];
  }) {
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

  useEffect(() => {
    if (role !== "owner" || !user) return;
    const currentUser = user;
    let active = true;
    async function load() {
      try {
        const payload = await fetchMemberOperations(currentUser);
        if (active) applyMemberOperations(payload);
      } catch {
        if (active) setMessage("無法載入會員營運資料，請確認網路後再試一次。");
      }
    }
    void load();
    return () => { active = false; };
    // The authenticated user and role are the authoritative reload boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user]);

  const duplicateUids = useMemo(
    () => new Set(duplicatePhoneGroups.flatMap((group) => group.memberUids)),
    [duplicatePhoneGroups],
  );

  async function saveNote(uid: string) {
    if (savingMemberUid === uid) {
      return;
    }
    const note = drafts[uid];
    const token = await user?.getIdToken();
    if (!note || !token) {
      setMemberSaveFeedback((current) => ({
        ...current,
        [uid]: "需要 Owner 權限才能儲存。",
      }));
      return;
    }
    setSavingMemberUid(uid);
    setMemberSaveFeedback((current) => ({ ...current, [uid]: "儲存中…" }));
    try {
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
        throw new Error("member_operations_save_failed");
      }
      setDrafts((current) => ({ ...current, [uid]: payload.note! }));
      setMemberSaveFeedback((current) => ({
        ...current,
        [uid]: "已儲存風險狀態與內部備註。",
      }));
      setMessage("會員營運資料已更新；本次變更已寫入 Audit Log。");
    } catch {
      setMemberSaveFeedback((current) => ({
        ...current,
        [uid]: "儲存失敗，請確認資料與網路後再試一次。",
      }));
    } finally {
      setSavingMemberUid((current) => current === uid ? "" : current);
    }
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange || !user || isChangingRole) return;
    setIsChangingRole(true);
    setRoleError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/workspace/members/${pendingRoleChange.uid}/role`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: pendingRoleChange.nextRole }),
      });
      if (!response.ok) throw new Error("role_change_failed");
      const changed = pendingRoleChange;
      setPendingRoleChange(null);
      applyMemberOperations(await fetchMemberOperations(user));
      setMessage(`已將 ${changed.displayName} 設為 ${roleLabels[changed.nextRole]}；新的權限已立即生效。`);
    } catch {
      setRoleError("角色變更失敗，請確認會員資料與權限後再試一次。");
    } finally {
      setIsChangingRole(false);
    }
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
        <p className="mt-3 text-sm text-slate-500" aria-live="polite">{message}</p>
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
                <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:items-end">
                  <div>
                    <p className="text-sm font-medium">Role（目前角色）</p>
                    <p className="mt-1 text-sm text-slate-600">{roleLabels[member.role]}</p>
                  </div>
                  {member.role !== "owner" ? (
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">指派角色</span>
                      <select
                        aria-label={`${member.displayName || member.uid} 指派角色`}
                        defaultValue=""
                        onChange={(event) => {
                          const nextRole = event.target.value as AssignableRoleKey;
                          if (!nextRole || nextRole === member.role) return;
                          setRoleError(null);
                          setPendingRoleChange({
                            uid: member.uid,
                            displayName: member.displayName || member.uid,
                            currentRole: member.role,
                            nextRole,
                          });
                          event.currentTarget.value = "";
                        }}
                        className="min-h-11 rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">選擇新角色</option>
                        {ASSIGNABLE_ROLE_KEYS.filter((value) => value !== member.role).map((value) => (
                          <option key={value} value={value}>{roleLabels[value]}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-slate-600">Owner 權限只能透過獨立管理工具維護。</p>
                  )}
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
                  disabled={savingMemberUid === member.uid}
                  className="mt-3 min-h-11 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {savingMemberUid === member.uid ? "儲存中…" : "儲存風險狀態與內部備註"}
                </button>
                {memberSaveFeedback[member.uid] ? (
                  <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">
                    {memberSaveFeedback[member.uid]}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="role-change-title"
            aria-describedby="role-change-description"
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
          >
            <h3 id="role-change-title" className="text-xl font-semibold">確認變更角色</h3>
            <p id="role-change-description" className="mt-3 text-sm leading-6 text-slate-600">
              將 {pendingRoleChange.displayName} 從 {roleLabels[pendingRoleChange.currentRole]}
              變更為 {roleLabels[pendingRoleChange.nextRole]}。變更後舊登入憑證會失效，對方需重新登入。
            </p>
            {roleError ? <p role="alert" className="mt-3 text-sm text-rose-700">{roleError}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isChangingRole}
                onClick={() => setPendingRoleChange(null)}
                className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isChangingRole}
                onClick={() => void confirmRoleChange()}
                className="min-h-11 rounded-xl bg-[var(--astera-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isChangingRole ? "角色變更中…" : "確認變更角色"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
