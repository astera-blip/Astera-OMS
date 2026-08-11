"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import type { RoleKey } from "@/domain/identity";
import type { StoredMemberProfile } from "@/lib/member/repository";
import { getRoleFromClaims } from "@/lib/member/role";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: StoredMemberProfile | null;
  role: RoleKey;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StoredMemberProfile | null>(null);
  const [role, setRole] = useState<RoleKey>("member");
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User) => {
    const [{ db }, { loadMemberProfile }] = await Promise.all([
      import("@/lib/firebase/client"),
      import("@/lib/member/repository"),
    ]);

    return loadMemberProfile(db, currentUser.uid);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    setProfile(await loadProfile(user));
  }, [loadProfile, user]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let redirectResultError: string | null = null;

    async function subscribe() {
      const [{ auth }, { getRedirectResult, onAuthStateChanged }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/auth"),
      ]);

      if (!active) {
        return;
      }

      await getRedirectResult(auth).catch((error: unknown) => {
        if (active) {
          redirectResultError = getGoogleSignInErrorMessage(error);
          setError(redirectResultError);
        }
      });

      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!active) {
          return;
        }

        if (!redirectResultError) {
          setError(null);
        } else if (currentUser) {
          setError(null);
        }
        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
          setRole("member");
          setStatus("signedOut");
          return;
        }

        try {
          const [memberProfile, token] = await Promise.all([
            loadProfile(currentUser),
            currentUser.getIdTokenResult(true),
          ]);

          if (!active) {
            return;
          }

          setProfile(memberProfile);
          setRole(getRoleFromClaims(token.claims));
          setStatus("signedIn");
        } catch {
          if (active) {
            setError("無法載入會員資料，請稍後再試。");
            setStatus("signedIn");
          }
        }
      });
    }

    void subscribe().catch(() => {
      if (active) {
        setError("登入服務暫時無法使用。");
        setStatus("signedOut");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const [{ auth }, { GoogleAuthProvider, signInWithRedirect }] =
      await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/auth"),
      ]);

    const provider = new GoogleAuthProvider();

    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(getGoogleSignInErrorMessage(error));
    }
  }, []);

  const signOutCurrentUser = useCallback(async () => {
    const [{ auth }, { signOut }] = await Promise.all([
      import("@/lib/firebase/client"),
      import("firebase/auth"),
    ]);

    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      role,
      error,
      signInWithGoogle,
      signOut: signOutCurrentUser,
      refreshProfile,
    }),
    [
      status,
      user,
      profile,
      role,
      error,
      signInWithGoogle,
      signOutCurrentUser,
      refreshProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <ProfileCompletionGuard>{children}</ProfileCompletionGuard>
    </AuthContext.Provider>
  );
}

function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (
      status === "signedIn" &&
      !profile &&
      pathname !== "/account/profile"
    ) {
      router.replace("/account/profile");
    }
  }, [pathname, profile, router, status]);

  return children;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

function isFirebaseError(error: unknown): error is { code: string } {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof (error as { code?: unknown }).code === "string";
}

function getGoogleSignInErrorMessage(error: unknown) {
  if (!isFirebaseError(error)) {
    return "Google 登入未完成，請再試一次。";
  }

  if (error.code === "auth/unauthorized-domain") {
    return "這個網址尚未允許 Google 登入，請改用正式測試網址或請管理員加入 Firebase 授權網域。";
  }

  if (error.code === "auth/popup-blocked") {
    return "瀏覽器封鎖了 Google 登入視窗，請允許彈出視窗或改用重新導向登入。";
  }

  if (error.code === "auth/popup-closed-by-user") {
    return "Google 登入視窗已關閉，請重新點選登入。";
  }

  return `Google 登入未完成（${error.code}），請再試一次。`;
}
