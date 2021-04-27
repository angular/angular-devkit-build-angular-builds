import * as ts from 'typescript';
export declare class BuildBrowserFeatures {
    private projectRoot;
    readonly supportedBrowsers: string[];
    constructor(projectRoot: string);
    /**
     * True, when one or more browsers requires ES5
     * support and the script target is ES2015 or greater.
     */
    isDifferentialLoadingNeeded(scriptTarget: ts.ScriptTarget): boolean;
    /**
     * True, when one or more browsers requires ES5 support
     */
    isEs5SupportNeeded(): boolean;
    /**
     * True, when a browser feature is supported partially or fully.
     */
    isFeatureSupported(featureId: string): boolean;
}
