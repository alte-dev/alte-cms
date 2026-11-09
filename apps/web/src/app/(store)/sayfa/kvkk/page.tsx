import { Metadata } from "next";
export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Mağaza",
  description: "6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında Aydınlatma Metni",
};

export default function KvkkPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-8 border-b pb-4">
        KVKK Aydınlatma Metni
      </h1>
      <p className="text-neutral-700 text-sm">
        Yer tutucu — bu hukuki metin mağaza sahibi tarafından eklenecektir.
      </p>
    </div>
  );
}
