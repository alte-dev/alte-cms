"use client";

import React, { useEffect, useRef, useState } from "react";
import { FieldLabel, useField } from "@payloadcms/ui";
import type { TextFieldClientProps } from "payload";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const PRESET_SWATCHES = [
  "#3A4A5B",
  "#2E3B49",
  "#92A3B6",
  "#1C1917",
  "#666666",
  "#FFFFFF",
  "#FAFAF9",
  "#F5F5F5",
  "#DEDEDE",
  "#E7E5E4",
  "#0F766E",
  "#1D4ED8",
  "#7C3AED",
  "#991B1B",
];

function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

export function ColorField({ field, path }: TextFieldClientProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({ path });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultVal =
    typeof field.admin?.placeholder === "string" && HEX_RE.test(field.admin.placeholder)
      ? field.admin.placeholder
      : "#3A4A5B";

  const activeHex = typeof value === "string" && HEX_RE.test(value) ? value : defaultVal;
  const light = isLightColor(activeHex);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: "1rem" }}>
      <FieldLabel htmlFor={`field-${path}`} label={field.label} required={field.required} />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginTop: "6px",
          borderRadius: "6px",
          border: showError
            ? "1px solid var(--theme-error-500, #dc2626)"
            : "1px solid var(--theme-elevation-200)",
          backgroundColor: "var(--theme-elevation-0)",
          overflow: "hidden",
          maxWidth: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={
            typeof field.label === "string" ? `${field.label} renk paletini aç` : "Renk paletini aç"
          }
          title="Renk seç"
          style={{
            width: "44px",
            height: "36px",
            backgroundColor: activeHex,
            border: "none",
            borderRight: "1px solid var(--theme-elevation-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={light ? "#1C1917" : "#FFFFFF"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
            <path d="m5 2 5 5" />
            <path d="M2 13h15" />
            <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
          </svg>
        </button>

        <input
          id={`field-${path}`}
          type="text"
          value={value ?? ""}
          placeholder={defaultVal}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: "110px",
            height: "36px",
            padding: "0 10px",
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            color: "var(--theme-text)",
            fontFamily: "monospace",
            fontSize: "13px",
          }}
        />

        <button
          type="button"
          onClick={() => setValue(defaultVal)}
          style={{
            height: "36px",
            padding: "0 10px",
            border: "none",
            borderLeft: "1px solid var(--theme-elevation-200)",
            backgroundColor: "var(--theme-elevation-50)",
            color: "var(--theme-text)",
            fontSize: "12px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Sıfırla
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 50,
            marginTop: "6px",
            padding: "12px",
            width: "248px",
            borderRadius: "8px",
            border: "1px solid var(--theme-elevation-200)",
            backgroundColor: "var(--theme-elevation-50)",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--theme-text)" }}>
              Renk Seçici
            </span>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--theme-text)",
                cursor: "pointer",
              }}
            >
              <span>Özel</span>
              <input
                type="color"
                value={activeHex}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                style={{
                  width: "28px",
                  height: "24px",
                  padding: 0,
                  border: "1px solid var(--theme-elevation-200)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "6px",
            }}
          >
            {PRESET_SWATCHES.map((swatch) => {
              const selected = activeHex.toUpperCase() === swatch.toUpperCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  aria-label={`Renk ${swatch}`}
                  onClick={() => {
                    setValue(swatch);
                    setOpen(false);
                  }}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "4px",
                    backgroundColor: swatch,
                    border: selected
                      ? "2px solid var(--theme-text)"
                      : "1px solid var(--theme-elevation-250)",
                    cursor: "pointer",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {showError && errorMessage && (
        <p
          role="alert"
          style={{
            marginTop: "4px",
            fontSize: "12px",
            color: "var(--theme-error-500, #dc2626)",
            fontWeight: 500,
          }}
        >
          {errorMessage}
        </p>
      )}

      {field.admin?.description && typeof field.admin.description === "string" && (
        <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--theme-elevation-500)" }}>
          {field.admin.description}
        </p>
      )}
    </div>
  );
}
