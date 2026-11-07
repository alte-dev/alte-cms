import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi | Alte Store",
  description: "Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Koşulları",
};

export default function MesafeliSatisSozlesmesiPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-8 border-b pb-4">
        Mesafeli Satış Sözleşmesi
      </h1>
      <div className="prose prose-neutral max-w-none text-neutral-700 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">1. TARAFLAR</h2>
          <p>
            İşbu Mesafeli Satış Sözleşmesi (&quot;Sözleşme&quot;), ALICI ile SATICI arasında,
            ALICI&apos;nın SATICI&apos;ya ait internet sitesi üzerinden elektronik ortamda
            siparişini verdiği aşağıda nitelikleri ve satış fiyatı belirtilen ürünün/hizmetin satışı
            ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve
            Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince düzenlenmiştir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">2. KONU</h2>
          <p>
            İşbu Sözleşmenin konusu, ALICI&apos;nın SATICI&apos;ya ait internet sitesinden
            elektronik ortamda siparişini yaptığı ürün/ürünlerin satışı, teslimi ve tarafların hak
            ve yükümlülüklerinin belirlenmesidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            3. SİPARİŞ VE TESLİMAT KOŞULLARI
          </h2>
          <p>
            Ürünler, sipariş onayından sonra taahhüt edilen süre içinde ALICI&apos;nın bildirdiği
            teslimat adresine anlaşmalı kargo şirketi aracılığıyla sevk edilir. Kargo ücreti, aksi
            sipariş aşamasında belirtilmedikçe veya ücretsiz kargo barajı aşılmadıkça ALICI
            tarafından karşılanır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">4. CAYMA HAKKI</h2>
          <p>
            ALICI, sözleşme konusu ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa
            tesliminden itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin ve
            cezai şart ödemeksizin cayma hakkını kullanabilir. Cayma hakkının kullanılması için bu
            süre içinde SATICI&apos;ya yazılı bildirimde bulunulması ve ürünün kullanılmamış olması
            şarttır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">5. YETKİLİ MAHKEME</h2>
          <p>
            İşbu Sözleşmeden doğan uyuşmazlıklarda, Sanayi ve Ticaret Bakanlığınca her yıl ilan
            edilen değere kadar Tüketici Hakem Heyetleri ile ALICI&apos;nın veya SATICI&apos;nın
            yerleşim yerindeki Tüketici Mahkemeleri yetkilidir.
          </p>
        </section>
      </div>
    </div>
  );
}
