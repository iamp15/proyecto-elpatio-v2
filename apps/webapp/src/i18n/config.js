import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';

// Detectar el idioma del cliente de Telegram del usuario (si está disponible)
const tgLanguage = window?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || 'es';
// Si el idioma de Telegram empieza con 'en', usamos inglés; si no, por defecto español.
const defaultLang = tgLanguage.startsWith('en') ? 'en' : 'es';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: esTranslations },
      en: { translation: enTranslations }
    },
    lng: defaultLang,
    fallbackLng: 'es', // Si falta una traducción en inglés, mostrará la de español
    interpolation: {
      escapeValue: false // React ya se encarga de escapar y prevenir XSS
    }
  });

// Exponer en window para cambiar idioma desde la consola (ej: window.i18n.changeLanguage('en'))
if (typeof window !== 'undefined') window.i18n = i18n;

export default i18n;