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
            if (block.groupOptions.name) {
                // Ignore groups which have been named already.
                return undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtZWQtY2h1bmtzLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILHFDQUEwRjtBQUUxRixtRUFBbUU7QUFDbkUsTUFBTSxnQkFBZ0IsR0FBeUMsT0FBTyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7QUFFcEgsTUFBTSxXQUFXLEdBQUcscUJBQXFCLENBQUM7QUFFMUM7Ozs7R0FJRztBQUNILE1BQWEsaUJBQWlCO0lBQzVCLEtBQUssQ0FBQyxRQUFrQjtRQUN0QixRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDMUQsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUN0RCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7b0JBQ2QsT0FBTztpQkFDUjtnQkFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLElBQUksRUFBRTtvQkFDUixLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztpQkFDbkI7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLFlBQVksQ0FBQyxLQUFZO1FBQy9CLEtBQUssTUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxDQUFDLEtBQUssWUFBWSxnQ0FBc0IsQ0FBQyxFQUFFO2dCQUM5QyxTQUFTO2FBQ1Y7WUFFRCxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFO2dCQUMzQiwrQ0FBK0M7Z0JBQy9DLE9BQU8sU0FBUyxDQUFDO2FBQ2xCO1lBRUQsS0FBSyxNQUFNLFVBQVUsSUFBSSxLQUFLLENBQUMsWUFBWSxFQUFFO2dCQUMzQyxJQUFJLFVBQVUsWUFBWSxnQkFBZ0IsRUFBRTtvQkFDMUMsT0FBTyxrQkFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQzVDO2FBQ0Y7U0FDRjtRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7Q0FDRjtBQXJDRCw4Q0FxQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQXN5bmNEZXBlbmRlbmNpZXNCbG9jaywgQ2h1bmssIENvbXBpbGVyLCBUZW1wbGF0ZSwgZGVwZW5kZW5jaWVzIH0gZnJvbSAnd2VicGFjayc7XG5cbi8vIGBJbXBvcnREZXBlbmRlbmN5YCBpcyBub3QgcGFydCBvZiBXZWJwYWNrJ3MgZGVwZW5lbmNpZXMgdHlwaW5ncy5cbmNvbnN0IEltcG9ydERlcGVuZGVuY3k6IHR5cGVvZiBkZXBlbmRlbmNpZXMuTW9kdWxlRGVwZW5kZW5jeSA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL2RlcGVuZGVuY2llcy9JbXBvcnREZXBlbmRlbmN5Jyk7XG5cbmNvbnN0IFBMVUdJTl9OQU1FID0gJ25hbWVkLWNodW5rcy1wbHVnaW4nO1xuXG4vKipcbiAqIFdlYnBhY2sgd2lsbCBub3QgcG9wdWxhdGUgdGhlIGNodW5rIGBuYW1lYCBwcm9wZXJ0eSB1bmxlc3MgYHdlYnBhY2tDaHVua05hbWVgIG1hZ2ljIGNvbW1lbnQgaXMgdXNlZC5cbiAqIFRoaXMgaG93ZXZlciB3aWxsIGFsc28gZWZmZWN0IHRoZSBmaWxlbmFtZSB3aGljaCBpcyBub3QgZGVzaXJlZCB3aGVuIHVzaW5nIGBkZXRlcm1pbmlzdGljYCBjaHVua0lkcy5cbiAqIFRoaXMgcGx1Z2luIHdpbGwgcG9wdWxhdGUgdGhlIGNodW5rIGBuYW1lYCB3aGljaCBpcyBtYWlubHkgdXNlZCBzbyB0aGF0IHVzZXJzIGNhbiBzZXQgYnVuZGxlIGJ1ZGdldHMgb24gbGF6eSBjaHVua3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBOYW1lZENodW5rc1BsdWdpbiB7XG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICBjb21waWxhdGlvbi5ob29rcy5jaHVua0Fzc2V0LnRhcChQTFVHSU5fTkFNRSwgKGNodW5rKSA9PiB7XG4gICAgICAgIGlmIChjaHVuay5uYW1lKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMuZ2VuZXJhdGVOYW1lKGNodW5rKTtcbiAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICBjaHVuay5uYW1lID0gbmFtZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdlbmVyYXRlTmFtZShjaHVuazogQ2h1bmspOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGZvciAoY29uc3QgZ3JvdXAgb2YgY2h1bmsuZ3JvdXBzSXRlcmFibGUpIHtcbiAgICAgIGNvbnN0IFtibG9ja10gPSBncm91cC5nZXRCbG9ja3MoKTtcbiAgICAgIGlmICghKGJsb2NrIGluc3RhbmNlb2YgQXN5bmNEZXBlbmRlbmNpZXNCbG9jaykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChibG9jay5ncm91cE9wdGlvbnMubmFtZSkge1xuICAgICAgICAvLyBJZ25vcmUgZ3JvdXBzIHdoaWNoIGhhdmUgYmVlbiBuYW1lZCBhbHJlYWR5LlxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGRlcGVuZGVuY3kgb2YgYmxvY2suZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGlmIChkZXBlbmRlbmN5IGluc3RhbmNlb2YgSW1wb3J0RGVwZW5kZW5jeSkge1xuICAgICAgICAgIHJldHVybiBUZW1wbGF0ZS50b1BhdGgoZGVwZW5kZW5jeS5yZXF1ZXN0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cbiJdfQ==