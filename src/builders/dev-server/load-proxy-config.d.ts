/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export declare function loadProxyConfiguration(root: string, proxyConfig: string | undefined): Promise<any>;
/**
 * Converts glob patterns to regular expressions to support Vite's proxy option.
 * @param proxy A proxy configuration object.
 */
export declare function normalizeProxyConfiguration(proxy: Record<string, unknown>): void;
