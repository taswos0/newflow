type MaybeError = { message?: string } | null | undefined;

export function mapSupabaseError(input: MaybeError): string {
  const message = input?.message ?? '';

  if (message.includes('idx_appointments_slot_unique') || message.includes('duplicate key value violates unique constraint')) {
    return 'هذا التوقيت محجوز بالفعل في هذا اليوم. اختر موعدا آخر.';
  }

  if (message.includes('row-level security policy') || message.includes('new row violates')) {
    return 'صلاحيات RLS تمنع العملية. نفذ ملف supabase/schema.sql داخل Supabase SQL Editor لتثبيت سياسات الوصول، ثم أعد المحاولة.';
  }

  if (
    message.includes("Could not find the table 'public.visits_queue' in the schema cache") ||
    message.includes("relation \"public.visits_queue\" does not exist")
  ) {
    return 'جدول visits_queue غير موجود في Supabase. افتح SQL Editor ونفذ ملف supabase/schema.sql ثم أعد تحميل الصفحة.';
  }

  if (
    message.includes("Could not find the table 'public.appointments' in the schema cache") ||
    message.includes("relation \"public.appointments\" does not exist")
  ) {
    return 'جدول appointments غير موجود في Supabase. نفذ ملف supabase/schema.sql مرة أخرى لتفعيل ميزة الكالندر.';
  }

  if (message.includes("relation \"public.patients\" does not exist")) {
    return 'جدول patients غير موجود في Supabase. نفذ ملف supabase/schema.sql من SQL Editor.';
  }

  if (message.toLowerCase().includes('failed to fetch')) {
    return 'تعذر الاتصال بـ Supabase. تأكد من اتصال الإنترنت وصحة بيانات .env.local.';
  }

  return message || 'حدث خطأ غير متوقع أثناء الاتصال بـ Supabase.';
}
