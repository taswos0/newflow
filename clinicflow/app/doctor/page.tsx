"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText, Wallet } from "lucide-react";
import { toast } from "sonner";

import { fetchTodayQueue, type QueueVisit } from "@/lib/queue/live-queue";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/supabase/error-map";

type TreatmentCatalogItem = {
  id: string;
  titleAr: string;
  defaultPrice: number;
  category: string;
};

type SelectedTreatment = {
  id: string;
  title: string;
  price: number;
};

type AppointmentSlot = {
  id: string;
  patientId: string | null;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
};

type SearchPatientRow = {
  id: string;
  fullName: string;
  phone: string;
  services: string[];
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

type TreatmentCatalogRow = {
  id: string;
  title_ar: string;
  default_price: number;
  category: string;
};

type AppointmentRow = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
};

type BillingDraft = {
  visitId: string;
  selectedIds: string[];
  priceMap: Record<string, string>;
  nextAppointmentDate: string;
  nextAppointmentTime: string;
  manualTitle: string;
  manualPrice: string;
};

const emptyDraft = (visitId: string): BillingDraft => ({
  visitId,
  selectedIds: [],
  priceMap: {},
  nextAppointmentDate: "",
  nextAppointmentTime: "09:00",
  manualTitle: "",
  manualPrice: "",
});

