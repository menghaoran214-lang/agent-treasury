import zhCN from './zh-CN.json';
import en from './en.json';

export type Lang = 'zh-CN' | 'en';
export type TranslationKey = string;

const translations: Record<Lang, typeof zhCN> = { 'zh-CN': zhCN, en };

function getNested(obj: any, path: string): string {
  // The dictionaries contain both nested namespaces and legacy dotted keys
  // (for example setup -> "section.strategy"). Consume the longest matching
  // segment at each level so both shapes resolve without duplicating strings.
  let cursor = obj;
  let parts = path.split('.');
  while (parts.length > 0) {
    let matched = false;
    for (let end = parts.length; end > 0; end -= 1) {
      const key = parts.slice(0, end).join('.');
      if (cursor?.[key] !== undefined) {
        cursor = cursor[key];
        parts = parts.slice(end);
        matched = true;
        break;
      }
    }
    if (!matched) return path;
  }
  return typeof cursor === 'string' ? cursor : path;
}

function detectLang(): Lang {
  const stored = localStorage.getItem('treasury-lang') as Lang | null;
  if (stored && (stored === 'zh-CN' || stored === 'en')) return stored;
  const nav = navigator.language || '';
  if (/^zh(?:-|_|$)/i.test(nav) || /中文/.test(nav)) return 'zh-CN';
  return 'en';
}

let currentLang: Lang = detectLang();
const listeners = new Set<() => void>();

export const i18n = {
  get lang() { return currentLang; },
  setLang(lang: Lang) {
    currentLang = lang;
    localStorage.setItem('treasury-lang', lang);
    listeners.forEach(fn => fn());
  },
  t(key: string, params?: Record<string, string | number>): string {
    let text = getNested(translations[currentLang], key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
