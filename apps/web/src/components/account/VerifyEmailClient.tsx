"use client";

import React from "react";
import { OtpVerificationCard } from "./OtpVerificationCard";

export function VerifyEmailClient({
  email = "",
  redirectTo = "/hesap",
}: {
  email?: string;
  redirectTo?: string;
}) {
  return <OtpVerificationCard initialEmail={email} redirectTo={redirectTo} />;
}
