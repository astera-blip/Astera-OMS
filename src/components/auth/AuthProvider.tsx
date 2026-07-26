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

    async function subscribe() {
      const [{ auth }, { onAuthStateChanged }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/auth"),
      ]);

      if (!active) {
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!active) {
          return;
        }

        setError(null);
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
    const [{ auth }, { GoogleAuthProvider, signInWithPopup }] =
      await Promise.all([
        import("@/lib/firebase/client"),
        import("firebase/auth"),
      ]);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setError("Google 登入未完成，請再試一次。");
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
