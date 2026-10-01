import catalogJson from './catalog.json';

export interface CatalogCategory {
  id: string;
  name: string;
  summary: string;
  order: number;
  pagePath: string;
}

export interface CatalogTopic {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  difficulty: string;
  status: 'completed' | 'planned';
  pagePath: string | null;
  prerequisites: string[];
  order: number;
}

export interface Catalog {
  categories: CatalogCategory[];
  topics: CatalogTopic[];
}

export const catalog = catalogJson as unknown as Catalog;

export const difficultyLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '进阶',
};

export function difficultyLabel(difficulty: string): string {
  return difficultyLabels[difficulty] || difficulty;
}

export function categoriesByOrder(): CatalogCategory[] {
  return [...catalog.categories].sort((a, b) => a.order - b.order);
}

export function topicsByCategory(categoryId: string): CatalogTopic[] {
  return catalog.topics
    .filter((topic) => topic.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

export function completedTopics(): CatalogTopic[] {
  return catalog.topics.filter((topic) => topic.status === 'completed');
}

export function completedTopicsByCategory(categoryId: string): CatalogTopic[] {
  return topicsByCategory(categoryId).filter((topic) => topic.status === 'completed');
}

export function findCategory(id: string | undefined | null): CatalogCategory | undefined {
  return catalog.categories.find((category) => category.id === id);
}

export function findTopic(id: string | undefined | null): CatalogTopic | undefined {
  return catalog.topics.find((topic) => topic.id === id);
}
