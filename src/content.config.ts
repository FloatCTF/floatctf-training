import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const motionLevels = ['static', 'subtle', 'explanatory', 'simulation'] as const;

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        pageType: z.enum(['home', 'category', 'lesson']).optional(),
        lessonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
        categoryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
        sources: z.array(z.string()).default([]),
        motionLevel: z.enum(motionLevels).optional(),
        safetyScope: z.enum(['authorized-lab', 'localhost', 'ctf', 'not-applicable']).optional(),
        researchStatus: z.enum(['complete', 'partial', 'blocked']).optional(),
      }),
    }),
  }),
};
