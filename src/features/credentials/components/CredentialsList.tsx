"use client";

import React, { useMemo } from "react";
import type { Credential, CredentialCategory } from "../lib/types";
import { CATEGORY_ORDER } from "../lib/types";
import { CredentialCategoryGroup } from "./CredentialCategoryGroup";

export interface CredentialsListProps {
  credentials: Credential[];
  search: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CredentialsList = React.memo(function CredentialsList({
  credentials,
  search,
  onEdit,
  onDelete,
}: CredentialsListProps) {
  const filtered = useMemo(() => {
    if (!search.trim()) return credentials;
    const q = search.toLowerCase();
    return credentials.filter(
      (c) =>
        c.humanName.toLowerCase().includes(q) ||
        c.serviceName.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [credentials, search]);

  const grouped = useMemo(() => {
    const map = new Map<CredentialCategory, Credential[]>();
    for (const cred of filtered) {
      const list = map.get(cred.category) ?? [];
      list.push(cred);
      map.set(cred.category, list);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, credentials: map.get(cat)! }));
  }, [filtered]);

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-2">
      {grouped.map(({ category, credentials: creds }) => (
        <CredentialCategoryGroup
          key={category}
          category={category}
          credentials={creds}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});
