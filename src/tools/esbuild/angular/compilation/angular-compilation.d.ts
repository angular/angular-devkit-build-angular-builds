/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type ng from '@angular/compiler-cli';
import type { PartialMessage } from 'esbuild';
import type ts from 'typescript';
import type { AngularHostOptions } from '../angular-host';
export interface EmitFileResult {
    filename: string;
    contents: string;
    dependencies?: readonly string[];
}
export declare abstract class AngularCompilation {
    #private;
    static loadCompilerCli(): Promise<typeof ng>;
    static loadTypescript(): Promise<typeof ts>;
    protected loadConfiguration(tsconfig: string): Promise<ng.CompilerOptions>;
    abstract initialize(tsconfig: string, hostOptions: AngularHostOptions, compilerOptionsTransformer?: (compilerOptions: ng.CompilerOptions) => ng.CompilerOptions): Promise<{
        affectedFiles: ReadonlySet<ts.SourceFile>;
        compilerOptions: ng.CompilerOptions;
        referencedFiles: readonly string[];
    }>;
    abstract emitAffectedFiles(): Iterable<EmitFileResult> | Promise<Iterable<EmitFileResult>>;
    protected abstract collectDiagnostics(): Iterable<ts.Diagnostic> | Promise<Iterable<ts.Diagnostic>>;
    diagnoseFiles(): Promise<{
        errors?: PartialMessage[];
        warnings?: PartialMessage[];
    }>;
    update?(files: Set<string>): Promise<void>;
    close?(): Promise<void>;
}
