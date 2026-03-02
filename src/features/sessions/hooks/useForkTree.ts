/**
 * useForkTree — Hook to build a fork tree for a given session.
 *
 * Returns the tree structure and metadata about the current session's
 * position in the fork hierarchy.
 */

import { useMemo } from "react";
import {
  buildForkTree,
  getForkEntry,
  getChildForks,
  type ForkTreeNode,
  type ForkRegistryEntry,
} from "../lib/forkRegistry";
import type { SessionHistoryEntry } from "./useSessionHistory";

export interface ForkTreeInfo {
  /** Full tree from root to all leaves */
  tree: ForkTreeNode | null;
  /** Whether this session is a fork (has a parent) */
  isFork: boolean;
  /** Parent fork entry (null if this is a root) */
  parentEntry: ForkRegistryEntry | null;
  /** Direct child forks of this session */
  childForks: ForkRegistryEntry[];
  /** Total number of nodes in the tree */
  totalNodes: number;
  /** Whether a tree exists (more than just the root) */
  hasTree: boolean;
}

function countNodes(node: ForkTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

export function useForkTree(
  sessionKey: string | null,
  sessions?: SessionHistoryEntry[],
): ForkTreeInfo {
  const displayNameMap = useMemo(() => {
    if (!sessions) return undefined;
    const map = new Map<string, string>();
    for (const s of sessions) {
      map.set(s.key, s.displayName);
    }
    return map;
  }, [sessions]);

  return useMemo(() => {
    if (!sessionKey) {
      return {
        tree: null,
        isFork: false,
        parentEntry: null,
        childForks: [],
        totalNodes: 0,
        hasTree: false,
      };
    }

    const parentEntry = getForkEntry(sessionKey);
    const childForks = getChildForks(sessionKey);
    const hasForkRelationship = parentEntry !== null || childForks.length > 0;

    if (!hasForkRelationship) {
      return {
        tree: null,
        isFork: false,
        parentEntry: null,
        childForks: [],
        totalNodes: 0,
        hasTree: false,
      };
    }

    const tree = buildForkTree(sessionKey, displayNameMap);
    const totalNodes = countNodes(tree);

    return {
      tree,
      isFork: parentEntry !== null,
      parentEntry,
      childForks,
      totalNodes,
      hasTree: totalNodes > 1,
    };
  }, [sessionKey, displayNameMap]);
}
