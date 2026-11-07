import { Metadata } from "next";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Alte Store",
  description: "6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında Aydınlatma Metni",
};

export default function KvkkPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-8 border-b pb-4">
        KVKK Aydınlatma Metni
      </h1>
      <div className="prose prose-neutral max-w-none text-neutral-700 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            1. VERİ SORUMLUSUNUN KİMLİĞİ
          </h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, kişisel
            verileriniz veri sorumlusu olarak Alte Teknoloji ve Ticaret A.Ş. (&quot;Şirket&quot;)
            tarafından aşağıda açıklanan kapsamda işlenebilecektir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            2. KİŞİSEL VERİLERİN İŞLENME AMACI
          </h2>
          <p>
            Toplanan kişisel verileriniz (ad, soyad, telefon numarası, e-posta adresi, teslimat ve
            fatura adresi); siparişlerinizin alınması, ürün ve hizmetlerin sunulması, fatura
            düzenlenmesi, kargo süreçlerinin yürütülmesi, müşteri memnuniyeti ve yasal
            yükümlülüklerin yerine getirilmesi amacıyla işlenmektedir. Şirketimiz, yasal zorunluluk
            haricinde TC Kimlik Numarası gibi hassas nitelikli bilgileri gereksiz yere talep
            etmemekte ve işlememektedir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            3. KİŞİSEL VERİLERİN AKTARILMASI
          </h2>
          <p>
            Kişisel verileriniz, yasal mevzuatın gerektirdiği hallerde adli/idari makamlar ile ve
            siparişinizin ifası kapsamında anlaşmalı kargo şirketleri, yetkili ödeme kuruluşları ve
            teknik altyapı sağlayıcılarımız ile sınırlı olarak paylaşılabilmektedir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">4. VERİ SAHİBİNİN HAKLARI</h2>
          <p>
            KVKK&apos;nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip
            işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, amaca uygun kullanılıp
            kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri
            bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme ve silinmesini/yok edilmesini
            isteme haklarına sahiptir.
          </p>
        </section>
      </div>
    </div>
  );
}
