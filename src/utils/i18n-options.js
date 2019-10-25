"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createI18nOptions(metadata, inline) {
    if (metadata.i18n !== undefined &&
        (typeof metadata.i18n !== 'object' || !metadata.i18n || Array.isArray(metadata.i18n))) {
        throw new Error('Project i18n field is malformed. Expected an object.');
    }
    metadata = metadata.i18n || {};
    if (metadata.sourceLocale !== undefined && typeof metadata.sourceLocale !== 'string') {
        throw new Error('Project i18n sourceLocale field is malformed. Expected a string.');
    }
    const i18n = {
        inlineLocales: new Set(),
        // en-US is the default locale added to Angular applications (https://angular.io/guide/i18n#i18n-pipes)
        sourceLocale: metadata.sourceLocale || 'en-US',
        locales: {},
        get shouldInline() {
            return this.inlineLocales.size > 0;
        },
    };
    if (metadata.locales !== undefined &&
        (!metadata.locales || typeof metadata.locales !== 'object' || Array.isArray(metadata.locales))) {
        throw new Error('Project i18n locales field is malformed. Expected an object.');
    }
    else if (metadata.locales) {
        for (const [locale, translationFile] of Object.entries(metadata.locales)) {
            if (typeof translationFile !== 'string') {
                throw new Error(`Project i18n locales field value for '${locale}' is malformed. Expected a string.`);
            }
            if (locale === i18n.sourceLocale) {
                throw new Error(`An i18n locale identifier ('${locale}') cannot both be a source locale and provide a translation.`);
            }
            i18n.locales[locale] = {
                file: translationFile,
            };
        }
    }
    if (inline === true) {
        i18n.inlineLocales.add(i18n.sourceLocale);
        Object.keys(i18n.locales).forEach(locale => i18n.inlineLocales.add(locale));
    }
    else if (inline) {
        for (const locale of inline) {
            if (!i18n.locales[locale]) {
                throw new Error(`Requested inline locale '${locale}' is not defined for the project.`);
            }
            i18n.inlineLocales.add(locale);
        }
    }
    return i18n;
}
exports.createI18nOptions = createI18nOptions;
function mergeDeprecatedI18nOptions(i18n, i18nLocale, i18nFile) {
    if (i18nFile !== undefined && i18nLocale === undefined) {
        throw new Error(`Option 'i18nFile' cannot be used without the 'i18nLocale' option.`);
    }
    if (i18nLocale !== undefined) {
        i18n.inlineLocales.clear();
        i18n.inlineLocales.add(i18nLocale);
        if (i18nFile !== undefined) {
            i18n.locales[i18nLocale] = { file: i18nFile };
            i18n.flatOutput = true;
        }
    }
    return i18n;
}
exports.mergeDeprecatedI18nOptions = mergeDeprecatedI18nOptions;
