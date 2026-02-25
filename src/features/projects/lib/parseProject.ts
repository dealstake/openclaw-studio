export interface AssociatedTask {
  name: string;
  cronJobId: string;
  autoManage: boolean;
}

export interface PlanItem {
  phaseName: string;
  taskDescription: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface HistoryEntry {
  entryDate: string;
  entryText: string;
  sortOrder: number;
}

export interface ProjectDetails {
  continuation: {
    lastWorkedOn?: string;
    nextStep?: string;
    blockedBy?: string;
    contextNeeded?: string;
  };
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  associatedTasks: AssociatedTask[];
  planItems: PlanItem[];
  history: HistoryEntry[];
}

export function parseProjectFile(markdown: string): ProjectDetails {
  const details: ProjectDetails = {
    continuation: {},
    progress: { completed: 0, total: 0, percent: 0 },
    associatedTasks: [],
    planItems: [],
    history: [],
  };

  // Parse Continuation Context
  const continuationMatch = markdown.match(
    /## Continuation Context([\s\S]*?)(?:##|$)/
  );

  if (continuationMatch) {
    const contextBody = continuationMatch[1];
    
    const lastWorkedMatch = contextBody.match(
      /[-*]\s*\*\*Last worked on\*\*:\s*(.+)/
    );
    if (lastWorkedMatch) details.continuation.lastWorkedOn = lastWorkedMatch[1].trim();

    const nextStepMatch = contextBody.match(
      /[-*]\s*\*\*Immediate next step\*\*:\s*(.+)/
    );
    if (nextStepMatch) {
      const raw = nextStepMatch[1].trim();
      // Suppress placeholder/template text (e.g. "[specific action]", "[nothing / ...]")
      if (raw && !/^\[.*\]$/.test(raw) && !raw.startsWith("_")) {
        details.continuation.nextStep = raw;
      }
    }

    const blockedMatch = contextBody.match(
      /[-*]\s*\*\*Blocked by\*\*:\s*(.+)/
    );
    if (blockedMatch) {
      const raw = blockedMatch[1].trim();
      if (raw && !/^\[.*\]$/.test(raw) && !raw.startsWith("_")) {
        details.continuation.blockedBy = raw;
      }
    }
    
    const contextNeededMatch = contextBody.match(
      /[-*]\s*\*\*Context needed\*\*:\s*(.+)/
    );
    if (contextNeededMatch) details.continuation.contextNeeded = contextNeededMatch[1].trim();
  }

  // Parse Implementation Plan Checkboxes — scoped to ## Implementation Plan section only
  const implMatch = markdown.match(
    /## Implementation Plan([\s\S]*?)(?:\n## (?!#)|$)/
  );
  const implSection = implMatch?.[1] ?? "";
  const completed = (implSection.match(/- \[x\]/gi) || []).length;
  const pending = (implSection.match(/- \[ \]/g) || []).length;
  const total = completed + pending;
  
  details.progress = {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };

  // Parse structured plan items (per-phase, per-task)
  if (implSection) {
    let currentPhase = "Ungrouped";
    let sortOrder = 0;
    for (const line of implSection.split("\n")) {
      // Detect phase headings: ### Phase 1: Name or ### Name
      const phaseMatch = line.match(/^###\s+(.+)/);
      if (phaseMatch) {
        currentPhase = phaseMatch[1].trim();
        continue;
      }
      // Detect checkboxes
      const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
      if (checkMatch) {
        details.planItems.push({
          phaseName: currentPhase,
          taskDescription: checkMatch[2].trim(),
          isCompleted: checkMatch[1].toLowerCase() === "x",
          sortOrder: sortOrder++,
        });
      }
    }
  }

  // Parse Associated Tasks section
  const tasksMatch = markdown.match(
    /## Associated Tasks([\s\S]*?)(?:\n##\s|$)/
  );
  if (tasksMatch) {
    const tasksBody = tasksMatch[1];
    const taskLines = tasksBody.split("\n");
    for (const line of taskLines) {
      // Match table rows: | Task Name | cronJobId | yes/no |
      const rowMatch = line.match(
        /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(yes|no)\s*\|$/i
      );
      if (rowMatch) {
        const [, name, cronJobId, autoManage] = rowMatch;
        // Skip header/separator rows
        if (
          !name ||
          name.includes("---") ||
          name.toLowerCase() === "task"
        ) continue;
        details.associatedTasks.push({
          name: name.trim(),
          cronJobId: cronJobId.trim(),
          autoManage: autoManage.trim().toLowerCase() === "yes",
        });
      }
    }
  }

  // Parse History section
  const historyMatch = markdown.match(
    /## History([\s\S]*?)(?:\n## (?!#)|$)/
  );
  if (historyMatch) {
    const historyBody = historyMatch[1];
    let sortOrder = 0;
    for (const line of historyBody.split("\n")) {
      // Match: - 2026-02-24: Description text
      const entryMatch = line.match(/^[-*]\s+(\d{4}-\d{2}-\d{2}):\s+(.+)/);
      if (entryMatch) {
        details.history.push({
          entryDate: entryMatch[1],
          entryText: entryMatch[2].trim(),
          sortOrder: sortOrder++,
        });
      }
    }
  }

  return details;
}
