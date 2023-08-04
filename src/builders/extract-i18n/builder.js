"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const load_esm_1 = require("../../utils/load-esm");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const options_1 = require("./options");
const schema_1 = require("./schema");
/**
 * @experimental Direct usage of this function is considered experimental.
 */
async function execute(options, context, transforms) {
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'extract-i18n' builder requires a target to be specified.`);
        return { success: false };
    }
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    // Load the Angular localize package.
    // The package is a peer dependency and might not be present
    let localizeToolsModule;
    try {
        localizeToolsModule = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
    }
    catch {
        return {
            success: false,
            error: `i18n extraction requires the '@angular/localize' package.`,
        };
    }
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    // Normalize options
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, options);
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.browserTarget);
    // Extract messages based on configured builder
    // TODO: Implement application/browser-esbuild support
    let extractionResult;
    if (builderName === '@angular-devkit/build-angular:application' ||
        builderName === '@angular-devkit/build-angular:browser-esbuild') {
        return {
            error: 'i18n extraction is currently only supported with the "browser" builder.',
            success: false,
        };
    }
    else {
        const { extractMessages } = await Promise.resolve().then(() => __importStar(require('./webpack-extraction')));
        extractionResult = await extractMessages(normalizedOptions, builderName, context, transforms);
    }
    // Return the builder result if it failed
    if (!extractionResult.builderResult.success) {
        return extractionResult.builderResult;
    }
    // Perform duplicate message checks
    const { checkDuplicateMessages } = localizeToolsModule;
    // The filesystem is used to create a relative path for each file
    // from the basePath.  This relative path is then used in the error message.
    const checkFileSystem = {
        relative(from, to) {
            return node_path_1.default.relative(from, to);
        },
    };
    const diagnostics = checkDuplicateMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkFileSystem, extractionResult.messages, 'warning', 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractionResult.basePath);
    if (diagnostics.messages.length > 0) {
        context.logger.warn(diagnostics.formatDiagnostics(''));
    }
    // Serialize all extracted messages
    const serializer = await createSerializer(localizeToolsModule, normalizedOptions.format, normalizedOptions.i18nOptions.sourceLocale, extractionResult.basePath, extractionResult.useLegacyIds, diagnostics);
    const content = serializer.serialize(extractionResult.messages);
    // Ensure directory exists
    const outputPath = node_path_1.default.dirname(normalizedOptions.outFile);
    if (!node_fs_1.default.existsSync(outputPath)) {
        node_fs_1.default.mkdirSync(outputPath, { recursive: true });
    }
    // Write translation file
    node_fs_1.default.writeFileSync(normalizedOptions.outFile, content);
    return extractionResult.builderResult;
}
exports.execute = execute;
async function createSerializer(localizeToolsModule, format, sourceLocale, basePath, useLegacyIds, diagnostics) {
    const { XmbTranslationSerializer, LegacyMessageIdMigrationSerializer, ArbTranslationSerializer, Xliff1TranslationSerializer, Xliff2TranslationSerializer, SimpleJsonTranslationSerializer, } = localizeToolsModule;
    switch (format) {
        case schema_1.Format.Xmb:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new XmbTranslationSerializer(basePath, useLegacyIds);
        case schema_1.Format.Xlf:
        case schema_1.Format.Xlif:
        case schema_1.Format.Xliff:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Xliff1TranslationSerializer(sourceLocale, basePath, useLegacyIds, {});
        case schema_1.Format.Xlf2:
        case schema_1.Format.Xliff2:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Xliff2TranslationSerializer(sourceLocale, basePath, useLegacyIds, {});
        case schema_1.Format.Json:
            return new SimpleJsonTranslationSerializer(sourceLocale);
        case schema_1.Format.LegacyMigrate:
            return new LegacyMessageIdMigrationSerializer(diagnostics);
        case schema_1.Format.Arb:
            const fileSystem = {
                relative(from, to) {
                    return node_path_1.default.relative(from, to);
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new ArbTranslationSerializer(sourceLocale, basePath, fileSystem);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9idWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsc0RBQXlCO0FBQ3pCLDBEQUE2QjtBQUc3QixtREFBcUQ7QUFDckQseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSx1Q0FBNkM7QUFDN0MscUNBQXVFO0FBRXZFOztHQUVHO0FBQ0ksS0FBSyxVQUFVLE9BQU8sQ0FDM0IsT0FBa0MsRUFDbEMsT0FBdUIsRUFDdkIsVUFFQztJQUVELHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUM7UUFFdEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELHlCQUF5QjtJQUN6QixJQUFBLHdDQUE4QixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUV0RCxxQ0FBcUM7SUFDckMsNERBQTREO0lBQzVELElBQUksbUJBQW1CLENBQUM7SUFDeEIsSUFBSTtRQUNGLG1CQUFtQixHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUN2Qyx5QkFBeUIsQ0FDMUIsQ0FBQztLQUNIO0lBQUMsTUFBTTtRQUNOLE9BQU87WUFDTCxPQUFPLEVBQUUsS0FBSztZQUNkLEtBQUssRUFBRSwyREFBMkQ7U0FDbkUsQ0FBQztLQUNIO0lBRUQsOEJBQThCO0lBQzlCLE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztJQUVwQyxv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ZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgRGlhZ25vc3RpY3MgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZS90b29scyc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB0eXBlIHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgRXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucywgRm9ybWF0IH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBFeHRyYWN0STE4bkJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtcz86IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gIH0sXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2V4dHJhY3QtaTE4bicgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAvLyBMb2FkIHRoZSBBbmd1bGFyIGxvY2FsaXplIHBhY2thZ2UuXG4gIC8vIFRoZSBwYWNrYWdlIGlzIGEgcGVlciBkZXBlbmRlbmN5IGFuZCBtaWdodCBub3QgYmUgcHJlc2VudFxuICBsZXQgbG9jYWxpemVUb29sc01vZHVsZTtcbiAgdHJ5IHtcbiAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpPihcbiAgICAgICdAYW5ndWxhci9sb2NhbGl6ZS90b29scycsXG4gICAgKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGBpMThuIGV4dHJhY3Rpb24gcmVxdWlyZXMgdGhlICdAYW5ndWxhci9sb2NhbGl6ZScgcGFja2FnZS5gLFxuICAgIH07XG4gIH1cblxuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgLy8gTm9ybWFsaXplIG9wdGlvbnNcbiAgY29uc3Qgbm9ybWFsaXplZE9wdGlvbnMgPSBhd2FpdCBub3JtYWxpemVPcHRpb25zKGNvbnRleHQsIHByb2plY3ROYW1lLCBvcHRpb25zKTtcbiAgY29uc3QgYnVpbGRlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KG5vcm1hbGl6ZWRPcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuXG4gIC8vIEV4dHJhY3QgbWVzc2FnZXMgYmFzZWQgb24gY29uZmlndXJlZCBidWlsZGVyXG4gIC8vIFRPRE86IEltcGxlbWVudCBhcHBsaWNhdGlvbi9icm93c2VyLWVzYnVpbGQgc3VwcG9ydFxuICBsZXQgZXh0cmFjdGlvblJlc3VsdDtcbiAgaWYgKFxuICAgIGJ1aWxkZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YXBwbGljYXRpb24nIHx8XG4gICAgYnVpbGRlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjpicm93c2VyLWVzYnVpbGQnXG4gICkge1xuICAgIHJldHVybiB7XG4gICAgICBlcnJvcjogJ2kxOG4gZXh0cmFjdGlvbiBpcyBjdXJyZW50bHkgb25seSBzdXBwb3J0ZWQgd2l0aCB0aGUgXCJicm93c2VyXCIgYnVpbGRlci4nLFxuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB7IGV4dHJhY3RNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCcuL3dlYnBhY2stZXh0cmFjdGlvbicpO1xuICAgIGV4dHJhY3Rpb25SZXN1bHQgPSBhd2FpdCBleHRyYWN0TWVzc2FnZXMobm9ybWFsaXplZE9wdGlvbnMsIGJ1aWxkZXJOYW1lLCBjb250ZXh0LCB0cmFuc2Zvcm1zKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgYnVpbGRlciByZXN1bHQgaWYgaXQgZmFpbGVkXG4gIGlmICghZXh0cmFjdGlvblJlc3VsdC5idWlsZGVyUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICByZXR1cm4gZXh0cmFjdGlvblJlc3VsdC5idWlsZGVyUmVzdWx0O1xuICB9XG5cbiAgLy8gUGVyZm9ybSBkdXBsaWNhdGUgbWVzc2FnZSBjaGVja3NcbiAgY29uc3QgeyBjaGVja0R1cGxpY2F0ZU1lc3NhZ2VzIH0gPSBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuXG4gIC8vIFRoZSBmaWxlc3lzdGVtIGlzIHVzZWQgdG8gY3JlYXRlIGEgcmVsYXRpdmUgcGF0aCBmb3IgZWFjaCBmaWxlXG4gIC8vIGZyb20gdGhlIGJhc2VQYXRoLiAgVGhpcyByZWxhdGl2ZSBwYXRoIGlzIHRoZW4gdXNlZCBpbiB0aGUgZXJyb3IgbWVzc2FnZS5cbiAgY29uc3QgY2hlY2tGaWxlU3lzdGVtID0ge1xuICAgIHJlbGF0aXZlKGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShmcm9tLCB0byk7XG4gICAgfSxcbiAgfTtcbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBjaGVja0R1cGxpY2F0ZU1lc3NhZ2VzKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY2hlY2tGaWxlU3lzdGVtIGFzIGFueSxcbiAgICBleHRyYWN0aW9uUmVzdWx0Lm1lc3NhZ2VzLFxuICAgICd3YXJuaW5nJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGV4dHJhY3Rpb25SZXN1bHQuYmFzZVBhdGggYXMgYW55LFxuICApO1xuICBpZiAoZGlhZ25vc3RpY3MubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oZGlhZ25vc3RpY3MuZm9ybWF0RGlhZ25vc3RpY3MoJycpKTtcbiAgfVxuXG4gIC8vIFNlcmlhbGl6ZSBhbGwgZXh0cmFjdGVkIG1lc3NhZ2VzXG4gIGNvbnN0IHNlcmlhbGl6ZXIgPSBhd2FpdCBjcmVhdGVTZXJpYWxpemVyKFxuICAgIGxvY2FsaXplVG9vbHNNb2R1bGUsXG4gICAgbm9ybWFsaXplZE9wdGlvbnMuZm9ybWF0LFxuICAgIG5vcm1hbGl6ZWRPcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZSxcbiAgICBleHRyYWN0aW9uUmVzdWx0LmJhc2VQYXRoLFxuICAgIGV4dHJhY3Rpb25SZXN1bHQudXNlTGVnYWN5SWRzLFxuICAgIGRpYWdub3N0aWNzLFxuICApO1xuICBjb25zdCBjb250ZW50ID0gc2VyaWFsaXplci5zZXJpYWxpemUoZXh0cmFjdGlvblJlc3VsdC5tZXNzYWdlcyk7XG5cbiAgLy8gRW5zdXJlIGRpcmVjdG9yeSBleGlzdHNcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguZGlybmFtZShub3JtYWxpemVkT3B0aW9ucy5vdXRGaWxlKTtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKG91dHB1dFBhdGgpKSB7XG4gICAgZnMubWtkaXJTeW5jKG91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9XG5cbiAgLy8gV3JpdGUgdHJhbnNsYXRpb24gZmlsZVxuICBmcy53cml0ZUZpbGVTeW5jKG5vcm1hbGl6ZWRPcHRpb25zLm91dEZpbGUsIGNvbnRlbnQpO1xuXG4gIHJldHVybiBleHRyYWN0aW9uUmVzdWx0LmJ1aWxkZXJSZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNlcmlhbGl6ZXIoXG4gIGxvY2FsaXplVG9vbHNNb2R1bGU6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyksXG4gIGZvcm1hdDogRm9ybWF0LFxuICBzb3VyY2VMb2NhbGU6IHN0cmluZyxcbiAgYmFzZVBhdGg6IHN0cmluZyxcbiAgdXNlTGVnYWN5SWRzOiBib29sZWFuLFxuICBkaWFnbm9zdGljczogRGlhZ25vc3RpY3MsXG4pIHtcbiAgY29uc3Qge1xuICAgIFhtYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyLFxuICAgIEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBYbGlmZjFUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgWGxpZmYyVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICAgIFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gIH0gPSBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuXG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWG1iOlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHJldHVybiBuZXcgWG1iVHJhbnNsYXRpb25TZXJpYWxpemVyKGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzKTtcbiAgICBjYXNlIEZvcm1hdC5YbGY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjpcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IFhsaWZmMVRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzLCB7fSk7XG4gICAgY2FzZSBGb3JtYXQuWGxmMjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjI6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjJUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcywge30pO1xuICAgIGNhc2UgRm9ybWF0Lkpzb246XG4gICAgICByZXR1cm4gbmV3IFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlKTtcbiAgICBjYXNlIEZvcm1hdC5MZWdhY3lNaWdyYXRlOlxuICAgICAgcmV0dXJuIG5ldyBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyKGRpYWdub3N0aWNzKTtcbiAgICBjYXNlIEZvcm1hdC5BcmI6XG4gICAgICBjb25zdCBmaWxlU3lzdGVtID0ge1xuICAgICAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgZmlsZVN5c3RlbSBhcyBhbnkpO1xuICB9XG59XG4iXX0=