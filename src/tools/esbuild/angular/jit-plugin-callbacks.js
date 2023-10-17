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
function setupJitPluginCallbacks(build, stylesheetBundler, stylesheetResourceFiles, inlineStyleLanguage) {
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
        let stylesheetResult;
        // Stylesheet contents only exist for internal stylesheets
        if (entry.contents === undefined) {
            stylesheetResult = await stylesheetBundler.bundleFile(entry.path);
        }
        else {
            stylesheetResult = await stylesheetBundler.bundleInline(entry.contents, entry.path, inlineStyleLanguage);
        }
        const { contents, resourceFiles, errors, warnings } = stylesheetResult;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LXBsdWdpbi1jYWxsYmFja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FuZ3VsYXIvaml0LXBsdWdpbi1jYWxsYmFja3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsK0NBQTRDO0FBQzVDLDBEQUE2QjtBQUU3QiwrQkFLZTtBQUVmOzs7Ozs7Ozs7O0dBVUc7QUFDSCxLQUFLLFVBQVUsU0FBUyxDQUN0QixLQUFhLEVBQ2IsSUFBWSxFQUNaLFFBQWtCO0lBRWxCLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM3QixNQUFNLFNBQVMsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWxELE9BQU87WUFDTCxJQUFJLEVBQUUsU0FBUztZQUNmLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFBLG1CQUFRLEVBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQztTQUNwRSxDQUFDO0tBQ0g7U0FBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDdEMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdEQsT0FBTztZQUNMLElBQUksRUFBRSxtQkFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDO1lBQy9CLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFR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RSxJQUFJLEVBQUUsRUFBRTtRQUM5RSxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV0RCxPQUFPO1lBQ0wsUUFBUTtZQUNSLE1BQU0sRUFBRSxNQUFNO1NBQ2YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQS9FRCwwREErRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPdXRwdXRGaWxlLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlciB9IGZyb20gJy4vY29tcG9uZW50LXN0eWxlc2hlZXRzJztcbmltcG9ydCB7XG4gIEpJVF9OQU1FU1BBQ0VfUkVHRVhQLFxuICBKSVRfU1RZTEVfTkFNRVNQQUNFLFxuICBKSVRfVEVNUExBVEVfTkFNRVNQQUNFLFxuICBwYXJzZUppdFVyaSxcbn0gZnJvbSAnLi91cmknO1xuXG4vKipcbiAqIExvYWRzL2V4dHJhY3RzIHRoZSBjb250ZW50cyBmcm9tIGEgbG9hZCBjYWxsYmFjayBBbmd1bGFyIEpJVCBlbnRyeS5cbiAqIEFuIEFuZ3VsYXIgSklUIGVudHJ5IHJlcHJlc2VudHMgZWl0aGVyIGEgZmlsZSBwYXRoIGZvciBhIGNvbXBvbmVudCByZXNvdXJjZSBvciBiYXNlNjRcbiAqIGVuY29kZWQgZGF0YSBmb3IgYW4gaW5saW5lIGNvbXBvbmVudCByZXNvdXJjZS5cbiAqIEBwYXJhbSBlbnRyeSBUaGUgdmFsdWUgdGhhdCByZXByZXNlbnRzIGNvbnRlbnQgdG8gbG9hZC5cbiAqIEBwYXJhbSByb290IFRoZSBhYnNvbHV0ZSBwYXRoIGZvciB0aGUgcm9vdCBvZiB0aGUgYnVpbGQgKHR5cGljYWxseSB0aGUgd29ya3NwYWNlIHJvb3QpLlxuICogQHBhcmFtIHNraXBSZWFkIElmIHRydWUsIGRvIG5vdCBhdHRlbXB0IHRvIHJlYWQgdGhlIGZpbGU7IGlmIGZhbHNlLCByZWFkIGZpbGUgY29udGVudCBmcm9tIGRpc2suXG4gKiBUaGlzIG9wdGlvbiBoYXMgbm8gZWZmZWN0IGlmIHRoZSBlbnRyeSBkb2VzIG5vdCBvcmlnaW5hdGUgZnJvbSBhIGZpbGUuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGFic29sdXRlIHBhdGggb2YgdGhlIGNvbnRlbnRzIGFuZCBvcHRpb25hbGx5IHRoZSBhY3R1YWwgY29udGVudHMuXG4gKiBGb3IgaW5saW5lIGVudHJpZXMgdGhlIGNvbnRlbnRzIHdpbGwgYWx3YXlzIGJlIHByb3ZpZGVkLlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkRW50cnkoXG4gIGVudHJ5OiBzdHJpbmcsXG4gIHJvb3Q6IHN0cmluZyxcbiAgc2tpcFJlYWQ/OiBib29sZWFuLFxuKTogUHJvbWlzZTx7IHBhdGg6IHN0cmluZzsgY29udGVudHM/OiBzdHJpbmcgfT4ge1xuICBpZiAoZW50cnkuc3RhcnRzV2l0aCgnZmlsZTonKSkge1xuICAgIGNvbnN0IHNwZWNpZmllciA9IHBhdGguam9pbihyb290LCBlbnRyeS5zbGljZSg1KSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcGF0aDogc3BlY2lmaWVyLFxuICAgICAgY29udGVudHM6IHNraXBSZWFkID8gdW5kZWZpbmVkIDogYXdhaXQgcmVhZEZpbGUoc3BlY2lmaWVyLCAndXRmLTgnKSxcbiAgICB9O1xuICB9IGVsc2UgaWYgKGVudHJ5LnN0YXJ0c1dpdGgoJ2lubGluZTonKSkge1xuICAgIGNvbnN0IFtpbXBvcnRlciwgZGF0YV0gPSBlbnRyeS5zbGljZSg3KS5zcGxpdCgnOycsIDIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhdGg6IHBhdGguam9pbihyb290LCBpbXBvcnRlciksXG4gICAgICBjb250ZW50czogQnVmZmVyLmZyb20oZGF0YSwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCksXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZGF0YSBmb3IgQW5ndWxhciBKSVQgZW50cnkuJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXRzIHVwIGVzYnVpbGQgcmVzb2x2ZSBhbmQgbG9hZCBjYWxsYmFja3MgdG8gc3VwcG9ydCBBbmd1bGFyIEpJVCBtb2RlIHByb2Nlc3NpbmdcbiAqIGZvciBib3RoIENvbXBvbmVudCBzdHlsZXNoZWV0cyBhbmQgdGVtcGxhdGVzLiBUaGVzZSBjYWxsYmFja3Mgd29yayBhbG9uZ3NpZGUgdGhlIEpJVFxuICogcmVzb3VyY2UgVHlwZVNjcmlwdCB0cmFuc2Zvcm1lciB0byBjb252ZXJ0IGFuZCB0aGVuIGJ1bmRsZSBDb21wb25lbnQgcmVzb3VyY2VzIGFzXG4gKiBzdGF0aWMgaW1wb3J0cy5cbiAqIEBwYXJhbSBidWlsZCBBbiBlc2J1aWxkIHtAbGluayBQbHVnaW5CdWlsZH0gaW5zdGFuY2UgdXNlZCB0byBhZGQgY2FsbGJhY2tzLlxuICogQHBhcmFtIHN0eWxlT3B0aW9ucyBUaGUgb3B0aW9ucyB0byB1c2Ugd2hlbiBidW5kbGluZyBzdHlsZXNoZWV0cy5cbiAqIEBwYXJhbSBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyBBbiBhcnJheSB3aGVyZSBzdHlsZXNoZWV0IHJlc291cmNlcyB3aWxsIGJlIGFkZGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBKaXRQbHVnaW5DYWxsYmFja3MoXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgc3R5bGVzaGVldEJ1bmRsZXI6IENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyLFxuICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdLFxuICBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3Qgcm9vdCA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJyc7XG5cbiAgLy8gQWRkIGEgcmVzb2x2ZSBjYWxsYmFjayB0byBjYXB0dXJlIGFuZCBwYXJzZSBhbnkgSklUIFVSSXMgdGhhdCB3ZXJlIGFkZGVkIGJ5IHRoZVxuICAvLyBKSVQgcmVzb3VyY2UgVHlwZVNjcmlwdCB0cmFuc2Zvcm1lci5cbiAgLy8gUmVzb3VyY2VzIG9yaWdpbmF0aW5nIGZyb20gYSBmaWxlIGFyZSByZXNvbHZlZCBhcyByZWxhdGl2ZSBmcm9tIHRoZSBjb250YWluaW5nIGZpbGUgKGltcG9ydGVyKS5cbiAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiBKSVRfTkFNRVNQQUNFX1JFR0VYUCB9LCAoYXJncykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSml0VXJpKGFyZ3MucGF0aCk7XG4gICAgaWYgKCFwYXJzZWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgeyBuYW1lc3BhY2UsIG9yaWdpbiwgc3BlY2lmaWVyIH0gPSBwYXJzZWQ7XG5cbiAgICBpZiAob3JpZ2luID09PSAnZmlsZScpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC8vIFVzZSBhIHJlbGF0aXZlIHBhdGggdG8gcHJldmVudCBmdWxseSByZXNvbHZlZCBwYXRocyBpbiB0aGUgbWV0YWZpbGUgKEpTT04gc3RhdHMgZmlsZSkuXG4gICAgICAgIC8vIFRoaXMgaXMgb25seSBuZWNlc3NhcnkgZm9yIGN1c3RvbSBuYW1lc3BhY2VzLiBlc2J1aWxkIHdpbGwgaGFuZGxlIHRoZSBmaWxlIG5hbWVzcGFjZS5cbiAgICAgICAgcGF0aDogJ2ZpbGU6JyArIHBhdGgucmVsYXRpdmUocm9vdCwgcGF0aC5qb2luKHBhdGguZGlybmFtZShhcmdzLmltcG9ydGVyKSwgc3BlY2lmaWVyKSksXG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElubGluZSBkYXRhIG1heSBuZWVkIHRoZSBpbXBvcnRlciB0byByZXNvbHZlIGltcG9ydHMvcmVmZXJlbmNlcyB3aXRoaW4gdGhlIGNvbnRlbnRcbiAgICAgIGNvbnN0IGltcG9ydGVyID0gcGF0aC5yZWxhdGl2ZShyb290LCBhcmdzLmltcG9ydGVyKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogYGlubGluZToke2ltcG9ydGVyfTske3NwZWNpZmllcn1gLFxuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBoYW5kbGUgQ29tcG9uZW50IHN0eWxlc2hlZXRzIChib3RoIGlubGluZSBhbmQgZXh0ZXJuYWwpXG4gIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2U6IEpJVF9TVFlMRV9OQU1FU1BBQ0UgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAvLyBza2lwUmVhZCBpcyB1c2VkIGhlcmUgYmVjYXVzZSB0aGUgc3R5bGVzaGVldCBidW5kbGluZyB3aWxsIHJlYWQgYSBmaWxlIHN0eWxlc2hlZXRcbiAgICAvLyBkaXJlY3RseSBlaXRoZXIgdmlhIGEgcHJlcHJvY2Vzc29yIG9yIGVzYnVpbGQgaXRzZWxmLlxuICAgIGNvbnN0IGVudHJ5ID0gYXdhaXQgbG9hZEVudHJ5KGFyZ3MucGF0aCwgcm9vdCwgdHJ1ZSAvKiBza2lwUmVhZCAqLyk7XG5cbiAgICBsZXQgc3R5bGVzaGVldFJlc3VsdDtcblxuICAgIC8vIFN0eWxlc2hlZXQgY29udGVudHMgb25seSBleGlzdCBmb3IgaW50ZXJuYWwgc3R5bGVzaGVldHNcbiAgICBpZiAoZW50cnkuY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IHN0eWxlc2hlZXRCdW5kbGVyLmJ1bmRsZUZpbGUoZW50cnkucGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBzdHlsZXNoZWV0QnVuZGxlci5idW5kbGVJbmxpbmUoXG4gICAgICAgIGVudHJ5LmNvbnRlbnRzLFxuICAgICAgICBlbnRyeS5wYXRoLFxuICAgICAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBzdHlsZXNoZWV0UmVzdWx0O1xuXG4gICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgbG9hZGVyOiAndGV4dCcsXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBoYW5kbGUgQ29tcG9uZW50IHRlbXBsYXRlc1xuICAvLyBOT1RFOiBXaGlsZSB0aGlzIGNhbGxiYWNrIHN1cHBvcnRzIGJvdGggaW5saW5lIGFuZCBleHRlcm5hbCB0ZW1wbGF0ZXMsIHRoZSB0cmFuc2Zvcm1lclxuICAvLyBjdXJyZW50bHkgb25seSBzdXBwb3J0cyBnZW5lcmF0aW5nIFVSSXMgZm9yIGV4dGVybmFsIHRlbXBsYXRlcy5cbiAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogSklUX1RFTVBMQVRFX05BTUVTUEFDRSB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgIGNvbnN0IHsgY29udGVudHMgfSA9IGF3YWl0IGxvYWRFbnRyeShhcmdzLnBhdGgsIHJvb3QpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgbG9hZGVyOiAndGV4dCcsXG4gICAgfTtcbiAgfSk7XG59XG4iXX0=