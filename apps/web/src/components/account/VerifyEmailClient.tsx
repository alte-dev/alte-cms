"use client";

import React from "react";
import { OtpVerificationCard } from "./OtpVerificationCard";
import { sanitizeRedirectPath } from "../../lib/medusa/safe-redirect";

export function VerifyEmailClient({
  email = "",
  redirectTo = "/hesap",
}: {
  email?: string;
  redirectTo?: string;
}) {
  const safeRedirectTo = sanitizeRedirectPath(redirectTo, "/hesap");
  return <OtpVerificationCard initialEmail={email} redirectTo={safeRedirectTo} />;
}
