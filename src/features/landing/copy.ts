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
 * Prices in dinars (grid from docs/launch/03-business-plan.md §3.2). The
 * visible strings, the JSON-LD offers and the CGV are all built from these,
 * so the page, search engines and the contract cannot disagree.
 *
 * Annual = 10 × monthly (two months free), so it beats monthly at every
 * horizon; lifetime is a capped launch offer with the kit included.
 */
export const PRICES = {
  month: 83,
  year: 830,
  life: 3400,
  /** Mise en service with the standard kit (wireless scanner + 80 mm printer). */
  setup: 500,
  /** Mise en service when the shop keeps its own hardware. */
  setupNoKit: 250,
  extraTill: 20,
  maintenance: 290,
} as const

/** Launch offer: half-price mise en service with the annual plan. */
export const PROMO_UNTIL = { fr: '20 décembre 2026', ar: '20 ديسمبر 2026' }

/** 2000 → "2 000" (the French grouping). */
function dt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export type PlanId = 'month' | 'year' | 'life'

interface Plan {
  id: PlanId
  name: string
  price: string
  unit: string
  /** One line under the price. */
  sub: string
  badge: string
  highlight: boolean
  perks: string[]
  /** Read by seo.ts as the offer description. */
  note: string
}

interface Showcase {
  /** Screenshot file stem in public/landing (…-fr / …-ar). */
  img: string
  eyebrow: string
  title: string
  body: string
  bullets: string[]
  alt: string
}

