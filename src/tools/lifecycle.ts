import { z } from "zod";
import type { ContainerStore } from "../store";
import type { Tag, Trigger, Variable } from "../schemas/index";
import { resolveTriggerName, resolveFolderName } from "../utils/entity";
import { getTagTypeName } from "../utils/typeCodes";

// ---------------------------------------------------------------------------
// GTM Tag Firing Order Constants
// ---------------------------------------------------------------------------

/**
 * GTM evaluates tags in a deterministic order on each event:
 *
 * 1. Google tags (gaawe, googtag, ua, awct, gf, dbm, adm, dfa, rem) — sorted by tagId ascending
 * 2. Custom HTML tags (html) — sorted by tagId ascending
 * 3. Custom Image tags (img) — sorted by tagId ascending
 * 4. Custom Template tags (cvt_*) — sorted by tagId ascending
 *
 * Within each group, lower tagId fires first.
 * Tags can override this with "tagsToOverride" (fires after) and
 * "blockingTagId" (won't fire until the blocking tag completes).
 */
const FIRING_ORDER_GROUP_PRIORITY: Record<string, number> = {
  // Google tags fire first
  gaawe: 1, googtag: 1, ua: 1, awct: 1, gf: 1, dbm: 1, adm: 1, dfa: 1, rem: 1,
  // Custom HTML fires second
  html: 2,
  // Custom Image fires third
  img: 3,
  // Custom templates fire last
  cvt_: 4,
};

function getFiringGroup(tag: Tag): { group: string; priority: number } {
  const priority = FIRING_ORDER_GROUP_PRIORITY[tag.type] ?? FIRING_ORDER_GROUP_PRIORITY["cvt_"];
  const group = priority === 1 ? "google" : priority === 2 ? "custom_html" : priority === 3 ? "custom_image" : "custom_template";
  return { group, priority };
}

// ---------------------------------------------------------------------------
// Consent Mode Detection Helpers
// ---------------------------------------------------------------------------

/**
 * Consent Mode v2 requires these consent types to be managed:
 * - ad_storage (advertising cookies)
 * - analytics_storage (analytics cookies)
 * - functionality_storage
 * - personalization_storage
 * - security_storage (always granted, cannot be denied)
 *
 * Detection heuristics:
 * 1. Look for tags that call consent.update() or set consent state
 * 2. Look for variables referencing consent state (e.g., {{consent_status}}, {{cm_consent}})
 * 3. Look for blocking triggers that reference consent variables
 * 4. Look for consent initialization patterns (timer triggers, custom events for consent)
 */
const CONSENT_KEYWORDS = [
  "consent", "gdpr", "ccpa", "cmp", "consent_mode", "consentmode",
  "ad_storage", "analytics_storage", "functionality_storage",
  "personalization_storage", "security_storage",
  "grant", "deny", "default_consent", "update_consent",
  "google.consent", "consent.status", "data_layer_version",
];

/** Check if a string contains consent-related keywords (case-insensitive) */
function containsConsentKeyword(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase();
  return CONSENT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Recursively check all parameter values for consent keywords */
function hasConsentReferences(params: unknown[]): boolean {
  function walk(v: unknown): boolean {
    if (typeof v === "string") return containsConsentKeyword(v);
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === "object") return Object.values(v).some(walk);
    return false;
  }
  return params.some(walk);
}

/**
 * Detect if a trigger appears to be a consent-blocking trigger.
 * Heuristic: trigger name or filter references consent variables,
 * or trigger is used as a blocking trigger on data-collection tags.
 */
