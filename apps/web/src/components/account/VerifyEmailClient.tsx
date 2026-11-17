"use client";

import React from "react";
import { OtpVerificationCard } from "./OtpVerificationCard";

export function VerifyEmailClient({ email = "" }: { email?: string }) {
  return <OtpVerificationCard initialEmail={email} />;
}
