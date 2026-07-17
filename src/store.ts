import { readFileSync, writeFileSync } from "node:fs";
import { GtmExportSchema } from "./schemas/export";
import type {
  BuiltInVariable,
  Client,
  CustomTemplate,
  Folder,
  GtmExport,
  Tag,
  Transformation,
  Trigger,
  Variable,
  Zone
} from "./schemas/index";
import { TagSchema } from "./schemas/tag";
import { TriggerSchema } from "./schemas/trigger";
import { VariableSchema } from "./schemas/variable";
import { nextId } from "./utils/entity";

/**
 * ContainerStore — in-memory state for a loaded GTM container.
 * Provides load, CRUD, and export operations with Zod validation.
 */
export class ContainerStore {
  private _data: GtmExport | null = null;
  private _sourcePath: string | null = null;
  private _undoStack: GtmExport[] = [];
  private _redoStack: GtmExport[] = [];
  private readonly MAX_UNDO = 50;

  /** Whether a container is currently loaded */
  get isLoaded(): boolean {
    return this._data !== null;
  }

  /** The source file path, if loaded from file */
  get sourcePath(): string | null {
    return this._sourcePath;
  }

  /** Number of undo steps available */
  get undoSteps(): number {
    return this._undoStack.length;
  }

  /** Number of redo steps available */
  get redoSteps(): number {
    return this._redoStack.length;
  }

