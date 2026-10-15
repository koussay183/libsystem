// Every word that appears on the ad images, FR + Tunisian Arabic (derja).
// Kept apart from the layout so marketing can re-word and re-render without
// touching the design. Headline lines are explicit (one array item = one line)
// so a translation can never reflow into an ugly break.

export const PHONE = '+216 98 158 160'

export const COMMON = {
  fr: {
    tag: 'Librairies · Papeteries',
    waLabel: 'Écrivez-nous sur WhatsApp',
    offer: '1er mois offert',
  },
  ar: {
    tag: 'للمكتبات',
    waLabel: 'ابعثلنا على واتساب',
    offer: 'الشهر الأول مجاني',
  },
}

export const CONCEPTS = [
  {
    id: '01-bip-scanner',
    theme: 'blue',
    fr: {
      kicker: 'Caisse au scanner',
      h1: ['<em>Bip,</em>', 'c’est vendu.'],
      sub: 'Scannez, encaissez : le ticket sort tout seul.',
      shop: 'VOTRE LIBRAIRIE',
      ticketNo: 'Ticket n° 0142 · 15/10',
      lines: [['Cahier 96 p', '×3', '3,600'], ['Stylo bleu', '×5', '2,250'], ['Gomme', '×2', '1,000']],
      total: ['TOTAL', '6,850 DT'],
      thanks: 'Merci, à bientôt !',
      bip: 'BIP !',
    },
    ar: {
      kicker: 'كاسة بالسكانر',
      h1: ['<em>بيب،</em>', 'تباعت!'],
      sub: 'سكاني، خلّص، والتيكيت يطلع وحدو.',
      shop: 'مكتبتك',
      ticketNo: 'تيكيت عدد 0142 · 15/10',
      lines: [['كرّاس 96 صفحة', '×3', '3,600'], ['ستيلو أزرق', '×5', '2,250'], ['قومة', '×2', '1,000']],
      total: ['المجموع', '6,850 د'],
      thanks: 'يعيشك، نستناوك!',
      bip: 'بيب!',
    },
  },
  {
    id: '02-fini-cahier-credit',
    theme: 'light',
    fr: {
      kicker: 'Carnet clients',
      h1: ['<em>Fini</em> le cahier', 'de crédit.'],
      sub: 'Qui doit quoi, depuis quand : tout est dans la caisse.',
      scribbles: ['Ahmed 35,000', 'Salma 12,5..', 'Karim ?? 8,25', 'Sami 4,700'],
      cardTitle: 'Carnet clients',
      dueLabel: 'À encaisser',
      due: '55,750 DT',
      rows: [['AB', 'Ahmed B.', 'depuis 12 j', '35,000', 0], ['SK', 'Salma K.', 'depuis 3 j', '12,500', 0], ['KM', 'Karim M.', 'depuis 27 j', '8,250', 1]],
    },
    ar: {
      kicker: 'كرّاس الحرفاء',
      h1: ['<em>ما عادش</em>', 'كرّاس الكريدي.'],
      sub: 'شكون يتسال، قدّاش، ومن وقتاش: الكل في الكاسة.',
      scribbles: ['أحمد 35,000', 'سلمى 12,5..', 'كريم ؟؟ 8,25', 'سامي 4,700'],
      cardTitle: 'كرّاس الحرفاء',
      dueLabel: 'الباقي للخلاص',
      due: '55,750 د',
      rows: [['أ', 'أحمد ب.', 'من 12 يوم', '35,000', 0], ['س', 'سلمى ك.', 'من 3 أيام', '12,500', 0], ['ك', 'كريم م.', 'من 27 يوم', '8,250', 1]],
    },
  },
  {
    id: '03-pret-rentree',
    theme: 'blue',
    fr: {
      kicker: 'Packs scolaires',
      h1: ['Prêt pour', 'la <em>rentrée</em> ?'],
      sub: 'Toute la liste scolaire en un seul scan.',
      pack: 'Pack 1ère année',
      scan: '1 scan',
      items: [['Cahier 96 p', '×6'], ['Stylo bleu', '×4'], ['Crayons de couleur', '×1'], ['Ardoise + craie', '×1'], ['Protège-cahiers', '×6']],
      total: ['Total', '64,500 DT'],
    },
    ar: {
      kicker: 'الباكات المدرسية',
      h1: ['<em>جاهز</em>', 'للرونتري؟'],
      sub: 'قائمة الأدوات الكاملة في سكان واحد.',
      pack: 'باك السنة الأولى',
      scan: 'سكان واحد',
      items: [['كرّاس 96 صفحة', '×6'], ['ستيلو أزرق', '×4'], ['أقلام ملوّنة', '×1'], ['لوحة + طباشير', '×1'], ['غلافات كراريس', '×6']],
      total: ['المجموع', '64,500 د'],
    },
  },
  {
    id: '04-sans-internet',
    theme: 'ink',
    fr: {
      kicker: 'Marche sans internet',
      h1: ['<em>Internet coupé ?</em>', 'La caisse continue.'],
      sub: 'Tout se synchronise au retour du réseau.',
      offline: 'Hors ligne',
      till: 'Caisse',
      lines: [['Cahier 96 p', '×3', '3,600'], ['Stylo bleu', '×5', '2,250']],
      total: ['Total', '5,850 DT'],
      saved: 'Vente enregistrée',
    },
    ar: {
      kicker: 'يخدم بلا إنترنت',
      h1: ['<em>الإنترنت قصّ؟</em>', 'الكاسة تكمّل تخدم.'],
      sub: 'وكل شي يتحفظ أونلاين كي يرجع الإنترنت.',
      offline: 'بلا إنترنت',
      till: 'الكاسة',
      lines: [['كرّاس 96 صفحة', '×3', '3,600'], ['ستيلو أزرق', '×5', '2,250']],
      total: ['المجموع', '5,850 د'],
      saved: 'البيعة تسجّلت',
    },
  },
  {
    id: '05-prix-83dt',
    theme: 'amber',
    fr: {
      kicker: 'Prix clair, en dinars',
      price: '83',
      cur: 'DT',
      per: '/ mois',
      badge: '1er mois offert',
      perks: ['Caisse au scanner', 'Stock en direct', 'Packs scolaires', 'Carnet clients', 'Rentabilité', 'Mises à jour incluses'],
      fine: '+ 500 DT de mise en service (scanner + imprimante ticket)',
    },
    ar: {
      kicker: 'أسعار واضحة بالدينار',
      price: '83',
      cur: 'د',
      per: '/ الشهر',
      badge: 'الشهر الأول مجاني',
      perks: ['كاسة بالسكانر', 'مخزون مباشر', 'باكات مدرسية', 'كرّاس الحرفاء', 'الربح لكل سلعة', 'التحديثات مشمولة'],
      fine: '+ 500 د للتركيب (سكانر + طابعة تيكيت)',
    },
  },
  {
    id: '06-stock-2-postes',
    theme: 'blue',
    fr: {
      kicker: 'Stock en direct sur 2 postes',
      h1: ['2 postes,', '<em>1 seul stock.</em>'],
      sub: 'Caisse et bureau : les mêmes chiffres, en direct.',
      a: 'Caisse',
      b: 'Bureau',
      live: 'En direct',
      screen: 'Stock',
      rows: [['Cahier 96 p', '41', 1], ['Stylo bleu', '128', 0], ['Pack 1ère année', '17', 0], ['Ardoise', '9', 0]],
    },
    ar: {
      kicker: 'المخزون مباشر على زوز حواسيب',
      h1: ['زوز حواسيب،', '<em>مخزون واحد.</em>'],
      sub: 'الكاسة والبيرو: نفس الأرقام، مباشرة.',
      a: 'الكاسة',
      b: 'البيرو',
      live: 'مباشر',
      screen: 'المخزون',
      rows: [['كرّاس 96 صفحة', '41', 1], ['ستيلو أزرق', '128', 0], ['باك السنة الأولى', '17', 0], ['لوحة', '9', 0]],
    },
  },
]

// Google Display: the strongest concept (01) adapted for small, low-attention
// placements: one promise, one offer, one button.
export const DISPLAY = {
  fr: { kicker: 'La caisse des librairies', button: 'Essayer : 1er mois offert', short: '1er mois offert' },
  ar: { kicker: 'كاسة المكتبات في تونس', button: 'جرّب: الشهر الأول مجاني', short: 'الشهر الأول مجاني' },
}
