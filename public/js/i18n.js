/**
 * CivicResolve - Multi-Language i18n Engine
 * Supports 12 languages with compact native names and RTL layout for Urdu.
 */

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', script: 'Latn', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', script: 'Deva', dir: 'ltr' },
  { code: 'bn', name: 'বাংলা', script: 'Beng', dir: 'ltr' },
  { code: 'te', name: 'తెలుగు', script: 'Telu', dir: 'ltr' },
  { code: 'mr', name: 'मराठी', script: 'Deva', dir: 'ltr' },
  { code: 'ta', name: 'தமிழ்', script: 'Taml', dir: 'ltr' },
  { code: 'ur', name: 'اردو', script: 'Arab', dir: 'rtl' },
  { code: 'gu', name: 'ગુજરાતી', script: 'Gujr', dir: 'ltr' },
  { code: 'kn', name: 'ಕನ್ನಡ', script: 'Knda', dir: 'ltr' },
  { code: 'ml', name: 'മലയാളം', script: 'Mlym', dir: 'ltr' },
  { code: 'or', name: 'ଓଡ଼ିଆ', script: 'Orya', dir: 'ltr' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', script: 'Guru', dir: 'ltr' }
];

const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'civicresolve_lang';

// In-memory cache for translations
const translationCache = {};
let currentTranslations = {};
let currentLangCode = DEFAULT_LANG;

/**
 * Resolve a nested key like "home.hero_title" from the dictionary
 */
function getNestedValue(obj, keyPath) {
  if (!obj || !keyPath) return null;
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Public translation function
 */
window.t = function(keyPath, fallback = '') {
  const val = getNestedValue(currentTranslations, keyPath);
  if (val !== null && val !== undefined) return val;
  if (translationCache['en']) {
    const enVal = getNestedValue(translationCache['en'], keyPath);
    if (enVal !== null && enVal !== undefined) return enVal;
  }
  return fallback || keyPath;
};

/**
 * Load translation JSON from /locales/{lang}.json
 */
async function loadTranslation(lang) {
  if (translationCache[lang]) {
    return translationCache[lang];
  }
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load translations for ${lang}`);
    }
    const data = await res.json();
    translationCache[lang] = data;
    return data;
  } catch (err) {
    console.warn(`Translation fetch error for ${lang}:`, err);
    if (lang !== DEFAULT_LANG) {
      return loadTranslation(DEFAULT_LANG);
    }
    return {};
  }
}

/**
 * Apply translations to DOM elements with data-i18n attributes
 */
function applyTranslations() {
  // Translate inner text
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = window.t(key);
    if (text) {
      el.textContent = text;
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = window.t(key);
    if (text) {
      el.setAttribute('placeholder', text);
    }
  });

  // Translate titles
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const text = window.t(key);
    if (text) {
      el.setAttribute('title', text);
    }
  });

  // Translate aria-labels
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const text = window.t(key);
    if (text) {
      el.setAttribute('aria-label', text);
    }
  });

  // Translate select options
  document.querySelectorAll('option[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = window.t(key);
    if (text) {
      el.textContent = text;
    }
  });

  // Update page title
  const pageTitleEl = document.querySelector('[data-i18n-page-title]');
  if (pageTitleEl) {
    const key = pageTitleEl.getAttribute('data-i18n-page-title');
    const text = window.t(key);
    if (text) {
      document.title = `${text} | CivicResolve`;
    }
  }
}

/**
 * Change the active language
 */
window.setLanguage = async function(langCode) {
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode) || SUPPORTED_LANGUAGES[0];
  currentLangCode = langConfig.code;

  // Update HTML attributes for language and text direction (RTL for Urdu)
  document.documentElement.lang = currentLangCode;
  document.documentElement.dir = langConfig.dir;
  document.documentElement.setAttribute('data-script', langConfig.script);

  // Store in localStorage
  try {
    localStorage.setItem(STORAGE_KEY, currentLangCode);
  } catch (e) {}

  // Load translations & apply
  currentTranslations = await loadTranslation(currentLangCode);
  applyTranslations();

  // Sync all language switcher select elements on page
  const switchers = document.querySelectorAll('.lang-switcher-select');
  switchers.forEach((select) => {
    select.value = currentLangCode;
  });

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent('civicresolve:langchange', {
    detail: { lang: currentLangCode, config: langConfig }
  }));
};

/**
 * Setup mobile hamburger menu toggle
 */
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('mobileNav');
  if (!btn || !nav) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = nav.classList.toggle('is-open');
    btn.classList.toggle('is-active', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close when tapping outside or clicking a nav link
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('is-open');
      btn.classList.remove('is-active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  nav.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      btn.classList.remove('is-active');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Initialize language engine on page load
 */
async function initI18n() {
  loadTranslation('en');

  let savedLang = null;
  try {
    savedLang = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}

  if (!savedLang || !SUPPORTED_LANGUAGES.some((l) => l.code === savedLang)) {
    savedLang = DEFAULT_LANG;
  }

  // Populate dropdowns with compact native names
  const switchers = document.querySelectorAll('.lang-switcher-select');
  switchers.forEach((select) => {
    select.innerHTML = '';
    SUPPORTED_LANGUAGES.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === savedLang) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      window.setLanguage(e.target.value);
    });
  });

  initMobileMenu();
  await window.setLanguage(savedLang);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18n);
} else {
  initI18n();
}
