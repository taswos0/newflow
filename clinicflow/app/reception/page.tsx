"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarDays, ReceiptText, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { fetchTodayQueue, getTodayDateISO, type QueueVisit } from "@/lib/queue/live-queue";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/supabase/error-map";

type InvoiceView = {
  id: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  nextAppointmentDate: string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  items: Array<{ title: string; price: number }>;
};

type SearchPatientRow = {
  id: string;
  fullName: string;
  phone: string;
  services: string[];
};

type DailyPaymentRow = {
  id: string;
  patientName: string;
  amount: number;
  method: "cash" | "wallet";
  collectedAt: string;
};

type InvoiceRow = {
  id: string;
  patient_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  next_appointment_date: string | null;
  payment_status: "unpaid" | "partial" | "paid";
  patients: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  invoice_items: Array<{ treatment_title: string; price_applied: number }> | null;
};

type DailyPaymentQueryRow = {
  id: string;
  amount: number;
  method: "cash" | "wallet";
  collected_at: string;
  patients: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

type PatientLookupRow = {
  id: string;
  full_name: string;
  phone: string;
};

type InvoiceLookupRow = {
  patient_id: string | null;
  invoice_items: Array<{ treatment_title: string }> | null;
  patients:
    | {
        full_name: string | null;
        phone: string | null;
      }
    | Array<{
        full_name: string | null;
        phone: string | null;
      }>
    | null;
};

type TodayAppointment = {
  id: string;
  patientName: string;
  phone: string;
  appointmentTime: string;
};

export default function ReceptionPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [latestInvoice, setLatestInvoice] = useState<InvoiceView | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRows, setSearchRows] = useState<SearchPatientRow[]>([]);
  const [dailyPayments, setDailyPayments] = useState<DailyPaymentRow[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [appointmentDraft, setAppointmentDraft] = useState<{ invoiceId: string; date: string }>({
    invoiceId: "",
    date: "",
  });
  const [busy, setBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [receptionCallAlertActive, setReceptionCallAlertActive] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [visitTime, setVisitTime] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const { client, error: setupError } = tryGetSupabaseBrowserClient();
  const receptionCallChannelRef = useRef<RealtimeChannel | null>(null);
  const receptionCallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const waiting = useMemo(
    () => queue.filter((visit) => visit.status === "waiting"),
    [queue],
  );

  const inConsultation = useMemo(
    () => queue.find((visit) => visit.status === "in_consultation") ?? null,
    [queue],
  );

  const filteredSearchRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [];
    }

    return searchRows
      .filter(
        (row) =>
          row.fullName.toLowerCase().includes(term) ||
          row.phone.toLowerCase().includes(term) ||
          row.services.some((service) => service.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [searchRows, searchTerm]);

  const dailySummary = useMemo(() => {
    return dailyPayments.reduce(
      (summary, payment) => {
        summary.total += payment.amount;
        summary[payment.method] += payment.amount;
        return summary;
      },
      { total: 0, cash: 0, wallet: 0 },
    );
  }, [dailyPayments]);

  const playSoftCallSound = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!audioContextClass) {
      return;
    }

    try {
      const ctx = new audioContextClass();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.18);

      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.42);

      setTimeout(() => {
        void ctx.close();
      }, 650);
    } catch {
      // Ignore audio failures due to browser/device limitations.
    }
  }, []);

  const stopReceptionCallAlert = useCallback(() => {
    if (receptionCallIntervalRef.current) {
      clearInterval(receptionCallIntervalRef.current);
      receptionCallIntervalRef.current = null;
    }
    setReceptionCallAlertActive(false);
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }

    const channel = client
      .channel("clinic-reception-calls")
      .on("broadcast", { event: "call-reception" }, () => {
        setReceptionCallAlertActive(true);
        toast("الطبيب يطلب حضور السكرتارية", { duration: 5000 });
        playSoftCallSound();

        if (!receptionCallIntervalRef.current) {
          receptionCallIntervalRef.current = setInterval(() => {
            playSoftCallSound();
          }, 3000);
        }
      });

    channel.subscribe();
    receptionCallChannelRef.current = channel;

    return () => {
      stopReceptionCallAlert();
      receptionCallChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [client, playSoftCallSound, stopReceptionCallAlert]);

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

    const refreshInvoice = async () => {
      const { data, error } = await client
        .from("invoices")
        .select(
          `
            id,
            patient_id,
            total_amount,
            paid_amount,
            remaining_amount,
            next_appointment_date,
            payment_status,
            created_at,
            patients ( full_name ),
            invoice_items ( treatment_title, price_applied )
          `,
        )
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        setErrorText(mapSupabaseError(error));
        return;
      }

      const row = (data?.[0] ?? null) as InvoiceRow | null;
      if (!row) {
        setLatestInvoice(null);
        return;
      }

      const patientRaw = Array.isArray(row.patients) ? row.patients[0] : row.patients;

      setLatestInvoice({
        id: row.id,
        patientId: row.patient_id,
        patientName: patientRaw?.full_name ?? "غير معروف",
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        nextAppointmentDate: row.next_appointment_date,
        paymentStatus: row.payment_status,
        items: (row.invoice_items ?? []).map((item) => ({
          title: item.treatment_title,
          price: item.price_applied,
        })),
      });
    };

    const refreshDailyPayments = async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data, error } = await client
        .from("invoice_payments")
        .select("id, amount, method, collected_at, patients ( full_name )")
        .gte("collected_at", start.toISOString())
        .order("collected_at", { ascending: false });

      if (error) {
        setErrorText(mapSupabaseError(error));
        return;
      }

      const paymentRows = (data ?? []) as DailyPaymentQueryRow[];

      setDailyPayments(
        paymentRows.map((row) => {
          const patientRaw = Array.isArray(row.patients) ? row.patients[0] : row.patients;
          return {
            id: row.id,
            patientName: patientRaw?.full_name ?? "غير معروف",
            amount: row.amount,
            method: row.method,
            collectedAt: row.collected_at,
          };
        }),
      );
    };

    void refreshInvoice();
    void refreshDailyPayments();

    const refreshTodayAppointments = async () => {
      const { data, error: apptError } = await client
        .from("appointments")
        .select("id, patient_name, phone, appointment_time")
        .eq("appointment_date", getTodayDateISO())
        .order("appointment_time", { ascending: true });

      if (!apptError) {
        type ApptRow = { id: string; patient_name: string; phone: string; appointment_time: string };
        setTodayAppointments(
          ((data ?? []) as ApptRow[]).map((row) => ({
            id: row.id,
            patientName: row.patient_name,
            phone: row.phone,
            appointmentTime: row.appointment_time,
          })),
        );
      }
    };

    void refreshTodayAppointments();

    const channel = client
      .channel("reception-live-queue")
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        () => {
          void refreshInvoice();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_items" },
        () => {
          void refreshInvoice();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_payments" },
        () => {
          void refreshDailyPayments();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          void refreshTodayAppointments();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const loadSearchRows = async () => {
      const [{ data: patientsData, error: patientsError }, { data: invoicesData, error: invoicesError }] =
        await Promise.all([
          client.from("patients").select("id, full_name, phone").limit(500),
          client
            .from("invoices")
            .select("patient_id, invoice_items ( treatment_title ), patients ( full_name, phone )")
            .limit(500),
        ]);

      if (patientsError) {
        setErrorText(mapSupabaseError(patientsError));
        return;
      }

      if (invoicesError) {
        setErrorText(mapSupabaseError(invoicesError));
        return;
      }

      const map = new Map<string, SearchPatientRow>();

      const patients = (patientsData ?? []) as PatientLookupRow[];
      const invoices = (invoicesData ?? []) as InvoiceLookupRow[];

      for (const patient of patients) {
        map.set(patient.id, {
          id: patient.id,
          fullName: patient.full_name,
          phone: patient.phone,
          services: [],
        });
      }

      for (const invoice of invoices) {
        const patientId = invoice.patient_id;
        if (!patientId) {
          continue;
        }

        const existing = map.get(patientId);
        const itemTitles = (invoice.invoice_items ?? []).map((item) => item.treatment_title);

        if (existing) {
          existing.services = Array.from(new Set([...existing.services, ...itemTitles]));
          continue;
        }

        const patientRaw = Array.isArray(invoice.patients) ? invoice.patients[0] : invoice.patients;
        map.set(patientId, {
          id: patientId,
          fullName: patientRaw?.full_name ?? "غير معروف",
          phone: patientRaw?.phone ?? "---",
          services: Array.from(new Set(itemTitles)),
        });
      }

      setSearchRows(Array.from(map.values()));
    };

    void loadSearchRows();
  }, [client]);

  const onAddPatient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fullName.trim() || !phone.trim()) {
      toast.error("يرجى إدخال اسم المريض والهاتف");
      return;
    }

    if (!client) {
      return;
    }

    setBusy(true);

    let patientId = selectedPatientId;

    if (!patientId) {
      const patientInsert = await (client
        .from("patients") as any)
        .insert({ full_name: fullName.trim(), phone: phone.trim() })
        .select("id")
        .single();

      if (patientInsert.error || !patientInsert.data) {
        setBusy(false);
        toast.error(patientInsert.error ? mapSupabaseError(patientInsert.error) : "فشل تسجيل المريض");
        return;
      }

      patientId = patientInsert.data.id;
    }

    if (visitTime) {
      const apptInsert = await (client.from("appointments") as any).insert({
        patient_id: patientId,
        patient_name: fullName.trim(),
        phone: phone.trim(),
        appointment_date: getTodayDateISO(),
        appointment_time: visitTime,
      });

      if (apptInsert.error) {
        setBusy(false);
        toast.error(mapSupabaseError(apptInsert.error));
        return;
      }
    }

    const visitInsert = await (client.from("visits_queue") as any).insert({
      patient_id: patientId,
      visit_date: getTodayDateISO(),
      status: "waiting",
    });

    setBusy(false);

    if (visitInsert.error) {
      toast.error(mapSupabaseError(visitInsert.error));
      return;
    }

    setFullName("");
    setPhone("");
    setVisitTime("");
    setSelectedPatientId(null);
    setSearchTerm("");
    toast.success("تم تسجيل المريض وإضافته إلى الدور");
  };

  const onPickSearchPatient = (row: SearchPatientRow) => {
    setSelectedPatientId(row.id);
    setFullName(row.fullName);
    setPhone(row.phone);
    setSearchTerm("");
  };

  const onCallPatient = async (visitId: string) => {
    if (!client) {
      return;
    }

    setBusy(true);

    const clearCurrent = await (client
      .from("visits_queue") as any)
      .update({ status: "completed" })
      .eq("visit_date", getTodayDateISO())
      .eq("status", "in_consultation");

    if (clearCurrent.error) {
      setBusy(false);
      toast.error(mapSupabaseError(clearCurrent.error));
      return;
    }

    const nextIn = await (client
      .from("visits_queue") as any)
      .update({ status: "in_consultation", call_time: new Date().toISOString() })
      .eq("id", visitId)
      .eq("status", "waiting");

    setBusy(false);

    if (nextIn.error) {
      toast.error(mapSupabaseError(nextIn.error));
      return;
    }

    toast.success("تم إدخال المريض وإرسال التنبيه للطبيب");
  };

  const onCompleteCurrent = async () => {
    if (!inConsultation) {
      return;
    }

    if (!client) {
      return;
    }

    setBusy(true);

    const result = await (client
      .from("visits_queue") as any)
      .update({ status: "completed" })
      .eq("id", inConsultation.id)
      .eq("status", "in_consultation");

    setBusy(false);

    if (result.error) {
      toast.error(mapSupabaseError(result.error));
      return;
    }

    toast.success("تم إنهاء الجلسة الحالية");
  };

  const onRegisterPayment = async () => {
    if (!client || !latestInvoice) {
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("أدخل مبلغ دفع صحيح");
      return;
    }

    const nextPaid = Math.min(latestInvoice.totalAmount, latestInvoice.paidAmount + amount);
    const nextRemaining = Math.max(0, latestInvoice.totalAmount - nextPaid);
    const nextStatus: "unpaid" | "partial" | "paid" =
      nextRemaining === latestInvoice.totalAmount ? "unpaid" : nextRemaining === 0 ? "paid" : "partial";

    setInvoiceBusy(true);

    const paymentInsert = await (client.from("invoice_payments") as any).insert({
      invoice_id: latestInvoice.id,
      patient_id: latestInvoice.patientId,
      amount,
      method: paymentMethod,
    });

    if (paymentInsert.error) {
      setInvoiceBusy(false);
      toast.error(mapSupabaseError(paymentInsert.error));
      return;
    }

    const update = await (client
      .from("invoices") as any)
      .update({
        paid_amount: nextPaid,
        remaining_amount: nextRemaining,
        payment_status: nextStatus,
      })
      .eq("id", latestInvoice.id);

    setInvoiceBusy(false);

    if (update.error) {
      toast.error(mapSupabaseError(update.error));
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("cash");
    toast.success("تم تسجيل الدفع بنجاح");
  };

  const onSaveNextAppointment = async () => {
    if (!client || !latestInvoice) {
      return;
    }

    const value =
      appointmentDraft.invoiceId === latestInvoice.id
        ? appointmentDraft.date || null
        : latestInvoice.nextAppointmentDate;

    setInvoiceBusy(true);

    const update = await (client
      .from("invoices") as any)
      .update({ next_appointment_date: value })
      .eq("id", latestInvoice.id);

    setInvoiceBusy(false);

    if (update.error) {
      toast.error(mapSupabaseError(update.error));
      return;
    }

    toast.success("تم حفظ الموعد القادم");
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-line bg-card p-6 shadow-[0_20px_60px_rgba(18,49,58,0.1)] sm:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-secondary">Reception View</p>
            <h1 className="text-3xl font-black text-foreground">واجهة السكرتارية</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-foreground transition hover:border-secondary/40"
            >
              <CalendarDays className="h-4 w-4" />
              الكالندر
            </Link>
            <Link
              href="/"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-foreground transition hover:border-secondary/40"
            >
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </header>

        {setupError || errorText ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {setupError ?? errorText}
          </div>
        ) : null}

        {/* TOP: today appointments + patient registration */}
        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <Panel title="مواعيد اليوم" icon={<CalendarDays className="h-5 w-5" />}>
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted">لا توجد مواعيد مجدولة لليوم.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto">
                {todayAppointments.map((appt) => (
                  <li key={appt.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                    <p className="font-bold text-foreground">{appt.patientName}</p>
                    <p className="text-muted">
                      {appt.phone} — {appt.appointmentTime.slice(0, 5)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="mb-3 text-lg font-extrabold text-foreground">بحث المرضى</h2>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالاسم أو رقم التليفون أو الخدمة"
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none"
              />
              {searchTerm.trim() ? (
                <div className="mt-3 space-y-2">
                  {filteredSearchRows.length === 0 ? (
                    <p className="text-sm text-muted">لا توجد نتائج مطابقة.</p>
                  ) : (
                    filteredSearchRows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => onPickSearchPatient(row)}
                        className="block w-full rounded-lg border border-line px-3 py-2 text-right text-sm transition hover:border-primary/40"
                      >
                        <p className="font-bold text-foreground">{row.fullName}</p>
                        <p className="text-muted">{row.phone}</p>
                        <p className="text-xs text-muted">
                          {row.services.length > 0 ? row.services.join(" - ") : "لا توجد خدمات مسجلة"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </section>

            <Panel title="تسجيل مريض" icon={<UserRoundPlus className="h-5 w-5" />}>
              <form onSubmit={onAddPatient} className="space-y-2">
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="اسم المريض"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
                />
                <div className="flex items-center gap-2">
                  <label className="shrink-0 text-xs font-bold text-foreground">الوقت</label>
                  <input
                    type="time"
                    value={visitTime}
                    onChange={(event) => setVisitTime(event.target.value)}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
                  />
                </div>
                <p className="text-[11px] text-muted">اختياري — لمنع تعارض المواعيد</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  إضافة إلى الدور
                </button>
              </form>
            </Panel>
          </div>
        </section>

        {/* MIDDLE: waiting queue + current status */}
        <section className="mb-4 rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 text-lg font-extrabold text-foreground">قائمة الانتظار</h2>
          <div className="space-y-2">
            {waiting.length === 0 ? (
              <p className="text-sm text-muted">لا يوجد مرضى في الانتظار.</p>
            ) : (
              waiting.map((visit) => (
                <article
                  key={visit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">{visit.fullName}</p>
                    <p className="text-xs text-muted">{visit.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCallPatient(visit.id)}
                    disabled={busy}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    إدخال المريض
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="mb-4">
          <Panel title="الحالة الحالية" icon={<BellRing className="h-5 w-5" />}>
            {inConsultation ? (
              <div className="space-y-2 text-sm text-muted">
                <p className="font-bold text-foreground">{inConsultation.fullName}</p>
                <p>{inConsultation.phone}</p>
                <button
                  type="button"
                  onClick={onCompleteCurrent}
                  disabled={busy}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  إنهاء الجلسة الحالية
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">لا يوجد مريض داخل الكشف حاليا</p>
            )}
          </Panel>
        </div>

        {/* BOTTOM: accounting */}
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="استلام الحساب" icon={<ReceiptText className="h-5 w-5" />}>
            {!latestInvoice ? (
              <p className="text-sm leading-7 text-muted">لا توجد فاتورة صادرة من الطبيب حتى الآن.</p>
            ) : (
              <div className="space-y-2 text-sm text-muted">
                {(() => {
                  const appointmentValue =
                    appointmentDraft.invoiceId === latestInvoice.id
                      ? appointmentDraft.date
                      : latestInvoice.nextAppointmentDate ?? "";

                  return (
                    <>
                      <p className="font-bold text-foreground">المريض: {latestInvoice.patientName}</p>
                      <p>الإجمالي: {latestInvoice.totalAmount.toFixed(2)} جنيه</p>
                      <p>المدفوع: {latestInvoice.paidAmount.toFixed(2)} جنيه</p>
                      <p>المتبقي: {latestInvoice.remainingAmount.toFixed(2)} جنيه</p>
                      <label className="block text-xs font-bold text-foreground">الموعد القادم</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={appointmentValue}
                          onChange={(event) =>
                            setAppointmentDraft({
                              invoiceId: latestInvoice.id,
                              date: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-line px-2 py-1 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={onSaveNextAppointment}
                          disabled={invoiceBusy}
                          className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-foreground disabled:opacity-50"
                        >
                          حفظ
                        </button>
                      </div>
                    </>
                  );
                })()}
                <div className="max-h-24 space-y-1 overflow-auto rounded-lg border border-line p-2 text-xs">
                  {latestInvoice.items.length === 0 ? (
                    <p>لا توجد بنود علاجية.</p>
                  ) : (
                    latestInvoice.items.map((item, index) => (
                      <p key={`${item.title}-${index}`}>
                        - {item.title}: {item.price.toFixed(2)}
                      </p>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder="مبلغ الدفع"
                    className="w-full rounded-lg border border-line px-2 py-1 text-sm outline-none"
                  />
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as "cash" | "wallet")}
                    className="rounded-lg border border-line px-2 py-1 text-sm outline-none"
                  >
                    <option value="cash">كاش</option>
                    <option value="wallet">محفظة</option>
                  </select>
                  <button
                    type="button"
                    onClick={onRegisterPayment}
                    disabled={invoiceBusy}
                    className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                  >
                    تسجيل
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <section className="rounded-2xl border border-line bg-white p-4">
            <h2 className="mb-3 text-lg font-extrabold text-foreground">المبالغ المحصلة اليوم</h2>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
                الإجمالي: {dailySummary.total.toFixed(2)}
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-foreground">
                كاش: {dailySummary.cash.toFixed(2)}
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-foreground">
                محفظة: {dailySummary.wallet.toFixed(2)}
              </div>
            </div>
            <div className="max-h-36 space-y-2 overflow-auto">
              {dailyPayments.length === 0 ? (
                <p className="text-sm text-muted">لا توجد تحصيلات اليوم.</p>
              ) : (
                dailyPayments.map((payment) => (
                  <article key={payment.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <p className="font-bold text-foreground">{payment.patientName}</p>
                    <p className="text-muted">
                      {payment.amount.toFixed(2)} - {payment.method === "cash" ? "كاش" : "محفظة"}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </div>

      {receptionCallAlertActive ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-secondary/30 bg-white p-3 shadow-[0_12px_30px_rgba(2,132,199,0.2)] sm:left-auto sm:right-6 sm:w-[360px]">
          <p className="text-sm font-extrabold text-foreground">استدعاء من الطبيب</p>
          <p className="mt-1 text-xs text-muted">يوجد طلب حضور من الطبيب. يتم تكرار تنبيه صوتي هادئ.</p>
          <button
            type="button"
            onClick={stopReceptionCallAlert}
            className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            تم الاستلام
          </button>
        </div>
      ) : null}
    </main>
  );
}

type PanelProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function Panel({ title, icon, children }: PanelProps) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 inline-flex rounded-xl bg-sky-100 p-2 text-secondary">{icon}</div>
      <h2 className="mb-2 text-lg font-extrabold text-foreground">{title}</h2>
      {children}
    </article>
  );
}
