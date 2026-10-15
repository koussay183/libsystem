/**
 * The three legal pages, French only, as DRAFTS.
 *
 * Built from the outlines in docs/launch/02-legal-fiscal-compliance.md §6.
 * Every [bracketed] passage is something only the founder or a lawyer can
 * fill in (company identity, INPDP numbers, durations); the page shows it
 * highlighted, and the pages carry noindex and stay out of the sitemap until a
 * Tunisian lawyer has validated them. What is written in plain text is true of
 * the product today: the hosts, the data, the prices, what is stored where.
 */
import { CONTACT, PRICES } from '../copy'

export type Block = string | { list: string[] } | { table: string[][] } | { manageCookies: string }

export interface LegalSection {
  id?: string
  title: string
  blocks: Block[]
}

export interface LegalDoc {
  path: string
  title: string
  description: string
  updated: string
  sections: LegalSection[]
}

const PHONE = `+216 ${CONTACT.whatsapp.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3')}`
const UPDATED = '15 octobre 2026'

export const DRAFT_NOTICE =
  'Version provisoire, en cours de validation juridique. Les passages entre crochets seront complétés avant la version définitive.'

const mentions: LegalDoc = {
  path: '/mentions-legales',
  title: 'Mentions légales',
  description: 'Éditeur, hébergement et propriété intellectuelle du site Mektebti.tn.',
  updated: UPDATED,
  sections: [
    {
      title: 'Éditeur du site',
      blocks: [
        'Mektebti.tn est édité par [raison sociale], [forme juridique] au capital de [montant] DT, dont le siège est situé [adresse].',
        { list: ['RNE : [numéro]', 'Matricule fiscal : [numéro]', `Téléphone et WhatsApp : ${PHONE}`, 'E-mail : [adresse e-mail]'] },
        'Directeur de la publication : [nom].',
      ],
    },
    {
      title: 'Hébergement',
      blocks: [
        { list: ['Site web : Netlify, Inc., États-Unis.', 'Données de l’application : Google Cloud (Firebase), région europe-west9, Paris, France.'] },
      ],
    },
    {
      title: 'Propriété intellectuelle',
      blocks: [
        'La marque et le logo « Mektebti.tn / مكتبتي », ainsi que les textes et visuels de ce site, appartiennent à l’éditeur [dépôt INNORPI le cas échéant]. Toute reproduction sans autorisation écrite est interdite.',
      ],
    },
    {
      title: 'Données personnelles',
      blocks: ['Voir la politique de confidentialité, qui décrit aussi les cookies et la façon de retirer votre consentement.'],
    },
  ],
}

