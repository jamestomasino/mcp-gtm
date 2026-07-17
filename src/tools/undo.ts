import { z } from "zod";
import type { ContainerStore } from "../store";

export function registerUndoTools(store: ContainerStore) {
  return [
    {
      name: "gtm_undo",
      description:
        "Undo the last mutation (create, update, delete, move) made to the container. Returns the previous state summary. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const success = store.undo();
        if (!success) {
          throw new Error("Nothing to undo. No mutations have been made yet.");
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  undone: true,
                  current_state: store.state,
                  undo_steps_remaining: store.undoSteps,
                  redo_steps_available: store.redoSteps
                },
                null,
                2
              )
            }
          ]
        };
      }
    },
    {
      name: "gtm_redo",
      description:
        "Redo the last undone mutation. Returns the restored state summary. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const success = store.redo();
        if (!success) {
          throw new Error("Nothing to redo. No undone mutations available.");
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  redone: true,
                  current_state: store.state,
                  undo_steps_remaining: store.undoSteps,
                  redo_steps_available: store.redoSteps
                },
                null,
                2
              )
            }
          ]
        };
      }
    }
  ];
}
