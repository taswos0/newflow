export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          birth_date: string | null;
          medical_alerts: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          birth_date?: string | null;
          medical_alerts?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          birth_date?: string | null;
          medical_alerts?: string[];
          created_at?: string;
        };
      };
      treatments_catalog: {
        Row: {
          id: string;
          title_ar: string;
          default_price: number;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title_ar: string;
          default_price: number;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title_ar?: string;
          default_price?: number;
          category?: string;
          created_at?: string;
        };
      };
      visits_queue: {
        Row: {
          id: string;
          patient_id: string;
          visit_date: string;
          status: 'waiting' | 'in_consultation' | 'completed';
          check_in_time: string;
          call_time: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          visit_date?: string;
          status?: 'waiting' | 'in_consultation' | 'completed';
          check_in_time?: string;
          call_time?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          visit_date?: string;
          status?: 'waiting' | 'in_consultation' | 'completed';
          check_in_time?: string;
          call_time?: string | null;
          created_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          visit_id: string;
          patient_id: string;
          total_amount: number;
          paid_amount: number;
          remaining_amount: number;
          next_appointment_date: string | null;
          payment_status: 'unpaid' | 'partial' | 'paid';
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          patient_id: string;
          total_amount?: number;
          paid_amount?: number;
          remaining_amount?: number;
          next_appointment_date?: string | null;
          payment_status?: 'unpaid' | 'partial' | 'paid';
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          patient_id?: string;
          total_amount?: number;
          paid_amount?: number;
          remaining_amount?: number;
          next_appointment_date?: string | null;
          payment_status?: 'unpaid' | 'partial' | 'paid';
          created_at?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          treatment_title: string;
          price_applied: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          treatment_title: string;
          price_applied: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          treatment_title?: string;
          price_applied?: number;
          created_at?: string;
        };
      };
      daily_expenses: {
        Row: {
          id: string;
          title: string;
          amount: number;
          expense_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          amount: number;
          expense_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          amount?: number;
          expense_date?: string;
          created_at?: string;
        };
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          patient_id: string;
          amount: number;
          method: 'cash' | 'wallet';
          collected_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          patient_id: string;
          amount: number;
          method: 'cash' | 'wallet';
          collected_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          patient_id?: string;
          amount?: number;
          method?: 'cash' | 'wallet';
          collected_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string | null;
          patient_name: string;
          phone: string;
          appointment_date: string;
          appointment_time: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id?: string | null;
          patient_name: string;
          phone: string;
          appointment_date: string;
          appointment_time?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string | null;
          patient_name?: string;
          phone?: string;
          appointment_date?: string;
          appointment_time?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      payment_method: 'cash' | 'wallet';
      payment_status: 'unpaid' | 'partial' | 'paid';
      visit_status: 'waiting' | 'in_consultation' | 'completed';
    };
    CompositeTypes: Record<string, never>;
  };
}
