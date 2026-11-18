import { VerifyEmailClient } from "../../../../components/account/VerifyEmailClient";
import { getServerCustomer } from "../../../../lib/medusa/account";
import { sanitizeRedirectPath } from "../../../../lib/medusa/safe-redirect";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const queryEmail = typeof params.email === "string" ? params.email : "";
  const redirectTo = sanitizeRedirectPath(params.redirect, "/hesap");
  const customer = queryEmail ? null : await getServerCustomer().catch(() => null);
  const email = queryEmail || customer?.email || "";

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <VerifyEmailClient email={email} redirectTo={redirectTo} />
      </div>
    </div>
  );
}