const fr = {
  seo: {
    title: 'Logiciel de caisse pour librairie en Tunisie | Mektebti.tn',
    description:
      'Caisse au scanner, stock, packs scolaires et carnet de crédit pour librairies-papeteries en Tunisie. Installé chez vous, en français et en arabe. Dès 83 DT par mois.',
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
    demo: 'Demander une démo',
    /** The OTHER language, written in that language. */
    otherLang: 'عربي',
  },
  promo: {
    text: `Offre de lancement jusqu’au ${PROMO_UNTIL.fr} : mise en service à moitié prix avec l’abonnement annuel.`,
    link: 'Voir les tarifs',
  },
  hero: {
    kicker: 'Caisse · Stock · Packs scolaires · Carnet de crédit',
    title: 'Le logiciel de caisse',
    titleAccent: 'des librairies tunisiennes.',
    sub: 'Vente au scanner, stock, packs scolaires, carnet de crédit et chiffres du jour. Installé chez vous, en français et en arabe, et la caisse continue de vendre quand internet coupe.',
    cta: 'Demander une démo',
    cta2: 'Voir les tarifs',
    points: ['Installation et formation sur place', 'Fonctionne sans internet', 'Support sur WhatsApp'],
    shotAlt: 'La caisse Mektebti : ticket en cours, total et bouton Encaisser',
  },
  facts: [
    ['Au millime près', 'totaux, rendu et carnet exacts'],
    ['Hors ligne', 'la vente continue quand la ligne coupe'],
    ['Français · عربي', 'chaque écran dans les deux langues'],
    ['Plusieurs postes', 'les mêmes chiffres partout, en direct'],
  ] as [string, string][],
  trust: 'Déjà en service dans des librairies en Tunisie',
  wa: {
    label: 'WhatsApp',
    text: 'Bonjour, je voudrais une démo de Mektebti pour ma librairie. Ville : ',
    plan: 'Bonjour, la formule {{plan}} de Mektebti m’intéresse. Ville : ',
    /** Appended when the visit came from a campaign: lets the founder see which one. */
    ref: 'réf.',
  },
  showcase: {
    title: 'Pensé pour le comptoir d’une librairie',
    sub: 'Les écrans ci-dessous sont ceux du logiciel, tels que vos caissiers les verront.',
    items: [
      {
        img: 'packs',
        eyebrow: 'Packs scolaires',
        title: 'La rentrée, vendue en un scan.',
        body: 'Composez une fois la liste de chaque niveau : le pack passe à la caisse en un scan, et le stock de chaque article est déduit tout seul.',
        bullets: ['Un pack par niveau ou par école', 'Prix du pack et économie affichés', 'Stock de chaque article mis à jour'],
        alt: 'Liste des packs scolaires avec leur contenu et leur prix',
      },
      {
        img: 'stock',
        eyebrow: 'Stock',
        title: 'Votre stock à jour, article par article.',
        body: 'Chaque vente et chaque achat mettent le stock à jour. Les articles qui s’épuisent sont signalés avant la rupture, et la valeur du stock est toujours sous vos yeux.',
        bullets: ['Familles, déclinaisons et codes-barres', 'Alertes de stock bas', 'Achats fournisseurs et ajustements'],
        alt: 'Liste du stock avec catégories, quantités et prix',
      },
      {
        img: 'client',
        eyebrow: 'Carnet de crédit',
        title: 'Le carnet de crédit, sans cahier.',
        body: 'Qui doit quoi, depuis quand. Les dettes anciennes ressortent d’elles-mêmes, et un rappel part sur WhatsApp en un clic.',
        bullets: ['Solde de chaque client', 'Rappels WhatsApp', 'Carnet imprimable'],
        alt: 'Fiche client avec solde dû, historique et bouton de rappel WhatsApp',
      },
      {
        img: 'dashboard',
        eyebrow: 'Chiffres',
        title: 'Ce qui rentre, ce qui sort, ce qui rapporte.',
        body: 'Ventes, achats, bénéfice estimé et panier moyen, par jour, semaine ou mois, et la rentabilité de chaque article.',
        bullets: ['Tableau de bord du jour', 'Rentabilité par article', 'Export pour Excel et sauvegarde'],
        alt: 'Tableau de bord : ventes, achats, bénéfice et graphique des entrées et sorties',
      },
    ] as Showcase[],
  },
  features: {
    title: 'Tout ce que fait une librairie, dans une seule caisse',
    items: [
      ['scan', 'Caisse au scanner', 'Bip, c’est vendu. Ticket ou facture imprimés.'],
      ['pack', 'Packs scolaires', 'La liste de la rentrée vendue en un scan.'],
      ['carnet', 'Carnet clients', 'Les dettes, les paiements et les rappels.'],
      ['stock', 'Stock vivant', 'Alerte avant la rupture.'],
      ['supplier', 'Achats et fournisseurs', 'Factures, dettes fournisseurs, historique.'],
      ['profit', 'Rentabilité', 'Ce que chaque article rapporte vraiment.'],
    ] as [string, string, string][],
  },
  why: {
    title: 'Pourquoi Mektebti ?',
    sub: 'Comparé à une caisse généraliste ou au cahier.',
    featureCol: 'Fonction',
    cols: ['Mektebti', 'Caisse classique', 'Cahier et Excel'],
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
  steps: {
    title: 'Opérationnel en trois étapes',
    items: [
      ['On installe chez vous', 'Logiciel, douchette et imprimante, réglés sur vos postes.'],
      ['On charge votre stock', 'Vos articles, prix et codes-barres, prêts à vendre.'],
      ['Vous vendez', 'Formation de l’équipe, puis support sur WhatsApp.'],
    ] as [string, string][],
  },
  offline: {
    eyebrow: 'Hors ligne',
    title: 'Internet coupe ? La caisse continue.',
    body: 'Chaque vente est enregistrée d’abord sur le poste, puis envoyée en ligne dès que la connexion revient. Aucune vente perdue, aucun client qui attend.',
    points: [
      ['Vente sans connexion', 'scan, ticket et rendu fonctionnent sans internet'],
      ['Synchronisation automatique', 'les postes se remettent d’accord tout seuls'],
      ['Sauvegarde en ligne', 'vos données à l’abri, exportables à tout moment'],
    ] as [string, string][],
  },
  faqAside: {
    title: 'Une autre question ?',
    body: 'Écrivez-nous sur WhatsApp : on répond en français ou en arabe, et on peut vous montrer le logiciel avec vos propres articles.',
    cta: 'Poser une question',
  },
  pricing: {
    title: 'Des tarifs simples, en dinars',
    sub: 'Toutes les fonctions dans chaque formule. Premier mois offert.',
    plans: [
      {
        id: 'month',
        name: 'Mensuel',
        price: dt(PRICES.month),
        unit: 'DT / mois',
        sub: 'Sans engagement, premier mois offert',
        badge: '',
        highlight: false,
        perks: ['Toutes les fonctions', 'Mises à jour incluses', 'Support sur WhatsApp', '1 poste de caisse'],
        note: `Mise en service ${dt(PRICES.setup)} DT avec matériel, ${dt(PRICES.setupNoKit)} DT sans`,
      },
      {
        id: 'year',
        name: 'Annuel',
        price: dt(PRICES.year),
        unit: 'DT / an',
        sub: `Soit ${(PRICES.year / 12).toFixed(1).replace('.', ',')} DT par mois, deux mois offerts`,
        badge: 'Recommandé',
        highlight: true,
        perks: [
          'Toutes les fonctions',
          'Mises à jour incluses',
          'Support prioritaire à la rentrée',
          `Mise en service à moitié prix jusqu’au ${PROMO_UNTIL.fr}`,
        ],
        note: `Mise en service ${dt(PRICES.setup)} DT avec matériel, ${dt(PRICES.setupNoKit)} DT sans`,
      },
      {
        id: 'life',
        name: 'À vie — Fondateurs',
        price: dt(PRICES.life),
        unit: 'DT, une seule fois',
        sub: 'Offre limitée à 20 licences',
        badge: '',
        highlight: false,
        perks: [
          'Toutes les fonctions, sans abonnement',
          'Kit matériel et mise en service inclus',
          'Support inclus pendant 24 mois',
          `Puis maintenance optionnelle ${dt(PRICES.maintenance)} DT / an`,
        ],
        note: 'Mise en service et matériel inclus',
      },
    ] as Plan[],
    setupTitle: 'Mise en service',
    extraTitle: 'Option',
    setup: [
      [`${dt(PRICES.setup)} DT`, 'avec le kit : douchette sans fil et imprimante ticket 80 mm à découpe, installées'],
      [`${dt(PRICES.setupNoKit)} DT`, 'sans matériel, si vous gardez le vôtre (testé avec vous avant)'],
      [`+${PRICES.extraTill} DT / mois`, 'par poste de caisse supplémentaire'],
    ] as [string, string][],
    taxNote: 'Prix en dinars tunisiens. Le paiement se fait par virement, chèque ou espèces, avec facture.',
    choose: 'Choisir cette formule',
    /** Accessible name of each plan button, so the three buttons can be told apart. */
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
        `Oui, si elles sont compatibles : une douchette USB et une imprimante ticket 80 mm (ou A4) suffisent. On les teste avec vous, et la mise en service passe alors à ${dt(PRICES.setupNoKit)} DT.`,
      ],
      [
        'Comment payer ?',
        'En dinars, par virement, chèque ou espèces, avec une facture. Le mensuel se règle chaque mois, l’annuel une fois par an, la formule à vie une seule fois.',
      ],
      [
        'Quelle formule choisir ?',
        `L’annuel revient moins cher que le mensuel dès la première année (deux mois offerts). La formule à vie est rentable si vous comptez garder le logiciel plus de quatre ans ; elle est limitée à 20 licences.`,
      ],
      [
        'Mes données sont-elles en sécurité ?',
        'Elles sont hébergées sur Google Cloud à Paris, avec une connexion chiffrée. Chaque librairie a son propre espace, séparé des autres. Vous pouvez tout exporter à tout moment : sauvegarde complète et fichiers pour Excel.',
      ],
      [
        'Il faut quel ordinateur ?',
        'Un PC avec Chrome ou Edge suffit, même ancien. Plusieurs postes peuvent travailler ensemble et voient les mêmes chiffres.',
      ],
    ] as [string, string][],
  },
  final: {
    title: 'Prêt pour la prochaine rentrée ?',
    sub: 'Une démonstration de 20 minutes, chez vous ou sur WhatsApp, avec vos propres articles.',
    cta: 'Demander une démo sur WhatsApp',
    call: 'Ou appelez le',
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
      'كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي للمكتبات في تونس. نركّبوها عندك، بالعربي والفرنسي. من 83 د في الشهر.',
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
    demo: 'اطلب ديمو',
    otherLang: 'Français',
  },
  promo: {
    text: `عرض الانطلاق حتى ${PROMO_UNTIL.ar}: التركيب بنصّ السوم مع الاشتراك السنوي.`,
    link: 'شوف الأسعار',
  },
  hero: {
    kicker: 'كاسة · مخزون · باكات مدرسية · كرّاس الكريدي',
    title: 'برنامج الكاسة',
    titleAccent: 'متاع المكتبات التونسية.',
    sub: 'بيع بالسكانر، مخزون، باكات مدرسية، كرّاس الكريدي وأرقام النهار. نركّبوه عندك، بالعربي والفرنسي، والكاسة تكمّل تبيع حتى كي يقصّ الإنترنت.',
    cta: 'اطلب ديمو',
    cta2: 'شوف الأسعار',
    points: ['تركيب وتكوين في المحل', 'يخدم بلا إنترنت', 'دعم على الواتساب'],
    shotAlt: 'كاسة مكتبتي: تيكيت مفتوح، المجموع وزرّ الخلاص',
  },
  facts: [
    ['بالمليم', 'المجموع، الصرف والكرّاس مضبوطين'],
    ['بلا إنترنت', 'البيع يكمّل كي تقصّ الكونكسيون'],
    ['عربي · Français', 'كل شاشة باللغتين'],
    ['أكثر من حاسوب', 'نفس الأرقام في كل بلاصة، مباشرة'],
  ],
  trust: 'يخدم توّا في مكتبات في تونس',
  wa: {
    label: 'واتساب',
    text: 'السلام، نحب ديمو متاع مكتبتي للمكتبة متاعي. المدينة: ',
    plan: 'السلام، يهمّني العرض {{plan}} متاع مكتبتي. المدينة: ',
    ref: 'réf.',
  },
  showcase: {
    title: 'مصنوع لكونتوار المكتبة',
    sub: 'الشاشات هاذي هي متاع البرنامج، كيف ما باش يشوفوها الكاسيرات متاعك.',
    items: [
      {
        img: 'packs',
        eyebrow: 'الباكات المدرسية',
        title: 'العودة المدرسية، تتباع في سكان واحد.',
        body: 'تعمل قائمة كل مستوى مرّة وحدة: الباك يتعدّى في الكاسة بسكان واحد، والمخزون متاع كل سلعة ينقص وحدو.',
        bullets: ['باك لكل مستوى ولا لكل مدرسة', 'سوم الباك والربح للحريف ظاهرين', 'المخزون متاع كل سلعة يتحيّن'],
        alt: 'قائمة الباكات المدرسية بالمحتوى والسوم',
      },
      {
        img: 'stock',
        eyebrow: 'المخزون',
        title: 'المخزون محيّن، سلعة بسلعة.',
        body: 'كل بيع وكل شراء يحيّنو المخزون. السلع اللي قاعدة تفرغ تتنبّه عليها قبل، وقيمة المخزون ديما قدّامك.',
        bullets: ['عائلات، أنواع وكودات', 'تنبيه كي يقلّ المخزون', 'شراءات المزودين والتعديلات'],
        alt: 'قائمة المخزون بالأصناف والكميات والأسوام',
      },
      {
        img: 'client',
        eyebrow: 'كرّاس الكريدي',
        title: 'كرّاس الكريدي، بلا كرّاس.',
        body: 'شكون يتسال، قدّاش، ومن وقتاش. الديون القديمة تطلع وحدها، والتذكير يمشي على الواتساب في كليك.',
        bullets: ['الرصيد متاع كل حريف', 'تذكير على الواتساب', 'كرّاس ينطبع'],
        alt: 'بطاقة حريف فيها الدين، التاريخ وزرّ التذكير على الواتساب',
      },
      {
        img: 'dashboard',
        eyebrow: 'الأرقام',
        title: 'شنوّة دخل، شنوّة خرج، وشنوّة ربّح.',
        body: 'المبيعات، الشراءات، الربح التقريبي ومعدّل السلّة، بالنهار، الجمعة ولا الشهر، والربح متاع كل سلعة.',
        bullets: ['لوحة أرقام النهار', 'الربح لكل سلعة', 'تصدير لـ Excel ونسخة احتياطية'],
        alt: 'لوحة الأرقام: المبيعات، الشراءات، الربح ورسم الدخول والخروج',
      },
    ],
  },
  features: {
    title: 'كل ما تعملو المكتبة، في كاسة وحدة',
    items: [
      ['scan', 'كاسة بالسكانر', 'بيب، تباعت. تيكيت ولا فاتورة تنطبع.'],
      ['pack', 'باكات مدرسية', 'قائمة العودة المدرسية تتباع في سكان واحد.'],
      ['carnet', 'كرّاس الحرفاء', 'الديون، الخلاص والتذكير.'],
      ['stock', 'مخزون حي', 'تنبيه قبل ما تفرغ السلعة.'],
      ['supplier', 'الشراءات والمزودين', 'فواتير، ديون المزودين، وتاريخ كامل.'],
      ['profit', 'الربح', 'قدّاش تربّح كل سلعة بالحق.'],
    ],
  },
  why: {
    title: 'علاش مكتبتي؟',
    sub: 'مقارنة بكاسة عامة ولا بالكرّاس.',
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
  steps: {
    title: 'جاهز في ثلاث خطوات',
    items: [
      ['نركّبو عندك', 'البرنامج، السكانر والطابعة، مظبوطين على الحواسب متاعك.'],
      ['نحطّو المخزون متاعك', 'السلع، الأسوام والكودات، جاهزين للبيع.'],
      ['تبدا تبيع', 'تكوين للفريق، ومن بعد دعم على الواتساب.'],
    ],
  },
  offline: {
    eyebrow: 'بلا إنترنت',
    title: 'قصّ الإنترنت؟ الكاسة تكمّل.',
    body: 'كل بيعة تتسجّل في الحاسوب الأول، ومن بعد تتبعث أونلاين كي ترجع الكونكسيون. حتى بيعة ما تضيع، وحتى حريف ما يستنّى.',
    points: [
      ['بيع بلا كونكسيون', 'السكان، التيكيت والصرف يخدمو بلا إنترنت'],
      ['مزامنة وحدها', 'الحواسب يتفاهمو وحدهم'],
      ['نسخة احتياطية أونلاين', 'معطياتك محفوظة، وتنجم تصدّرها وقت ما تحب'],
    ],
  },
  faqAside: {
    title: 'عندك سؤال آخر؟',
    body: 'ابعثلنا على الواتساب: نجاوبو بالعربي ولا بالفرنسي، ونجمو نوريوك البرنامج بالسلع متاعك.',
    cta: 'اسأل سؤال',
  },
  pricing: {
    title: 'أسعار بسيطة، بالدينار',
    sub: 'كل الخدمات في كل عرض. الشهر الأول مجاني.',
    plans: [
      {
        id: 'month',
        name: 'شهري',
        price: dt(PRICES.month),
        unit: 'د / الشهر',
        sub: 'بلا التزام، الشهر الأول مجاني',
        badge: '',
        highlight: false,
        perks: ['كل الخدمات', 'التحديثات مشمولة', 'دعم على الواتساب', 'كاسة وحدة'],
        note: `التركيب ${dt(PRICES.setup)} د بالمعدّات، ${dt(PRICES.setupNoKit)} د بلاش معدّات`,
      },
      {
        id: 'year',
        name: 'سنوي',
        price: dt(PRICES.year),
        unit: 'د / السنة',
        sub: `يعني ${(PRICES.year / 12).toFixed(1).replace('.', ',')} د في الشهر، شهرين بلاش`,
        badge: 'ننصحو بيه',
        highlight: true,
        perks: [
          'كل الخدمات',
          'التحديثات مشمولة',
          'دعم أولوية في العودة المدرسية',
          `التركيب بنصّ السوم حتى ${PROMO_UNTIL.ar}`,
        ],
        note: `التركيب ${dt(PRICES.setup)} د بالمعدّات، ${dt(PRICES.setupNoKit)} د بلاش معدّات`,
      },
      {
        id: 'life',
        name: 'مدى الحياة — المؤسّسين',
        price: dt(PRICES.life),
        unit: 'د، مرّة وحدة',
        sub: 'عرض محدود بـ 20 رخصة',
        badge: '',
        highlight: false,
        perks: [
          'كل الخدمات، بلا اشتراك',
          'المعدّات والتركيب مشمولين',
          'دعم مشمول مدّة 24 شهر',
          `من بعد صيانة اختيارية ${dt(PRICES.maintenance)} د / السنة`,
        ],
        note: 'التركيب والمعدّات مشمولين',
      },
    ],
    setupTitle: 'التركيب',
    extraTitle: 'خيار',
    setup: [
      [`${dt(PRICES.setup)} د`, 'بالمعدّات: سكانر بلا خيط وطابعة تيكيات 80 مم تقصّ وحدها، مركّبين'],
      [`${dt(PRICES.setupNoKit)} د`, 'بلاش معدّات، كان تحب تخدم بمتاعك (نجرّبوه معاك قبل)'],
      [`+${PRICES.extraTill} د / الشهر`, 'لكل كاسة زايدة'],
    ],
    taxNote: 'الأسعار بالدينار التونسي. الخلاص بالفيرمو، بالشيك ولا كاش، بفاتورة.',
    choose: 'اختار العرض هذا',
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
        `إيه، كان متوافقين: سكانر USB وطابعة تيكيات 80 مم (ولا A4) يكفيو. نجرّبوهم معاك، والتركيب يولّي ${dt(PRICES.setupNoKit)} د.`,
      ],
      [
        'كيفاش نخلّص؟',
        'بالدينار، بالفيرمو، بالشيك ولا كاش، بفاتورة. الشهري كل شهر، السنوي مرّة في العام، ومدى الحياة مرّة وحدة.',
      ],
      [
        'آما عرض نختار؟',
        'السنوي أرخص من الشهري من أوّل عام (شهرين بلاش). مدى الحياة يربّحك كان باش تخدم بالبرنامج أكثر من أربعة سنين، وهو محدود بـ 20 رخصة.',
      ],
      [
        'معطياتي في أمان؟',
        'مخزّنة على Google Cloud في باريس والاتصال مشفّر. كل مكتبة عندها فضاءها، مفصول على الآخرين. وتنجم تصدّر كل شي وقت ما تحب: نسخة احتياطية كاملة وملفات لـ Excel.',
      ],
      [
        'شنوّة الحاسوب اللي يلزم؟',
        'PC بـ Chrome ولا Edge يكفي، حتى كان قديم. وتنجم تخدم بأكثر من حاسوب، وكلهم يشوفو نفس الأرقام.',
      ],
    ],
  },
  final: {
    title: 'جاهز للعودة المدرسية الجاية؟',
    sub: 'ديمو في 20 دقيقة، عندك في المحل ولا على الواتساب، بالسلع متاعك.',
    cta: 'اطلب ديمو على الواتساب',
    call: 'ولا كلّمنا على',
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
