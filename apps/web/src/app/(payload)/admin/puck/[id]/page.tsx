import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { isStaffRole } from "@/access/content";
import { PuckEditorClient } from "@/components/puck/PuckEditorClient";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminPuckEditorPage({ params }: Props) {
  const { id } = await params;
  const payload = await getPayload({ config: configPromise });
  const reqHeaders = await headers();

  const { user } = await payload.auth({ headers: reqHeaders });
  if (!user || !isStaffRole(user.role as string)) {
    redirect(`/admin/login?redirect=/admin/puck/${id}`);
  }

  let pageDoc: any = null;
  try {
    pageDoc = await payload.findByID({
      collection: "pages",
      id,
      draft: true,
      user,
    });
  } catch {
    notFound();
  }

  if (!pageDoc) {
    notFound();
  }

  return (
    <PuckEditorClient
      pageId={pageDoc.id}
      initialData={pageDoc.puckData}
      pageTitle={pageDoc.title || "İsimsiz Sayfa"}
      pageSlug={pageDoc.slug || ""}
    />
  );
}
