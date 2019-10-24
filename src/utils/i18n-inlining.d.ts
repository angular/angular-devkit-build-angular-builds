/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { EmittedFiles } from '@angular-devkit/build-webpack';
import { InlineOptions } from './process-bundle';
export declare function emittedFilesToInlineOptions(emittedFiles: EmittedFiles[], scriptsEntryPointName: string[], emittedPath: string, outputPath: string, es5: boolean, missingTranslation: 'error' | 'warning' | 'ignore' | undefined): {
    options: InlineOptions[];
    originalFiles: string[];
};
