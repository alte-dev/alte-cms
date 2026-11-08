import { Metadata } from "next";
import { STORE_NAME } from "@/lib/constants/store-config";

export const metadata: Metadata = {
  title: `Mesafeli Satış Sözleşmesi | ${STORE_NAME}`,
  description: "Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Koşulları",
};

export default function MesafeliSatisSozlesmesiPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-8 border-b pb-4">
        Mesafeli Satış Sözleşmesi
      </h1>
      <p className="text-neutral-700 text-sm">
        Yer tutucu — bu hukuki metin mağaza sahibi tarafından eklenecektir.
      </p>
    </div>
  );
}
