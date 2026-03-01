import { useCallback, useReducer } from "react";
import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

// ─── State & Actions ─────────────────────────────────────────────────────────

interface EditFormState {
  editing: boolean;
  name: string;
  description: string;
  prompt: string;
  model: string;
  thinking: string;
  cacheRetention: string;
  deliveryChannel: string;
  deliveryTarget: string;
}

type EditFormAction =
  | { type: "start"; task: StudioTask }
  | { type: "cancel" }
  | { type: "setField"; field: keyof Omit<EditFormState, "editing">; value: string };

const initialState: EditFormState = {
  editing: false,
  name: "",
  description: "",
  prompt: "",
  model: "",
  thinking: "",
  cacheRetention: "",
  deliveryChannel: "",
  deliveryTarget: "",
};

function editFormReducer(state: EditFormState, action: EditFormAction): EditFormState {
  switch (action.type) {
    case "start":
      return {
        editing: true,
        name: action.task.name,
        description: action.task.description,
        prompt: action.task.prompt,
        model: action.task.model,
        thinking: action.task.thinking ?? "",
        cacheRetention: action.task.cacheRetention ?? "",
        deliveryChannel: action.task.deliveryChannel ?? "",
        deliveryTarget: action.task.deliveryTarget ?? "",
      };
    case "cancel":
      return { ...state, editing: false };
    case "setField":
      return { ...state, [action.field]: action.value };
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseTaskEditFormOptions {
  task: StudioTask | null;
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
}

export function useTaskEditForm({ task, onUpdateTask }: UseTaskEditFormOptions) {
  const [state, dispatch] = useReducer(editFormReducer, initialState);

  const startEditing = useCallback(() => {
    if (!task) return;
    dispatch({ type: "start", task });
  }, [task]);

  const cancelEditing = useCallback(() => {
    dispatch({ type: "cancel" });
  }, []);

  const setField = useCallback(
    (field: keyof Omit<EditFormState, "editing">, value: string) => {
      dispatch({ type: "setField", field, value });
    },
    [],
  );

  const saveEdits = useCallback(() => {
    if (!task) return;
    const updates: UpdateTaskPayload = {};
    if (state.name.trim() && state.name.trim() !== task.name) updates.name = state.name.trim();
    if (state.description !== task.description) updates.description = state.description;
    if (state.prompt.trim() && state.prompt.trim() !== task.prompt) updates.prompt = state.prompt.trim();
    if (state.model.trim() && state.model.trim() !== task.model) updates.model = state.model.trim();
    const newThinking = state.thinking || null;
    if (newThinking !== (task.thinking ?? null)) updates.thinking = newThinking;
    const newCacheRetention = state.cacheRetention || null;
    if (newCacheRetention !== (task.cacheRetention ?? null)) updates.cacheRetention = newCacheRetention;
    const newDeliveryChannel = state.deliveryChannel || null;
    if (newDeliveryChannel !== task.deliveryChannel) updates.deliveryChannel = newDeliveryChannel;
    const newDeliveryTarget = state.deliveryTarget || null;
    if (newDeliveryTarget !== task.deliveryTarget) updates.deliveryTarget = newDeliveryTarget;

    if (Object.keys(updates).length === 0) {
      dispatch({ type: "cancel" });
      return;
    }
    onUpdateTask(task.id, updates);
    dispatch({ type: "cancel" });
  }, [task, state.name, state.description, state.prompt, state.model, state.thinking, state.cacheRetention, state.deliveryChannel, state.deliveryTarget, onUpdateTask]);

  return {
    editing: state.editing,
    editName: state.name,
    editDescription: state.description,
    editPrompt: state.prompt,
    editModel: state.model,
    editThinking: state.thinking,
    editCacheRetention: state.cacheRetention,
    editDeliveryChannel: state.deliveryChannel,
    editDeliveryTarget: state.deliveryTarget,
    startEditing,
    cancelEditing,
    saveEdits,
    setField,
  };
}
