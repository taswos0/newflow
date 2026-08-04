import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/app-toaster";
import { AuthGate } from "@/components/auth/auth-gate";
import { SessionActions } from "@/components/auth/session-actions";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClinicFlow",
  description: "نظام ذكي لإدارة العيادات الطبية وعيادات الأسنان لحظيا",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthGate>
          <SessionActions />
          {children}
        </AuthGate>
        <AppToaster />
      </body>
    </html>
  );
}
