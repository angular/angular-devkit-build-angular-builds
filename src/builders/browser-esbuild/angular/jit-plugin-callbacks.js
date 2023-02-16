"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupJitPluginCallbacks = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const stylesheets_1 = require("../stylesheets");
const uri_1 = require("./uri");
/**
 * Loads/extracts the contents from a load callback Angular JIT entry.
 * An Angular JIT entry represents either a file path for a component resource or base64
 * encoded data for an inline component resource.
 * @param entry The value that represents content to load.
 * @param root The absolute path for the root of the build (typically the workspace root).
 * @param skipRead If true, do not attempt to read the file; if false, read file content from disk.
 * This option has no effect if the entry does not originate from a file. Defaults to false.
 * @returns An object containing the absolute path of the contents and optionally the actual contents.
 * For inline entries the contents will always be provided.
 */
async function loadEntry(entry, root, skipRead) {
    if (entry.startsWith('file:')) {
        const specifier = node_path_1.default.join(root, entry.slice(5));
        return {
            path: specifier,
            contents: skipRead ? undefined : await (0, promises_1.readFile)(specifier, 'utf-8'),
        };
    }
    else if (entry.startsWith('inline:')) {
        const [importer, data] = entry.slice(7).split(';', 2);
        return {
            path: node_path_1.default.join(root, importer),
            contents: Buffer.from(data, 'base64').toString(),
        };
    }
    else {
        throw new Error('Invalid data for Angular JIT entry.');
    }
}
/**
 * Sets up esbuild resolve and load callbacks to support Angular JIT mode processing
 * for both Component stylesheets and templates. These callbacks work alongside the JIT
 * resource TypeScript transformer to convert and then bundle Component resources as
 * static imports.
 * @param build An esbuild {@link PluginBuild} instance used to add callbacks.
 * @param styleOptions The options to use when bundling stylesheets.
 * @param stylesheetResourceFiles An array where stylesheet resources will be added.
 */
