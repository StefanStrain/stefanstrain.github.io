import { getCollection, getEntry } from 'astro:content';
import { entryLang, type Lang } from './index';
import resumeEn from '../../content/resume/en.json';
import resumeFr from '../../content/resume/fr.json';

const resumes = { en: resumeEn, fr: resumeFr };

export function getResume(lang: Lang) {
  return resumes[lang];
}

export async function getProfile(lang: Lang) {
  return (await getEntry('profile', lang))!;
}

export async function getProjects(lang: Lang) {
  const projects = await getCollection('projects', ({ id }) => entryLang(id) === lang);
  return projects.sort((a, b) => a.data.importance - b.data.importance);
}

// Minutes to read a write-up: prose words only, so the inline scripts, styles and HTML attributes don't count
export function readingMinutes(body: string | undefined): number {
  const prose = (body ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ');
  const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / 220));
}

export async function getBooks(lang: Lang) {
  const books = await getCollection('books', ({ id }) => entryLang(id) === lang);
  return books.sort((a, b) => (b.data.finished?.getTime() ?? 0) - (a.data.finished?.getTime() ?? 0));
}
