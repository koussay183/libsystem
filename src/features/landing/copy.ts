/**
 * The landing page's words, kept out of the app's dictionaries on purpose:
 * they change with marketing, not with the product, and the till never needs
 * them in its bundle.
 */

export type Mark = 'yes' | 'part' | 'no'

export const CONTACT = {
  /** WhatsApp number without +216, e.g. '20123456'. Empty = CTAs scroll to the prices. */
  whatsapp: '98158160',
}

const fr = {
  nav: { why: 'Avantages', pricing: 'Tarifs', login: 'Se connecter' },
  hero: {
    kicker: 'La caisse des librairies tunisiennes',
    title1: 'Vendez plus vite.',
    title2: 'Gérez sans cahier.',
    sub: 'Caisse au scanner, stock, packs scolaires et carnet clients. Un seul écran, même quand internet coupe.',
    cta: 'Essayer — 1er mois offert',
    cta2: 'Voir les tarifs',
    chips: ['Hors ligne', 'Français · العربية', 'Millimes exacts', 'Ticket 80 mm + A4'],
  },
  mock: {
    title: 'Caisse',
    lines: [
      ['Cahier 96 pages', '×3', '3,600'],
      ['Stylo bleu', '×5', '2,250'],
      ['Pack 1ère année', '×1', '64,500'],
    ],
    total: 'Total',
    totalValue: '70,350 DT',
    pay: 'Encaisser',
    scanned: 'Scanné',
    low: 'Stock bas · Cahier 96p',
    lowValue: '4 restants',
    debt: 'Carnet · Ahmed',
    debtValue: '35,000 DT',
  },
  facts: [
    ['100 %', 'utilisable hors ligne'],
    ['0,001', 'DT : au millime près'],
    ['2', 'langues : FR et عربي'],
    ['1 mois', 'offert pour commencer'],
  ] as [string, string][],
  trust: 'Déjà en service dans des librairies en Tunisie',
  wa: { label: 'WhatsApp', plan: 'Bonjour, je suis intéressé par la formule {{plan}} de Mektebti.' },
  why: {
    title: 'Pourquoi Mektebti ?',
    cols: ['Mektebti', 'Caisse classique', 'Cahier & Excel'],
    rows: [
      ['Pensé pour les librairies : packs, rentrée', ['yes', 'no', 'no']],
      ['Marche hors ligne et sauvegardé en ligne', ['yes', 'part', 'no']],
      ['Carnet de crédit clients intégré', ['yes', 'part', 'part']],
      ['Plusieurs postes, mêmes chiffres en direct', ['yes', 'no', 'no']],
      ['En français et en arabe', ['yes', 'part', 'part']],
      ['Rentabilité article par article', ['yes', 'part', 'no']],
      ['Mises à jour incluses', ['yes', 'part', 'no']],
    ] as [string, Mark[]][],
  },
  features: {
    title: 'Tout ce que fait la librairie. Rien de plus.',
    items: [
      ['scan', 'Caisse au scanner', 'Bip, c’est vendu. Ticket imprimé.'],
      ['pack', 'Packs scolaires', 'La liste de la rentrée en un scan.'],
      ['carnet', 'Carnet clients', 'Qui doit quoi, depuis quand.'],
      ['stock', 'Stock vivant', 'Alerte avant la rupture.'],
      ['supplier', 'Achats & fournisseurs', 'Factures, dettes, historique.'],
      ['profit', 'Rentabilité', 'Ce qui rapporte vraiment.'],
    ] as [string, string, string][],
  },
  steps: {
    title: 'Prêt en 3 étapes',
    items: ['On installe chez vous', 'On charge votre stock', 'Vous vendez'],
  },
  pricing: {
    title: 'Des prix clairs, en dinars',
    plans: [
      {
        id: 'month',
        name: 'Mensuel',
        price: '83',
        unit: 'DT / mois',
        badge: '1er mois offert',
        perks: ['Toutes les fonctions', 'Mises à jour incluses'],
        note: '+ 500 DT de mise en service',
      },
      {
        id: 'year',
        name: 'Annuel',
        price: '2 000',
        unit: 'DT / an',
        badge: '',
        perks: ['Toutes les fonctions', 'Mises à jour incluses', 'Mise en service incluse'],
        note: '',
      },
      {
        id: 'life',
        name: 'À vie',
        price: '3 400',
        unit: 'DT, une seule fois',
        badge: 'Le plus rentable',
        perks: ['Toutes les fonctions', 'Mises à jour incluses', 'Mise en service incluse', 'Accès à vie'],
        note: '',
      },
    ],
    choose: 'Choisir',
  },
  final: { title: 'Prêt pour la rentrée ?', cta: 'Démarrer maintenant' },
  footer: '© 2026 Mektebti.tn · Fait en Tunisie',
  waText: 'Bonjour, je veux essayer Mektebti pour ma librairie.',
}

