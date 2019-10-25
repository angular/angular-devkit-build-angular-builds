/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { json } from '@angular-devkit/core';
export interface I18nOptions {
    inlineLocales: Set<string>;
    sourceLocale: string;
    locales: Record<string, {
        file: string;
        format?: string;
        translation?: unknown;
    }>;
    flatOutput?: boolean;
    readonly shouldInline: boolean;
}
export declare function createI18nOptions(metadata: json.JsonObject, inline?: boolean | string[]): I18nOptions;
export declare function mergeDeprecatedI18nOptions(i18n: I18nOptions, i18nLocale: string | undefined, i18nFile: string | undefined): I18nOptions;
