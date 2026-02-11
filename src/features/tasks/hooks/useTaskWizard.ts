import { useCallback, useState } from "react";
import type {
  TaskType,
  WizardTaskConfig,
  CreateTaskPayload,
} from "@/features/tasks/types";

export type WizardStep = "type-select" | "chat" | "confirm";

export interface UseTaskWizardReturn {
  // State
  step: WizardStep;
  taskType: TaskType | null;
  taskConfig: WizardTaskConfig | null;

  // Actions
  selectType: (type: TaskType) => void;
  setTaskConfig: (config: WizardTaskConfig | null) => void;
  confirm: () => CreateTaskPayload | null;
  reset: () => void;
  goBack: () => void;
}

export function useTaskWizard(): UseTaskWizardReturn {
  const [step, setStep] = useState<WizardStep>("type-select");
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [taskConfig, setTaskConfig] = useState<WizardTaskConfig | null>(null);

  const selectType = useCallback((type: TaskType) => {
    setTaskType(type);
    setStep("chat");
    setTaskConfig(null);
  }, []);

  const confirm = useCallback((): CreateTaskPayload | null => {
    if (!taskConfig) return null;
    return {
      agentId: taskConfig.agentId,
      name: taskConfig.name,
      description: taskConfig.description,
      type: taskConfig.type,
      schedule: taskConfig.schedule,
      prompt: taskConfig.prompt,
      model: taskConfig.model,
      deliveryChannel: taskConfig.deliveryChannel ?? null,
    };
  }, [taskConfig]);

  const reset = useCallback(() => {
    setStep("type-select");
    setTaskType(null);
    setTaskConfig(null);
  }, []);

  const goBack = useCallback(() => {
    if (step === "chat") {
      setStep("type-select");
      setTaskType(null);
      setTaskConfig(null);
    } else if (step === "confirm") {
      setStep("chat");
    }
  }, [step]);

  return {
    step,
    taskType,
    taskConfig,
    selectType,
    setTaskConfig,
    confirm,
    reset,
    goBack,
  };
}