  /** Load a container from a JSON file path */
  load(filePath: string): void {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    // Normalize workspace exports: entities may sit at containerVersion level
    // instead of inside containerVersion.container
    const cv = parsed.containerVersion;
    const container = cv?.container;
    const entityMap: Array<[string, string]> = [
      ["tag", "tag"],
      ["trigger", "trigger"],
      ["userDefinedVariable", "userDefinedVariable"],
      ["variable", "userDefinedVariable"], // workspace exports use "variable"
      ["folder", "folder"],
      ["builtInVariable", "builtInVariable"],
      ["zone", "zone"],
      ["client", "client"],
      ["transformation", "transformation"],
      ["customTemplate", "customTemplate"]
    ];
    if (cv && container) {
      for (const [srcKey, dstKey] of entityMap) {
        if (cv[srcKey] && !(dstKey in container)) {
          (container as any)[dstKey] = cv[srcKey];
        }
      }
    }

    const result = GtmExportSchema.safeParse(parsed);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid GTM container JSON: ${errors}`);
    }

    this._data = result.data;
    this._sourcePath = filePath;
    // Clear undo/redo stacks on load
    this._undoStack = [];
    this._redoStack = [];
  }

  /** Get the full export data (throws if not loaded) */
  get data(): GtmExport {
    this.assertLoaded();
    return this._data!;
  }

  /** Get tags */
  get tags(): Tag[] {
    return this.data.containerVersion.container.tag ?? [];
  }

  /** Get triggers */
  get triggers(): Trigger[] {
    return this.data.containerVersion.container.trigger ?? [];
  }

  /** Get user-defined variables */
  get variables(): Variable[] {
    return this.data.containerVersion.container.userDefinedVariable ?? [];
  }

  /** Get folders */
  get folders(): Folder[] {
    return this.data.containerVersion.container.folder ?? [];
  }

  /** Get built-in variables */
  get builtInVariables(): BuiltInVariable[] {
    return this.data.containerVersion.container.builtInVariable ?? [];
  }

  /** Get zones (server-side GTM) */
  get zones(): Zone[] {
    return this.data.containerVersion.container.zone ?? [];
  }

  /** Get clients (server-side GTM) */
  get clients(): Client[] {
    return this.data.containerVersion.container.client ?? [];
  }

  /** Get transformations (server-side GTM) */
  get transformations(): Transformation[] {
    return this.data.containerVersion.container.transformation ?? [];
  }

  /** Get custom templates */
  get customTemplates(): CustomTemplate[] {
    return this.data.containerVersion.container.customTemplate ?? [];
  }

  /** Get container metadata */
  get containerInfo() {
    const cv = this.data.containerVersion;
    const container = cv.container;
    return {
      accountId: cv.accountId,
      containerId: cv.containerId,
      containerVersionId: cv.containerVersionId ?? null,
      name: container.name,
      description: container.description ?? null,
      usageContext: container.usageContext ?? [],
      defaultTimezone: container.defaultTimezone ?? null
    };
  }

  /** Get summary counts */
  get state() {
    return {
      tags: this.tags.length,
      triggers: this.triggers.length,
      variables: this.variables.length,
      folders: this.folders.length,
      builtInVariables: this.builtInVariables.length,
      zones: this.zones.length,
      clients: this.clients.length,
      transformations: this.transformations.length,
      customTemplates: this.customTemplates.length
    };
  }

  /** Create a tag (validates, auto-assigns tagId) */
  createTag(tag: Omit<Tag, "tagId"> & { tagId?: string }): Tag {
    this.snapshot();
    const allIds = [
      ...this.tags.map((t) => t.tagId),
      ...this.triggers.map((t) => t.triggerId),
      ...this.variables.map((v) => v.variableId)
    ];
    const newId = tag.tagId ?? nextId(allIds);

    const newTag: Tag = { tagId: newId, ...tag } as Tag;
    const result = TagSchema.safeParse(newTag);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid tag: ${errors}`);
    }

    this.data.containerVersion.container.tag = [...this.tags, result.data];
    return result.data;
  }

  /** Create a trigger (validates, auto-assigns triggerId) */
  createTrigger(
    trigger: Omit<Trigger, "triggerId"> & { triggerId?: string }
  ): Trigger {
    this.snapshot();
    const allIds = [
      ...this.tags.map((t) => t.tagId),
      ...this.triggers.map((t) => t.triggerId),
      ...this.variables.map((v) => v.variableId)
    ];
    const newId = trigger.triggerId ?? nextId(allIds);

    const newTrigger: Trigger = { triggerId: newId, ...trigger } as Trigger;
    const result = TriggerSchema.safeParse(newTrigger);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid trigger: ${errors}`);
    }

    this.data.containerVersion.container.trigger = [
      ...this.triggers,
      result.data
    ];
    return result.data;
  }

  /** Create a variable (validates, auto-assigns variableId) */
  createVariable(
    variable: Omit<Variable, "variableId"> & { variableId?: string }
  ): Variable {
    this.snapshot();
    const allIds = [
      ...this.tags.map((t) => t.tagId),
      ...this.triggers.map((t) => t.triggerId),
      ...this.variables.map((v) => v.variableId)
    ];
    const newId = variable.variableId ?? nextId(allIds);

    const newVariable: Variable = {
      variableId: newId,
      ...variable
    } as Variable;
    const result = VariableSchema.safeParse(newVariable);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid variable: ${errors}`);
    }

    this.data.containerVersion.container.userDefinedVariable = [
      ...this.variables,
      result.data
    ];
    return result.data;
  }

  /** Update a tag by ID */
  updateTag(tagId: string, updates: Partial<Tag>): Tag {
    this.snapshot();
    const index = this.tags.findIndex((t) => t.tagId === tagId);
    if (index === -1) throw new Error(`Tag not found: ${tagId}`);

    const updated = {
      ...this.tags[index],
      ...updates,
      tagId: this.tags[index].tagId
    };
    const result = TagSchema.safeParse(updated);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid tag: ${errors}`);
    }

    this.data.containerVersion.container.tag = [
      ...this.tags.slice(0, index),
      result.data,
      ...this.tags.slice(index + 1)
    ];
    return result.data;
  }

  /** Update a trigger by ID */
  updateTrigger(triggerId: string, updates: Partial<Trigger>): Trigger {
    this.snapshot();
    const index = this.triggers.findIndex((t) => t.triggerId === triggerId);
    if (index === -1) throw new Error(`Trigger not found: ${triggerId}`);

    const updated = {
      ...this.triggers[index],
      ...updates,
      triggerId: this.triggers[index].triggerId
    };
    const result = TriggerSchema.safeParse(updated);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid trigger: ${errors}`);
    }

    this.data.containerVersion.container.trigger = [
      ...this.triggers.slice(0, index),
      result.data,
      ...this.triggers.slice(index + 1)
    ];
    return result.data;
  }

  /** Update a variable by ID */
  updateVariable(variableId: string, updates: Partial<Variable>): Variable {
    this.snapshot();
    const index = this.variables.findIndex((v) => v.variableId === variableId);
    if (index === -1) throw new Error(`Variable not found: ${variableId}`);

    const updated = {
      ...this.variables[index],
      ...updates,
      variableId: this.variables[index].variableId
    };
    const result = VariableSchema.safeParse(updated);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new Error(`Invalid variable: ${errors}`);
    }

    this.data.containerVersion.container.userDefinedVariable = [
      ...this.variables.slice(0, index),
      result.data,
      ...this.variables.slice(index + 1)
    ];
    return result.data;
  }

  /** Delete a tag by ID */
  deleteTag(tagId: string): boolean {
    const index = this.tags.findIndex((t) => t.tagId === tagId);
    if (index === -1) return false;
    this.snapshot();
    this.data.containerVersion.container.tag = [
      ...this.tags.slice(0, index),
      ...this.tags.slice(index + 1)
    ];
    return true;
  }

  /** Delete a trigger by ID */
  deleteTrigger(triggerId: string): boolean {
    const index = this.triggers.findIndex((t) => t.triggerId === triggerId);
    if (index === -1) return false;
    this.snapshot();
    this.data.containerVersion.container.trigger = [
      ...this.triggers.slice(0, index),
      ...this.triggers.slice(index + 1)
    ];
    return true;
  }

  /** Delete a variable by ID */
  deleteVariable(variableId: string): boolean {
    const index = this.variables.findIndex((v) => v.variableId === variableId);
    if (index === -1) return false;
    this.snapshot();
    this.data.containerVersion.container.userDefinedVariable = [
      ...this.variables.slice(0, index),
      ...this.variables.slice(index + 1)
    ];
    return true;
  }

  /** Export current state to a JSON file */
  exportTo(filePath: string): void {
    writeFileSync(filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  /** Full Zod validation — returns all issues */
  validate(): string[] {
    const result = GtmExportSchema.safeParse(this.data);
    if (result.success) return [];
    return result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  }

  /** Create a folder */
  createFolder(
    name: string,
    notes?: string
  ): { folderId: string; name: string; tagId: string[] } {
    this.snapshot();
    const allIds = [
      ...this.tags.map((t) => t.tagId),
      ...this.triggers.map((t) => t.triggerId),
      ...this.variables.map((v) => v.variableId),
      ...this.folders.map((f) => f.folderId)
    ];
    const newId = nextId(allIds);
    const folder = { folderId: newId, name, tagId: [], notes };
    this.data.containerVersion.container.folder = [...this.folders, folder];
    return folder;
  }

  /** Delete a folder by ID */
  deleteFolder(folderId: string): boolean {
    const index = this.folders.findIndex((f) => f.folderId === folderId);
    if (index === -1) return false;
    this.snapshot();
    this.data.containerVersion.container.folder = [
      ...this.folders.slice(0, index),
      ...this.folders.slice(index + 1)
    ];
    return true;
  }

  /** Move a tag to a folder (or unassign by passing null) */
  moveTagToFolder(tagId: string, folderId: string | null): boolean {
    const index = this.tags.findIndex((t) => t.tagId === tagId);
    if (index === -1) return false;
    this.snapshot();
    const updated = {
      ...this.tags[index],
      parentFolderId: folderId ?? undefined
    };
    this.data.containerVersion.container.tag = [
      ...this.tags.slice(0, index),
      updated,
      ...this.tags.slice(index + 1)
    ];

    // Update folder membership
    if (folderId) {
      const folderIndex = this.folders.findIndex(
        (f) => f.folderId === folderId
      );
      if (folderIndex !== -1) {
        const folder = {
          ...this.folders[folderIndex],
          tagId: [...(this.folders[folderIndex].tagId ?? []), tagId]
        };
        this.data.containerVersion.container.folder = [
          ...this.folders.slice(0, folderIndex),
          folder,
          ...this.folders.slice(folderIndex + 1)
        ];
      }
    } else {
      // Remove from any folder
      this.folders.forEach((f, fi) => {
        if (f.tagId?.includes(tagId)) {
          const updated = { ...f, tagId: f.tagId.filter((id) => id !== tagId) };
          this.data.containerVersion.container.folder = [
            ...this.folders.slice(0, fi),
            updated,
            ...this.folders.slice(fi + 1)
          ];
        }
      });
    }
    return true;
  }

  /** Move a trigger to a folder (or unassign by passing null) */
  moveTriggerToFolder(triggerId: string, folderId: string | null): boolean {
    const index = this.triggers.findIndex((t) => t.triggerId === triggerId);
    if (index === -1) return false;
    this.snapshot();
    const updated = {
      ...this.triggers[index],
      parentFolderId: folderId ?? undefined
    };
    this.data.containerVersion.container.trigger = [
      ...this.triggers.slice(0, index),
      updated,
      ...this.triggers.slice(index + 1)
    ];
    return true;
  }

  /** Move a variable to a folder (or unassign by passing null) */
  moveVariableToFolder(variableId: string, folderId: string | null): boolean {
    const index = this.variables.findIndex((v) => v.variableId === variableId);
    if (index === -1) return false;
    this.snapshot();
    const updated = {
      ...this.variables[index],
      parentFolderId: folderId ?? undefined
    };
    this.data.containerVersion.container.userDefinedVariable = [
      ...this.variables.slice(0, index),
      updated,
      ...this.variables.slice(index + 1)
    ];
    return true;
  }

  private assertLoaded(): void {
    if (!this._data) {
      throw new Error("No container loaded. Call gtm_load_container first.");
    }
  }

  /** Snapshot current state for undo */
  private snapshot(): void {
    if (!this._data) return;
    this._undoStack.push(JSON.parse(JSON.stringify(this._data)));
    if (this._undoStack.length > this.MAX_UNDO) {
      this._undoStack.shift();
    }
    // Clear redo stack on new mutation
    this._redoStack = [];
  }

  /** Undo the last mutation */
  undo(): boolean {
    if (this._undoStack.length === 0) return false;
    this._redoStack.push(JSON.parse(JSON.stringify(this._data!)));
    this._data = this._undoStack.pop()!;
    return true;
  }

  /** Redo the last undone mutation */
  redo(): boolean {
    if (this._redoStack.length === 0) return false;
    this._undoStack.push(JSON.parse(JSON.stringify(this._data!)));
    this._data = this._redoStack.pop()!;
    return true;
  }
}
