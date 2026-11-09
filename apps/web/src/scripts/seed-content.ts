import { getPayload } from "payload";
import configPromise from "../payload.config";

async function seedContent() {
  console.log("🌱 Starting Payload CMS Content Seed...");
  const payload = await getPayload({ config: configPromise });

  // 0. Ensure Test Staff Users Exist (Admin & Editor)
  console.log("👥 Checking Staff Users...");
  const existingAdmin = await payload.find({
    collection: "users",
    where: { email: { equals: "admin@example.test" } },
    limit: 1,
  });
  if (existingAdmin.docs.length === 0) {
    await payload.create({
      collection: "users",
      data: {
        email: "admin@example.test",
        password: "test-admin-password-123",
        name: "Test Admin",
        role: "admin",
      },
    });
    console.log("  + Test Admin created: admin@example.test");
  }

  const existingEditor = await payload.find({
    collection: "users",
    where: { email: { equals: "editor@example.test" } },
    limit: 1,
  });
  if (existingEditor.docs.length === 0) {
    await payload.create({
      collection: "users",
      data: {
        email: "editor@example.test",
        password: "test-editor-password-123",
        name: "Test Editör",
        role: "editor",
      },
    });
    console.log("  + Test Editor created: editor@example.test");
  }

  // 1. Site Settings Global
  console.log("⚙️  Updating Site Settings Global...");
  await payload.updateGlobal({
    slug: "site-settings",
    data: {
      storeName: "Demo Mağaza",
      storeDescription:
        "Özenle tasarlanmış giyim, aksesuar ve yaşam ürünleri. Zarafet, doğallık ve kaliteli işçilik.",
      contactEmail: "iletisim@example.test",
      contactPhone: "0850 000 00 00",
      address: "Nişantaşı Mah. Abdi İpekçi Cad. No: 42/3 Şişli / İstanbul",
      socialMedia: {
        instagram: "https://instagram.com/example",
        facebook: "https://facebook.com/example",
        twitter: "https://x.com/example",
        youtube: "https://youtube.com/@example",
      },
    },
  });

  // 2. Navigation Global
  console.log("🧭 Updating Navigation Global...");
  await payload.updateGlobal({
    slug: "navigation",
    data: {
      headerMenu: [
        { label: "Anasayfa", href: "/" },
        { label: "Tüm Ürünler", href: "/urunler" },
        { label: "Blog", href: "/blog" },
        { label: "Hakkımızda", href: "/sayfa/hakkimizda" },
        { label: "İletişim", href: "/sayfa/iletisim" },
      ],
      footerMenu: [
        {
          title: "Kurumsal",
          items: [
            { label: "Hakkımızda", href: "/sayfa/hakkimizda" },
            { label: "İletişim", href: "/sayfa/iletisim" },
            { label: "Mesafeli Satış Sözleşmesi", href: "/sayfa/mesafeli-satis-sozlesmesi" },
            { label: "KVKK Aydınlatma Metni", href: "/sayfa/kvkk" },
          ],
        },
        {
          title: "Kategoriler",
          items: [
            { label: "Giyim", href: "/kategori/giyim" },
            { label: "Üst Giyim", href: "/kategori/ust-giyim" },
            { label: "Alt Giyim", href: "/kategori/alt-giyim" },
            { label: "Aksesuar", href: "/kategori/aksesuar" },
          ],
        },
      ],
    },
  });

  // 3. Post Categories (Idempotent)
  console.log("📚 Seeding Post Categories...");
  const categoriesData = [
    {
      title: "Stil Rehberi",
      slug: "stil-rehberi",
      description: "Günlük ve özel davet kombinleri, renk uyumu ve mevsimlik stil ipuçları.",
    },
    {
      title: "Kumaş & Bakım",
      slug: "kumas-ve-bakim",
      description: "Doğal lifler, keten, pamuk ve ipek kumaşların doğru yıkama ve bakım kılavuzu.",
    },
    {
      title: "Koleksiyon Hikayeleri",
      slug: "koleksiyon-hikayeleri",
      description: "Tasarım süreçleri, ilham kaynakları ve atölye arkası anlatımları.",
    },
  ];

  const categoryMap = new Map<string, string | number>();
  for (const cat of categoriesData) {
    const existing = await payload.find({
      collection: "post-categories",
      where: { slug: { equals: cat.slug } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      categoryMap.set(cat.slug, existing.docs[0].id);
      console.log(`  - Category '${cat.title}' already exists.`);
    } else {
      const created = await payload.create({
        collection: "post-categories",
        data: cat,
      });
      categoryMap.set(cat.slug, created.id);
      console.log(`  + Category '${cat.title}' created.`);
    }
  }

  // Find or use first staff user as author
  const users = await payload.find({
    collection: "users",
    limit: 1,
  });
  const defaultAuthorId = users.docs[0]?.id;

  // 4. Sample Blog Posts (Idempotent)
  console.log("✍️  Seeding Blog Posts...");
  const postsData = [
    {
      title: "Kapsül Gardırop Oluşturmanın 5 Altın Kuralı",
      slug: "kapsul-gardirop-olusturmanin-5-altin-kurali",
      excerpt:
        "Daha az parça ile daha çok ve zarif kombin oluşturmanın pratik yöntemleri. Zamansız tasarımlarla minimalist şıklık.",
      categorySlug: "stil-rehberi",
      content: {
        root: {
          type: "root",
          direction: "ltr" as const,
          format: "" as const,
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Kapsül gardırop kavramı, birbiriyle uyumlu, yüksek kaliteli ve zamansız parçalardan oluşan minimalist bir giyim koleksiyonudur. Gardırobunuzu sadeleştirerek hem her sabah 'ne giyeceğim' stresinden kurtulabilir hem de her daim özenli ve şık görünebilirsiniz.",
                },
              ],
            },
            {
              type: "heading",
              version: 1,
              tag: "h2",
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "1. Nötr Renk Paleti ile Temeli Atın",
                },
              ],
            },
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Siyah, beyaz, bej, ekru ve lacivert gibi temel renkler, tüm parçaların birbiriyle zahmetsizce eşleşmesini sağlar. Sezon renklerini ise küçük aksesuarlarla koleksiyonunuza dahil edebilirsiniz.",
                },
              ],
            },
            {
              type: "heading",
              version: 1,
              tag: "h2",
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "2. Doğal Kumaşlara Yatırım Yapın",
                },
              ],
            },
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Pamuk, keten ve yün gibi doğal dokular hem nefes alır hem de uzun yıllar formunu kaybetmeden ilk günkü zarafetini korur.",
                },
              ],
            },
          ],
        },
      },
    },
    {
      title: "Keten Kumaş Bakım Kılavuzu: Uzun Ömürlü Kullanım İpuçları",
      slug: "keten-kumas-bakim-kilavuzu",
      excerpt:
        "Yaz aylarının vazgeçilmezi doğal keten kıyafetlerinizi yıkarken, kuruturken ve ütülerken dikkat etmeniz gereken püf noktaları.",
      categorySlug: "kumas-ve-bakim",
      content: {
        root: {
          type: "root",
          direction: "ltr" as const,
          format: "" as const,
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Keten, insanlık tarihinin bilinen en eski ve en asil kumaşlarından biridir. Dayanıklılığı ve kendine has doğal kırışıklıkları ile rahat şıklığın simgesidir.",
                },
              ],
            },
            {
              type: "heading",
              version: 1,
              tag: "h2",
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Yıkama Sıcaklığı ve Deterjan Seçimi",
                },
              ],
            },
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Keten kıyafetlerinizi daima 30 dereceyi geçmeyen ılık veya soğuk suda, hassas yıkama programında yıkayınız. Ağartıcı ve ağır kimyasallar kumaşın doğal liflerine zarar verebilir.",
                },
              ],
            },
          ],
        },
      },
    },
    {
      title: "Yeni Sezon Hikayesi: Ege Esintisi Koleksiyonu",
      slug: "yeni-sezon-hikayesi-ege-esintisi",
      excerpt:
        "Doğanın dinginliğinden, zeytin ağaçlarından ve deniz kıyısındaki hafif rüzgarlardan ilham alan yeni koleksiyonumuzun sahne arkası.",
      categorySlug: "koleksiyon-hikayeleri",
      content: {
        root: {
          type: "root",
          direction: "ltr" as const,
          format: "" as const,
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              version: 1,
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Yeni sezon koleksiyonumuzu tasarlarken doğanın sunduğu huzurlu tonlardan ve zamansız silüetlerden ilham aldık. Her bir dikiş, kumaşın akışkanlığına saygı duyularak titizlikle hazırlandı.",
                },
              ],
            },
          ],
        },
      },
    },
  ];

  for (const post of postsData) {
    const existing = await payload.find({
      collection: "posts",
      where: { slug: { equals: post.slug } },
      limit: 1,
    });

    const categoryId = categoryMap.get(post.categorySlug);

    if (existing.docs.length > 0) {
      console.log(`  - Post '${post.title}' already exists.`);
    } else {
      await payload.create({
        collection: "posts",
        data: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          categories: categoryId ? [Number(categoryId)] : [],
          author: defaultAuthorId,
          _status: "published" as const,
        },
      });
      console.log(`  + Post '${post.title}' created and published.`);
    }
  }

  // 5. Pages with Puck Data (Idempotent)
  console.log("📄 Seeding Pages with Visual Blocks (Puck)...");

  // Page 1: Hakkımızda (Published)
  const hakkimizdaData = {
    title: "Hakkımızda",
    slug: "hakkimizda",
    _status: "published" as const,
    puckData: {
      root: { props: { title: "Hakkımızda" } },
      content: [
        {
          type: "Hero",
          props: {
            title: "Hikayemiz ve Değerlerimiz",
            subtitle: "Zarafeti, kaliteyi ve sürdürülebilir tasarımı bir araya getiriyoruz.",
            bgColor: "gray",
            align: "center",
            primaryButtonText: "Koleksiyonu İncele",
            primaryButtonHref: "/urunler",
          },
        },
        {
          type: "RichText",
          props: {
            content:
              "Mağaza olarak, her parçanın kendine has bir hikayesi olduğuna inanıyoruz. Üretim sürecimizde çevreye duyarlı, yüksek kaliteli doğal kumaşları ve usta işçiliği tercih ediyoruz.\n\nAmacımız yalnızca giysi üretmek değil, kendinizi özel ve özgüvenli hissettiren zamansız bir deneyim sunmaktır.",
            maxWidth: "prose-lg",
          },
        },
        {
          type: "Columns",
          props: {
            columns: "3",
            col1Title: "Doğal & Nefes Alan Kumaşlar",
            col1Content:
              "Tüm koleksiyonlarımızda keten, pamuk ve ipek gibi cildinize dost doğal lifler kullanılır.",
            col2Title: "Usta Terzilik & İnce İşçilik",
            col2Content:
              "Her bir dikiş ve detay, uzman eller tarafından yüksek kalite standartlarıyla üretilir.",
            col3Title: "Zamansız Tasarım Anlayışı",
            col3Content:
              "Hızlı tüketim yerine, gardırobunuzda yıllarca yerini koruyacak kalıcı silüetler tasarlıyoruz.",
          },
        },
      ],
    },
  };

  const existingHakkimizda = await payload.find({
    collection: "pages",
    where: { slug: { equals: "hakkimizda" } },
    limit: 1,
  });

  if (existingHakkimizda.docs.length > 0) {
    console.log("  - Page 'hakkimizda' already exists.");
  } else {
    await payload.create({
      collection: "pages",
      data: hakkimizdaData,
    });
    console.log("  + Page 'hakkimizda' created and published.");
  }

  // Page 2: İletişim (Published)
  const iletisimData = {
    title: "İletişim",
    slug: "iletisim",
    _status: "published" as const,
    puckData: {
      root: { props: { title: "İletişim" } },
      content: [
        {
          type: "Hero",
          props: {
            title: "Bizimle İletişime Geçin",
            subtitle:
              "Siparişleriniz, stil danışmanlığı veya sorularınız için her zaman buradayız.",
            bgColor: "gray",
            align: "center",
          },
        },
        {
          type: "ContactInfo",
          props: {
            title: "Müşteri Hizmetleri & Atölye",
            email: "iletisim@example.test",
            phone: "0850 000 00 00",
            address: "Nişantaşı Mah. Abdi İpekçi Cad. No: 42/3 Şişli / İstanbul",
            workingHours: "Hafta içi: 09:00 - 18:00 (Hafta sonu kapalı)",
          },
        },
        {
          type: "RichText",
          props: {
            content:
              "Sorularınız ve özel talepleriniz için bize yukarıdaki iletişim kanallarından ulaşabilirsiniz. Müşteri temsilcilerimiz en geç 24 saat içinde dönüş yapacaktır.",
            maxWidth: "prose",
          },
        },
      ],
    },
  };

  const existingIletisim = await payload.find({
    collection: "pages",
    where: { slug: { equals: "iletisim" } },
    limit: 1,
  });

  if (existingIletisim.docs.length > 0) {
    console.log("  - Page 'iletisim' already exists.");
  } else {
    await payload.create({
      collection: "pages",
      data: iletisimData,
    });
    console.log("  + Page 'iletisim' created and published.");
  }

  // Legal Draft Page 1: Mesafeli Satış Sözleşmesi (Strictly Draft!)
  const existingMss = await payload.find({
    collection: "pages",
    where: { slug: { equals: "mesafeli-satis-sozlesmesi" } },
    limit: 1,
  });

  if (existingMss.docs.length > 0) {
    console.log("  - Draft Page 'mesafeli-satis-sozlesmesi' already exists.");
  } else {
    await payload.create({
      collection: "pages",
      data: {
        title: "Mesafeli Satış Sözleşmesi",
        slug: "mesafeli-satis-sozlesmesi",
        _status: "draft" as const,
        puckData: {
          root: { props: { title: "Mesafeli Satış Sözleşmesi" } },
          content: [
            {
              type: "RichText",
              props: {
                content:
                  "Yer tutucu — bu hukuki metin mağaza sahibi tarafından eklenecektir.\n\nDikkat: Bu sayfa şu anda taslak modundadır.",
                maxWidth: "prose-lg",
              },
            },
          ],
        },
      },
    });
    console.log("  + Legal Page 'mesafeli-satis-sozlesmesi' created as DRAFT.");
  }

  // Legal Draft Page 2: KVKK (Strictly Draft!)
  const existingKvkk = await payload.find({
    collection: "pages",
    where: { slug: { equals: "kvkk" } },
    limit: 1,
  });

  if (existingKvkk.docs.length > 0) {
    console.log("  - Draft Page 'kvkk' already exists.");
  } else {
    await payload.create({
      collection: "pages",
      data: {
        title: "KVKK Aydınlatma Metni",
        slug: "kvkk",
        _status: "draft" as const,
        puckData: {
          root: { props: { title: "KVKK Aydınlatma Metni" } },
          content: [
            {
              type: "RichText",
              props: {
                content:
                  "Yer tutucu — bu hukuki metin mağaza sahibi tarafından eklenecektir.\n\nDikkat: Bu sayfa şu anda taslak modundadır.",
                maxWidth: "prose-lg",
              },
            },
          ],
        },
      },
    });
    console.log("  + Legal Page 'kvkk' created as DRAFT.");
  }

  // 6. Sample Safe Redirect (Idempotent)
  console.log("🔀 Seeding Sample Redirect...");
  const existingRedirect = await payload.find({
    collection: "redirects",
    where: { from: { equals: "/eski-blog" } },
    limit: 1,
  });

  if (existingRedirect.docs.length > 0) {
    console.log("  - Redirect '/eski-blog' -> '/blog' already exists.");
  } else {
    await payload.create({
      collection: "redirects",
      data: {
        from: "/eski-blog",
        to: "/blog",
        type: "301",
      },
    });
    console.log("  + Redirect '/eski-blog' -> '/blog' created.");
  }

  console.log("✅ Payload CMS Content Seed Completed Successfully!");
  process.exit(0);
}

seedContent().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
