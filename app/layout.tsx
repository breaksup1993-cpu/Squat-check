import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "בדיקת סקוואט",
  description: "ניתוח טכניקת סקוואט מווידאו קצר, ישירות בדפדפן וללא שרת.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
