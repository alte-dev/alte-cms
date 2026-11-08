"use client";

import React, { useEffect, useState } from "react";

export function PuckEditorButton() {
  const [pageId, setPageId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // In Payload admin, URL is /admin/collections/pages/:id
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "create" && last !== "pages") {
        setPageId(last);
      }
    }
  }, []);

  if (!pageId) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
        Sayfayı görsel düzenleyici (Puck) ile düzenlemek için lütfen önce kaydedin.
      </div>
    );
  }

  return (
    <div className="my-2">
      <a
        href={`/admin/puck/${pageId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition-colors"
      >
        <span>🎨 Görsel Düzenleyiciyle Aç (Puck)</span>
      </a>
      <p className="text-[11px] text-zinc-500 mt-1 text-center">
        Blokları sürükle-bırak yöntemiyle görsel olarak tasarlayın.
      </p>
    </div>
  );
}

export default PuckEditorButton;
