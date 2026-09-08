import { createContext, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

/* Hand-rolled rather than react-i18next: this app has no component
   library and no form library either (CLAUDE.md 2, rule 8), and a
   dictionary lookup plus a locale switch is the whole of what a
   two-language build needs. Adding a library here would be exactly the
   kind of dependency that rule already argues against elsewhere.

   Scope, stated plainly rather than left to be discovered: only the
   public-facing surface (Landing, the notice board and citizen lookup,
   Login, and the shared public header/footer) is translated today. The
   authenticated officer workspace stays English-only — this is a
   national platform whose most-visited screens are the ones a citizen
   with no account reaches, which is where a second language earns the
   most; officers are trained users signing in through an invitation code,
   not the audience the "multilingual support" line in the problem
   statement is written for. A key with no translation for the active
   locale falls back to English rather than rendering blank or a raw key
   — see t() below — so widening this scope later means adding entries,
   never restructuring anything that already renders. */

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const STORAGE_KEY = 'bhoomimitra.locale';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LOCALES.some((l) => l.code === stored) ? stored : 'en';
  } catch {
    // Private browsing / storage disabled — English, same as a first visit.
    return 'en';
  }
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  function setLocale(code) {
    setLocaleState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* Nothing to do — the choice just won't survive a reload. */
    }
  }

  const value = useMemo(() => {
    // A handful of entries (a count baked into a sentence, a copyright
    // year) are functions instead of plain strings — args here are
    // forwarded to one of those; a plain-string key ignores them.
    function t(key, ...args) {
      const resolved = lookup(translations[locale], key) ?? lookup(translations.en, key);
      if (resolved === undefined) {
        // Neither locale has it — a missing key is a bug to notice during
        // review, not something to hide behind a silently blank string.
        return key;
      }
      return typeof resolved === 'function' ? resolved(...args) : resolved;
    }
    return { locale, setLocale, locales: LOCALES, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