export type LandingCopy = typeof fr

const ar: LandingCopy = {
  nav: { why: 'المزايا', pricing: 'الأسعار', login: 'تسجيل الدخول' },
  hero: {
    kicker: 'نظام الكاسة للمكتبات التونسية',
    title1: 'بيع أسرع.',
    title2: 'تصرّف بلا كرّاس.',
    sub: 'كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي. شاشة وحدة، حتى كي يقصّ الإنترنت.',
    cta: 'جرّب — الشهر الأول مجاني',
    cta2: 'شوف الأسعار',
    chips: ['يخدم بلا إنترنت', 'العربية · Français', 'بالمليم', 'تيكيت 80 مم + A4'],
  },
  mock: {
    title: 'الكاسة',
    lines: [
      ['كرّاس 96 صفحة', '×3', '3,600'],
      ['ستيلو أزرق', '×5', '2,250'],
      ['باك السنة الأولى', '×1', '64,500'],
    ],
    total: 'المجموع',
    totalValue: '70,350 د',
    pay: 'خلّص',
    scanned: 'تسكانا',
    low: 'مخزون ناقص · كرّاس 96',
    lowValue: '4 باقين',
    debt: 'الكرّاس · أحمد',
    debtValue: '35,000 د',
  },
  facts: [
    ['100 %', 'يخدم بلا إنترنت'],
    ['0,001', 'د : بالمليم'],
    ['2', 'لغات : عربي و FR'],
    ['شهر', 'مجاني للبداية'],
  ],
  trust: 'يخدم توّا في مكتبات في تونس',
  wa: { label: 'واتساب', plan: 'السلام، يهمّني العرض {{plan}} متاع مكتبتي.' },
  why: {
    title: 'علاش مكتبتي؟',
    cols: ['مكتبتي', 'كاسة عادية', 'كرّاس و Excel'],
    rows: [
      ['مصنوع للمكتبات: باكات، العودة المدرسية', ['yes', 'no', 'no']],
      ['يخدم بلا إنترنت ومحفوظ أونلاين', ['yes', 'part', 'no']],
      ['كرّاس الكريدي للحرفاء مدمج', ['yes', 'part', 'part']],
      ['أكثر من حاسوب، نفس الأرقام مباشرة', ['yes', 'no', 'no']],
      ['بالعربية والفرنسية', ['yes', 'part', 'part']],
      ['الربح لكل سلعة', ['yes', 'part', 'no']],
      ['التحديثات مشمولة', ['yes', 'part', 'no']],
    ],
  },
  features: {
    title: 'كل ما تعملو المكتبة. لا أكثر.',
    items: [
      ['scan', 'كاسة بالسكانر', 'بيب، تباعت. والتيكيت يطبع.'],
      ['pack', 'باكات مدرسية', 'قائمة العودة المدرسية في سكان واحد.'],
      ['carnet', 'كرّاس الحرفاء', 'شكون يتسال، قدّاش، ومن وقتاش.'],
      ['stock', 'مخزون حي', 'تنبيه قبل ما تفرغ السلعة.'],
      ['supplier', 'الشراءات والمزودين', 'فواتير، ديون، وتاريخ كامل.'],
      ['profit', 'الربح', 'شنوّة اللي يربّح بالحق.'],
    ],
  },
  steps: {
    title: 'جاهز في 3 خطوات',
    items: ['نركّبو عندك', 'نحطّو المخزون متاعك', 'تبدا تبيع'],
  },
  pricing: {
    title: 'أسعار واضحة بالدينار',
    plans: [
      {
        id: 'month',
        name: 'شهري',
        price: '83',
        unit: 'د / الشهر',
        badge: 'الشهر الأول مجاني',
        perks: ['كل الخدمات', 'التحديثات مشمولة'],
        note: '+ 500 د للتركيب',
      },
      {
        id: 'year',
        name: 'سنوي',
        price: '2 000',
        unit: 'د / السنة',
        badge: '',
        perks: ['كل الخدمات', 'التحديثات مشمولة', 'التركيب مشمول'],
        note: '',
      },
      {
        id: 'life',
        name: 'مدى الحياة',
        price: '3 400',
        unit: 'د، مرة وحدة',
        badge: 'الأربح',
        perks: ['كل الخدمات', 'التحديثات مشمولة', 'التركيب مشمول', 'نفاذ مدى الحياة'],
        note: '',
      },
    ],
    choose: 'اختار',
  },
  final: { title: 'جاهز للعودة المدرسية؟', cta: 'ابدا توّا' },
  footer: '© 2026 Mektebti.tn · صنع في تونس',
  waText: 'السلام، نحب نجرّب مكتبتي للمكتبة متاعي.',
}

export const LANDING_COPY = { fr, ar }
