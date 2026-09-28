/** Routes that show the mobile intent dock (catalogue home + API subpages). */
const INTENT_DOCK_PATTERNS = [
  /^\/$/,
  /^\/browse(\/|$)/,
  /^\/apis(\/|$)/,
  /^\/keys\/?$/,
  /^\/setup\//,
];

export function isIntentDockRoute(pathname = "") {
  return INTENT_DOCK_PATTERNS.some((pattern) => pattern.test(pathname));
}
