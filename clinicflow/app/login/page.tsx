"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { client, error: setupError } = tryGetSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!client) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    setBusy(true);

    const result =
      mode === "signin"
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password });

    setBusy(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    if (mode === "signup") {
      toast.success("تم إنشاء الحساب. راجع بريدك الإلكتروني إذا كان تأكيد البريد مفعلاً.");
      return;
    }

    toast.success("تم تسجيل الدخول بنجاح");
    router.replace("/");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_30px_80px_rgba(3,105,161,0.12)] sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-primary-soft p-3 text-primary">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-foreground">دخول ClinicFlow</h1>
          <p className="mt-2 text-sm text-muted">تسجيل الدخول مطلوب للوصول إلى بيانات العيادة.</p>
        </div>

        {setupError ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {setupError}
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-primary-soft/50 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "signin" ? "bg-white text-foreground" : "text-muted"}`}
          >
            تسجيل دخول
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "signup" ? "bg-white text-foreground" : "text-muted"}`}
          >
            إنشاء حساب
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="البريد الإلكتروني"
            className="w-full rounded-xl border border-line px-3 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="كلمة المرور"
            className="w-full rounded-xl border border-line px-3 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy || !client}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </button>
        </form>
      </section>
    </main>
  );
}
