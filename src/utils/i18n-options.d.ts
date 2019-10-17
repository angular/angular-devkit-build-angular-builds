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
    readonly shouldInline: boolean;
}
export declare function createI18nOptions(metadata: json.JsonObject, inline?: boolean | string[]): I18nOptions;
