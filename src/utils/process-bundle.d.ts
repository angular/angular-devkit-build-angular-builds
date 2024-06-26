/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { InlineOptions } from './bundle-inline-options';
export declare function inlineLocales(options: InlineOptions): Promise<{
    file: string;
    diagnostics: {
        type: "warning" | "error";
        message: string;
    }[];
    count: number;
} | {
    file: string;
    diagnostics: {
        type: "warning" | "error";
        message: string;
    }[];
}>;
