export type Breadcrumb = { label: string; path: string };

/**
 * Build navigation breadcrumbs from a relative path.
 * Always starts with the root "~" crumb.
 */
export function buildBreadcrumbs(currentPath: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "~", path: "" }];
  if (currentPath) {
    const parts = currentPath.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      crumbs.push({ label: part, path: accumulated });
    }
  }
  return crumbs;
}
