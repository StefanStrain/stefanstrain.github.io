import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Every collection is split by language folder: content/<collection>/<lang>/..., so ids look like "fr/zero_to_one"

const profile = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/profile' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    location: z.string(),
    email: z.string(),
    photo: z.string(),
    socials: z.record(z.string(), z.string()),
    cv_pdfs: z.array(z.object({ label: z.string(), file: z.string() })),
    languages: z.array(z.string()),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    img: z.string(),
    importance: z.number().default(99),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    cover: z.string(),
    isbn: z.coerce.string().optional(),
    // space-separated lists in the old al-folio frontmatter
    categories: z.string().default('').transform((s) => s.split(/\s+/).filter(Boolean)),
    tags: z.string().default('').transform((s) => s.split(/\s+/).filter(Boolean)),
    buy_link: z.string().optional(),
    started: z.coerce.date().optional(),
    finished: z.coerce.date().optional(),
    released: z.coerce.number().optional(),
    stars: z.number().min(0).max(5).optional(),
    status: z.string().optional(),
  }),
});

export const collections = { profile, projects, books };
