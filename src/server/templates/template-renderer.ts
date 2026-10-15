/**
 * 範本變數替換（純函式）。
 * 以 {變數} 標示；未提供值之變數保留原樣，並回報缺漏清單，方便使用者補齊。
 */
export type TemplateVars = Record<string, string | null | undefined>;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** 可為空白的選用變數：沒有值時直接省略，不視為缺漏 */
const OPTIONAL_VARS = new Set(["eventDayWord", "notificationRoundText", "eventLocationText"]);

export function renderTemplate(text: string, vars: TemplateVars, options: { keep?: string[] } = {}) {
  const missing = new Set<string>();
  const keep = new Set(options.keep ?? []);
  const rendered = text.replace(PLACEHOLDER, (match, key: string) => {
    if (keep.has(key)) return match;
    const v = vars[key];
    if (v === undefined || v === null || v === "") {
      if (OPTIONAL_VARS.has(key)) return "";
      missing.add(key);
      return match;
    }
    return v;
  });
  return { text: rendered, missing: [...missing] };
}

export function listPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}
