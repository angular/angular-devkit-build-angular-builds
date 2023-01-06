/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference path="../../../../../../../../packages/angular_devkit/build_angular/src/babel-bazel.d.ts" />
/// <reference types="@angular/compiler-cli/private/babel" />
export declare function createI18nPlugins(locale: string, translation: unknown | undefined, missingTranslation: 'error' | 'warning' | 'ignore', shouldInline: boolean, localeDataContent?: string): Promise<{
    diagnostics: import("@angular/localize/tools").Diagnostics;
    plugins: import("@types/babel__core").PluginObj<import("@types/babel__core").PluginPass>[];
}>;
export interface InlineOptions {
    filename: string;
    code: string;
    map?: string;
    outputPath: string;
    missingTranslation?: 'warning' | 'error' | 'ignore';
    setLocale?: boolean;
}
export declare function inlineLocales(options: InlineOptions): Promise<{
    file: string;
    diagnostics: {
        type: "error" | "warning";
        message: string;
    }[];
    count: number;
} | {
    file: string;
    diagnostics: {
        type: "error" | "warning";
        message: string;
    }[];
}>;
