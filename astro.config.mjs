import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';

const catalog = JSON.parse(
  readFileSync(new URL('./src/data/catalog.json', import.meta.url), 'utf8'),
);

const normalizeBase = (value) => {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

const base = normalizeBase(process.env.TRAINING_BASE || '/');
const site = process.env.TRAINING_SITE || 'http://training.local';

const sidebar = [...catalog.categories]
  .sort((a, b) => a.order - b.order)
  .map((category) => ({
    label: category.name,
    items: [
      { label: '分类概览', slug: `categories/${category.id}` },
      ...catalog.topics
        .filter((topic) => topic.categoryId === category.id && topic.status === 'completed')
        .map((topic) => ({
          label: topic.title,
          slug: topic.pagePath.replace(/^\//, '').replace(/\/$/, ''),
        })),
    ],
  }));

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: {
    enabled: false,
  },
  integrations: [
    react(),
    starlight({
      title: '技术训练导航',
      description: '安全、计算机基础、AI、编程与工程工具课程地图',
      defaultLocale: 'root',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/global.css'],
      components: {
        Header: './src/components/training-header.astro',
        Hero: './src/components/navigation-hero.astro',
        PageTitle: './src/components/training-page-title.astro',
        PageFrame: './src/components/training-page-frame.astro',
        Sidebar: './src/components/training-sidebar.astro',
        TwoColumnContent: './src/components/training-two-column-content.astro',
      },
      sidebar,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: true,
    }),
  ],
});