export default function DoctorPage() {
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [catalog, setCatalog] = useState<TreatmentCatalogItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSlot[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRows, setSearchRows] = useState<SearchPatientRow[]>([]);
  const [previewPatient, setPreviewPatient] = useState<SearchPatientRow | null>(null);
  const [billingDraft, setBillingDraft] = useState<BillingDraft>(emptyDraft(""));
  const [billingBusy, setBillingBusy] = useState(false);
  const [catalogTitle, setCatalogTitle] = useState("");
  const [catalogPrice, setCatalogPrice] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { client, error: setupError } = tryGetSupabaseBrowserClient();

  useEffect(() => {
    if (!client) {
      return;
    }

    const refreshQueue = async () => {
      const result = await fetchTodayQueue(client);
      if (result.error) {
        setErrorText(result.error);
        return;
      }
      setQueue(result.data);
      setErrorText(null);
    };

    void refreshQueue();

    const channel = client
      .channel("doctor-live-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits_queue" }, () => {
        void refreshQueue();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => {
        void refreshQueue();
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

  const loadCatalog = useCallback(async () => {
    if (!client) {
      return;
    }

    const { data, error } = await client
      .from("treatments_catalog")
      .select("id, title_ar, default_price, category")
      .order("title_ar", { ascending: true });

    if (error) {
      setErrorText(mapSupabaseError(error));
      return;
    }

    const catalogRows = (data ?? []) as TreatmentCatalogRow[];

    setCatalog(
      catalogRows.map((item) => ({
        id: item.id,
        titleAr: item.title_ar,
        defaultPrice: item.default_price,
        category: item.category,
      })),
    );
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    void loadCatalog();

    const channel = client
      .channel("doctor-treatments-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "treatments_catalog" }, () => {
        void loadCatalog();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, loadCatalog]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const loadAppointments = async () => {
      const { data, error } = await client
        .from("appointments")
        .select("id, patient_id, patient_name, appointment_date, appointment_time")
        .limit(500);

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
          appointmentDate: row.appointment_date,
          appointmentTime: row.appointment_time,
        })),
      );
    };

    void loadAppointments();

    const channel = client
      .channel("doctor-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        void loadAppointments();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client]);

  const activePatient = useMemo(
    () => queue.find((visit) => visit.status === "in_consultation") ?? null,
    [queue],
  );

  const upcoming = useMemo(
    () => queue.filter((visit) => visit.status === "waiting").slice(0, 3),
    [queue],
  );

  const activeVisitId = activePatient?.id ?? "";
  const visitDraft = useMemo(
    () => (billingDraft.visitId === activeVisitId ? billingDraft : emptyDraft(activeVisitId)),
    [billingDraft, activeVisitId],
  );

  const selectedTreatments = useMemo<SelectedTreatment[]>(() => {
    const fromCatalog = visitDraft.selectedIds
      .map((id) => {
        const treatment = catalog.find((item) => item.id === id);
        if (!treatment) {
          return null;
        }

        const customPrice = Number(visitDraft.priceMap[id]);
        const price = Number.isFinite(customPrice) && customPrice >= 0 ? customPrice : treatment.defaultPrice;

        return {
          id: treatment.id,
          title: treatment.titleAr,
          price,
        };
      })
      .filter((item): item is SelectedTreatment => Boolean(item));

    const manualPriceNumber = Number(visitDraft.manualPrice);
    const hasManual =
      visitDraft.manualTitle.trim().length > 0 && Number.isFinite(manualPriceNumber) && manualPriceNumber >= 0;

    if (!hasManual) {
      return fromCatalog;
    }

    return [
      ...fromCatalog,
      {
        id: "manual",
        title: visitDraft.manualTitle.trim(),
        price: manualPriceNumber,
      },
    ];
  }, [catalog, visitDraft]);

  const totalAmount = useMemo(
    () => selectedTreatments.reduce((sum, item) => sum + item.price, 0),
    [selectedTreatments],
  );

  const conflictingAppointments = useMemo(() => {
    if (!activePatient || !visitDraft.nextAppointmentDate || !visitDraft.nextAppointmentTime) {
      return [];
    }

    return appointments.filter(
      (appointment) =>
        appointment.appointmentDate === visitDraft.nextAppointmentDate &&
        appointment.appointmentTime === visitDraft.nextAppointmentTime &&
        appointment.patientId !== activePatient.patientId,
    );
  }, [appointments, visitDraft.nextAppointmentDate, visitDraft.nextAppointmentTime, activePatient]);

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

  const currentViewPatient = activePatient
    ? {
        fullName: activePatient.fullName,
        phone: activePatient.phone,
        services: [] as string[],
        note: activePatient.medicalAlerts.length > 0 ? activePatient.medicalAlerts.join(" - ") : null,
      }
    : previewPatient
      ? {
          fullName: previewPatient.fullName,
          phone: previewPatient.phone,
          services: previewPatient.services,
          note: "معاينة من البحث",
        }
      : null;

  const updateDraft = (patch: Partial<BillingDraft>) => {
    setBillingDraft((prev) => ({
      ...(prev.visitId === activeVisitId ? prev : emptyDraft(activeVisitId)),
      visitId: activeVisitId,
      ...patch,
    }));
  };

  const onToggleTreatment = (id: string) => {
    const nextIds = visitDraft.selectedIds.includes(id)
      ? visitDraft.selectedIds.filter((value) => value !== id)
      : [...visitDraft.selectedIds, id];

    updateDraft({ selectedIds: nextIds });
  };

  const onAddCatalogItem = async () => {
    if (!client) {
      return;
    }

    const title = catalogTitle.trim();
    const price = Number(catalogPrice);

    if (!title) {
      toast.error("أدخل نوع الكشف");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      toast.error("أدخل سعر صحيح");
      return;
    }

    setCatalogBusy(true);

    const { error } = await (client.from("treatments_catalog") as any).insert({
      title_ar: title,
      default_price: price,
      category: "كشف",
    });

    setCatalogBusy(false);

    if (error) {
      toast.error(mapSupabaseError(error));
      return;
    }

    setCatalogTitle("");
    setCatalogPrice("");
    toast.success("تمت إضافة نوع الكشف بنجاح");
    void loadCatalog();
  };

  const onBillingSubmit = async () => {
    if (!client || !activePatient) {
      return;
    }

    if (selectedTreatments.length === 0) {
      toast.error("اختر نوع كشف واحد على الأقل");
      return;
    }

    if ((visitDraft.nextAppointmentDate && !visitDraft.nextAppointmentTime) || (!visitDraft.nextAppointmentDate && visitDraft.nextAppointmentTime !== "09:00")) {
      toast.error("أدخل تاريخ ووقت الموعد القادم معا");
      return;
    }

    if (conflictingAppointments.length > 0) {
      toast.error("هذا التوقيت محجوز بالفعل. اختر وقتا آخر");
      return;
    }

    setBillingBusy(true);

    const invoiceUpsert = await (client
      .from("invoices") as any)
      .upsert(
        {
          visit_id: activePatient.id,
          patient_id: activePatient.patientId,
          total_amount: totalAmount,
          paid_amount: 0,
          remaining_amount: totalAmount,
          next_appointment_date: visitDraft.nextAppointmentDate || null,
          payment_status: "unpaid",
        },
        { onConflict: "visit_id" },
      )
      .select("id")
      .single();

    if (invoiceUpsert.error || !invoiceUpsert.data) {
      setBillingBusy(false);
      toast.error(mapSupabaseError(invoiceUpsert.error));
      return;
    }

    const invoiceId = invoiceUpsert.data.id;

    const cleanupItems = await (client.from("invoice_items") as any).delete().eq("invoice_id", invoiceId);
    if (cleanupItems.error) {
      setBillingBusy(false);
      toast.error(mapSupabaseError(cleanupItems.error));
      return;
    }

    const insertItems = await (client.from("invoice_items") as any).insert(
      selectedTreatments.map((item) => ({
        invoice_id: invoiceId,
        treatment_title: item.title,
        price_applied: item.price,
      })),
    );

    if (insertItems.error) {
      setBillingBusy(false);
      toast.error(mapSupabaseError(insertItems.error));
      return;
    }

    if (visitDraft.nextAppointmentDate) {
      const existingAppointment = await client
        .from("appointments")
        .select("id")
        .eq("patient_id", activePatient.patientId)
        .eq("appointment_date", visitDraft.nextAppointmentDate)
        .eq("appointment_time", visitDraft.nextAppointmentTime)
        .maybeSingle();

      if (existingAppointment.error) {
        setBillingBusy(false);
        toast.error(mapSupabaseError(existingAppointment.error));
        return;
      }

      if (!existingAppointment.data) {
        const appointmentInsert = await (client.from("appointments") as any).insert({
          patient_id: activePatient.patientId,
          patient_name: activePatient.fullName,
          phone: activePatient.phone,
          appointment_date: visitDraft.nextAppointmentDate,
          appointment_time: visitDraft.nextAppointmentTime,
          notes: "موعد متابعة من الطبيب",
        });

        if (appointmentInsert.error) {
          setBillingBusy(false);
          toast.error(mapSupabaseError(appointmentInsert.error));
          return;
        }
      }
    }

    const closeVisit = await (client
      .from("visits_queue") as any)
      .update({ status: "completed" })
      .eq("id", activePatient.id)
      .eq("status", "in_consultation");

    setBillingBusy(false);

    if (closeVisit.error) {
      toast.error(mapSupabaseError(closeVisit.error));
      return;
    }

    toast.success("تم إرسال الحساب للسكرتارية بنجاح");
    setBillingDraft(emptyDraft(activeVisitId));
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-line bg-card p-6 shadow-[0_20px_60px_rgba(18,49,58,0.1)] sm:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Doctor View</p>
            <h1 className="text-3xl font-black text-foreground">واجهة الطبيب</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary/40"
          >
            العودة للصفحة الرئيسية
          </Link>
        </header>

        {setupError || errorText ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {setupError ?? errorText}
          </div>
        ) : null}

        <section className="mb-4 rounded-2xl border border-line bg-white p-4">
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
                    onClick={() => {
                      setPreviewPatient(row);
                      setSearchTerm("");
                    }}
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

        <section className="grid gap-4 md:grid-cols-3">
          <Panel title="الحالة الحالية" icon={<CalendarClock className="h-5 w-5" />}>
            {currentViewPatient ? (
              <div className="space-y-2 text-sm text-muted">
                <p className="text-xl font-black text-foreground">{currentViewPatient.fullName}</p>
                <p>{currentViewPatient.phone}</p>
                {currentViewPatient.note ? (
                  <p className="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-700">
                    {currentViewPatient.note}
                  </p>
                ) : (
                  <p>لا توجد تنبيهات طبية مسجلة.</p>
                )}
                {currentViewPatient.services.length > 0 ? (
                  <p className="text-xs text-muted">الخدمات السابقة: {currentViewPatient.services.join(" - ")}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">لا يوجد مريض داخل الكشف حاليا.</p>
            )}
          </Panel>

          <Panel title="القادمون" icon={<FileText className="h-5 w-5" />}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">لا يوجد مرضى بانتظار الدور.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((visit, index) => (
                  <li key={visit.id} className="rounded-lg border border-line px-2 py-2 text-sm text-foreground">
                    {index + 1}. {visit.fullName}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="إتمام الجلسة" icon={<Wallet className="h-5 w-5" />}>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-primary-soft/40 p-2">
                <p className="mb-2 text-xs font-bold text-primary">إضافة نوع كشف جديد إلى الكتالوج</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <input
                    value={catalogTitle}
                    onChange={(event) => setCatalogTitle(event.target.value)}
                    placeholder="نوع الكشف"
                    className="w-full rounded-lg border border-line px-2 py-2 text-sm outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={catalogPrice}
                    onChange={(event) => setCatalogPrice(event.target.value)}
                    placeholder="السعر"
                    className="w-full rounded-lg border border-line px-2 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={onAddCatalogItem}
                    disabled={catalogBusy}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              {!activePatient ? (
                <p className="text-sm leading-7 text-muted">ابدأ بإدخال مريض من السكرتارية لتفعيل إتمام الجلسة.</p>
              ) : (
                <>
                <div className="rounded-xl border border-line bg-primary-soft/30 p-2">
                  <p className="mb-2 text-xs font-bold text-primary">إضافة كشف/علاج يدوي</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={visitDraft.manualTitle}
                      onChange={(event) => updateDraft({ manualTitle: event.target.value })}
                      placeholder="نوع الكشف"
                      className="w-full rounded-lg border border-line px-2 py-2 text-sm outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={visitDraft.manualPrice}
                      onChange={(event) => updateDraft({ manualPrice: event.target.value })}
                      placeholder="السعر"
                      className="w-full rounded-lg border border-line px-2 py-2 text-sm outline-none"
                    />
                  </div>
                </div>

                {catalog.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-700">
                    لا توجد عناصر في كتالوج العلاجات حاليا. يمكنك استخدام البند اليدوي بالأعلى أو تشغيل seed.sql.
                  </p>
                ) : null}

                <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-line p-2">
                  {catalog.map((item) => {
                    const checked = visitDraft.selectedIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-2 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleTreatment(item.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-semibold text-foreground">{item.titleAr}</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          disabled={!checked}
                          value={visitDraft.priceMap[item.id] ?? String(item.defaultPrice)}
                          onChange={(event) =>
                            updateDraft({
                              priceMap: {
                                ...visitDraft.priceMap,
                                [item.id]: event.target.value,
                              },
                            })
                          }
                          className="w-24 rounded-lg border border-line px-2 py-1 text-sm outline-none"
                        />
                      </label>
                    );
                  })}
                </div>

                <input
                  type="date"
                  value={visitDraft.nextAppointmentDate}
                  onChange={(event) => updateDraft({ nextAppointmentDate: event.target.value })}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none"
                />

                <input
                  type="time"
                  value={visitDraft.nextAppointmentTime}
                  onChange={(event) => updateDraft({ nextAppointmentTime: event.target.value })}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none"
                />

                {conflictingAppointments.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    هذا الموعد محجوز مع: {conflictingAppointments.map((item) => item.patientName).join(" - ")}
                  </div>
                ) : null}

                <div className="rounded-lg bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
                  الإجمالي: {totalAmount.toFixed(2)} جنيه
                </div>

                <button
                  type="button"
                  onClick={onBillingSubmit}
                  disabled={billingBusy}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  إتمام الجلسة وإرسال الحساب
                </button>
                </>
              )}
            </div>
          </Panel>
        </section>
      </div>
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
      <div className="mb-4 inline-flex rounded-xl bg-primary-soft p-2 text-primary">{icon}</div>
      <h2 className="mb-2 text-lg font-extrabold text-foreground">{title}</h2>
      {children}
    </article>
  );
}
