import { z } from "zod";
import type { ContainerStore } from "../store";
import { textResult } from "../utils/response";
import { ContainerNotLoadedError } from "../utils/errors";

export function registerUndoTools(store: ContainerStore) {
  return [
    {
      name: "gtm_undo",
      description:
        "Undo the last mutation (create, update, delete, move) made to the container. Returns the previous state summary. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        if (!store.isLoaded) throw new ContainerNotLoadedError();
        const success = store.undo();
        if (!success) {
          throw new Error("Nothing to undo. No mutations have been made yet.");
        }
        return textResult({
          undone: true,
          current_state: store.state,
          undo_steps_remaining: store.undoSteps,
          redo_steps_available: store.redoSteps
        });
      }
    },
    {
      name: "gtm_redo",
      description:
        "Redo the last undone mutation. Returns the restored state summary. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        if (!store.isLoaded) throw new ContainerNotLoadedError();
        const success = store.redo();
        if (!success) {
          throw new Error("Nothing to redo. No undone mutations available.");
        }
        return textResult({
          redone: true,
          current_state: store.state,
          undo_steps_remaining: store.undoSteps,
          redo_steps_available: store.redoSteps
        });
      }
    }
  ];
}
