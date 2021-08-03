/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export declare class BuildBrowserFeatures {
    private projectRoot;
    readonly supportedBrowsers: string[];
    constructor(projectRoot: string);
    /**
     * True, when a browser feature is supported partially or fully.
     */
    isFeatureSupported(featureId: string): boolean;
}
