"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  validateMemberProfileDraft,
  type MemberProfileDraft,
  type MemberProfileField,
} from "@/lib/member/profile";

const emptyDraft: MemberProfileDraft = {
  displayName: "",
  communityId: "",
  mobilePhone: "",
  birthday: "",
};

type NameDraft = {
  lastName: string;
  firstName: string;
};

function splitDisplayName(displayName: string): NameDraft {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return { lastName: "", firstName: "" };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length >= 2) {
    const [lastName, ...firstNameParts] = parts;
    return {
      lastName: lastName ?? "",
      firstName: firstNameParts.join(" "),
    };
  }

  return {
    lastName: trimmed.slice(0, 1),
    firstName: trimmed.slice(1),
  };
}

function combineDisplayName(nameDraft: NameDraft) {
  return `${nameDraft.lastName.trim()}${nameDraft.firstName.trim()}`.trim();
}

export default function MemberProfilePage() {
  const router = useRouter();
  const {
    status,
    user,
    profile,
    error: authError,
    signInWithGoogle,
    refreshProfile,
  } = useAuth();
  const [draft, setDraft] = useState<MemberProfileDraft>(() =>
    profile
      ? {
          displayName: profile.displayName,
          communityId: profile.communityId,
          mobilePhone: profile.mobilePhone,
          birthday: profile.birthday ?? "",
        }
      : {
          ...emptyDraft,
          displayName: user?.displayName ?? "",
        },
  );
  const [nameDraft, setNameDraft] = useState<NameDraft>(() =>
    splitDisplayName(profile?.displayName ?? user?.displayName ?? ""),
  );
  const [errors, setErrors] = useState<
    Partial<Record<MemberProfileField, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateField(field: MemberProfileField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function updateNameField(field: keyof NameDraft, value: string) {
    setNameDraft((current) => ({ ...current, [field]: value }));
    setDraft((current) => ({
      ...current,
      displayName: combineDisplayName({ ...nameDraft, [field]: value }),
    }));
    setErrors((current) => ({ ...current, displayName: undefined }));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDraft = {
      ...draft,
      displayName: combineDisplayName(nameDraft),
    };
    const validation = validateMemberProfileDraft(nextDraft);

    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    if (!user?.email) {
      setMessage("Google 帳號沒有可用 Email，無法建立會員資料。");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/member/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nextDraft),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        errors?: Partial<Record<MemberProfileField, string>>;
      } | null;

      if (!response.ok || !result?.ok) {
        setErrors(result?.errors ?? {});
        setMessage("儲存失敗，請檢查資料後再試一次。");
        return;
      }

      await refreshProfile();
      setMessage("會員資料已儲存。");
      router.replace("/");
    } catch {
      setMessage("儲存失敗，請檢查連線後再試一次。");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <ProfilePageMessage text="正在載入登入狀態..." />;
  }

  if (status === "signedOut") {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
        <section className="mx-auto max-w-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-amber-700">Astera OMS 會員</p>
          <h1 className="mt-2 text-2xl font-semibold">登入後建立會員資料</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            目前會員帳號使用 Google 登入。請補齊聯絡資訊，方便訂單、付款與配送聯繫。
          </p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="mt-6 h-11 w-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            使用 Google 登入
          </button>
          {authError ? <p className="mt-3 text-sm text-red-700">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:py-12">
      <section className="mx-auto max-w-2xl">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-amber-700">會員帳號</p>
          <h1 className="mt-2 text-3xl font-semibold">{profile ? "會員資料" : "完成會員資料"}</h1>
          <p className="mt-2 text-sm text-slate-600">登入帳號：{user?.email}</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5 border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              id="lastName"
              label="姓"
              value={nameDraft.lastName}
              error={errors.displayName}
              autoComplete="family-name"
              onChange={(value) => updateNameField("lastName", value)}
            />
            <ProfileField
              id="firstName"
              label="名"
              value={nameDraft.firstName}
              error={undefined}
              autoComplete="given-name"
              onChange={(value) => updateNameField("firstName", value)}
            />
          </div>
          <ProfileField
            id="communityId"
            label="社群內 ID"
            value={draft.communityId}
            error={errors.communityId}
            onChange={(value) => updateField("communityId", value)}
          />
          <ProfileField
            id="mobilePhone"
            label="手機"
            value={draft.mobilePhone}
            error={errors.mobilePhone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0912 345 678"
            onChange={(value) => updateField("mobilePhone", value)}
          />
          <ProfileField
            id="birthday"
            label="生日（選填）"
            value={draft.birthday}
            error={errors.birthday}
            type="date"
            autoComplete="bday"
            onChange={(value) => updateField("birthday", value)}
          />

          {message ? (
            <p role="status" className="text-sm text-slate-700">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "儲存中..." : "儲存會員資料"}
          </button>
        </form>
      </section>
    </main>
  );
}

type ProfileFieldProps = {
  id: MemberProfileField | keyof NameDraft;
  label: string;
  value: string;
  error?: string;
  type?: string;
  inputMode?: "tel";
  autoComplete?: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

function ProfileField({
  id,
  label,
  value,
  error,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  onChange,
}: ProfileFieldProps) {
  const errorId = `${id}-error`;

  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border border-slate-300 bg-white px-3 text-base outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
      />
      {error ? <span id={errorId} className="text-sm font-normal text-red-700">{error}</span> : null}
    </label>
  );
}

function ProfilePageMessage({ text }: { text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-700">
      <p>{text}</p>
    </main>
  );
}
