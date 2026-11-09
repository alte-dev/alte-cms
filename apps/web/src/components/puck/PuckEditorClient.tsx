"use client";

import React, { useState, useTransition } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/dist/index.css";
import { puckConfig } from "@/lib/puck/config";
import Link from "next/link";

interface PuckEditorClientProps {
  pageId: string | number;
  initialData?: any;
  pageTitle: string;
  pageSlug: string;
}

export function PuckEditorClient({
  pageId,
  initialData,
  pageTitle,
  pageSlug,
}: PuckEditorClientProps) {
  const [data, setData] = useState<Data>(
    initialData && typeof initialData === "object" && initialData.content
      ? initialData
      : { content: [], root: { props: { title: pageTitle } } },
  );

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = async (dataToSave: Data, publish = false) => {
    setMessage(null);
    try {
      const res = await fetch("/api/puck/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pageId,
          puckData: dataToSave,
          publish,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Kaydetme başarısız oldu.");
      }

      setMessage({
        type: "success",
        text: publish ? "Sayfa başarıyla yayınlandı!" : "Taslak kaydedildi.",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Bir hata oluştu.",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-100 text-zinc-900 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b border-zinc-200 bg-white px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/collections/pages"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded px-2.5 py-1.5 transition-colors"
          >
            &larr; Admin Paneli
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-900">{pageTitle}</span>
            <span className="text-xs text-zinc-400">({pageSlug})</span>
          </div>
        </div>

        {message && (
          <div
            className={`text-xs px-3 py-1.5 rounded font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={`/onizleme/${pageId}`}
            target="_blank"
            className="text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-zinc-300 rounded px-3 py-1.5 transition-colors"
          >
            Önizle ↗
          </Link>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await handleSave(data, false);
              });
            }}
            className="text-xs font-medium text-zinc-700 hover:bg-zinc-100 border border-zinc-300 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor..." : "Taslak Kaydet"}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await handleSave(data, true);
              });
            }}
            className="text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded px-3 py-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            Yayına Al
          </button>
        </div>
      </header>

      {/* Puck Canvas */}
      <main className="flex-1 relative overflow-hidden">
        <Puck
          config={puckConfig}
          data={data}
          onChange={(newData) => setData(newData)}
          onPublish={(publishData) => {
            startTransition(async () => {
              await handleSave(publishData, true);
            });
          }}
        />
      </main>
    </div>
  );
}
