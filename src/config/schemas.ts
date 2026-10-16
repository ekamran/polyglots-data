import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'added must be a date like 2026-10-16')
const text = z.string().trim().min(1)

export const CoreTmSchema = z.object({ projects: z.array(z.object({ path: z.string() }).strict()) }).strict()

export const LocaleTmSchema = z.object({
  projects: z.array(z.object({ path: z.string(), added: date, by: text, reviewed: text }).strict()).default([]),
  exclude: z.array(z.string()).default([]),
}).strict()

export const LocaleMetaSchema = z.object({
  locale: z.string(),
  maintainers: z.array(z.object({
    wporg: text,
    github: text.optional(),
    role: z.enum(['Locale Manager', 'General Translation Editor']),
  }).strict()),
  rules: z.object({ status: z.enum(['maintained', 'draft']) }).strict(),
}).strict()
