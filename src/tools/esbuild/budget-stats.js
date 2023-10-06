"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBudgetStats = void 0;
const node_path_1 = require("node:path");
/**
 * Generates a bundle budget calculator compatible stats object that provides
 * the necessary information for the Webpack-based bundle budget code to
 * interoperate with the esbuild-based builders.
 * @param metafile The esbuild metafile of a build to use.
 * @param initialFiles The records of all initial files of a build.
 * @returns A bundle budget compatible stats object.
 */
function generateBudgetStats(metafile, initialFiles) {
    const stats = {
        chunks: [],
        assets: [],
    };
    for (const [file, entry] of Object.entries(metafile.outputs)) {
        if (!file.endsWith('.js') && !file.endsWith('.css')) {
            continue;
        }
        const initialRecord = initialFiles.get(file);
        let name = initialRecord?.name;
        if (name === undefined && entry.entryPoint) {
            // For non-initial lazy modules, convert the entry point file into a Webpack compatible name
            name = (0, node_path_1.basename)(entry.entryPoint)
                .replace(/\.[cm]?[jt]s$/, '')
                .replace(/[\\/.]/g, '-');
        }
        stats.chunks.push({
            files: [file],
            initial: !!initialRecord,
            names: name ? [name] : undefined,
        });
        stats.assets.push({ name: file, size: entry.bytes });
    }
    return stats;
}
exports.generateBudgetStats = generateBudgetStats;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVkZ2V0LXN0YXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idWRnZXQtc3RhdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQXFDO0FBSXJDOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixtQkFBbUIsQ0FDakMsUUFBa0IsRUFDbEIsWUFBNEM7SUFFNUMsTUFBTSxLQUFLLEdBQTBCO1FBQ25DLE1BQU0sRUFBRSxFQUFFO1FBQ1YsTUFBTSxFQUFFLEVBQUU7S0FDWCxDQUFDO0lBRUYsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzVELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNuRCxTQUFTO1NBQ1Y7UUFFRCxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdDLElBQUksSUFBSSxHQUFHLGFBQWEsRUFBRSxJQUFJLENBQUM7UUFDL0IsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7WUFDMUMsNEZBQTRGO1lBQzVGLElBQUksR0FBRyxJQUFBLG9CQUFRLEVBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztpQkFDOUIsT0FBTyxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUM7aUJBQzVCLE9BQU8sQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDNUI7UUFFRCxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNoQixLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUM7WUFDYixPQUFPLEVBQUUsQ0FBQyxDQUFDLGFBQWE7WUFDeEIsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztTQUNqQyxDQUFDLENBQUM7UUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0tBQ3REO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBaENELGtEQWdDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE1ldGFmaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgdHlwZSB7IEJ1ZGdldFN0YXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHR5cGUgeyBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBidW5kbGUgYnVkZ2V0IGNhbGN1bGF0b3IgY29tcGF0aWJsZSBzdGF0cyBvYmplY3QgdGhhdCBwcm92aWRlc1xuICogdGhlIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiBmb3IgdGhlIFdlYnBhY2stYmFzZWQgYnVuZGxlIGJ1ZGdldCBjb2RlIHRvXG4gKiBpbnRlcm9wZXJhdGUgd2l0aCB0aGUgZXNidWlsZC1iYXNlZCBidWlsZGVycy5cbiAqIEBwYXJhbSBtZXRhZmlsZSBUaGUgZXNidWlsZCBtZXRhZmlsZSBvZiBhIGJ1aWxkIHRvIHVzZS5cbiAqIEBwYXJhbSBpbml0aWFsRmlsZXMgVGhlIHJlY29yZHMgb2YgYWxsIGluaXRpYWwgZmlsZXMgb2YgYSBidWlsZC5cbiAqIEByZXR1cm5zIEEgYnVuZGxlIGJ1ZGdldCBjb21wYXRpYmxlIHN0YXRzIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQnVkZ2V0U3RhdHMoXG4gIG1ldGFmaWxlOiBNZXRhZmlsZSxcbiAgaW5pdGlhbEZpbGVzOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4pOiBCdWRnZXRTdGF0cyB7XG4gIGNvbnN0IHN0YXRzOiBSZXF1aXJlZDxCdWRnZXRTdGF0cz4gPSB7XG4gICAgY2h1bmtzOiBbXSxcbiAgICBhc3NldHM6IFtdLFxuICB9O1xuXG4gIGZvciAoY29uc3QgW2ZpbGUsIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyhtZXRhZmlsZS5vdXRwdXRzKSkge1xuICAgIGlmICghZmlsZS5lbmRzV2l0aCgnLmpzJykgJiYgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaW5pdGlhbFJlY29yZCA9IGluaXRpYWxGaWxlcy5nZXQoZmlsZSk7XG4gICAgbGV0IG5hbWUgPSBpbml0aWFsUmVjb3JkPy5uYW1lO1xuICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQgJiYgZW50cnkuZW50cnlQb2ludCkge1xuICAgICAgLy8gRm9yIG5vbi1pbml0aWFsIGxhenkgbW9kdWxlcywgY29udmVydCB0aGUgZW50cnkgcG9pbnQgZmlsZSBpbnRvIGEgV2VicGFjayBjb21wYXRpYmxlIG5hbWVcbiAgICAgIG5hbWUgPSBiYXNlbmFtZShlbnRyeS5lbnRyeVBvaW50KVxuICAgICAgICAucmVwbGFjZSgvXFwuW2NtXT9banRdcyQvLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL1tcXFxcLy5dL2csICctJyk7XG4gICAgfVxuXG4gICAgc3RhdHMuY2h1bmtzLnB1c2goe1xuICAgICAgZmlsZXM6IFtmaWxlXSxcbiAgICAgIGluaXRpYWw6ICEhaW5pdGlhbFJlY29yZCxcbiAgICAgIG5hbWVzOiBuYW1lID8gW25hbWVdIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHN0YXRzLmFzc2V0cy5wdXNoKHsgbmFtZTogZmlsZSwgc2l6ZTogZW50cnkuYnl0ZXMgfSk7XG4gIH1cblxuICByZXR1cm4gc3RhdHM7XG59XG4iXX0=