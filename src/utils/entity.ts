/**
 * Entity resolution helpers — used by tools to resolve IDs to names.
 */

/** Resolve a trigger ID to its name from the trigger list */
export function resolveTriggerName(
  triggerId: string,
  triggers: { triggerId: string; name: string }[]
): string | null {
  const trigger = triggers.find((t) => t.triggerId === triggerId);
  return trigger?.name ?? null;
}

/** Resolve a folder ID to its name from the folder list */
export function resolveFolderName(
  folderId: string | undefined,
  folders: { folderId: string; name: string }[]
): string | null {
  if (!folderId) return null;
  const folder = folders.find((f) => f.folderId === folderId);
  return folder?.name ?? null;
}

/** Resolve multiple trigger IDs to names */
export function resolveTriggerNames(
  triggerIds: string[],
  triggers: { triggerId: string; name: string }[]
): string[] {
  return triggerIds.map((id) => resolveTriggerName(id, triggers) ?? id);
}

/** Generate the next available ID based on existing IDs */
export function nextId(ids: string[]): string {
  const maxId = ids.reduce((max, id) => {
    const num = Number(id);
    return num > max ? num : max;
  }, 0);
  return String(maxId + 1);
}
