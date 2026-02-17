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
}

export function parseProjectFile(markdown: string): ProjectDetails {
  const details: ProjectDetails = {
    continuation: {},
    progress: { completed: 0, total: 0, percent: 0 },
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

  // Parse Implementation Plan Checkboxes
  // Look for "- [x]" and "- [ ]" within the whole file (simplest approach)
  // Or restrict to "Implementation Plan" section if needed, but global is usually fine/safe enough
  const completed = (markdown.match(/- \[x\]/gi) || []).length;
  const pending = (markdown.match(/- \[ \]/g) || []).length;
  const total = completed + pending;
  
  details.progress = {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };

  return details;
}
