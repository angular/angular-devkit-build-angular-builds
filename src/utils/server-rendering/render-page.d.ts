/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { MainServerBundleExports } from './main-bundle-exports';
export interface RenderOptions {
    route: string;
    serverContext: ServerContext;
    outputFiles: Record<string, string>;
    document: string;
    inlineCriticalCss?: boolean;
    loadBundle?: (path: string) => Promise<MainServerBundleExports>;
}
export interface RenderResult {
    errors?: string[];
    warnings?: string[];
    content?: string;
}
export type ServerContext = 'app-shell' | 'ssg' | 'ssr';
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
export declare function renderPage({ route, serverContext, document, inlineCriticalCss, outputFiles, loadBundle, }: RenderOptions): Promise<RenderResult>;
