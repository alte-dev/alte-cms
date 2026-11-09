import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { isStaffRole } from "@/access/content";
import { RenderPuckContent } from "@/lib/puck/render";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Taslak Önizleme | Mağaza",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function PagePreview({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  const payload = await getPayload({ config: configPromise });
  const reqHeaders = await headers();
  const { user } = await payload.auth({ headers: reqHeaders });

  // Verification: Staff session OR preview token match
  const isStaff = user && isStaffRole(user.role as string);
  const isValidToken = token && token === process.env.PAYLOAD_SECRET;

  if (!isStaff && !isValidToken) {
    notFound();
  }

  let pageDoc: any = null;
  try {
    pageDoc = await payload.findByID({
      collection: "pages",
      id,
      draft: true,
    });
  } catch {
    notFound();
  }

  if (!pageDoc) {
    notFound();
  }

  return (
    <div className="w-full">
      {/* Draft Warning Banner */}
      <div className="bg-amber-500 text-zinc-950 px-4 py-2 text-xs font-semibold text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-3">
        <span>
          ⚠️ Bu sayfa TASLAK modunda önizlenmektedir. Arama motorları tarafından indekslenmez
          (noindex).
        </span>
        <span className="bg-black/10 px-2 py-0.5 rounded text-[11px]">
          Durum: {pageDoc._status || "draft"}
        </span>
      </div>

      <div className="py-6">
        <RenderPuckContent data={pageDoc.puckData} />
      </div>
    </div>
  );
}
