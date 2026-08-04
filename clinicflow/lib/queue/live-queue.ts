import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { mapSupabaseError } from '@/lib/supabase/error-map';

export type QueueVisit = {
  id: string;
  patientId: string;
  status: Database['public']['Enums']['visit_status'];
  checkInTime: string;
  callTime: string | null;
  fullName: string;
  phone: string;
  medicalAlerts: string[];
};

export function getTodayDateISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchTodayQueue(
  supabase: SupabaseClient<Database>,
): Promise<{ data: QueueVisit[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('visits_queue')
      .select(
        `
        id,
        patient_id,
        status,
        check_in_time,
        call_time,
        patients (
          full_name,
          phone,
          medical_alerts
        )
      `,
      )
      .eq('visit_date', getTodayDateISO())
      .order('check_in_time', { ascending: true });

    if (error) {
      return { data: [], error: mapSupabaseError(error) };
    }

    const normalized: QueueVisit[] = (data ?? []).map((row) => {
      const patientRaw = Array.isArray(row.patients) ? row.patients[0] : row.patients;

      return {
        id: row.id,
        patientId: row.patient_id,
        status: row.status,
        checkInTime: row.check_in_time,
        callTime: row.call_time,
        fullName: patientRaw?.full_name ?? 'غير معروف',
        phone: patientRaw?.phone ?? '---',
        medicalAlerts: patientRaw?.medical_alerts ?? [],
      };
    });

    return { data: normalized, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch';
    return {
      data: [],
      error: mapSupabaseError({ message }),
    };
  }
}