function isLikelyConsentBlockingTrigger(trigger: Trigger, store: ContainerStore): boolean {
  // Check trigger name for consent keywords
  if (containsConsentKeyword(trigger.name)) return true;

  // Check filter conditions for consent variable references
  if (Array.isArray(trigger.filter)) {
    for (const filt of trigger.filter) {
      if (Array.isArray(filt?.parameter)) {
        if (hasConsentReferences(filt.parameter)) return true;
      }
    }
  }

  // Check if used as blocking trigger on data-collection tags
  const dataCollectionTypes = ["gaawe", "googtag", "awct", "ua", "html", "img"];
  for (const tag of store.tags) {
    if (dataCollectionTypes.includes(tag.type) &&
        (tag.blockingTriggerId ?? []).includes(trigger.triggerId)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect if a tag appears to be a consent management tag.
 * Heuristic: tag parameters or name reference consent APIs.
 */
function isConsentManagementTag(tag: Tag): boolean {
  if (containsConsentKeyword(tag.name)) return true;
  if (Array.isArray(tag.parameter) && hasConsentReferences(tag.parameter)) return true;
  return false;
}

/**
 * Check if a variable appears to track consent state.
 */
function isConsentVariable(variable: Variable): boolean {
  if (containsConsentKeyword(variable.name)) return true;
  if (Array.isArray(variable.parameter) && hasConsentReferences(variable.parameter)) return true;
  return false;
}

/**
 * Extract sequencing dependencies from tag parameters.
 * Tags can specify "tagsToOverride" (fires after) via parameter key "tagsToOverride".
 */
function getSequencingDependencies(tag: Tag): { firesAfter: string[]; firesBefore: string[] } {
  const firesAfter: string[] = [];
  if (Array.isArray(tag.parameter)) {
    for (const param of tag.parameter) {
      if (param.key === "tagsToOverride" && typeof param.value === "string") {
        firesAfter.push(param.value);
      }
      if (param.key === "tagsToOverride" && Array.isArray(param.value)) {
        firesAfter.push(...param.value.filter((v) => typeof v === "string"));
      }
    }
  }
  // firesBefore is the inverse: tags that list this tag in their tagsToOverride
  // (computed at container level, not here)
  return { firesAfter, firesBefore: [] };
}

// ---------------------------------------------------------------------------
// Issue Classification
// ---------------------------------------------------------------------------

export interface LifecycleIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  affected_tags?: string[];
  affected_triggers?: string[];
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// Tool: gtm_analyze_tag_firing_order
// ---------------------------------------------------------------------------

function analyzeTagFiringOrder(store: ContainerStore) {
  const tags = store.tags.filter((t) => t.enabled !== false);
  const triggers = store.triggers;

  // Build inverse map: which tags fire before a given tag (via tagsToOverride)
  const firesBeforeMap = new Map<string, string[]>();
  for (const tag of store.tags) {
    const deps = getSequencingDependencies(tag);
    for (const afterId of deps.firesAfter) {
      if (!firesBeforeMap.has(afterId)) firesBeforeMap.set(afterId, []);
      firesBeforeMap.get(afterId)!.push(tag.tagId);
    }
  }

  // Sort tags by firing group priority, then by tagId within group
  const sorted = [...tags].sort((a, b) => {
    const aGroup = getFiringGroup(a);
    const bGroup = getFiringGroup(b);
    if (aGroup.priority !== bGroup.priority) return aGroup.priority - bGroup.priority;
    return Number(a.tagId) - Number(b.tagId);
  });

  // Detect sequencing conflicts: a tag with higher tagId fires before a tag with
  // lower tagId due to tagsToOverride, reversing natural order
  const sequencingConflicts: { tag: string; firesAfter: string }[] = [];
  for (const tag of store.tags) {
    const deps = getSequencingDependencies(tag);
    for (const afterId of deps.firesAfter) {
      const afterTag = store.tags.find((t) => t.tagId === afterId);
      if (afterTag) {
        const aGroup = getFiringGroup(tag);
        const bGroup = getFiringGroup(afterTag);
        // Natural order would put lower tagId first within same group
        if (aGroup.priority === bGroup.priority && Number(tag.tagId) < Number(afterTag.tagId)) {
          // This is fine — lower tagId fires first, and this tag fires after higher tagId
        } else if (aGroup.priority <= bGroup.priority && Number(tag.tagId) > Number(afterTag.tagId)) {
          // Potential conflict: this tag naturally fires later but must wait for an earlier tag
          sequencingConflicts.push({
            tag: tag.name,
            firesAfter: afterTag.name,
          });
        }
      }
    }
  }

  return {
    firing_order: sorted.map((tag, index) => {
      const { group } = getFiringGroup(tag);
      const deps = getSequencingDependencies(tag);
      const firesBefore = firesBeforeMap.get(tag.tagId) ?? [];
      return {
        position: index + 1,
        tag_id: tag.tagId,
        tag_name: tag.name,
        type: tag.type,
        type_name: getTagTypeName(tag.type),
        firing_group: group,
        fires_after: deps.firesAfter.map((id) => {
          const t = store.tags.find((tg) => tg.tagId === id);
          return t ? t.name : id;
        }),
        fires_before: firesBefore.map((id) => {
          const t = store.tags.find((tg) => tg.tagId === id);
          return t ? t.name : id;
        }),
        blocked_by_tag_ids: tag.blockingTagId ?? [],
        blocked_by_trigger_ids: tag.blockingTriggerId ?? [],
      };
    }),
    groups: {
      google: sorted.filter((t) => getFiringGroup(t).group === "google").length,
      custom_html: sorted.filter((t) => getFiringGroup(t).group === "custom_html").length,
      custom_image: sorted.filter((t) => getFiringGroup(t).group === "custom_image").length,
      custom_template: sorted.filter((t) => getFiringGroup(t).group === "custom_template").length,
    },
    sequencing_conflicts: sequencingConflicts,
    total_tags: sorted.length,
  };
}

// ---------------------------------------------------------------------------
// Tool: gtm_analyze_consent_setup
// ---------------------------------------------------------------------------

function analyzeConsentSetup(store: ContainerStore): {
  consent_detected: boolean;
  consent_management_tags: { tag_id: string; name: string; detection_reason: string }[];
  consent_variables: { variable_id: string; name: string; type: string }[];
  consent_blocking_triggers: { trigger_id: string; name: string; type: string; blocked_tags_count: number }[];
  consent_patterns: string[];
  issues: LifecycleIssue[];
  recommendation_summary: string;
} {
  const issues: LifecycleIssue[] = [];
  const consentPatterns: string[] = [];

  // 1. Detect consent management tags
  const consentTags = store.tags.filter(isConsentManagementTag);
  const consentManagementTags = consentTags.map((t) => ({
    tag_id: t.tagId,
    name: t.name,
    detection_reason: containsConsentKeyword(t.name) ? "tag_name" : "tag_parameters",
  }));

  // 2. Detect consent variables
  const consentVars = store.variables.filter(isConsentVariable);
  const consentVariables = consentVars.map((v) => ({
    variable_id: v.variableId,
    name: v.name,
    type: v.type,
  }));

  // 3. Detect consent blocking triggers
  const consentBlockingTriggers = store.triggers.filter((trigger) => isLikelyConsentBlockingTrigger(trigger, store)).map((t) => ({
    trigger_id: t.triggerId,
    name: t.name,
    type: t.type,
    blocked_tags_count: store.tags.filter((tag) =>
      (tag.blockingTriggerId ?? []).includes(t.triggerId)
    ).length,
  }));

  // 4. Determine if consent is detected at all
  const consentDetected = consentTags.length > 0 || consentVars.length > 0 || consentBlockingTriggers.length > 0;

  // 5. Detect specific consent patterns
  if (consentTags.length > 0) {
    consentPatterns.push("consent_management_tags");
  }
  if (consentVars.length > 0) {
    consentPatterns.push("consent_state_variables");
  }
  if (consentBlockingTriggers.length > 0) {
    consentPatterns.push("consent_blocking_triggers");
  }

  // Check for consent initialization trigger (timer-based or custom event on load)
  for (const trigger of consentBlockingTriggers) {
    const trig = store.triggers.find((t) => t.triggerId === trigger.trigger_id);
    if (trig && (trig.type === "timer" || trig.type === "custom")) {
      consentPatterns.push("consent_initialization");
      break;
    }
  }

  // 6. Analyze issues

  // ISSUE: No consent setup at all on a web container
  const isWebContainer = store.containerInfo.usageContext?.includes(1);
  if (isWebContainer && !consentDetected && store.tags.length > 0) {
    issues.push({
      severity: "warning",
      category: "consent_missing",
      message: "No consent management detected in a web container. If this site serves users in EEA/UK or under CCPA, Consent Mode v2 is required for Google tags.",
      recommendation: "Add a consent management tag (e.g., Google Consent Mode) and blocking triggers for data collection tags.",
    });
  }

  // ISSUE: Data collection tags without blocking triggers when consent exists
  if (consentDetected) {
    const unprotectedTags = store.tags.filter((tag) =>
      DATA_COLLECTION_TYPES.includes(tag.type) &&
      (tag.blockingTriggerId ?? []).length === 0 &&
      tag.enabled !== false
    );

    if (unprotectedTags.length > 0) {
      issues.push({
        severity: "critical",
        category: "unprotected_data_collection",
        message: `${unprotectedTags.length} data collection tag(s) have no blocking triggers despite consent management being present. These tags may fire before consent is granted.`,
        affected_tags: unprotectedTags.map((t) => t.name),
        recommendation: "Add a consent-blocking trigger to these tags to prevent firing before consent is granted.",
      });
    }
  }

  // ISSUE: Consent tags firing on All Pages without consent check
  if (consentDetected) {
    for (const consentTag of consentTags) {
      const firingTriggers = (consentTag.firingTriggerId ?? []).map((id) =>
        store.triggers.find((t) => t.triggerId === id)
      ).filter(Boolean) as Trigger[];

      // Check if consent tag fires on "All Pages" type trigger
      const firesOnAllPages = firingTriggers.some((t) => t.type === "pageview" && (!t.filter || t.filter.length === 0));
      if (firesOnAllPages) {
        issues.push({
          severity: "info",
          category: "consent_firing_scope",
          message: `Consent tag "${consentTag.name}" fires on all pages. This is typically correct for consent initialization, but verify it does not send data before consent.`,
          affected_tags: [consentTag.name],
        });
      }
    }
  }

  // ISSUE: Blocking triggers reference non-existent triggers
  for (const tag of store.tags) {
    for (const blockId of tag.blockingTriggerId ?? []) {
      if (!store.triggers.find((t) => t.triggerId === blockId)) {
        issues.push({
          severity: "critical",
          category: "orphaned_blocking_reference",
          message: `Tag "${tag.name}" references non-existent blocking trigger ID "${blockId}". This tag may never fire or behave unpredictably.`,
          affected_tags: [tag.name],
          recommendation: `Fix or remove the blocking trigger reference "${blockId}" on tag "${tag.name}".`,
        });
      }
    }
  }

  // ISSUE: Consent timing — consent tags should fire before data collection tags
  if (consentTags.length > 0) {
    for (const consentTag of consentTags) {
      const consentGroup = getFiringGroup(consentTag);
      for (const dataTag of store.tags) {
        if (DATA_COLLECTION_TYPES.includes(dataTag.type) && dataTag.tagId !== consentTag.tagId) {
          const dataGroup = getFiringGroup(dataTag);
          // If consent tag is in a later firing group than data collection tag
          if (consentGroup.priority > dataGroup.priority) {
            issues.push({
              severity: "warning",
              category: "consent_timing",
              message: `Consent tag "${consentTag.name}" (${consentGroup.group}) may fire after data collection tag "${dataTag.name}" (${dataGroup.group}). Consent should be set before data collection evaluates.`,
              affected_tags: [consentTag.name, dataTag.name],
              recommendation: "Move the consent tag to a higher-priority firing group (e.g., use a Google tag type or ensure lower tagId), or add sequencing.",
            });
          }
        }
      }
    }
  }

  // Build recommendation summary
  let recommendationSummary = "";
  if (!consentDetected) {
    recommendationSummary = "No consent management detected. Consider implementing Consent Mode v2 if your site serves users in regulated regions.";
  } else if (issues.some((i) => i.severity === "critical")) {
    recommendationSummary = "Consent management is partially configured but has critical issues. Review unprotected data collection tags and orphaned trigger references.";
  } else if (issues.length > 0) {
    recommendationSummary = "Consent management is configured with minor issues. Review timing and scope recommendations.";
  } else {
    recommendationSummary = "Consent management appears properly configured. All data collection tags have blocking triggers and consent tags fire in the correct lifecycle phase.";
  }

  return {
    consent_detected: consentDetected,
    consent_management_tags: consentManagementTags,
    consent_variables: consentVariables,
    consent_blocking_triggers: consentBlockingTriggers,
    consent_patterns: consentPatterns,
    issues,
    recommendation_summary: recommendationSummary,
  };
}

// ---------------------------------------------------------------------------
// Tool: gtm_get_tag_lifecycle
// ---------------------------------------------------------------------------

const DATA_COLLECTION_TYPES = ["gaawe", "googtag", "awct", "ua", "html", "img"];

function getTagLifecyclePhase(tag: Tag, store: ContainerStore): string {
  if (isConsentManagementTag(tag)) return "consent_management";
  if (DATA_COLLECTION_TYPES.includes(tag.type)) return "data_collection";
  return "other";
}

function getTagLifecycle(tag: Tag, store: ContainerStore): {
  tag_id: string;
  tag_name: string;
  tag_type: string;
  type_name: string;
  lifecycle_phase: string;
  enabled: boolean;
  firing_order: {
    group: string;
    priority: number;
    position_in_group: number;
  };
  triggers: {
    firing: { id: string; name: string }[];
    blocking: { id: string; name: string }[];
  };
  sequencing: {
    fires_after: string[];
    fires_before: string[];
  };
  consent_related: boolean;
  issues: LifecycleIssue[];
} {
  const issues: LifecycleIssue[] = [];
  const { group, priority } = getFiringGroup(tag);

  // Position within firing group
  const sameGroupTags = store.tags
    .filter((t) => getFiringGroup(t).group === group && t.enabled !== false)
    .sort((a, b) => Number(a.tagId) - Number(b.tagId));
  const positionInGroup = sameGroupTags.findIndex((t) => t.tagId === tag.tagId) + 1;

  // Sequencing
  const deps = getSequencingDependencies(tag);
  const firesBefore = store.tags.filter((t) => {
    const tDeps = getSequencingDependencies(t);
    return tDeps.firesAfter.includes(tag.tagId);
  }).map((t) => t.name);

  // Resolve trigger names
  const firingTriggers = (tag.firingTriggerId ?? []).map((id) => ({
    id,
    name: resolveTriggerName(id, store.triggers) ?? id,
  }));
  const blockingTriggers = (tag.blockingTriggerId ?? []).map((id) => ({
    id,
    name: resolveTriggerName(id, store.triggers) ?? id,
  }));

  // Per-tag issues
  const lifecyclePhase = getTagLifecyclePhase(tag, store);

  // Check: data collection tag with no blocking trigger in a consent-enabled container
  // Skip if the tag already has built-in consent gating (consentStatus !== "NOT_NEEDED")
  const tagHasConsentGating = tag.consentSettings?.consentStatus &&
    tag.consentSettings.consentStatus !== "NOT_NEEDED";

  const hasConsentSetup = store.tags.some(isConsentManagementTag) ||
    store.triggers.some((t) => isLikelyConsentBlockingTrigger(t, store)) ||
    store.variables.some(isConsentVariable);

  if (lifecyclePhase === "data_collection" && hasConsentSetup && blockingTriggers.length === 0 && !tagHasConsentGating) {
    issues.push({
      severity: "critical",
      category: "unprotected_data_collection",
      message: `This data collection tag has no blocking triggers in a consent-enabled container. It may fire before consent is granted.`,
      recommendation: "Add a consent-blocking trigger.",
    });
  }

  // Check: firing trigger references
  for (const ft of firingTriggers) {
    if (!store.triggers.find((t) => t.triggerId === ft.id)) {
      issues.push({
        severity: "critical",
        category: "orphaned_firing_reference",
        message: `Firing trigger ID "${ft.id}" does not exist in the container.`,
        recommendation: "Fix the trigger reference.",
      });
    }
  }

  // Check: blocking trigger references
  for (const bt of blockingTriggers) {
    if (!store.triggers.find((t) => t.triggerId === bt.id)) {
      issues.push({
        severity: "critical",
        category: "orphaned_blocking_reference",
        message: `Blocking trigger ID "${bt.id}" does not exist in the container.`,
        recommendation: "Fix the trigger reference.",
      });
    }
  }

  // Check: no firing triggers
  if (firingTriggers.length === 0) {
    issues.push({
      severity: "warning",
      category: "no_firing_triggers",
      message: "This tag has no firing triggers configured. It will never fire.",
      recommendation: "Add at least one firing trigger.",
    });
  }

  // Check: disabled tag
  if (tag.enabled === false) {
    issues.push({
      severity: "info",
      category: "disabled_tag",
      message: "This tag is disabled and will not fire.",
    });
  }

  // Check: consent tag firing after data collection
  if (lifecyclePhase === "consent_management") {
    for (const dcTag of store.tags) {
      if (getTagLifecyclePhase(dcTag, store) === "data_collection") {
        const dcGroup = getFiringGroup(dcTag);
        if (priority > dcGroup.priority) {
          issues.push({
            severity: "warning",
            category: "consent_timing",
            message: `This consent tag fires in group "${group}" after data collection tag "${dcTag.name}" in group "${dcGroup.group}".`,
            recommendation: "Ensure consent is set before data collection tags evaluate.",
          });
        }
      }
    }
  }

  return {
    tag_id: tag.tagId,
    tag_name: tag.name,
    tag_type: tag.type,
    type_name: getTagTypeName(tag.type),
    lifecycle_phase: lifecyclePhase,
    enabled: tag.enabled !== false,
    firing_order: {
      group,
      priority,
      position_in_group: positionInGroup,
    },
    triggers: {
      firing: firingTriggers,
      blocking: blockingTriggers,
    },
    sequencing: {
      fires_after: deps.firesAfter.map((id) => {
        const t = store.tags.find((tg) => tg.tagId === id);
        return t ? t.name : id;
      }),
      fires_before: firesBefore,
    },
    consent_related: isConsentManagementTag(tag) || tagHasConsentGating || blockingTriggers.some((bt) => {
      const trig = store.triggers.find((t) => t.triggerId === bt.id);
      return trig && isLikelyConsentBlockingTrigger(trig, store);
    }),
    consent_settings: tag.consentSettings ?? null,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerLifecycleTools(store: ContainerStore) {
  return [
    {
      name: "gtm_analyze_tag_firing_order",
      description:
        "Analyze the deterministic tag firing order for the loaded container. Reports the evaluation sequence (Google tags → Custom HTML → Custom Image → Custom Templates), position within each group, sequencing dependencies (fires after/before), and potential ordering conflicts. Critical for understanding consent timing and tag execution order. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const result = analyzeTagFiringOrder(store);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    },
    {
      name: "gtm_analyze_consent_setup",
      description:
        "Analyze the container's consent management configuration. Detects consent management tags, consent state variables, consent blocking triggers, and consent initialization patterns. Reports issues like unprotected data collection tags, consent timing problems, orphaned blocking references, and missing consent setup. Issues are classified as critical/warning/info with recommendations. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const result = analyzeConsentSetup(store);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    },
    {
      name: "gtm_get_tag_lifecycle",
      description:
        "Get detailed lifecycle analysis for a specific tag. Reports the lifecycle phase (consent_management, data_collection, other), firing order position, trigger configuration, sequencing dependencies, consent relationships, and per-tag issues. Use to debug why a specific tag might fire at the wrong time or violate consent requirements. Requires a loaded container.",
      parameters: z.object({
        tag_id: z.string().optional().describe("Tag ID to analyze"),
        name: z.string().optional().describe("Tag name to analyze (alternative to tag_id)"),
      }),
      handler: async ({ tag_id, name }: { tag_id?: string; name?: string }) => {
        let tag: Tag | undefined;
        if (tag_id) {
          tag = store.tags.find((t) => t.tagId === tag_id);
        } else if (name) {
          tag = store.tags.find((t) => t.name === name);
        }
        if (!tag) {
          throw new Error(`Tag not found. Provided: tag_id=${tag_id ?? "none"}, name=${name ?? "none"}`);
        }
        const result = getTagLifecycle(tag, store);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    },
  ];
}

// Export helpers for testing
export {
  getFiringGroup,
  isConsentManagementTag,
  isConsentVariable,
  isLikelyConsentBlockingTrigger,
  getSequencingDependencies,
  getTagLifecyclePhase,
  analyzeTagFiringOrder,
  analyzeConsentSetup,
  getTagLifecycle,
};
