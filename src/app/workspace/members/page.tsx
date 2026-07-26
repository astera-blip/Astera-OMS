"use client";

import { useEffect, useState } from "react";
import { findDuplicatePhones, loadMembers, type MemberAdminRecord } from "@/lib/member/adminRepository";

export default function WorkspaceMembersPage() {
  const [members, setMembers] = useState<MemberAdminRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void import("@/lib/firebase/client")
      .then(({ db }) => loadMembers(db))
      .then((items) => {
        if (active) {
          setMembers(items);
        }
      })
      .catch(() => {
        if (active) {
          setStatus("無法載入會員資料。");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const duplicateGroups = findDuplicatePhones(members);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Members</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            會員名單、電話重複警示與基本聯絡資訊集中於此。
          </p>
        </div>

        {status ? <p className="mt-4 text-sm text-red-700">{status}</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Member list</h2>
            <div className="mt-4 grid gap-3">
              {members.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有會員資料。</p>
              ) : (
                members.map((member) => (
                  <div key={member.uid} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{member.displayName}</p>
                        <p className="text-sm text-slate-500">{member.email}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {member.mobilePhone}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{member.communityId}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Duplicate phone warnings</h2>
            <div className="mt-4 grid gap-3">
              {duplicateGroups.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有重複電話。</p>
              ) : (
                duplicateGroups.map((group) => (
                  <div key={group.mobilePhone} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">{group.mobilePhone}</p>
                    <ul className="mt-2 grid gap-1 text-sm text-amber-900">
                      {group.items.map((member) => (
                        <li key={member.uid}>{member.displayName} · {member.communityId}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
