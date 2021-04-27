import { Compilation, Compiler } from 'webpack';
export interface ScriptsWebpackPluginOptions {
    name: string;
    sourceMap?: boolean;
    scripts: string[];
    filename: string;
    basePath: string;
}
export declare class ScriptsWebpackPlugin {
    private options;
    private _lastBuildTime?;
    private _cachedOutput?;
    constructor(options: ScriptsWebpackPluginOptions);
    shouldSkip(compilation: Compilation, scripts: string[]): Promise<boolean>;
    private _insertOutput;
    apply(compiler: Compiler): void;
}
