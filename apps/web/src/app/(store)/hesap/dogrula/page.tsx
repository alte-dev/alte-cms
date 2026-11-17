import { VerifyEmailClient } from "../../../../components/account/VerifyEmailClient";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <VerifyEmailClient email={email} />
      </div>
    </div>
  );
}
