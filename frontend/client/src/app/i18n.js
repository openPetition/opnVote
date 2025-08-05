import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import translationEN from "../../public/locales/en/translation.json";
import translationDE from "../../public/locales/de/translation.json";
const resources = {
    en: {
        translation: translationEN
    },
    de: {
        translation: translationDE
    }
};

const detectOptions = {
    order: ['localStorage', 'navigator', 'querystring'],
    convertDetectedLanguage: (lng) => {
        if (typeof lng !== 'string') {
            return '';
        }
        const languageCode = lng.split('-')[0];
        return languageCode;
    }
};

const formatConfigs = {
    datetime: {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    },
    date: {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    },
    time: {
        hour: "2-digit",
        minute: "2-digit",
    }
}

export function formatDate(value, type, lang) {
    const config = formatConfigs[type];
    const browserLocale = navigator.language;
    const locale = browserLocale.includes(lang) ? browserLocale : lang;
    return new Intl.DateTimeFormat(locale, config).format(value);
}

i18n
    .use(LanguageDetector)
    // load translation using http -> see /public/locales
    // learn more: https://github.com/i18next/i18next-http-backend
    .use(Backend)
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languageDetector
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        resources,
        defaultLocale: "de",
        locales: ["de", "en"],
        supportedLngs: ["de", "en"],
        fallbackLng: 'en',
        debug: true,
        detection: detectOptions,
        load: 'languageOnly',
        interpolation: {
            formatSeparator: ',',
            format: function (value, formatting, lng) {
                if (value instanceof Date) {
                    return formatDate(value, formatting, lng)
                }
                return value.toString();
            }
        }
    });

export default i18n;