function setupJitPluginCallbacks(build, styleOptions, stylesheetResourceFiles) {
    const root = build.initialOptions.absWorkingDir ?? '';
    // Add a resolve callback to capture and parse any JIT URIs that were added by the
    // JIT resource TypeScript transformer.
    // Resources originating from a file are resolved as relative from the containing file (importer).
    build.onResolve({ filter: uri_1.JIT_NAMESPACE_REGEXP }, (args) => {
        const parsed = (0, uri_1.parseJitUri)(args.path);
        if (!parsed) {
            return undefined;
        }
        const { namespace, origin, specifier } = parsed;
        if (origin === 'file') {
            return {
                // Use a relative path to prevent fully resolved paths in the metafile (JSON stats file).
                // This is only necessary for custom namespaces. esbuild will handle the file namespace.
                path: 'file:' + node_path_1.default.relative(root, node_path_1.default.join(node_path_1.default.dirname(args.importer), specifier)),
                namespace,
            };
        }
        else {
            // Inline data may need the importer to resolve imports/references within the content
            const importer = node_path_1.default.relative(root, args.importer);
            return {
                path: `inline:${importer};${specifier}`,
                namespace,
            };
        }
    });
    // Add a load callback to handle Component stylesheets (both inline and external)
    build.onLoad({ filter: /./, namespace: uri_1.JIT_STYLE_NAMESPACE }, async (args) => {
        // skipRead is used here because the stylesheet bundling will read a file stylesheet
        // directly either via a preprocessor or esbuild itself.
        const entry = await loadEntry(args.path, root, true /* skipRead */);
        const { contents, resourceFiles, errors, warnings } = await (0, stylesheets_1.bundleComponentStylesheet)(styleOptions.inlineStyleLanguage, 
        // The `data` parameter is only needed for a stylesheet if it was inline
        entry.contents ?? '', entry.path, entry.contents !== undefined, styleOptions);
        stylesheetResourceFiles.push(...resourceFiles);
        return {
            errors,
            warnings,
            contents,
            loader: 'text',
        };
    });
    // Add a load callback to handle Component templates
    // NOTE: While this callback supports both inline and external templates, the transformer
    // currently only supports generating URIs for external templates.
    build.onLoad({ filter: /./, namespace: uri_1.JIT_TEMPLATE_NAMESPACE }, async (args) => {
        const { contents } = await loadEntry(args.path, root);
        return {
            contents,
            loader: 'text',
        };
    });
}
exports.setupJitPluginCallbacks = setupJitPluginCallbacks;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LXBsdWdpbi1jYWxsYmFja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvYW5ndWxhci9qaXQtcGx1Z2luLWNhbGxiYWNrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCwrQ0FBNEM7QUFDNUMsMERBQTZCO0FBQzdCLGdEQUFvRjtBQUNwRiwrQkFLZTtBQUVmOzs7Ozs7Ozs7O0dBVUc7QUFDSCxLQUFLLFVBQVUsU0FBUyxDQUN0QixLQUFhLEVBQ2IsSUFBWSxFQUNaLFFBQWtCO0lBRWxCLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM3QixNQUFNLFNBQVMsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWxELE9BQU87WUFDTCxJQUFJLEVBQUUsU0FBUztZQUNmLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFBLG1CQUFRLEVBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQztTQUNwRSxDQUFDO0tBQ0g7U0FBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDdEMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdEQsT0FBTztZQUNMLElBQUksRUFBRSxtQkFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDO1lBQy9CLFFBQVEsRUFBRSxNQUFNLENBQUMs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TCxRQUFRO1lBQ1IsTUFBTSxFQUFFLE1BQU07U0FDZixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBeEVELDBEQXdFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE91dHB1dEZpbGUsIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLCBidW5kbGVDb21wb25lbnRTdHlsZXNoZWV0IH0gZnJvbSAnLi4vc3R5bGVzaGVldHMnO1xuaW1wb3J0IHtcbiAgSklUX05BTUVTUEFDRV9SRUdFWFAsXG4gIEpJVF9TVFlMRV9OQU1FU1BBQ0UsXG4gIEpJVF9URU1QTEFURV9OQU1FU1BBQ0UsXG4gIHBhcnNlSml0VXJpLFxufSBmcm9tICcuL3VyaSc7XG5cbi8qKlxuICogTG9hZHMvZXh0cmFjdHMgdGhlIGNvbnRlbnRzIGZyb20gYSBsb2FkIGNhbGxiYWNrIEFuZ3VsYXIgSklUIGVudHJ5LlxuICogQW4gQW5ndWxhciBKSVQgZW50cnkgcmVwcmVzZW50cyBlaXRoZXIgYSBmaWxlIHBhdGggZm9yIGEgY29tcG9uZW50IHJlc291cmNlIG9yIGJhc2U2NFxuICogZW5jb2RlZCBkYXRhIGZvciBhbiBpbmxpbmUgY29tcG9uZW50IHJlc291cmNlLlxuICogQHBhcmFtIGVudHJ5IFRoZSB2YWx1ZSB0aGF0IHJlcHJlc2VudHMgY29udGVudCB0byBsb2FkLlxuICogQHBhcmFtIHJvb3QgVGhlIGFic29sdXRlIHBhdGggZm9yIHRoZSByb290IG9mIHRoZSBidWlsZCAodHlwaWNhbGx5IHRoZSB3b3Jrc3BhY2Ugcm9vdCkuXG4gKiBAcGFyYW0gc2tpcFJlYWQgSWYgdHJ1ZSwgZG8gbm90IGF0dGVtcHQgdG8gcmVhZCB0aGUgZmlsZTsgaWYgZmFsc2UsIHJlYWQgZmlsZSBjb250ZW50IGZyb20gZGlzay5cbiAqIFRoaXMgb3B0aW9uIGhhcyBubyBlZmZlY3QgaWYgdGhlIGVudHJ5IGRvZXMgbm90IG9yaWdpbmF0ZSBmcm9tIGEgZmlsZS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgYWJzb2x1dGUgcGF0aCBvZiB0aGUgY29udGVudHMgYW5kIG9wdGlvbmFsbHkgdGhlIGFjdHVhbCBjb250ZW50cy5cbiAqIEZvciBpbmxpbmUgZW50cmllcyB0aGUgY29udGVudHMgd2lsbCBhbHdheXMgYmUgcHJvdmlkZWQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvYWRFbnRyeShcbiAgZW50cnk6IHN0cmluZyxcbiAgcm9vdDogc3RyaW5nLFxuICBza2lwUmVhZD86IGJvb2xlYW4sXG4pOiBQcm9taXNlPHsgcGF0aDogc3RyaW5nOyBjb250ZW50cz86IHN0cmluZyB9PiB7XG4gIGlmIChlbnRyeS5zdGFydHNXaXRoKCdmaWxlOicpKSB7XG4gICAgY29uc3Qgc3BlY2lmaWVyID0gcGF0aC5qb2luKHJvb3QsIGVudHJ5LnNsaWNlKDUpKTtcblxuICAgIHJldHVybiB7XG4gICAgICBwYXRoOiBzcGVjaWZpZXIsXG4gICAgICBjb250ZW50czogc2tpcFJlYWQgPyB1bmRlZmluZWQgOiBhd2FpdCByZWFkRmlsZShzcGVjaWZpZXIsICd1dGYtOCcpLFxuICAgIH07XG4gIH0gZWxzZSBpZiAoZW50cnkuc3RhcnRzV2l0aCgnaW5saW5lOicpKSB7XG4gICAgY29uc3QgW2ltcG9ydGVyLCBkYXRhXSA9IGVudHJ5LnNsaWNlKDcpLnNwbGl0KCc7JywgMik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcGF0aDogcGF0aC5qb2luKHJvb3QsIGltcG9ydGVyKSxcbiAgICAgIGNvbnRlbnRzOiBCdWZmZXIuZnJvbShkYXRhLCAnYmFzZTY0JykudG9TdHJpbmcoKSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkYXRhIGZvciBBbmd1bGFyIEpJVCBlbnRyeS4nKTtcbiAgfVxufVxuXG4vKipcbiAqIFNldHMgdXAgZXNidWlsZCByZXNvbHZlIGFuZCBsb2FkIGNhbGxiYWNrcyB0byBzdXBwb3J0IEFuZ3VsYXIgSklUIG1vZGUgcHJvY2Vzc2luZ1xuICogZm9yIGJvdGggQ29tcG9uZW50IHN0eWxlc2hlZXRzIGFuZCB0ZW1wbGF0ZXMuIFRoZXNlIGNhbGxiYWNrcyB3b3JrIGFsb25nc2lkZSB0aGUgSklUXG4gKiByZXNvdXJjZSBUeXBlU2NyaXB0IHRyYW5zZm9ybWVyIHRvIGNvbnZlcnQgYW5kIHRoZW4gYnVuZGxlIENvbXBvbmVudCByZXNvdXJjZXMgYXNcbiAqIHN0YXRpYyBpbXBvcnRzLlxuICogQHBhcmFtIGJ1aWxkIEFuIGVzYnVpbGQge0BsaW5rIFBsdWdpbkJ1aWxkfSBpbnN0YW5jZSB1c2VkIHRvIGFkZCBjYWxsYmFja3MuXG4gKiBAcGFyYW0gc3R5bGVPcHRpb25zIFRoZSBvcHRpb25zIHRvIHVzZSB3aGVuIGJ1bmRsaW5nIHN0eWxlc2hlZXRzLlxuICogQHBhcmFtIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzIEFuIGFycmF5IHdoZXJlIHN0eWxlc2hlZXQgcmVzb3VyY2VzIHdpbGwgYmUgYWRkZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyhcbiAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zICYgeyBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcgfSxcbiAgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSxcbik6IHZvaWQge1xuICBjb25zdCByb290ID0gYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJztcblxuICAvLyBBZGQgYSByZXNvbHZlIGNhbGxiYWNrIHRvIGNhcHR1cmUgYW5kIHBhcnNlIGFueSBKSVQgVVJJcyB0aGF0IHdlcmUgYWRkZWQgYnkgdGhlXG4gIC8vIEpJVCByZXNvdXJjZSBUeXBlU2NyaXB0IHRyYW5zZm9ybWVyLlxuICAvLyBSZXNvdXJjZXMgb3JpZ2luYXRpbmcgZnJvbSBhIGZpbGUgYXJlIHJlc29sdmVkIGFzIHJlbGF0aXZlIGZyb20gdGhlIGNvbnRhaW5pbmcgZmlsZSAoaW1wb3J0ZXIpLlxuICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IEpJVF9OQU1FU1BBQ0VfUkVHRVhQIH0sIChhcmdzKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkID0gcGFyc2VKaXRVcmkoYXJncy5wYXRoKTtcbiAgICBpZiAoIXBhcnNlZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCB7IG5hbWVzcGFjZSwgb3JpZ2luLCBzcGVjaWZpZXIgfSA9IHBhcnNlZDtcblxuICAgIGlmIChvcmlnaW4gPT09ICdmaWxlJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLy8gVXNlIGEgcmVsYXRpdmUgcGF0aCB0byBwcmV2ZW50IGZ1bGx5IHJlc29sdmVkIHBhdGhzIGluIHRoZSBtZXRhZmlsZSAoSlNPTiBzdGF0cyBmaWxlKS5cbiAgICAgICAgLy8gVGhpcyBpcyBvbmx5IG5lY2Vzc2FyeSBmb3IgY3VzdG9tIG5hbWVzcGFjZXMuIGVzYnVpbGQgd2lsbCBoYW5kbGUgdGhlIGZpbGUgbmFtZXNwYWNlLlxuICAgICAgICBwYXRoOiAnZmlsZTonICsgcGF0aC5yZWxhdGl2ZShyb290LCBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGFyZ3MuaW1wb3J0ZXIpLCBzcGVjaWZpZXIpKSxcbiAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSW5saW5lIGRhdGEgbWF5IG5lZWQgdGhlIGltcG9ydGVyIHRvIHJlc29sdmUgaW1wb3J0cy9yZWZlcmVuY2VzIHdpdGhpbiB0aGUgY29udGVudFxuICAgICAgY29uc3QgaW1wb3J0ZXIgPSBwYXRoLnJlbGF0aXZlKHJvb3QsIGFyZ3MuaW1wb3J0ZXIpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBwYXRoOiBgaW5saW5lOiR7aW1wb3J0ZXJ9OyR7c3BlY2lmaWVyfWAsXG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIGhhbmRsZSBDb21wb25lbnQgc3R5bGVzaGVldHMgKGJvdGggaW5saW5lIGFuZCBleHRlcm5hbClcbiAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogSklUX1NUWUxFX05BTUVTUEFDRSB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgIC8vIHNraXBSZWFkIGlzIHVzZWQgaGVyZSBiZWNhdXNlIHRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIHdpbGwgcmVhZCBhIGZpbGUgc3R5bGVzaGVldFxuICAgIC8vIGRpcmVjdGx5IGVpdGhlciB2aWEgYSBwcmVwcm9jZXNzb3Igb3IgZXNidWlsZCBpdHNlbGYuXG4gICAgY29uc3QgZW50cnkgPSBhd2FpdCBsb2FkRW50cnkoYXJncy5wYXRoLCByb290LCB0cnVlIC8qIHNraXBSZWFkICovKTtcblxuICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gICAgICBzdHlsZU9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgIC8vIFRoZSBgZGF0YWAgcGFyYW1ldGVyIGlzIG9ubHkgbmVlZGVkIGZvciBhIHN0eWxlc2hlZXQgaWYgaXQgd2FzIGlubGluZVxuICAgICAgZW50cnkuY29udGVudHMgPz8gJycsXG4gICAgICBlbnRyeS5wYXRoLFxuICAgICAgZW50cnkuY29udGVudHMgIT09IHVuZGVmaW5lZCxcbiAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICApO1xuXG4gICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgbG9hZGVyOiAndGV4dCcsXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBoYW5kbGUgQ29tcG9uZW50IHRlbXBsYXRlc1xuICAvLyBOT1RFOiBXaGlsZSB0aGlzIGNhbGxiYWNrIHN1cHBvcnRzIGJvdGggaW5saW5lIGFuZCBleHRlcm5hbCB0ZW1wbGF0ZXMsIHRoZSB0cmFuc2Zvcm1lclxuICAvLyBjdXJyZW50bHkgb25seSBzdXBwb3J0cyBnZW5lcmF0aW5nIFVSSXMgZm9yIGV4dGVybmFsIHRlbXBsYXRlcy5cbiAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogSklUX1RFTVBMQVRFX05BTUVTUEFDRSB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgIGNvbnN0IHsgY29udGVudHMgfSA9IGF3YWl0IGxvYWRFbnRyeShhcmdzLnBhdGgsIHJvb3QpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgbG9hZGVyOiAndGV4dCcsXG4gICAgfTtcbiAgfSk7XG59XG4iXX0=