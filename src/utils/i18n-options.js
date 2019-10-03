"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createI18nOptions(metadata) {
    const i18n = { locales: {} };
    if (metadata.sourceLocale !== undefined && typeof metadata.sourceLocale !== 'string') {
        throw new Error('Project i18n sourceLocale field is malformed. Expected a string.');
    }
    // en-US is the default locale added to Angular applications (https://angular.io/guide/i18n#i18n-pipes)
    i18n.sourceLocale = metadata.sourceLocale || 'en-US';
    if (metadata.locales !== undefined &&
        (!metadata.locales || typeof metadata.locales !== 'object' || Array.isArray(metadata.locales))) {
        throw new Error('Project i18n locales field is malformed. Expected an object.');
    }
    else if (metadata.locales) {
        for (const [locale, translationFile] of Object.entries(metadata.locales)) {
            if (typeof translationFile !== 'string') {
                throw new Error(`Project i18n locales field value for '${locale}' is malformed. Expected a string.`);
            }
            // TODO: Integrate translation file parsing from FW when available
            i18n.locales[locale] = {
                file: translationFile,
                translation: {},
            };
        }
    }
    return i18n;
}
exports.createI18nOptions = createI18nOptions;
