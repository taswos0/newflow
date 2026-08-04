"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Monitor, Stethoscope, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/supabase/error-map";

type CalendarAppointment = {
  id: string;
  patientId: string | null;
  patientName: string;
  phone: string;
  date: string;
  time: string;
  notes: string | null;
};

type PatientSuggestion = {
  id: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  medicalAlerts: string[];
};

type AppointmentRow = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  phone: string;
  appointment_date: string;
  appointment_time: string;
  notes: string | null;
};

type PatientRow = {
  id: string;
  full_name: string;
  phone: string;
  birth_date: string | null;
  medical_alerts: string[];
};

export default function Home() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [linkedByPhone, setLinkedByPhone] = useState<PatientSuggestion[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { client, error: setupError } = tryGetSupabaseBrowserClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const refreshAppointments = async () => {
      const { data, error } = await client
        .from("appointments")
        .select("id, patient_id, patient_name, phone, appointment_date, appointment_time, notes")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(300);

      if (error) {
        setErrorText(mapSupabaseError(error));
        return;
      }

      const appointmentRows = (data ?? []) as AppointmentRow[];

      setAppointments(
        appointmentRows.map((row) => ({
          id: row.id,
          patientId: row.patient_id,
          patientName: row.patient_name,
          phone: row.phone,
          date: row.appointment_date,
          time: row.appointment_time,
          notes: row.notes,
        })),
      );
      setErrorText(null);
    };

    void refreshAppointments();

    const channel = client
      .channel("home-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        void refreshAppointments();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const term = patientName.trim();
    if (!term) {
      return;
    }

    const searchPatients = async () => {
      const { data, error } = await client
        .from("patients")
        .select("id, full_name, phone, birth_date, medical_alerts")
        .ilike("full_name", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) {
        setErrorText(mapSupabaseError(error));
        return;
      }

      const patientRows = (data ?? []) as PatientRow[];

      setSuggestions(
        patientRows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          phone: row.phone,
          birthDate: row.birth_date,
          medicalAlerts: row.medical_alerts,
        })),
      );
    };

    void searchPatients();
  }, [client, patientName]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const value = phone.trim();
    if (!value) {
      return;
    }

    const findLinkedPatients = async () => {
      const { data, error } = await client
        .from("patients")
        .select("id, full_name, phone, birth_date, medical_alerts")
        .eq("phone", value)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        setErrorText(mapSupabaseError(error));
        return;
      }

      const patientRows = (data ?? []) as PatientRow[];

      setLinkedByPhone(
        patientRows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          phone: row.phone,
          birthDate: row.birth_date,
          medicalAlerts: row.medical_alerts,
        })),
      );
    };

    void findLinkedPatients();
  }, [client, phone]);

  const monthLabel = useMemo(
    () => monthCursor.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
    [monthCursor],
  );

  const daysGrid = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const leading = first.getDay();
    const total = last.getDate();

    const cells: Array<{ key: string; day: number | null; iso: string | null }> = [];

    for (let i = 0; i < leading; i += 1) {
      cells.push({ key: `pre-${i}`, day: null, iso: null });
    }

    for (let day = 1; day <= total; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ key: iso, day, iso });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `post-${cells.length}`, day: null, iso: null });
    }

    return cells;
  }, [monthCursor]);

  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of appointments) {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const visibleCases = useMemo(() => {
    const month = monthCursor.getMonth() + 1;
    const year = monthCursor.getFullYear();

    return appointments.filter((item) => {
      const [y, m] = item.date.split("-").map(Number);
      return y === year && m === month;
    });
  }, [appointments, monthCursor]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    return appointments
      .filter((item) => item.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);

  const hasTimeConflict = useMemo(
    () => selectedDayAppointments.some((item) => item.time === appointmentTime),
    [selectedDayAppointments, appointmentTime],
  );

  const openDay = (iso: string) => {
    setSelectedDate(iso);
    setPatientName("");
    setPhone("");
    setAppointmentTime("09:00");
    setNotes("");
    setSelectedPatientId(null);
    setSuggestions([]);
    setLinkedByPhone([]);
  };

  const onPickSuggestion = (item: PatientSuggestion) => {
    setSelectedPatientId(item.id);
    setPatientName(item.fullName);
    setPhone(item.phone);
    setSuggestions([]);
  };

  const onAddAppointment = async () => {
    if (!client || !selectedDate) {
      return;
    }

    if (!patientName.trim() || !phone.trim()) {
      toast.error("يرجى إدخال اسم المريض ورقم الهاتف");
      return;
    }

    if (!appointmentTime) {
      toast.error("يرجى اختيار توقيت الموعد");
      return;
    }

    if (hasTimeConflict) {
      toast.error("هذا التوقيت محجوز بالفعل في هذا اليوم");
      return;
    }

    setSaving(true);

    let patientId = selectedPatientId;
    if (!patientId) {
      const insertPatient = await (client
        .from("patients") as any)
        .insert({
          full_name: patientName.trim(),
          phone: phone.trim(),
        })
        .select("id")
        .single();

      if (insertPatient.error || !insertPatient.data) {
        setSaving(false);
        toast.error(insertPatient.error ? mapSupabaseError(insertPatient.error) : "فشل إنشاء المريض");
        return;
      }

      patientId = insertPatient.data.id;
    }

    const add = await (client.from("appointments") as any).insert({
      patient_id: patientId,
      patient_name: patientName.trim(),
      phone: phone.trim(),
      appointment_date: selectedDate,
      appointment_time: appointmentTime,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (add.error) {
      toast.error(mapSupabaseError(add.error));
      return;
    }

    toast.success("تم إضافة الموعد بنجاح");
    setPatientName("");
    setPhone("");
    setAppointmentTime("09:00");
    setNotes("");
    setSelectedPatientId(null);
  };

  const onDeleteAppointment = async (appointmentId: string) => {
    if (!client) {
      return;
    }

    const result = await (client.from("appointments") as any).delete().eq("id", appointmentId);

    if (result.error) {
      toast.error(mapSupabaseError(result.error));
      return;
    }

    toast.success("تم حذف الموعد");
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-6xl rounded-3xl border border-line/80 bg-card/85 p-5 shadow-[0_30px_80px_rgba(3,105,161,0.12)] backdrop-blur sm:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-primary-soft/70 px-4 py-3">
          <p className="text-sm font-semibold text-primary">ClinicFlow</p>
          <p className="text-sm text-muted">إدارة لحظية للطبيب والسكرتارية وشاشة الانتظار</p>
        </div>

        <section className="mb-8 text-center sm:text-right">
          <h1 className="mb-3 text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            اختر واجهة العمل
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted sm:mx-0 sm:text-lg">
            ابدأ من الدور المناسب لجهازك: الطبيب، السكرتارية، أو شاشة الانتظار.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <RoleCard
            href="/doctor"
            title="واجهة الطبيب"
            description="متابعة الحالة الحالية، السجل الطبي، وإتمام الجلسة"
            badge="Doctor"
            icon={<Stethoscope className="h-5 w-5" />}
          />
          <RoleCard
            href="/reception"
            title="واجهة السكرتارية"
            description="تسجيل المرضى، إدارة الدور، واستلام الفواتير الفورية"
            badge="Reception"
            icon={<UsersRound className="h-5 w-5" />}
          />
          <RoleCard
            href="/display"
            title="شاشة الانتظار"
            description="عرض اسم المريض الحالي والقادمين مع تحديث مباشر"
            badge="Display"
            icon={<Monitor className="h-5 w-5" />}
          />
        </section>

        {setupError || errorText ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {setupError ?? errorText}
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl border border-line bg-white/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-primary">
              <CalendarDays className="h-5 w-5" />
              <h3 className="text-lg font-extrabold text-foreground">كالندر الحالات</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="rounded-lg border border-line px-2 py-1 text-xs font-bold"
              >
                السابق
              </button>
              <p className="text-sm font-bold text-foreground">{monthLabel}</p>
              <button
                type="button"
                onClick={() =>
                  setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="rounded-lg border border-line px-2 py-1 text-xs font-bold"
              >
                التالي
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
            <span>ح</span>
            <span>ن</span>
            <span>ث</span>
            <span>ر</span>
            <span>خ</span>
            <span>ج</span>
            <span>س</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((cell) => {
              if (!cell.day || !cell.iso) {
                return <div key={cell.key} className="h-12 rounded-lg border border-transparent" />;
              }

              const count = countByDate.get(cell.iso) ?? 0;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => openDay(cell.iso as string)}
                  className="h-12 rounded-lg border border-line bg-white p-1 text-center transition hover:border-primary/40"
                >
                  <p className="text-xs font-bold text-foreground">{cell.day}</p>
                  {count > 0 ? (
                    <p className="mt-1 rounded-md bg-primary-soft px-1 py-0.5 text-[10px] font-bold text-primary">
                      {count} حالة
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-white p-3">
            <p className="mb-2 text-sm font-bold text-foreground">حالات هذا الشهر</p>
            {visibleCases.length === 0 ? (
              <p className="text-xs text-muted">لا توجد مواعيد مسجلة في هذا الشهر.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-auto text-xs">
                {visibleCases.map((item) => (
                  <p key={item.id} className="rounded-md border border-line px-2 py-1">
                    {item.date} - {item.patientName} - {item.phone}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedDate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-black text-foreground">مواعيد يوم {selectedDate}</h4>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded-full border border-line p-1 text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 max-h-32 space-y-1 overflow-auto rounded-xl border border-line p-2 text-sm">
              {selectedDayAppointments.length === 0 ? (
                <p className="text-muted">لا توجد مواعيد في هذا اليوم.</p>
              ) : (
                selectedDayAppointments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1">
                    <p>
                      {item.time} - {item.patientName} - {item.phone}
                      {item.notes ? ` - ${item.notes}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => onDeleteAppointment(item.id)}
                      className="rounded-md p-1 text-rose-600 transition hover:bg-rose-50"
                      aria-label="حذف الموعد"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-line bg-primary-soft/20 p-3">
              <p className="text-sm font-bold text-foreground">إضافة موعد جديد</p>

              <input
                value={patientName}
                onChange={(event) => {
                  setPatientName(event.target.value);
                  setSelectedPatientId(null);
                  if (!event.target.value.trim()) {
                    setSuggestions([]);
                  }
                }}
                placeholder="اسم المريض"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
              />

              {suggestions.length > 0 ? (
                <div className="max-h-24 space-y-1 overflow-auto rounded-lg border border-line bg-white p-2 text-xs">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onPickSuggestion(item)}
                      className="block w-full rounded-md border border-line px-2 py-1 text-right hover:bg-primary-soft/30"
                    >
                      {item.fullName} - {item.phone}
                    </button>
                  ))}
                </div>
              ) : null}

              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (!event.target.value.trim()) {
                    setLinkedByPhone([]);
                  }
                }}
                placeholder="رقم الهاتف"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
              />

              {linkedByPhone.length > 1 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-700">
                  نفس الرقم مرتبط بـ {linkedByPhone.length} مرضى: {linkedByPhone.map((item) => item.fullName).join(" - ")}
                </div>
              ) : null}

              <input
                type="time"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
              />

              {hasTimeConflict ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-700">
                  يوجد موعد آخر في نفس التوقيت داخل هذا اليوم.
                </div>
              ) : null}

              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="ملاحظات (اختياري)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
              />

              <button
                type="button"
                onClick={onAddAppointment}
                disabled={saving}
                className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                حفظ الموعد
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type RoleCardProps = {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
};

function RoleCard({ href, title, description, badge, icon }: RoleCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(15,118,110,0.16)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {icon}
          {badge}
        </span>
      </div>
      <h2 className="mb-2 text-xl font-extrabold text-foreground">{title}</h2>
      <p className="text-sm leading-7 text-muted">{description}</p>
    </Link>
  );
}
