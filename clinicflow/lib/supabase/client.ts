import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  if (url.includes('your-project-ref.supabase.co') || anonKey === 'your-anon-key') {
    throw new Error(
      'Supabase environment variables are placeholders. Replace NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    );
  }

  browserClient = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}

export function tryGetSupabaseBrowserClient(): {
  client: SupabaseClient<Database> | null;
  error: string | null;
} {
  try {
    return { client: getSupabaseBrowserClient(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Supabase client error';
    if (
      message.includes('Missing Supabase environment variables') ||
      message.includes('Supabase environment variables are placeholders')
    ) {
      return {
        client: null,
        error:
          'بيانات Supabase غير مضافة بعد. افتح ملف .env.local وأضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY ثم أعد تشغيل الخادم.',
      };
    }
    return { client: null, error: message };
  }
}
