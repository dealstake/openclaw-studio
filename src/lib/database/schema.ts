import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Projects Index ──────────────────────────────────────────────────────────

export const projectsIndex = sqliteTable("projects_index", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  doc: text("doc").notNull().unique(),
  status: text("status").notNull(),
  statusEmoji: text("status_emoji").notNull(),
  priority: text("priority").notNull(),
  priorityEmoji: text("priority_emoji").notNull(),
  oneLiner: text("one_liner").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Type exports ────────────────────────────────────────────────────────────

export type ProjectIndexRow = typeof projectsIndex.$inferSelect;
export type NewProjectIndexRow = typeof projectsIndex.$inferInsert;
