"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Tv } from "lucide-react";

import { fetchTodayQueue, type QueueVisit } from "@/lib/queue/live-queue";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DisplayPage() {
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { client, error: setupError } = tryGetSupabaseBrowserClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const refresh = async () => {
      const result = await fetchTodayQueue(client);
      if (result.error) {
        setErrorText(result.error);
        return;
      }
      setQueue(result.data);
      setErrorText(null);
    };

    void refresh();

    const channel = client
      .channel("display-live-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits_queue" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client]);

  const current = useMemo(
    () => queue.find((visit) => visit.status === "in_consultation") ?? null,
    [queue],
  );

  const nextTwo = useMemo(
    () => queue.filter((visit) => visit.status === "waiting").slice(0, 2),
    [queue],
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-5xl rounded-3xl border border-line bg-white p-6 shadow-[0_20px_60px_rgba(18,49,58,0.1)] sm:p-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Tv className="h-5 w-5" />
            <span className="text-sm font-bold">Waiting Display</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary/40"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </Link>
        </header>

        {setupError || errorText ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {setupError ?? errorText}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-primary/25 bg-primary-soft p-6 text-center">
          <p className="mb-2 text-sm font-bold text-primary">الرجاء دخول</p>
          <h1 className="text-3xl font-black text-foreground sm:text-5xl">
            {current?.fullName ?? "لا يوجد مريض حاليا"}
          </h1>
          <p className="mt-2 text-sm text-muted">إلى غرفة الكشف</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <QueueCard number="1" patient={nextTwo[0]?.fullName ?? "لا يوجد"} />
          <QueueCard number="2" patient={nextTwo[1]?.fullName ?? "لا يوجد"} />
        </div>
      </section>
    </main>
  );
}

type QueueCardProps = {
  number: string;
  patient: string;
};

function QueueCard({ number, patient }: QueueCardProps) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5 text-center">
      <p className="mb-2 text-sm font-semibold text-muted">التالي رقم {number}</p>
      <h2 className="text-2xl font-extrabold text-foreground">{patient}</h2>
    </article>
  );
}
