import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Hesabım",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function HesapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
