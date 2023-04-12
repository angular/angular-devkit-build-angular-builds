/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type ng from '@angular/compiler-cli';
import ts from 'typescript';
import { AngularCompilation, FileEmitter } from './angular-compilation';
import { AngularHostOptions } from './angular-host';
export declare class AotCompilation extends AngularCompilation {
    #private;
    initialize(rootNames: string[], compilerOptions: ng.CompilerOptions, hostOptions: AngularHostOptions, configurationDiagnostics?: ts.Diagnostic[]): Promise<{
        affectedFiles: ReadonlySet<ts.SourceFile>;
    }>;
    collectDiagnostics(): Iterable<ts.Diagnostic>;
    createFileEmitter(onAfterEmit?: (sourceFile: ts.SourceFile) => void): FileEmitter;
}
