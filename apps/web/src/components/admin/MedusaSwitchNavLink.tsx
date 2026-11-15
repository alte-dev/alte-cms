"use client";

import React, { useEffect, useState } from "react";

export function MedusaSwitchNavLink() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { role?: string } } | null) => {
        if (!active) return;
        const role = data?.user?.role;
        if (role === "super-admin" || role === "admin") {
          setAllowed(true);
        }
      })
      .catch(() => {
        // Ignore network errors silently in nav link
      });
    return () => {
      active = false;
    };
  }, []);

  if (!allowed) {
    return null;
  }

  return (
    <div
      style={{
        padding: "12px 0",
        borderTop: "1px solid var(--theme-elevation-150)",
        marginTop: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => {
          window.location.href = "/api/admin/switch-to-medusa";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          backgroundColor: "var(--theme-elevation-100)",
          color: "var(--theme-text)",
          fontSize: "13px",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        <span>🛍️ Mağaza Yönetimi (/app)</span>
      </button>
    </div>
  );
}

export default MedusaSwitchNavLink;
