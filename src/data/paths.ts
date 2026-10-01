import pathsJson from './paths.json';
import { findTopic, type CatalogTopic } from './catalog';

export interface LearningPathStage {
  name: string;
  goal: string;
  topics: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  summary: string;
  pagePath: string;
  sessionMinutes: number;
  stages: LearningPathStage[];
}

export interface PathLesson {
  /** 在整条路线中的课序，从 1 开始。 */
  number: number;
  topic: CatalogTopic;
}

export interface ResolvedStage {
  name: string;
  goal: string;
  lessons: PathLesson[];
}

export const learningPaths = (pathsJson as unknown as { paths: LearningPath[] }).paths;

export function findPath(id: string | undefined | null): LearningPath | undefined {
  return learningPaths.find((path) => path.id === id);
}

/** 把路线里的 topic id 解析成 catalog 条目并编上连续课序；未登记的 id 由门禁拦截，这里直接跳过。 */
export function resolveStages(path: LearningPath): ResolvedStage[] {
  let number = 0;
  return path.stages.map((stage) => ({
    name: stage.name,
    goal: stage.goal,
    lessons: stage.topics.flatMap((id) => {
      const topic = findTopic(id);
      if (!topic) return [];
      number += 1;
      return [{ number, topic }];
    }),
  }));
}

export function pathLessons(path: LearningPath): PathLesson[] {
  return resolveStages(path).flatMap((stage) => stage.lessons);
}

/** 路线上第一门尚未上线的课；全部上线时为 undefined。 */
export function nextLesson(path: LearningPath): PathLesson | undefined {
  return pathLessons(path).find((lesson) => lesson.topic.status !== 'completed');
}

export interface PathPosition {
  path: LearningPath;
  number: number;
  /** 路线上前一门已上线的课。 */
  previous?: CatalogTopic;
  /** 路线上后一门已上线的课。 */
  next?: CatalogTopic;
  /** 紧接着的下一课，不论是否上线；用于说明「下一课还在准备」。 */
  upcoming?: CatalogTopic;
}

/** 一门课在学习路线中的位置；不在任何路线上时为 undefined，调用方退回分类内的顺序。 */
export function pathPosition(topicId: string): PathPosition | undefined {
  for (const path of learningPaths) {
    const lessons = pathLessons(path);
    const index = lessons.findIndex((lesson) => lesson.topic.id === topicId);
    if (index < 0) continue;
    const isOnline = (lesson: PathLesson) => lesson.topic.status === 'completed' && Boolean(lesson.topic.pagePath);
    return {
      path,
      number: lessons[index].number,
      previous: lessons.slice(0, index).reverse().find(isOnline)?.topic,
      next: lessons.slice(index + 1).find(isOnline)?.topic,
      upcoming: lessons[index + 1]?.topic,
    };
  }
  return undefined;
}
