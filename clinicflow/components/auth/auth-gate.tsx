"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { canAccessDoctor } from "@/lib/auth/roles";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { client } = tryGetSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(client));

  useEffect(() => {
    if (!client) {
      return;
    }

    const loadSession = async () => {
      const { data } = await client.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    if (session && pathname === "/login") {
      router.replace("/");
      return;
    }

    if (session && pathname.startsWith("/doctor") && !canAccessDoctor(session)) {
      router.replace("/reception");
    }
  }, [loading, pathname, router, session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-line bg-white px-6 py-4 text-sm font-bold text-foreground">
          جاري التحقق من تسجيل الدخول...
        </div>
      </div>
    );
  }

  if (!session && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
