/**
 * The landing page's words, kept out of the app's dictionaries on purpose:
 * they change with marketing, not with the product, and the till never needs
 * them in its bundle. Both languages live here and `ar` is typed against `fr`,
 * so a key added to one and forgotten in the other does not compile.
 *
 * Every claim below has to be true today. When in doubt, say less: a prospect
 * who catches one overstatement stops believing the rest.
 */

export type Mark = 'yes' | 'part' | 'no'
export type Lang = 'fr' | 'ar'

export const CONTACT = {
  /** WhatsApp number without +216, e.g. '20123456'. */
  whatsapp: '98158160',
}

/**
 * The founder's prices, in dinars. The visible strings and the JSON-LD offers
 * are both built from these, so the page and what search engines read cannot
 * disagree.
 */
export const PRICES = { month: 83, setup: 500, year: 2000, life: 3400 } as const

/** 2000 → "2 000" (narrow no-break space, the French grouping). */
function dt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export type PlanId = 'month' | 'year' | 'life'

const fr = {
  seo: {
    title: 'Logiciel de caisse pour librairie en Tunisie | Mektebti.tn',
    description:
      'Caisse au scanner, stock, packs scolaires et carnet de crédit pour librairies-papeteries en Tunisie. Installé chez vous, en français et en arabe.',
    ogTitle: 'Mektebti.tn, la caisse des librairies tunisiennes',
    ogDescription:
      'Caisse au scanner, packs scolaires, carnet de crédit et stock, au millime près. On installe, on charge votre stock, vous vendez.',
    ogImageAlt: 'Mektebti.tn : la caisse des librairies tunisiennes',
  },
  skip: 'Aller au contenu',
  nav: {
    features: 'Fonctions',
    pricing: 'Tarifs',
    faq: 'Questions',
    login: 'Se connecter',
    /** The OTHER language, written in that language. */
    otherLang: 'عربي',
  },
  hero: {
    kicker: 'La caisse des librairies tunisiennes',
    title1: 'Vendez plus vite.',
    title2: 'Gérez sans cahier.',
    sub: 'Caisse au scanner, stock, packs scolaires et carnet clients. Un seul écran, même quand internet coupe.',
    cta: 'Demander une démo',
    cta2: 'Voir les tarifs',
  },
  mock: {
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
    ['Hors ligne', 'la caisse continue quand internet coupe'],
    ['Matériel inclus', 'douchette + imprimante ticket'],
    ['FR · عربي', 'deux langues, un seul écran'],
    ['1 mois', 'd’abonnement offert'],
  ] as [string, string][],
  trust: 'Déjà en service dans des librairies en Tunisie',
  wa: {
    label: 'WhatsApp',
    text: 'Bonjour, je voudrais une démo de Mektebti pour ma librairie. Ville : ',
    plan: 'Bonjour, la formule {{plan}} de Mektebti m’intéresse. Ville : ',
    /** Appended when the visit came from a campaign: lets the founder see which one. */
    ref: 'réf.',
  },
  why: {
    title: 'Pourquoi Mektebti ?',
    featureCol: 'Fonction',
    cols: ['Mektebti', 'Caisse classique', 'Cahier & Excel'],
    marks: { yes: 'Oui', part: 'En partie', no: 'Non' } as Record<Mark, string>,
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
    title: 'Tout ce que fait une librairie, dans une seule caisse.',
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
        id: 'month' as PlanId,
        name: 'Mensuel',
        price: dt(PRICES.month),
        unit: 'DT / mois',
        badge: '1er mois offert',
        perks: ['Toutes les fonctions', 'Mises à jour incluses'],
        note: `+ ${dt(PRICES.setup)} DT de mise en service : douchette + imprimante ticket, installées`,
      },
      {
        id: 'year' as PlanId,
        name: 'Annuel',
        price: dt(PRICES.year),
        unit: 'DT / an',
        badge: '',
        perks: [
          'Toutes les fonctions',
          'Mises à jour incluses',
          'Mise en service incluse : douchette + imprimante ticket',
        ],
        note: '',
      },
      {
        id: 'life' as PlanId,
        name: 'À vie',
        price: dt(PRICES.life),
        unit: 'DT, une seule fois',
        // Was « Le plus rentable », which is only true after about three years
        // against the monthly plan. This one is simply what the plan is.
        badge: 'Payez une seule fois',
        perks: [
          'Toutes les fonctions',
          'Mises à jour incluses',
          'Mise en service incluse : douchette + imprimante ticket',
          'Accès à vie',
        ],
        note: '',
      },
    ],
    choose: 'Choisir',
    /** Accessible name of each plan button, so three « Choisir » can be told apart. */
    chooseLabel: 'Choisir la formule {{plan}}',
    terms: 'Le détail de chaque formule est dans les',
    termsLink: 'conditions générales',
  },
  faq: {
    title: 'Questions fréquentes',
    items: [
      [
        'Et si internet coupe ?',
        'La caisse continue de vendre. Les ventes restent sur le poste et partent toutes seules au retour de la ligne. Seules l’installation et la première connexion demandent internet.',
      ],
      [
        'Je peux garder ma douchette et mon imprimante ?',
        'Oui, si elles sont compatibles : une douchette USB et une imprimante ticket 80 mm (ou A4) suffisent. On les teste avec vous avant l’installation.',
      ],
      [
        'Comment payer ?',
        'En dinars : espèces, chèque ou virement. Le mensuel se règle chaque mois, l’annuel une fois par an, la formule à vie une seule fois.',
      ],
      [
        'Mes données sont-elles en sécurité ?',
        'Elles sont hébergées sur Google Cloud à Paris, avec une connexion chiffrée. Chaque librairie a son propre espace, séparé des autres. Vous pouvez tout exporter à tout moment : sauvegarde complète et fichiers pour Excel.',
      ],
      [
        'Y a-t-il un contrat ?',
        'Oui, un contrat simple : les conditions générales décrivent chaque formule. Si vous arrêtez, vos données restent à vous et vous les exportez avant de partir.',
      ],
      [
        'Il faut quel ordinateur ?',
        'Un PC avec Chrome ou Edge suffit. Plusieurs postes peuvent travailler ensemble et voient les mêmes chiffres.',
      ],
    ] as [string, string][],
  },
  final: {
    title: 'Prêt pour la rentrée ?',
    cta: 'Demander une démo sur WhatsApp',
    call: 'Appeler',
  },
  footer: {
    made: '© 2026 Mektebti.tn · Fait en Tunisie',
    nav: 'Informations légales',
    legal: 'Mentions légales',
    cgv: 'Conditions générales',
    privacy: 'Confidentialité',
    cookies: 'Gérer mes cookies',
  },
}

