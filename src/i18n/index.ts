export const languages = { en: 'English', fr: 'Français' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'en';

// English lives at the root, every other language under its own prefix (/fr/...)
export function getLang(url: URL): Lang {
  const first = url.pathname.split('/')[1];
  return first in languages && first !== defaultLang ? (first as Lang) : defaultLang;
}

export function localePath(lang: Lang, path: string): string {
  return lang === defaultLang ? path : `/${lang}${path}`;
}

// The same page in another language, so switching never sends you back to the homepage
export function switchPath(url: URL, target: Lang): string {
  const current = getLang(url);
  const base = current === defaultLang ? url.pathname : url.pathname.slice(current.length + 1) || '/';
  return localePath(target, base);
}

// Content entries are stored as <lang>/<slug> (content/projects/fr/mri_segmentation.md -> "fr/mri_segmentation")
export function entryLang(id: string): Lang {
  return id.split('/')[0] as Lang;
}

export function entrySlug(id: string): string {
  return id.split('/').slice(1).join('/');
}

export function dateLocale(lang: Lang): string {
  return lang === 'fr' ? 'fr-FR' : 'en-GB';
}

const ui = {
  en: {
    'nav.projects': 'Projects',
    'nav.cv': 'CV',
    'nav.books': 'Books',
    'nav.downloadCv': 'Download CV',
    'download.title': 'Download my CV',
    'download.intro': 'Pick a language. Both are the same one-page PDF.',
    'download.close': 'Close',
    'nav.theme': 'Toggle light and dark mode',
    'nav.language': 'Lire en français',
    'home.headline.1': 'Statistician',
    'home.headline.2': '& data scientist',
    'home.intro': 'Building models for medicine and finance.',
    'home.selected': 'Selected projects',
    'home.allProjects': 'All projects →',
    'home.about': 'About',
    'projects.title': 'Projects',
    'projects.intro': "A growing collection of things I've built, written up properly.",
    'projects.back': '← Projects',
    'cv.title': 'Curriculum vitae',
    'cv.experience': 'Experience',
    'cv.education': 'Education',
    'cv.skills': 'Skills',
    'cv.volunteering': 'Volunteering',
    'cv.languages': 'Languages',
    'cv.interests': 'Interests',
    'cv.present': 'Present',
    'cv.in': 'in',
    'books.title': 'Bookshelf',
    'books.intro': "What I've been reading, and what I made of it.",
    'books.back': '← Bookshelf',
    'books.read': 'Read',
    'books.find': 'Find the book →',
    'books.status.paused': 'Reading, paused',
    'books.status.reread': 'Reread',
    'projects.readingTime': 'min read',
    'projects.wip': 'In progress',
    'projects.wipNote': 'Write-up coming soon',
    'a11y.skip': 'Skip to content',
    'books.stars': 'out of 5 stars',
    'books.cover': 'Cover of',
    'books.by': 'by',
    'books.review': 'a short review.',
    'notFound.title': 'Page not found',
    'notFound.headline': 'Nothing here.',
    'notFound.back': 'Back to the homepage →',
    'meta.description': 'Stefan Strainovic, statistician and data scientist based in Paris.',
    'meta.jobTitle': 'Statistician and data scientist',
    'cv.printable': 'Printable version',
    'cv.print': 'Print / Save as PDF',
    'cv.back': '← Back to the CV',
  },
  fr: {
    'nav.projects': 'Projets',
    'nav.cv': 'CV',
    'nav.books': 'Lectures',
    'nav.downloadCv': 'Télécharger le CV',
    'download.title': 'Télécharger mon CV',
    'download.intro': "Choisissez une langue. Les deux versions sont le même PDF d'une page.",
    'download.close': 'Fermer',
    'nav.theme': 'Basculer entre mode clair et mode sombre',
    'nav.language': 'Read in English',
    'home.headline.1': 'Statisticien',
    'home.headline.2': '& data scientist',
    'home.intro': 'Je construis des modèles pour la médecine et la finance.',
    'home.selected': 'Projets choisis',
    'home.allProjects': 'Tous les projets →',
    'home.about': 'À propos',
    'projects.title': 'Projets',
    'projects.intro': "Une collection qui s'agrandit de choses que j'ai construites, racontées en détail.",
    'projects.back': '← Projets',
    'cv.title': 'Curriculum vitae',
    'cv.experience': 'Expériences',
    'cv.education': 'Formation',
    'cv.skills': 'Compétences',
    'cv.volunteering': 'Bénévolat',
    'cv.languages': 'Langues',
    'cv.interests': "Centres d'intérêt",
    'cv.present': "Aujourd'hui",
    'cv.in': 'en',
    'books.title': 'Lectures',
    'books.intro': "Ce que j'ai lu, et ce que j'en ai pensé.",
    'books.back': '← Lectures',
    'books.read': 'Lu en',
    'books.find': 'Trouver le livre →',
    'books.status.paused': 'Lecture en pause',
    'books.status.reread': 'Relu',
    'projects.readingTime': 'min de lecture',
    'projects.wip': 'En cours',
    'projects.wipNote': 'Article à venir',
    'a11y.skip': 'Aller au contenu',
    'books.stars': 'étoiles sur 5',
    'books.cover': 'Couverture de',
    'books.by': 'de',
    'books.review': 'une courte critique.',
    'notFound.title': 'Page introuvable',
    'notFound.headline': 'Rien ici.',
    'notFound.back': "Retour à l'accueil →",
    'meta.description': 'Stefan Strainovic, statisticien et data scientist basé à Paris.',
    'meta.jobTitle': 'Statisticien et data scientist',
    'cv.printable': 'Version imprimable',
    'cv.print': 'Imprimer / Enregistrer en PDF',
    'cv.back': '← Retour au CV',
  },
} as const;

export type UiKey = keyof (typeof ui)['en'];

export function useTranslations(lang: Lang) {
  return (key: UiKey): string => ui[lang][key] ?? ui[defaultLang][key];
}
