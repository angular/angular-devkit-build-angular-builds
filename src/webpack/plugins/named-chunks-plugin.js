"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NamedChunksPlugin = void 0;
const webpack_1 = require("webpack");
// `ImportDependency` is not part of Webpack's depenencies typings.
const ImportDependency = require('webpack/lib/dependencies/ImportDependency');
const PLUGIN_NAME = 'named-chunks-plugin';
/**
 * Webpack will not populate the chunk `name` property unless `webpackChunkName` magic comment is used.
 * This however will also effect the filename which is not desired when using `deterministic` chunkIds.
 * This plugin will populate the chunk `name` which is mainly used so that users can set bundle budgets on lazy chunks.
 */
class NamedChunksPlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.chunkAsset.tap(PLUGIN_NAME, (chunk) => {
                if (chunk.name) {
                    return;
                }
                const name = this.generateName(chunk);
                if (name) {
                    chunk.name = name;
                }
            });
        });
    }
    generateName(chunk) {
        for (const group of chunk.groupsIterable) {
            const [block] = group.getBlocks();
            if (!(block instanceof webpack_1.AsyncDependenciesBlock)) {
                continue;
            }
            for (const dependency of block.dependencies) {
                if (dependency instanceof ImportDependency) {
                    return webpack_1.Template.toPath(dependency.request);
                }
            }
        }
        return undefined;
    }
}
exports.NamedChunksPlugin = NamedChunksPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtZWQtY2h1bmtzLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILHFDQUEwRjtBQUUxRixtRUFBbUU7QUFDbkUsTUFBTSxnQkFBZ0IsR0FBeUMsT0FBTyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7QUFFcEgsTUFBTSxXQUFXLEdBQUcscUJBQXFCLENBQUM7QUFFMUM7Ozs7R0FJRztBQUNILE1BQWEsaUJBQWlCO0lBQzVCLEtBQUssQ0FBQyxRQUFrQjtRQUN0QixRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDMUQsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUN0RCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7b0JBQ2QsT0FBTztpQkFDUjtnQkFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLElBQUksRUFBRTtvQkFDUixLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztpQkFDbkI7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLFlBQVksQ0FBQyxLQUFZO1FBQy9CLEtBQUssTUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxDQUFDLEtBQUssWUFBWSxnQ0FBc0IsQ0FBQyxFQUFFO2dCQUM5QyxTQUFTO2FBQ1Y7WUFFRCxLQUFLLE1BQU0sVUFBVSxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUU7Z0JBQzNDLElBQUksVUFBVSxZQUFZLGdCQUFnQixFQUFFO29CQUMxQyxPQUFPLGtCQUFRLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDNUM7YUFDRjtTQUNGO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztDQUNGO0FBaENELDhDQWdDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBc3luY0RlcGVuZGVuY2llc0Jsb2NrLCBDaHVuaywgQ29tcGlsZXIsIFRlbXBsYXRlLCBkZXBlbmRlbmNpZXMgfSBmcm9tICd3ZWJwYWNrJztcblxuLy8gYEltcG9ydERlcGVuZGVuY3lgIGlzIG5vdCBwYXJ0IG9mIFdlYnBhY2sncyBkZXBlbmVuY2llcyB0eXBpbmdzLlxuY29uc3QgSW1wb3J0RGVwZW5kZW5jeTogdHlwZW9mIGRlcGVuZGVuY2llcy5Nb2R1bGVEZXBlbmRlbmN5ID0gcmVxdWlyZSgnd2VicGFjay9saWIvZGVwZW5kZW5jaWVzL0ltcG9ydERlcGVuZGVuY3knKTtcblxuY29uc3QgUExVR0lOX05BTUUgPSAnbmFtZWQtY2h1bmtzLXBsdWdpbic7XG5cbi8qKlxuICogV2VicGFjayB3aWxsIG5vdCBwb3B1bGF0ZSB0aGUgY2h1bmsgYG5hbWVgIHByb3BlcnR5IHVubGVzcyBgd2VicGFja0NodW5rTmFtZWAgbWFnaWMgY29tbWVudCBpcyB1c2VkLlxuICogVGhpcyBob3dldmVyIHdpbGwgYWxzbyBlZmZlY3QgdGhlIGZpbGVuYW1lIHdoaWNoIGlzIG5vdCBkZXNpcmVkIHdoZW4gdXNpbmcgYGRldGVybWluaXN0aWNgIGNodW5rSWRzLlxuICogVGhpcyBwbHVnaW4gd2lsbCBwb3B1bGF0ZSB0aGUgY2h1bmsgYG5hbWVgIHdoaWNoIGlzIG1haW5seSB1c2VkIHNvIHRoYXQgdXNlcnMgY2FuIHNldCBidW5kbGUgYnVkZ2V0cyBvbiBsYXp5IGNodW5rcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5hbWVkQ2h1bmtzUGx1Z2luIHtcbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmNodW5rQXNzZXQudGFwKFBMVUdJTl9OQU1FLCAoY2h1bmspID0+IHtcbiAgICAgICAgaWYgKGNodW5rLm5hbWUpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5nZW5lcmF0ZU5hbWUoY2h1bmspO1xuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgIGNodW5rLm5hbWUgPSBuYW1lO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2VuZXJhdGVOYW1lKGNodW5rOiBDaHVuayk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgZm9yIChjb25zdCBncm91cCBvZiBjaHVuay5ncm91cHNJdGVyYWJsZSkge1xuICAgICAgY29uc3QgW2Jsb2NrXSA9IGdyb3VwLmdldEJsb2NrcygpO1xuICAgICAgaWYgKCEoYmxvY2sgaW5zdGFuY2VvZiBBc3luY0RlcGVuZGVuY2llc0Jsb2NrKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBkZXBlbmRlbmN5IG9mIGJsb2NrLmRlcGVuZGVuY2llcykge1xuICAgICAgICBpZiAoZGVwZW5kZW5jeSBpbnN0YW5jZW9mIEltcG9ydERlcGVuZGVuY3kpIHtcbiAgICAgICAgICByZXR1cm4gVGVtcGxhdGUudG9QYXRoKGRlcGVuZGVuY3kucmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG4iXX0=