export type LandingCopy = typeof fr

const ar: LandingCopy = {
  seo: {
    title: 'كاسة وبرنامج تصرّف للمكتبات في تونس | مكتبتي Mektebti.tn',
    description:
      'كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي للمكتبات في تونس. نركّبوها عندك، بالعربي والفرنسي.',
    ogTitle: 'مكتبتي، الكاسة متاع المكتبات التونسية',
    ogDescription:
      'كاسة بالسكانر، باكات مدرسية، كرّاس الكريدي والمخزون، بالمليم. نركّبو، نحطّو السلعة، وانت تبيع.',
    ogImageAlt: 'مكتبتي Mektebti.tn: الكاسة متاع المكتبات التونسية',
  },
  skip: 'انتقل إلى المحتوى',
  nav: {
    features: 'الخدمات',
    pricing: 'الأسعار',
    faq: 'أسئلة',
    login: 'تسجيل الدخول',
    otherLang: 'Français',
  },
  hero: {
    kicker: 'نظام الكاسة للمكتبات التونسية',
    title1: 'بيع أسرع.',
    title2: 'تصرّف بلا كرّاس.',
    sub: 'كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي. شاشة وحدة، حتى كي يقصّ الإنترنت.',
    cta: 'اطلب ديمو',
    cta2: 'شوف الأسعار',
  },
  mock: {
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
    ['بلا إنترنت', 'الكاسة تكمّل كي يقصّ الإنترنت'],
    ['المعدّات مشمولة', 'سكانر + طابعة تيكيات'],
    ['عربي · FR', 'لغتين، شاشة وحدة'],
    ['شهر', 'اشتراك بلاش للبداية'],
  ],
  trust: 'يخدم توّا في مكتبات في تونس',
  wa: {
    label: 'واتساب',
    text: 'السلام، نحب ديمو متاع مكتبتي للمكتبة متاعي. المدينة: ',
    plan: 'السلام، يهمّني العرض {{plan}} متاع مكتبتي. المدينة: ',
    ref: 'réf.',
  },
  why: {
    title: 'علاش مكتبتي؟',
    featureCol: 'الميزة',
    cols: ['مكتبتي', 'كاسة عادية', 'كرّاس و Excel'],
    marks: { yes: 'إيه', part: 'جزئياً', no: 'لا' },
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
    title: 'كل ما تعملو المكتبة، في كاسة وحدة.',
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
        price: dt(PRICES.month),
        unit: 'د / الشهر',
        badge: 'الشهر الأول مجاني',
        perks: ['كل الخدمات', 'التحديثات مشمولة'],
        note: `+ ${dt(PRICES.setup)} د للتركيب: سكانر + طابعة تيكيات، مركّبين`,
      },
      {
        id: 'year',
        name: 'سنوي',
        price: dt(PRICES.year),
        unit: 'د / السنة',
        badge: '',
        perks: ['كل الخدمات', 'التحديثات مشمولة', 'التركيب مشمول: سكانر + طابعة تيكيات'],
        note: '',
      },
      {
        id: 'life',
        name: 'مدى الحياة',
        price: dt(PRICES.life),
        unit: 'د، مرة وحدة',
        badge: 'تخلّص مرّة وحدة',
        perks: [
          'كل الخدمات',
          'التحديثات مشمولة',
          'التركيب مشمول: سكانر + طابعة تيكيات',
          'نفاذ مدى الحياة',
        ],
        note: '',
      },
    ],
    choose: 'اختار',
    chooseLabel: 'اختار العرض {{plan}}',
    terms: 'تفاصيل كل عرض موجودة في',
    termsLink: 'الشروط العامة',
  },
  faq: {
    title: 'أسئلة متكرّرة',
    items: [
      [
        'وكان يقصّ الإنترنت؟',
        'الكاسة تكمّل تبيع. البيع يتسجّل في الحاسوب ويتبعث وحدو كي ترجع الكونكسيون. كان التركيب وأوّل دخول يلزمهم إنترنت.',
      ],
      [
        'نجم نخدم بالسكانر والطابعة متاعي؟',
        'إيه، كان متوافقين: سكانر USB وطابعة تيكيات 80 مم (ولا A4) يكفيو. نجرّبوهم معاك قبل التركيب.',
      ],
      [
        'كيفاش نخلّص؟',
        'بالدينار: كاش، شيك ولا فيرمو. الشهري كل شهر، السنوي مرّة في العام، ومدى الحياة مرّة وحدة.',
      ],
      [
        'معطياتي في أمان؟',
        'مخزّنة على Google Cloud في باريس والاتصال مشفّر. كل مكتبة عندها فضاءها، مفصول على الآخرين. وتنجم تصدّر كل شي وقت ما تحب: نسخة احتياطية كاملة وملفات لـ Excel.',
      ],
      [
        'فما عقد؟',
        'إيه، عقد بسيط: الشروط العامة تفسّر كل عرض. وكان تحبس، المعطيات متاعك تبقى ليك وتصدّرهم قبل ما تمشي.',
      ],
      [
        'شنوّة الحاسوب اللي يلزم؟',
        'PC بـ Chrome ولا Edge يكفي. وتنجم تخدم بأكثر من حاسوب، وكلهم يشوفو نفس الأرقام.',
      ],
    ],
  },
  final: {
    title: 'جاهز للعودة المدرسية؟',
    cta: 'اطلب ديمو على الواتساب',
    call: 'كلّمنا',
  },
  footer: {
    made: '© 2026 Mektebti.tn · صنع في تونس',
    nav: 'معلومات قانونية',
    legal: 'البيانات القانونية',
    cgv: 'الشروط العامة',
    privacy: 'الخصوصية',
    cookies: 'إعدادات الكوكيز',
  },
}

export const LANDING_COPY: Record<Lang, LandingCopy> = { fr, ar }

/** The public URL of each language's landing page. */
export const LANDING_PATH: Record<Lang, string> = { fr: '/decouvrir', ar: '/ar/decouvrir' }
