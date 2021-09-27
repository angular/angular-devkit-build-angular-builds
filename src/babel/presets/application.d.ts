/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export declare type DiagnosticReporter = (type: 'error' | 'warning' | 'info', message: string) => void;
/**
 * An interface representing the required exports from the `@angular/localize/tools`
 * entry-point. This must be provided for the ESM imports since dynamic imports are
 * required to be asynchronous and Babel presets currently can only be synchronous.
 *
 * TODO_ESM: Remove all deep imports once `@angular/localize` is published with the `tools` entry point
 */
export interface LocalizeToolExports {
    makeEs2015TranslatePlugin: typeof import('@angular/localize/src/tools/src/translate/source_files/es2015_translate_plugin').makeEs2015TranslatePlugin;
    makeEs5TranslatePlugin: typeof import('@angular/localize/src/tools/src/translate/source_files/es5_translate_plugin').makeEs5TranslatePlugin;
    makeLocalePlugin: typeof import('@angular/localize/src/tools/src/translate/source_files/locale_plugin').makeLocalePlugin;
    Diagnostics: typeof import('@angular/localize/src/tools/src/diagnostics').Diagnostics;
}
export interface ApplicationPresetOptions {
    i18n?: {
        locale: string;
        missingTranslationBehavior?: 'error' | 'warning' | 'ignore';
        translation?: unknown;
        localizeToolExports?: LocalizeToolExports;
    };
    angularLinker?: {
        shouldLink: boolean;
        jitMode: boolean;
        linkerPluginCreator: typeof import('@angular/compiler-cli/linker/babel').createEs2015LinkerPlugin;
    };
    forceES5?: boolean;
    forceAsyncTransformation?: boolean;
    diagnosticReporter?: DiagnosticReporter;
}
export default function (api: unknown, options: ApplicationPresetOptions): {
    presets: any[][];
    plugins: any[];
};