const privacy: LegalDoc = {
  path: '/confidentialite',
  title: 'Politique de confidentialité',
  description: 'Quelles données Mektebti.tn traite, pourquoi, où elles sont hébergées, et vos droits.',
  updated: UPDATED,
  sections: [
    {
      title: 'Responsable du traitement',
      blocks: [
        `L’éditeur du site (voir les mentions légales), joignable au ${PHONE} et à [adresse e-mail]. Déclaration auprès de l’INPDP : [numéro].`,
      ],
    },
    {
      title: 'Données traitées',
      blocks: [
        {
          list: [
            'Sur ce site : les pages consultées et les clics, uniquement si vous acceptez les cookies de mesure ou de publicité ; les messages que vous nous envoyez sur WhatsApp ou par téléphone.',
            'Dans l’application : l’identifiant de connexion de la librairie et les données de facturation de l’abonnement.',
            'Les données que la librairie enregistre sur ses propres clients (carnet de crédit, ventes) : Mektebti les traite pour le compte de la librairie, qui en reste responsable, et ne les utilise jamais à d’autres fins.',
          ],
        },
      ],
    },
    {
      title: 'Pourquoi',
      blocks: [
        'Fournir le service et l’assistance, facturer l’abonnement, l’améliorer. Mesurer l’audience du site et l’efficacité de nos publicités, uniquement avec votre consentement.',
        'Bases : le contrat d’abonnement, votre consentement (Loi organique n° 2004-63, art. 27 et 30) et nos obligations légales, notamment comptables.',
      ],
    },
    {
      title: 'Destinataires',
      blocks: [
        {
          list: [
            'Google (Firebase, Google Cloud) : hébergement des données de l’application.',
            'Netlify : hébergement du site.',
            'Google (Analytics, Ads) et Meta : uniquement si vous acceptez les cookies correspondants.',
            'Notre expert-comptable, pour la facturation.',
          ],
        },
        'Nous ne vendons aucune donnée.',
      ],
    },
    {
      title: 'Transferts hors de Tunisie',
      blocks: [
        'Les données de l’application sont hébergées en France (Union européenne). Le site est hébergé aux États-Unis, où se trouvent aussi les services de mesure et de publicité de Google et de Meta, utilisés seulement avec votre accord. Autorisation de l’INPDP : [numéro].',
      ],
    },
    {
      title: 'Durées de conservation',
      blocks: [
        {
          list: [
            'Compte de la librairie : durée du contrat, puis [N] mois.',
            'Factures : 10 ans.',
            'Contacts commerciaux (prospects) : [N] mois après le dernier échange.',
            'Votre choix sur les cookies : 180 jours, puis la question vous est reposée.',
            'Cookies de mesure et de publicité : 13 mois au plus.',
          ],
        },
      ],
    },
    {
      title: 'Sécurité',
      blocks: [
        'Connexions chiffrées, accès par identifiant et mot de passe propres à chaque librairie, données de chaque librairie séparées des autres, export complet possible à tout moment.',
      ],
    },
    {
      title: 'Vos droits',
      blocks: [
        `Vous pouvez demander l’accès à vos données, leur rectification, vous opposer à leur traitement et retirer votre consentement, au ${PHONE} ou à [adresse e-mail]. Vous pouvez aussi saisir l’INPDP (Instance nationale de protection des données personnelles).`,
        'Le service s’adresse aux professionnels ; il ne doit pas servir à ouvrir un carnet au nom d’un mineur.',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      blocks: [
        'Aucun cookie de mesure ou de publicité n’est déposé sans votre accord. Si vous acceptez, ces cookies peuvent l’être :',
        {
          table: [
            ['Nom', 'Émetteur', 'Finalité', 'Durée'],
            ['_ga, _ga_…', 'Google Analytics', 'Mesure d’audience', '2 ans au plus'],
            ['_gcl_…', 'Google Ads', 'Mesurer les visites venues d’une annonce', '90 jours'],
            ['_fbp, _fbc', 'Meta', 'Mesurer les visites venues d’une annonce', '[durée à vérifier]'],
          ],
        },
        'Votre choix lui-même est gardé dans votre navigateur (« mk:consent », 180 jours). L’application de caisse n’utilise aucun cookie publicitaire : elle garde seulement sur l’appareil ce qu’il lui faut pour fonctionner, y compris hors ligne (session de connexion, copie locale des données de la librairie).',
        { manageCookies: 'Gérer mes cookies' },
      ],
    },
  ],
}

const cgv: LegalDoc = {
  path: '/cgv',
  title: 'Conditions générales de vente et d’utilisation',
  description: 'Les formules Mektebti.tn, leurs prix et les conditions d’utilisation du service.',
  updated: UPDATED,
  sections: [
    {
      title: '1. Objet',
      blocks: [
        'Abonnement au logiciel Mektebti.tn (caisse, stock, packs scolaires, carnet de crédit, factures, rapports), utilisé en ligne, et fourniture du matériel de caisse prévu par la formule choisie.',
      ],
    },
    {
      title: '2. Clients',
      blocks: ['Le service est réservé aux professionnels (librairies, papeteries), qui déclarent agir pour les besoins de leur activité.'],
    },
    {
      title: '3. Formules et prix',
      blocks: [
        {
          list: [
            `Mensuel : ${PRICES.month} DT par mois, plus ${PRICES.setup} DT de mise en service (douchette code-barres et imprimante ticket, installées). Premier mois d’abonnement offert : [conditions et date de début de facturation].`,
            `Annuel : ${PRICES.year} DT par an, mise en service et matériel inclus.`,
            `À vie : ${PRICES.life} DT, payés une seule fois, mise en service et matériel inclus.`,
          ],
        },
        'Prix en dinars tunisiens, [TTC ou HT à préciser]. Le matériel est [vendu ou mis à disposition].',
      ],
    },
    {
      title: '4. Compte et activation',
      blocks: [
        'Le compte de la librairie est créé par Mektebti ; il n’existe pas d’inscription libre. Les identifiants sont personnels et confidentiels ; le client répond de leur usage.',
      ],
    },
    {
      title: '5. Facturation et paiement',
      blocks: [
        'Paiement en dinars : [moyens de paiement acceptés]. [Périodicité de facturation, timbre fiscal, retenue à la source.]',
        'En cas de retard, le service peut être suspendu après une mise en demeure restée sans effet pendant [X] jours, sans suppression des données pendant [Y] jours.',
      ],
    },
    {
      title: '6. Durée et résiliation',
      blocks: [
        {
          list: [
            'Mensuel : [préavis de résiliation].',
            'Annuel : engagement de 12 mois.',
            '« À vie » : pour toute la durée d’exploitation du service par Mektebti, avec un minimum garanti de [N] ans. En cas d’arrêt du service : préavis de [durée], export complet des données et remboursement au prorata si l’arrêt intervient avant ce minimum. La formule est attachée à la librairie et n’est pas cessible.',
          ],
        },
      ],
    },
    {
      title: '7. Matériel',
      blocks: [
        'Garantie du fabricant de [durée], transmise au client. Sont exclus la casse, les liquides et les surtensions. [Restitution en fin de contrat si le matériel est mis à disposition.] Le client peut utiliser son propre matériel s’il est compatible.',
      ],
    },
    {
      title: '8. Service et disponibilité',
      blocks: [
        'La caisse continue de fonctionner sans internet et se synchronise au retour de la connexion ; l’installation et la première connexion demandent internet. Mektebti ne garantit pas une disponibilité absolue des services en ligne. Assistance par WhatsApp : [horaires].',
      ],
    },
    {
      title: '9. Obligations fiscales du client',
      blocks: [
        'Le client reste seul responsable de son régime fiscal, des taux de TVA qu’il paramètre, de la numérotation et de la conservation de ses factures et de ses déclarations. Mektebti fournit un outil et ne délivre aucun conseil fiscal. Le logiciel n’est pas une caisse enregistreuse homologuée au sens du décret n° 2019-1126.',
      ],
    },
    {
      title: '10. Données',
      blocks: [
        'Le client est responsable des données de ses propres clients ; Mektebti les traite pour son compte, comme sous-traitant [accord de sous-traitance en annexe]. Le client reste propriétaire de ses données : il peut les exporter à tout moment, et elles lui sont restituées pendant [N] mois après la fin du contrat.',
      ],
    },
    {
      title: '11. Responsabilité',
      blocks: [
        'La responsabilité de Mektebti est limitée aux sommes payées au cours des 12 derniers mois et exclut les dommages indirects. Des exports réguliers (bouton « Sauvegarde ») sont recommandés.',
      ],
    },
    {
      title: '12. Propriété intellectuelle',
      blocks: ['Le client reçoit une licence d’utilisation non exclusive et non cessible, pour la durée de sa formule.'],
    },
    {
      title: '13. Modification des conditions',
      blocks: ['Toute modification est communiquée [30] jours avant son entrée en vigueur.'],
    },
    {
      title: '14. Droit applicable',
      blocks: ['Droit tunisien. Les parties cherchent d’abord un accord amiable ; à défaut, les tribunaux de [ville] sont compétents.'],
    },
  ],
}

export const LEGAL_DOCS: LegalDoc[] = [mentions, privacy, cgv]
