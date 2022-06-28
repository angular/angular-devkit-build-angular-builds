"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTranslations = exports.configureI18nBuild = exports.createI18nOptions = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = __importDefault(require("fs"));
const module_1 = __importDefault(require("module"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const schema_1 = require("../builders/browser/schema");
const read_tsconfig_1 = require("../utils/read-tsconfig");
const load_translations_1 = require("./load-translations");
/**
 * The base module location used to search for locale specific data.
 */
const LOCALE_DATA_BASE_MODULE = '@angular/common/locales/global';
function normalizeTranslationFileOption(option, locale, expectObjectInError) {
    if (typeof option === 'string') {
        return [option];
    }
    if (Array.isArray(option) && option.every((element) => typeof element === 'string')) {
        return option;
    }
    let errorMessage = `Project i18n locales translation field value for '${locale}' is malformed. `;
    if (expectObjectInError) {
        errorMessage += 'Expected a string, array of strings, or object.';
    }
    else {
        errorMessage += 'Expected a string or array of strings.';
    }
    throw new Error(errorMessage);
}
function createI18nOptions(metadata, inline) {
    if (metadata.i18n !== undefined && !core_1.json.isJsonObject(metadata.i18n)) {
        throw new Error('Project i18n field is malformed. Expected an object.');
    }
    metadata = metadata.i18n || {};
    const i18n = {
        inlineLocales: new Set(),
        // en-US is the default locale added to Angular applications (https://angular.io/guide/i18n#i18n-pipes)
        sourceLocale: 'en-US',
        locales: {},
        get shouldInline() {
            return this.inlineLocales.size > 0;
        },
    };
    let rawSourceLocale;
    let rawSourceLocaleBaseHref;
    if (core_1.json.isJsonObject(metadata.sourceLocale)) {
        rawSourceLocale = metadata.sourceLocale.code;
        if (metadata.sourceLocale.baseHref !== undefined &&
            typeof metadata.sourceLocale.baseHref !== 'string') {
            throw new Error('Project i18n sourceLocale baseHref field is malformed. Expected a string.');
        }
        rawSourceLocaleBaseHref = metadata.sourceLocale.baseHref;
    }
    else {
        rawSourceLocale = metadata.sourceLocale;
    }
    if (rawSourceLocale !== undefined) {
        if (typeof rawSourceLocale !== 'string') {
            throw new Error('Project i18n sourceLocale field is malformed. Expected a string.');
        }
        i18n.sourceLocale = rawSourceLocale;
        i18n.hasDefinedSourceLocale = true;
    }
    i18n.locales[i18n.sourceLocale] = {
        files: [],
        baseHref: rawSourceLocaleBaseHref,
    };
    if (metadata.locales !== undefined && !core_1.json.isJsonObject(metadata.locales)) {
        throw new Error('Project i18n locales field is malformed. Expected an object.');
    }
    else if (metadata.locales) {
        for (const [locale, options] of Object.entries(metadata.locales)) {
            let translationFiles;
            let baseHref;
            if (core_1.json.isJsonObject(options)) {
                translationFiles = normalizeTranslationFileOption(options.translation, locale, false);
                if (typeof options.baseHref === 'string') {
                    baseHref = options.baseHref;
                }
            }
            else {
                translationFiles = normalizeTranslationFileOption(options, locale, true);
            }
            if (locale === i18n.sourceLocale) {
                throw new Error(`An i18n locale ('${locale}') cannot both be a source locale and provide a translation.`);
            }
            i18n.locales[locale] = {
                files: translationFiles.map((file) => ({ path: file })),
                baseHref,
            };
        }
    }
    if (inline === true) {
        i18n.inlineLocales.add(i18n.sourceLocale);
        Object.keys(i18n.locales).forEach((locale) => i18n.inlineLocales.add(locale));
    }
    else if (inline) {
        for (const locale of inline) {
            if (!i18n.locales[locale] && i18n.sourceLocale !== locale) {
                throw new Error(`Requested locale '${locale}' is not defined for the project.`);
            }
            i18n.inlineLocales.add(locale);
        }
    }
    return i18n;
}
exports.createI18nOptions = createI18nOptions;
async function configureI18nBuild(context, options) {
    if (!context.target) {
        throw new Error('The builder requires a target.');
    }
    const buildOptions = { ...options };
    const tsConfig = await (0, read_tsconfig_1.readTsconfig)(buildOptions.tsConfig, context.workspaceRoot);
    const metadata = await context.getProjectMetadata(context.target);
    const i18n = createI18nOptions(metadata, buildOptions.localize);
    // No additional processing needed if no inlining requested and no source locale defined.
    if (!i18n.shouldInline && !i18n.hasDefinedSourceLocale) {
        return { buildOptions, i18n };
    }
    const projectRoot = path_1.default.join(context.workspaceRoot, metadata.root || '');
    // The trailing slash is required to signal that the path is a directory and not a file.
    const projectRequire = module_1.default.createRequire(projectRoot + '/');
    const localeResolver = (locale) => projectRequire.resolve(path_1.default.join(LOCALE_DATA_BASE_MODULE, locale));
    // Load locale data and translations (if present)
    let loader;
    const usedFormats = new Set();
    for (const [locale, desc] of Object.entries(i18n.locales)) {
        if (!i18n.inlineLocales.has(locale) && locale !== i18n.sourceLocale) {
            continue;
        }
        let localeDataPath = findLocaleDataPath(locale, localeResolver);
        if (!localeDataPath) {
            const [first] = locale.split('-');
            if (first) {
                localeDataPath = findLocaleDataPath(first.toLowerCase(), localeResolver);
                if (localeDataPath) {
                    context.logger.warn(`Locale data for '${locale}' cannot be found. Using locale data for '${first}'.`);
                }
            }
        }
        if (!localeDataPath) {
            context.logger.warn(`Locale data for '${locale}' cannot be found. No locale data will be included for this locale.`);
        }
        else {
            desc.dataPath = localeDataPath;
        }
        if (!desc.files.length) {
            continue;
        }
        loader !== null && loader !== void 0 ? loader : (loader = await (0, load_translations_1.createTranslationLoader)());
        loadTranslations(locale, desc, context.workspaceRoot, loader, {
            warn(message) {
                context.logger.warn(message);
            },
            error(message) {
                throw new Error(message);
            },
        }, usedFormats, buildOptions.i18nDuplicateTranslation);
        if (usedFormats.size > 1 && tsConfig.options.enableI18nLegacyMessageIdFormat !== false) {
            // This limitation is only for legacy message id support (defaults to true as of 9.0)
            throw new Error('Localization currently only supports using one type of translation file format for the entire application.');
        }
    }
    // If inlining store the output in a temporary location to facilitate post-processing
    if (i18n.shouldInline) {
        const tempPath = fs_1.default.mkdtempSync(path_1.default.join(fs_1.default.realpathSync(os_1.default.tmpdir()), 'angular-cli-i18n-'));
        buildOptions.outputPath = tempPath;
        process.on('exit', () => deleteTempDirectory(tempPath));
        process.once('SIGINT', () => {
            deleteTempDirectory(tempPath);
            // Needed due to `ora` as otherwise process will not terminate.
            process.kill(process.pid, 'SIGINT');
        });
    }
    return { buildOptions, i18n };
}
exports.configureI18nBuild = configureI18nBuild;
function findLocaleDataPath(locale, resolver) {
    // Remove private use subtags
    const scrubbedLocale = locale.replace(/-x(-[a-zA-Z0-9]{1,8})+$/, '');
    try {
        return resolver(scrubbedLocale);
    }
    catch (_a) {
        // fallback to known existing en-US locale data as of 14.0
        return scrubbedLocale === 'en-US' ? findLocaleDataPath('en', resolver) : null;
    }
}
/** Remove temporary directory used for i18n processing. */
function deleteTempDirectory(tempPath) {
    try {
        fs_1.default.rmSync(tempPath, { force: true, recursive: true, maxRetries: 3 });
    }
    catch (_a) { }
}
function loadTranslations(locale, desc, workspaceRoot, loader, logger, usedFormats, duplicateTranslation) {
    let translations = undefined;
    for (const file of desc.files) {
        const loadResult = loader(path_1.default.join(workspaceRoot, file.path));
        for (const diagnostics of loadResult.diagnostics.messages) {
            if (diagnostics.type === 'error') {
                logger.error(`Error parsing translation file '${file.path}': ${diagnostics.message}`);
            }
            else {
                logger.warn(`WARNING [${file.path}]: ${diagnostics.message}`);
            }
        }
        if (loadResult.locale !== undefined && loadResult.locale !== locale) {
            logger.warn(`WARNING [${file.path}]: File target locale ('${loadResult.locale}') does not match configured locale ('${locale}')`);
        }
        usedFormats === null || usedFormats === void 0 ? void 0 : usedFormats.add(loadResult.format);
        file.format = loadResult.format;
        file.integrity = loadResult.integrity;
        if (translations) {
            // Merge translations
            for (const [id, message] of Object.entries(loadResult.translations)) {
                if (translations[id] !== undefined) {
                    const duplicateTranslationMessage = `[${file.path}]: Duplicate translations for message '${id}' when merging.`;
                    switch (duplicateTranslation) {
                        case schema_1.I18NTranslation.Ignore:
                            break;
                        case schema_1.I18NTranslation.Error:
                            logger.error(`ERROR ${duplicateTranslationMessage}`);
                            break;
                        case schema_1.I18NTranslation.Warning:
                        default:
                            logger.warn(`WARNING ${duplicateTranslationMessage}`);
                            break;
                    }
                }
                translations[id] = message;
            }
        }
        else {
            // First or only translation file
            translations = loadResult.translations;
        }
    }
    desc.translation = translations;
}
exports.loadTranslations = loadTranslations;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1vcHRpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaTE4bi1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILCtDQUE0QztBQUM1Qyw0Q0FBb0I7QUFDcEIsb0RBQTRCO0FBQzVCLDRDQUFvQjtBQUNwQixnREFBd0I7QUFDeEIsdURBQTZGO0FBRTdGLDBEQUFzRDtBQUN0RCwyREFBaUY7QUFFakY7O0dBRUc7QUFDSCxNQUFNLHVCQUF1QixHQUFHLGdDQUFnQyxDQUFDO0FBc0JqRSxTQUFTLDhCQUE4QixDQUNyQyxNQUFzQixFQUN0QixNQUFjLEVBQ2QsbUJBQTRCO0lBRTVCLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1FBQzlCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNqQjtJQUVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsRUFBRTtRQUNuRixPQUFPLE1BQWtCLENBQUM7S0FDM0I7SUFFRCxJQUFJLFlBQVksR0FBRyxxREFBcUQsTUFBTSxrQkFBa0IsQ0FBQztJQUNqRyxJQUFJLG1CQUFtQixFQUFFO1FBQ3ZCLFlBQVksSUFBSSxpREFBaUQsQ0FBQztLQUNuRTtTQUFNO1FBQ0wsWUFBWSxJQUFJLHdDQUF3QyxDQUFDO0tBQzFEO0lBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQsU0FBZ0IsaUJBQWlCLENBQy9CLFFBQXlCLEVBQ3pCLE1BQTJCO0lBRTNCLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksQ0FB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Q29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IG1vZHVsZSBmcm9tICdtb2R1bGUnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBJMThOVHJhbnNsYXRpb24gfSBmcm9tICcuLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgU2VydmVyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2J1aWxkZXJzL3NlcnZlci9zY2hlbWEnO1xuaW1wb3J0IHsgcmVhZFRzY29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyBUcmFuc2xhdGlvbkxvYWRlciwgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuL2xvYWQtdHJhbnNsYXRpb25zJztcblxuLyoqXG4gKiBUaGUgYmFzZSBtb2R1bGUgbG9jYXRpb24gdXNlZCB0byBzZWFyY2ggZm9yIGxvY2FsZSBzcGVjaWZpYyBkYXRhLlxuICovXG5jb25zdCBMT0NBTEVfREFUQV9CQVNFX01PRFVMRSA9ICdAYW5ndWxhci9jb21tb24vbG9jYWxlcy9nbG9iYWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExvY2FsZURlc2NyaXB0aW9uIHtcbiAgZmlsZXM6IHtcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgaW50ZWdyaXR5Pzogc3RyaW5nO1xuICAgIGZvcm1hdD86IHN0cmluZztcbiAgfVtdO1xuICB0cmFuc2xhdGlvbj86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBkYXRhUGF0aD86IHN0cmluZztcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSTE4bk9wdGlvbnMge1xuICBpbmxpbmVMb2NhbGVzOiBTZXQ8c3RyaW5nPjtcbiAgc291cmNlTG9jYWxlOiBzdHJpbmc7XG4gIGxvY2FsZXM6IFJlY29yZDxzdHJpbmcsIExvY2FsZURlc2NyaXB0aW9uPjtcbiAgZmxhdE91dHB1dD86IGJvb2xlYW47XG4gIHJlYWRvbmx5IHNob3VsZElubGluZTogYm9vbGVhbjtcbiAgaGFzRGVmaW5lZFNvdXJjZUxvY2FsZT86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVRyYW5zbGF0aW9uRmlsZU9wdGlvbihcbiAgb3B0aW9uOiBqc29uLkpzb25WYWx1ZSxcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGV4cGVjdE9iamVjdEluRXJyb3I6IGJvb2xlYW4sXG4pOiBzdHJpbmdbXSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9uID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBbb3B0aW9uXTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KG9wdGlvbikgJiYgb3B0aW9uLmV2ZXJ5KChlbGVtZW50KSA9PiB0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycpKSB7XG4gICAgcmV0dXJuIG9wdGlvbiBhcyBzdHJpbmdbXTtcbiAgfVxuXG4gIGxldCBlcnJvck1lc3NhZ2UgPSBgUHJvamVjdCBpMThuIGxvY2FsZXMgdHJhbnNsYXRpb24gZmllbGQgdmFsdWUgZm9yICcke2xvY2FsZX0nIGlzIG1hbGZvcm1lZC4gYDtcbiAgaWYgKGV4cGVjdE9iamVjdEluRXJyb3IpIHtcbiAgICBlcnJvck1lc3NhZ2UgKz0gJ0V4cGVjdGVkIGEgc3RyaW5nLCBhcnJheSBvZiBzdHJpbmdzLCBvciBvYmplY3QuJztcbiAgfSBlbHNlIHtcbiAgICBlcnJvck1lc3NhZ2UgKz0gJ0V4cGVjdGVkIGEgc3RyaW5nIG9yIGFycmF5IG9mIHN0cmluZ3MuJztcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSTE4bk9wdGlvbnMoXG4gIG1ldGFkYXRhOiBqc29uLkpzb25PYmplY3QsXG4gIGlubGluZT86IGJvb2xlYW4gfCBzdHJpbmdbXSxcbik6IEkxOG5PcHRpb25zIHtcbiAgaWYgKG1ldGFkYXRhLmkxOG4gIT09IHVuZGVmaW5lZCAmJiAhanNvbi5pc0pzb25PYmplY3QobWV0YWRhdGEuaTE4bikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3QgaTE4biBmaWVsZCBpcyBtYWxmb3JtZWQuIEV4cGVjdGVkIGFuIG9iamVjdC4nKTtcbiAgfVxuICBtZXRhZGF0YSA9IG1ldGFkYXRhLmkxOG4gfHwge307XG5cbiAgY29uc3QgaTE4bjogSTE4bk9wdGlvbnMgPSB7XG4gICAgaW5saW5lTG9jYWxlczogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgLy8gZW4tVVMgaXMgdGhlIGRlZmF1bHQgbG9jYWxlIGFkZGVkIHRvIEFuZ3VsYXIgYXBwbGljYXRpb25zIChodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaTE4biNpMThuLXBpcGVzKVxuICAgIHNvdXJjZUxvY2FsZTogJ2VuLVVTJyxcbiAgICBsb2NhbGVzOiB7fSxcbiAgICBnZXQgc2hvdWxkSW5saW5lKCkge1xuICAgICAgcmV0dXJuIHRoaXMuaW5saW5lTG9jYWxlcy5zaXplID4gMDtcbiAgICB9LFxuICB9O1xuXG4gIGxldCByYXdTb3VyY2VMb2NhbGU7XG4gIGxldCByYXdTb3VyY2VMb2NhbGVCYXNlSHJlZjtcbiAgaWYgKGpzb24uaXNKc29uT2JqZWN0KG1ldGFkYXRhLnNvdXJjZUxvY2FsZSkpIHtcbiAgICByYXdTb3VyY2VMb2NhbGUgPSBtZXRhZGF0YS5zb3VyY2VMb2NhbGUuY29kZTtcbiAgICBpZiAoXG4gICAgICBtZXRhZGF0YS5zb3VyY2VMb2NhbGUuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdHlwZW9mIG1ldGFkYXRhLnNvdXJjZUxvY2FsZS5iYXNlSHJlZiAhPT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBpMThuIHNvdXJjZUxvY2FsZSBiYXNlSHJlZiBmaWVsZCBpcyBtYWxmb3JtZWQuIEV4cGVjdGVkIGEgc3RyaW5nLicpO1xuICAgIH1cbiAgICByYXdTb3VyY2VMb2NhbGVCYXNlSHJlZiA9IG1ldGFkYXRhLnNvdXJjZUxvY2FsZS5iYXNlSHJlZjtcbiAgfSBlbHNlIHtcbiAgICByYXdTb3VyY2VMb2NhbGUgPSBtZXRhZGF0YS5zb3VyY2VMb2NhbGU7XG4gIH1cblxuICBpZiAocmF3U291cmNlTG9jYWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodHlwZW9mIHJhd1NvdXJjZUxvY2FsZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBpMThuIHNvdXJjZUxvY2FsZSBmaWVsZCBpcyBtYWxmb3JtZWQuIEV4cGVjdGVkIGEgc3RyaW5nLicpO1xuICAgIH1cblxuICAgIGkxOG4uc291cmNlTG9jYWxlID0gcmF3U291cmNlTG9jYWxlO1xuICAgIGkxOG4uaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSA9IHRydWU7XG4gIH1cblxuICBpMThuLmxvY2FsZXNbaTE4bi5zb3VyY2VMb2NhbGVdID0ge1xuICAgIGZpbGVzOiBbXSxcbiAgICBiYXNlSHJlZjogcmF3U291cmNlTG9jYWxlQmFzZUhyZWYsXG4gIH07XG5cbiAgaWYgKG1ldGFkYXRhLmxvY2FsZXMgIT09IHVuZGVmaW5lZCAmJiAhanNvbi5pc0pzb25PYmplY3QobWV0YWRhdGEubG9jYWxlcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3QgaTE4biBsb2NhbGVzIGZpZWxkIGlzIG1hbGZvcm1lZC4gRXhwZWN0ZWQgYW4gb2JqZWN0LicpO1xuICB9IGVsc2UgaWYgKG1ldGFkYXRhLmxvY2FsZXMpIHtcbiAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG9wdGlvbnNdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGFkYXRhLmxvY2FsZXMpKSB7XG4gICAgICBsZXQgdHJhbnNsYXRpb25GaWxlcztcbiAgICAgIGxldCBiYXNlSHJlZjtcbiAgICAgIGlmIChqc29uLmlzSnNvbk9iamVjdChvcHRpb25zKSkge1xuICAgICAgICB0cmFuc2xhdGlvbkZpbGVzID0gbm9ybWFsaXplVHJhbnNsYXRpb25GaWxlT3B0aW9uKG9wdGlvbnMudHJhbnNsYXRpb24sIGxvY2FsZSwgZmFsc2UpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5iYXNlSHJlZiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBiYXNlSHJlZiA9IG9wdGlvbnMuYmFzZUhyZWY7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZXMgPSBub3JtYWxpemVUcmFuc2xhdGlvbkZpbGVPcHRpb24ob3B0aW9ucywgbG9jYWxlLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBbiBpMThuIGxvY2FsZSAoJyR7bG9jYWxlfScpIGNhbm5vdCBib3RoIGJlIGEgc291cmNlIGxvY2FsZSBhbmQgcHJvdmlkZSBhIHRyYW5zbGF0aW9uLmAsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGkxOG4ubG9jYWxlc1tsb2NhbGVdID0ge1xuICAgICAgICBmaWxlczogdHJhbnNsYXRpb25GaWxlcy5tYXAoKGZpbGUpID0+ICh7IHBhdGg6IGZpbGUgfSkpLFxuICAgICAgICBiYXNlSHJlZixcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKGlubGluZSA9PT0gdHJ1ZSkge1xuICAgIGkxOG4uaW5saW5lTG9jYWxlcy5hZGQoaTE4bi5zb3VyY2VMb2NhbGUpO1xuICAgIE9iamVjdC5rZXlzKGkxOG4ubG9jYWxlcykuZm9yRWFjaCgobG9jYWxlKSA9PiBpMThuLmlubGluZUxvY2FsZXMuYWRkKGxvY2FsZSkpO1xuICB9IGVsc2UgaWYgKGlubGluZSkge1xuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIGlubGluZSkge1xuICAgICAgaWYgKCFpMThuLmxvY2FsZXNbbG9jYWxlXSAmJiBpMThuLnNvdXJjZUxvY2FsZSAhPT0gbG9jYWxlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVxdWVzdGVkIGxvY2FsZSAnJHtsb2NhbGV9JyBpcyBub3QgZGVmaW5lZCBmb3IgdGhlIHByb2plY3QuYCk7XG4gICAgICB9XG5cbiAgICAgIGkxOG4uaW5saW5lTG9jYWxlcy5hZGQobG9jYWxlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaTE4bjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbmZpZ3VyZUkxOG5CdWlsZDxUIGV4dGVuZHMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfCBTZXJ2ZXJCdWlsZGVyU2NoZW1hPihcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIG9wdGlvbnM6IFQsXG4pOiBQcm9taXNlPHtcbiAgYnVpbGRPcHRpb25zOiBUO1xuICBpMThuOiBJMThuT3B0aW9ucztcbn0+IHtcbiAgaWYgKCFjb250ZXh0LnRhcmdldCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcbiAgY29uc3QgdHNDb25maWcgPSBhd2FpdCByZWFkVHNjb25maWcoYnVpbGRPcHRpb25zLnRzQ29uZmlnLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKGNvbnRleHQudGFyZ2V0KTtcbiAgY29uc3QgaTE4biA9IGNyZWF0ZUkxOG5PcHRpb25zKG1ldGFkYXRhLCBidWlsZE9wdGlvbnMubG9jYWxpemUpO1xuXG4gIC8vIE5vIGFkZGl0aW9uYWwgcHJvY2Vzc2luZyBuZWVkZWQgaWYgbm8gaW5saW5pbmcgcmVxdWVzdGVkIGFuZCBubyBzb3VyY2UgbG9jYWxlIGRlZmluZWQuXG4gIGlmICghaTE4bi5zaG91bGRJbmxpbmUgJiYgIWkxOG4uaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgIHJldHVybiB7IGJ1aWxkT3B0aW9ucywgaTE4biB9O1xuICB9XG5cbiAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCAobWV0YWRhdGEucm9vdCBhcyBzdHJpbmcpIHx8ICcnKTtcbiAgLy8gVGhlIHRyYWlsaW5nIHNsYXNoIGlzIHJlcXVpcmVkIHRvIHNpZ25hbCB0aGF0IHRoZSBwYXRoIGlzIGEgZGlyZWN0b3J5IGFuZCBub3QgYSBmaWxlLlxuICBjb25zdCBwcm9qZWN0UmVxdWlyZSA9IG1vZHVsZS5jcmVhdGVSZXF1aXJlKHByb2plY3RSb290ICsgJy8nKTtcbiAgY29uc3QgbG9jYWxlUmVzb2x2ZXIgPSAobG9jYWxlOiBzdHJpbmcpID0+XG4gICAgcHJvamVjdFJlcXVpcmUucmVzb2x2ZShwYXRoLmpvaW4oTE9DQUxFX0RBVEFfQkFTRV9NT0RVTEUsIGxvY2FsZSkpO1xuXG4gIC8vIExvYWQgbG9jYWxlIGRhdGEgYW5kIHRyYW5zbGF0aW9ucyAoaWYgcHJlc2VudClcbiAgbGV0IGxvYWRlcjtcbiAgY29uc3QgdXNlZEZvcm1hdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBbbG9jYWxlLCBkZXNjXSBvZiBPYmplY3QuZW50cmllcyhpMThuLmxvY2FsZXMpKSB7XG4gICAgaWYgKCFpMThuLmlubGluZUxvY2FsZXMuaGFzKGxvY2FsZSkgJiYgbG9jYWxlICE9PSBpMThuLnNvdXJjZUxvY2FsZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGxvY2FsZURhdGFQYXRoID0gZmluZExvY2FsZURhdGFQYXRoKGxvY2FsZSwgbG9jYWxlUmVzb2x2ZXIpO1xuICAgIGlmICghbG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgIGNvbnN0IFtmaXJzdF0gPSBsb2NhbGUuc3BsaXQoJy0nKTtcbiAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICBsb2NhbGVEYXRhUGF0aCA9IGZpbmRMb2NhbGVEYXRhUGF0aChmaXJzdC50b0xvd2VyQ2FzZSgpLCBsb2NhbGVSZXNvbHZlcik7XG4gICAgICAgIGlmIChsb2NhbGVEYXRhUGF0aCkge1xuICAgICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgICAgICBgTG9jYWxlIGRhdGEgZm9yICcke2xvY2FsZX0nIGNhbm5vdCBiZSBmb3VuZC4gVXNpbmcgbG9jYWxlIGRhdGEgZm9yICcke2ZpcnN0fScuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghbG9jYWxlRGF0YVBhdGgpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBMb2NhbGUgZGF0YSBmb3IgJyR7bG9jYWxlfScgY2Fubm90IGJlIGZvdW5kLiBObyBsb2NhbGUgZGF0YSB3aWxsIGJlIGluY2x1ZGVkIGZvciB0aGlzIGxvY2FsZS5gLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVzYy5kYXRhUGF0aCA9IGxvY2FsZURhdGFQYXRoO1xuICAgIH1cblxuICAgIGlmICghZGVzYy5maWxlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxvYWRlciA/Pz0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcblxuICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICBkZXNjLFxuICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgbG9hZGVyLFxuICAgICAge1xuICAgICAgICB3YXJuKG1lc3NhZ2UpIHtcbiAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHVzZWRGb3JtYXRzLFxuICAgICAgYnVpbGRPcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbixcbiAgICApO1xuXG4gICAgaWYgKHVzZWRGb3JtYXRzLnNpemUgPiAxICYmIHRzQ29uZmlnLm9wdGlvbnMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCAhPT0gZmFsc2UpIHtcbiAgICAgIC8vIFRoaXMgbGltaXRhdGlvbiBpcyBvbmx5IGZvciBsZWdhY3kgbWVzc2FnZSBpZCBzdXBwb3J0IChkZWZhdWx0cyB0byB0cnVlIGFzIG9mIDkuMClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0xvY2FsaXphdGlvbiBjdXJyZW50bHkgb25seSBzdXBwb3J0cyB1c2luZyBvbmUgdHlwZSBvZiB0cmFuc2xhdGlvbiBmaWxlIGZvcm1hdCBmb3IgdGhlIGVudGlyZSBhcHBsaWNhdGlvbi4nLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBpbmxpbmluZyBzdG9yZSB0aGUgb3V0cHV0IGluIGEgdGVtcG9yYXJ5IGxvY2F0aW9uIHRvIGZhY2lsaXRhdGUgcG9zdC1wcm9jZXNzaW5nXG4gIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgIGNvbnN0IHRlbXBQYXRoID0gZnMubWtkdGVtcFN5bmMocGF0aC5qb2luKGZzLnJlYWxwYXRoU3luYyhvcy50bXBkaXIoKSksICdhbmd1bGFyLWNsaS1pMThuLScpKTtcbiAgICBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCA9IHRlbXBQYXRoO1xuXG4gICAgcHJvY2Vzcy5vbignZXhpdCcsICgpID0+IGRlbGV0ZVRlbXBEaXJlY3RvcnkodGVtcFBhdGgpKTtcbiAgICBwcm9jZXNzLm9uY2UoJ1NJR0lOVCcsICgpID0+IHtcbiAgICAgIGRlbGV0ZVRlbXBEaXJlY3RvcnkodGVtcFBhdGgpO1xuXG4gICAgICAvLyBOZWVkZWQgZHVlIHRvIGBvcmFgIGFzIG90aGVyd2lzZSBwcm9jZXNzIHdpbGwgbm90IHRlcm1pbmF0ZS5cbiAgICAgIHByb2Nlc3Mua2lsbChwcm9jZXNzLnBpZCwgJ1NJR0lOVCcpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgYnVpbGRPcHRpb25zLCBpMThuIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRMb2NhbGVEYXRhUGF0aChsb2NhbGU6IHN0cmluZywgcmVzb2x2ZXI6IChsb2NhbGU6IHN0cmluZykgPT4gc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIC8vIFJlbW92ZSBwcml2YXRlIHVzZSBzdWJ0YWdzXG4gIGNvbnN0IHNjcnViYmVkTG9jYWxlID0gbG9jYWxlLnJlcGxhY2UoLy14KC1bYS16QS1aMC05XXsxLDh9KSskLywgJycpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlc29sdmVyKHNjcnViYmVkTG9jYWxlKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gZmFsbGJhY2sgdG8ga25vd24gZXhpc3RpbmcgZW4tVVMgbG9jYWxlIGRhdGEgYXMgb2YgMTQuMFxuICAgIHJldHVybiBzY3J1YmJlZExvY2FsZSA9PT0gJ2VuLVVTJyA/IGZpbmRMb2NhbGVEYXRhUGF0aCgnZW4nLCByZXNvbHZlcikgOiBudWxsO1xuICB9XG59XG5cbi8qKiBSZW1vdmUgdGVtcG9yYXJ5IGRpcmVjdG9yeSB1c2VkIGZvciBpMThuIHByb2Nlc3NpbmcuICovXG5mdW5jdGlvbiBkZWxldGVUZW1wRGlyZWN0b3J5KHRlbXBQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBmcy5ybVN5bmModGVtcFBhdGgsIHsgZm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogMyB9KTtcbiAgfSBjYXRjaCB7fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZFRyYW5zbGF0aW9ucyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGRlc2M6IExvY2FsZURlc2NyaXB0aW9uLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGxvYWRlcjogVHJhbnNsYXRpb25Mb2FkZXIsXG4gIGxvZ2dlcjogeyB3YXJuOiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkOyBlcnJvcjogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCB9LFxuICB1c2VkRm9ybWF0cz86IFNldDxzdHJpbmc+LFxuICBkdXBsaWNhdGVUcmFuc2xhdGlvbj86IEkxOE5UcmFuc2xhdGlvbixcbikge1xuICBsZXQgdHJhbnNsYXRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGRlc2MuZmlsZXMpIHtcbiAgICBjb25zdCBsb2FkUmVzdWx0ID0gbG9hZGVyKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBmaWxlLnBhdGgpKTtcblxuICAgIGZvciAoY29uc3QgZGlhZ25vc3RpY3Mgb2YgbG9hZFJlc3VsdC5kaWFnbm9zdGljcy5tZXNzYWdlcykge1xuICAgICAgaWYgKGRpYWdub3N0aWNzLnR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGBFcnJvciBwYXJzaW5nIHRyYW5zbGF0aW9uIGZpbGUgJyR7ZmlsZS5wYXRofSc6ICR7ZGlhZ25vc3RpY3MubWVzc2FnZX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci53YXJuKGBXQVJOSU5HIFske2ZpbGUucGF0aH1dOiAke2RpYWdub3N0aWNzLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxvYWRSZXN1bHQubG9jYWxlICE9PSB1bmRlZmluZWQgJiYgbG9hZFJlc3VsdC5sb2NhbGUgIT09IGxvY2FsZSkge1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgIGBXQVJOSU5HIFske2ZpbGUucGF0aH1dOiBGaWxlIHRhcmdldCBsb2NhbGUgKCcke2xvYWRSZXN1bHQubG9jYWxlfScpIGRvZXMgbm90IG1hdGNoIGNvbmZpZ3VyZWQgbG9jYWxlICgnJHtsb2NhbGV9JylgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB1c2VkRm9ybWF0cz8uYWRkKGxvYWRSZXN1bHQuZm9ybWF0KTtcbiAgICBmaWxlLmZvcm1hdCA9IGxvYWRSZXN1bHQuZm9ybWF0O1xuICAgIGZpbGUuaW50ZWdyaXR5ID0gbG9hZFJlc3VsdC5pbnRlZ3JpdHk7XG5cbiAgICBpZiAodHJhbnNsYXRpb25zKSB7XG4gICAgICAvLyBNZXJnZSB0cmFuc2xhdGlvbnNcbiAgICAgIGZvciAoY29uc3QgW2lkLCBtZXNzYWdlXSBvZiBPYmplY3QuZW50cmllcyhsb2FkUmVzdWx0LnRyYW5zbGF0aW9ucykpIHtcbiAgICAgICAgaWYgKHRyYW5zbGF0aW9uc1tpZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IGR1cGxpY2F0ZVRyYW5zbGF0aW9uTWVzc2FnZSA9IGBbJHtmaWxlLnBhdGh9XTogRHVwbGljYXRlIHRyYW5zbGF0aW9ucyBmb3IgbWVzc2FnZSAnJHtpZH0nIHdoZW4gbWVyZ2luZy5gO1xuICAgICAgICAgIHN3aXRjaCAoZHVwbGljYXRlVHJhbnNsYXRpb24pIHtcbiAgICAgICAgICAgIGNhc2UgSTE4TlRyYW5zbGF0aW9uLklnbm9yZTpcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEkxOE5UcmFuc2xhdGlvbi5FcnJvcjpcbiAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBFUlJPUiAke2R1cGxpY2F0ZVRyYW5zbGF0aW9uTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEkxOE5UcmFuc2xhdGlvbi5XYXJuaW5nOlxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oYFdBUk5JTkcgJHtkdXBsaWNhdGVUcmFuc2xhdGlvbk1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0cmFuc2xhdGlvbnNbaWRdID0gbWVzc2FnZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRmlyc3Qgb3Igb25seSB0cmFuc2xhdGlvbiBmaWxlXG4gICAgICB0cmFuc2xhdGlvbnMgPSBsb2FkUmVzdWx0LnRyYW5zbGF0aW9ucztcbiAgICB9XG4gIH1cbiAgZGVzYy50cmFuc2xhdGlvbiA9IHRyYW5zbGF0aW9ucztcbn1cbiJdfQ==