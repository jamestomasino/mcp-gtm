/**
 * Maps GTM type codes to human-readable names.
 */

export const TAG_TYPE_NAMES: Record<string, string> = {
  gaawe: "GA4 Event",
  googtag: "Google Tag",
  html: "Custom HTML",
  ua: "Universal Analytics",
  awct: "Ads Conversion Tracking",
  img: "Custom Image",
  gf: "Google Floodlight",
  dbm: "DoubleClick Studio",
  adm: "Ad Manager",
  dfa: "DoubleClick for Publishers",
  rem: "Remarketing"
};

export const TRIGGER_TYPE_NAMES: Record<string, string> = {
  pageview: "Page View",
  click: "Click",
  form: "Form Submission",
  scroll: "Scroll",
  timer: "Timer",
  custom: "Custom Event",
  historyChange: "History Change",
  domReady: "DOM Ready",
  error: "Error",
  video: "YouTube Video",
  impression: "Impression"
};

export const VARIABLE_TYPE_NAMES: Record<string, string> = {
  v: "Data Layer Variable",
  u: "URL",
  jsm: "Custom JavaScript",
  smm: "Lookup Table",
  remm: "RegEx Table",
  c: "Constant",
  k: "Cookie",
  d: "DOM Element",
  gas: "GA Settings",
  mm: "Monarch"
};

/** Get human-readable name for a tag type */
export function getTagTypeName(type: string): string {
  return TAG_TYPE_NAMES[type] ?? type;
}

/** Get human-readable name for a trigger type */
export function getTriggerTypeName(type: string): string {
  return TRIGGER_TYPE_NAMES[type] ?? type;
}

/** Get human-readable name for a variable type */
export function getVariableTypeName(type: string): string {
  return VARIABLE_TYPE_NAMES[type] ?? type;
}

/** Resolve usage context numbers to platform names */
export const USAGE_CONTEXT_NAMES: Record<number, string> = {
  1: "Web",
  2: "Server-Side",
  3: "Android",
  4: "iOS"
};

export function getUsageContextNames(contexts: (number | string)[]): string[] {
  return contexts.map((c) =>
    typeof c === "number" ? (USAGE_CONTEXT_NAMES[c] ?? String(c)) : String(c)
  );
}
