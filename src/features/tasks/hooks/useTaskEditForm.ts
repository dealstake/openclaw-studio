import { useCallback, useReducer } from "react";
import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

// ─── State & Actions ─────────────────────────────────────────────────────────

interface EditFormState {
  editing: boolean;
  name: string;
  description: string;
  prompt: string;
  model: string;
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

    if (Object.keys(updates).length === 0) {
      dispatch({ type: "cancel" });
      return;
    }
    onUpdateTask(task.id, updates);
    dispatch({ type: "cancel" });
  }, [task, state.name, state.description, state.prompt, state.model, onUpdateTask]);

  return {
    editing: state.editing,
    editName: state.name,
    editDescription: state.description,
    editPrompt: state.prompt,
    editModel: state.model,
    startEditing,
    cancelEditing,
    saveEdits,
    setField,
  };
}
