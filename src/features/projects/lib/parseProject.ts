export interface AssociatedTask {
  name: string;
  cronJobId: string;
  autoManage: boolean;
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
}

export function parseProjectFile(markdown: string): ProjectDetails {
  const details: ProjectDetails = {
    continuation: {},
    progress: { completed: 0, total: 0, percent: 0 },
    associatedTasks: [],
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
    if (nextStepMatch) details.continuation.nextStep = nextStepMatch[1].trim();

    const blockedMatch = contextBody.match(
      /[-*]\s*\*\*Blocked by\*\*:\s*(.+)/
    );
    if (blockedMatch) details.continuation.blockedBy = blockedMatch[1].trim();
    
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

  return details;
}
