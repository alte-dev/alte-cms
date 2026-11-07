import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ALTE E-Ticaret ve İçerik Yönetim Platformu",
  description: "Medusa v2 ve Payload CMS 3 tabanlı modüler e-ticaret platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
