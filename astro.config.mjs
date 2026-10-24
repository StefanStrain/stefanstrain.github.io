// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://stefanstrainovic.com',
  integrations: [mdx(), sitemap()],
  // Old al-folio URLs that no longer exist. Remove '/books' when the _books pages are switched back on.
  redirects: {
    '/books': '/',
    '/blog': '/',
    '/news': '/',
    '/people': '/',
    '/teaching': '/',
    '/publications': '/projects/',
    '/repositories': '/projects/',
  },
  markdown: {
    // Only $$...$$ is maths: single dollars are currency in the write-ups (e.g. R$5.7M)
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
