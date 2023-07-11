/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export interface RenderOptions {
    route: string;
    serverContext: ServerContext;
}
export interface RenderResult {
    errors?: string[];
    warnings?: string[];
    content?: string;
}
export type ServerContext = 'app-shell' | 'ssg';
export interface WorkerData {
    zonePackage: string;
    outputFiles: Record<string, string>;
    document: string;
    inlineCriticalCss?: boolean;
}
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
declare function render({ route, serverContext }: RenderOptions): Promise<RenderResult>;
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
declare const _default: Promise<typeof render>;
export default _default;
