"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export function SessionActions() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const { client } = tryGetSupabaseBrowserClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const loadSession = async () => {
      const { data } = await client.auth.getSession();
      setSession(data.session);
    };

    void loadSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  if (!session || pathname === "/login") {
    return null;
  }

  const onSignOut = async () => {
    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }

    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={onSignOut}
      className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-line bg-white/90 px-4 py-2 text-sm font-bold text-foreground shadow-sm backdrop-blur"
    >
      <LogOut className="h-4 w-4" />
      تسجيل الخروج
    </button>
  );
}
