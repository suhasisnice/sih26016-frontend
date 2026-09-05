// Served as a static asset from public/docs — see public/docs/bhoomimitra-about.pdf.
export const ABOUT_PDF_URL = '/docs/bhoomimitra-about.pdf';

// The Mantra fingerprint kiosk agent — see mantra-agent/ at the repo root.
// It runs on the SAME machine as the browser, never through the backend,
// which is why this is a separate origin rather than another VITE_API_URL
// route. Only ever reachable at all on a kiosk PC with the agent actually
// installed and running; everywhere else a fetch to this simply fails,
// which is exactly why "unlock through fingerprint" is a fallback link and
// never the default view.
export const KIOSK_AGENT_URL = import.meta.env.VITE_KIOSK_AGENT_URL || 'http://127.0.0.1:8791';
