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
            error: `i18n extraction requires the '@angular/localize' package.` +
                ` You can add it by using 'ng add @angular/localize'.`,
        };
    }
    // Normalize options
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, options);
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.browserTarget);
    // Extract messages based on configured builder
    let extractionResult;
    if (builderName === '@angular-devkit/build-angular:application' ||
        builderName === '@angular-devkit/build-angular:browser-esbuild') {
        const { extractMessages } = await Promise.resolve().then(() => __importStar(require('./application-extraction')));
        extractionResult = await extractMessages(normalizedOptions, builderName, context, localizeToolsModule.MessageExtractor);
    }
    else {
        // Purge old build disk cache.
        // Other build systems handle stale cache purging directly.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
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
    if (normalizedOptions.progress) {
        context.logger.info(`Extraction Complete. (Messages: ${extractionResult.messages.length})`);
    }
    return { success: true, outputPath: normalizedOptions.outFile };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9idWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsc0RBQXlCO0FBQ3pCLDBEQUE2QjtBQUc3QixtREFBcUQ7QUFDckQseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSx1Q0FBNkM7QUFDN0MscUNBQXVFO0FBRXZFOztHQUVHO0FBQ0ksS0FBSyxVQUFVLE9BQU8sQ0FDM0IsT0FBa0MsRUFDbEMsT0FBdUIsRUFDdkIsVUFFQztJQUVELHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUM7UUFFdEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELHlCQUF5QjtJQUN6QixJQUFBLHdDQUE4QixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUV0RCxxQ0FBcUM7SUFDckMsNERBQTREO0lBQzVELElBQUksbUJBQW1CLENBQUM7SUFDeEIsSUFBSTtRQUNGLG1CQUFtQixHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUN2Qyx5QkFBeUIsQ0FDMUIsQ0FBQztLQUNIO0lBQUMsTUFBTTtRQUNOLE9BQU87WUFDTCxPQUFPLEVBQUUsS0FBSztZQUNkLEtBQUssRUFDSCwyREFBMkQ7Z0JBQzNELHNEQUFzRDtTQUN6RCxDQUFDO0tBQ0g7SUFFRCxvQkFBb0I7SUFDcEIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUEsMEJBQWdCLEVBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNoRixNQUFNLFdBQVcsR0FBRyxNQUFNLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUUzRiwrQ0FBK0M7SUFDL0MsSUFBSSxnQkFBZ0IsQ0FBQztJQUNyQixJQUNFLFdBQVcsS0FBSywyQ0FBMkM7UUFDM0QsV0FBVyxLQUFLLCtDQUErQyxFQUMvRDtRQUNBLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1FBQ3JFLGdCQUFnQixHQUFHLE1BQU0sZUFBZSxDQUN0QyxpQkFBaUIsRUFDakIsV0FBVyxFQUNYLE9BQU8sRUFDUCxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FDckMsQ0FBQztLQUNIO1NBQU07UUFDTCw4QkFBOEI7UUFDOUIsMkRBQTJEO1FBQzNELE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztRQUVwQyxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsd0RBQWEsc0JBQXNCLEdBQUMsQ0FBQztRQUNqRSxnQkFBZ0IsR0FBRyxNQUFNLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0tBQy9GO0lBRUQseUNBQXlDO0lBQ3pDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFO1FBQzNDLE9BQU8sZ0JBQWdCLENBQUMsYUFBYSxDQUFDO0tBQ3ZDO0lBRUQsbUNBQW1DO0lBQ25DLE1BQU0sRUFBRSxzQkFBc0IsRUFBRSxHQUFHLG1CQUFtQixDQUFDO0lBRXZELGlFQUFpRTtJQUNqRSw0RUFBNEU7SUFDNUUsTUFBTSxlQUFlLEdBQUc7UUFDdEIsUUFBUSxDQUFDLElBQVksRUFBRSxFQUFVO1lBQy9CLE9BQU8sbUJBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7S0FDRixDQUFDO0lBQ0YsTUFBTSxXQUFXLEdBQUcsc0JBQXNCO0lBQ3hDLDhEQUE4RDtJQUM5RCxlQUFzQixFQUN0QixnQkFBZ0IsQ0FBQyxRQUFRLEVBQ3pCLFNBQVM7SUFDVCw4REFBOEQ7SUFDOUQsZ0JBQWdCLENBQUMsUUFBZSxDQUNqQyxDQUFDO0lBQ0YsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDbkMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDeEQ7SUFFRCxtQ0FBbUM7SUFDbkMsTUFBTSxVQUFVLEdBQUcsTUFBTSxnQkFBZ0IsQ0FDdkMsbUJBQW1CLEVBQ25CLGlCQUFpQixDQUFDLE1BQU0sRUFDeEIsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFlBQVksRUFDMUMsZ0JBQWdCLENBQUMsUUFBUSxFQUN6QixnQkFBZ0IsQ0FBQyxZQUFZLEVBQzdCLFdBQVcsQ0FDWixDQUFDO0lBQ0YsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUVoRSwwQkFBMEI7SUFDMUIsTUFBTSxVQUFVLEdBQUcsbUJBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDM0QsSUFBSSxDQUFDLGlCQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQzlCLGlCQUFFLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQy9DO0lBRUQseUJBQXlCO0lBQ3pCLGlCQUFFLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVyRCxJQUFJLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtRQUM5QixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7S0FDN0Y7SUFFRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbEUsQ0FBQztBQWhIRCwwQkFnSEM7QUFFRCxLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLG1CQUE2RCxFQUM3RCxNQUFjLEVBQ2QsWUFBb0IsRUFDcEIsUUFBZ0IsRUFDaEIsWUFBcUIsRUFDckIsV0FBd0I7SUFFeEIsTUFBTSxFQUNKLHdCQUF3QixFQUN4QixrQ0FBa0MsRUFDbEMsd0JBQXdCLEVBQ3hCLDJCQUEyQixFQUMzQiwyQkFBMkIsRUFDM0IsK0JBQStCLEdBQ2hDLEdBQUcsbUJBQW1CLENBQUM7SUFFeEIsUUFBUSxNQUFNLEVBQUU7UUFDZCxLQUFLLGVBQU0sQ0FBQyxHQUFHO1lBQ2IsOERBQThEO1lBQzlELE9BQU8sSUFBSSx3QkFBd0IsQ0FBQyxRQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDckUsS0FBSyxlQUFNLENBQUMsR0FBRyxDQUFDO1FBQ2hCLEtBQUssZUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQixLQUFLLGVBQU0sQ0FBQyxLQUFLO1lBQ2YsOERBQThEO1lBQzlELE9BQU8sSUFBSSwyQkFBMkIsQ0FBQyxZQUFZLEVBQUUsUUFBZSxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRixLQUFLLGVBQU0sQ0FBQyxJQUFJLENBQUM7UUFDakIsS0FBSyxlQUFNLENBQUMsTUFBTTtZQUNoQiw4REFBOEQ7WUFDOUQsT0FBTyxJQUFJLDJCQUEyQixDQUFDLFlBQVksRUFBRSxRQUFlLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzFGLEtBQUssZUFBTSxDQUFDLElBQUk7WUFDZCxPQUFPLElBQUksK0JBQStCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDM0QsS0FBSyxlQUFNLENBQUMsYUFBYTtZQUN2QixPQUFPLElBQUksa0NBQWtDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDN0QsS0FBSyxlQUFNLENBQUMsR0FBRztZQUNiLE1BQU0sVUFBVSxHQUFHO2dCQUNqQixRQUFRLENBQUMsSUFBWSxFQUFFLEVBQVU7b0JBQy9CLE9BQU8sbUJBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO2FBQ0YsQ0FBQztZQUVGLDhEQUE4RDtZQUM5RCxPQUFPLElBQUksd0JBQXdCLENBQUMsWUFBWSxFQUFFLFFBQWUsRUFBRSxVQUFpQixDQUFDLENBQUM7S0FDekY7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgRGlhZ25vc3RpY3MgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZS90b29scyc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB0eXBlIHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgRXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucywgRm9ybWF0IH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBFeHRyYWN0STE4bkJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtcz86IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gIH0sXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2V4dHJhY3QtaTE4bicgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAvLyBMb2FkIHRoZSBBbmd1bGFyIGxvY2FsaXplIHBhY2thZ2UuXG4gIC8vIFRoZSBwYWNrYWdlIGlzIGEgcGVlciBkZXBlbmRlbmN5IGFuZCBtaWdodCBub3QgYmUgcHJlc2VudFxuICBsZXQgbG9jYWxpemVUb29sc01vZHVsZTtcbiAgdHJ5IHtcbiAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpPihcbiAgICAgICdAYW5ndWxhci9sb2NhbGl6ZS90b29scycsXG4gICAgKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6XG4gICAgICAgIGBpMThuIGV4dHJhY3Rpb24gcmVxdWlyZXMgdGhlICdAYW5ndWxhci9sb2NhbGl6ZScgcGFja2FnZS5gICtcbiAgICAgICAgYCBZb3UgY2FuIGFkZCBpdCBieSB1c2luZyAnbmcgYWRkIEBhbmd1bGFyL2xvY2FsaXplJy5gLFxuICAgIH07XG4gIH1cblxuICAvLyBOb3JtYWxpemUgb3B0aW9uc1xuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIG9wdGlvbnMpO1xuICBjb25zdCBidWlsZGVyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQobm9ybWFsaXplZE9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG5cbiAgLy8gRXh0cmFjdCBtZXNzYWdlcyBiYXNlZCBvbiBjb25maWd1cmVkIGJ1aWxkZXJcbiAgbGV0IGV4dHJhY3Rpb25SZXN1bHQ7XG4gIGlmIChcbiAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJyB8fFxuICAgIGJ1aWxkZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YnJvd3Nlci1lc2J1aWxkJ1xuICApIHtcbiAgICBjb25zdCB7IGV4dHJhY3RNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCcuL2FwcGxpY2F0aW9uLWV4dHJhY3Rpb24nKTtcbiAgICBleHRyYWN0aW9uUmVzdWx0ID0gYXdhaXQgZXh0cmFjdE1lc3NhZ2VzKFxuICAgICAgbm9ybWFsaXplZE9wdGlvbnMsXG4gICAgICBidWlsZGVyTmFtZSxcbiAgICAgIGNvbnRleHQsXG4gICAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlLk1lc3NhZ2VFeHRyYWN0b3IsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICAvLyBPdGhlciBidWlsZCBzeXN0ZW1zIGhhbmRsZSBzdGFsZSBjYWNoZSBwdXJnaW5nIGRpcmVjdGx5LlxuICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgY29uc3QgeyBleHRyYWN0TWVzc2FnZXMgfSA9IGF3YWl0IGltcG9ydCgnLi93ZWJwYWNrLWV4dHJhY3Rpb24nKTtcbiAgICBleHRyYWN0aW9uUmVzdWx0ID0gYXdhaXQgZXh0cmFjdE1lc3NhZ2VzKG5vcm1hbGl6ZWRPcHRpb25zLCBidWlsZGVyTmFtZSwgY29udGV4dCwgdHJhbnNmb3Jtcyk7XG4gIH1cblxuICAvLyBSZXR1cm4gdGhlIGJ1aWxkZXIgcmVzdWx0IGlmIGl0IGZhaWxlZFxuICBpZiAoIWV4dHJhY3Rpb25SZXN1bHQuYnVpbGRlclJlc3VsdC5zdWNjZXNzKSB7XG4gICAgcmV0dXJuIGV4dHJhY3Rpb25SZXN1bHQuYnVpbGRlclJlc3VsdDtcbiAgfVxuXG4gIC8vIFBlcmZvcm0gZHVwbGljYXRlIG1lc3NhZ2UgY2hlY2tzXG4gIGNvbnN0IHsgY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICAvLyBUaGUgZmlsZXN5c3RlbSBpcyB1c2VkIHRvIGNyZWF0ZSBhIHJlbGF0aXZlIHBhdGggZm9yIGVhY2ggZmlsZVxuICAvLyBmcm9tIHRoZSBiYXNlUGF0aC4gIFRoaXMgcmVsYXRpdmUgcGF0aCBpcyB0aGVuIHVzZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UuXG4gIGNvbnN0IGNoZWNrRmlsZVN5c3RlbSA9IHtcbiAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gIH07XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyhcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNoZWNrRmlsZVN5c3RlbSBhcyBhbnksXG4gICAgZXh0cmFjdGlvblJlc3VsdC5tZXNzYWdlcyxcbiAgICAnd2FybmluZycsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBleHRyYWN0aW9uUmVzdWx0LmJhc2VQYXRoIGFzIGFueSxcbiAgKTtcbiAgaWYgKGRpYWdub3N0aWNzLm1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGRpYWdub3N0aWNzLmZvcm1hdERpYWdub3N0aWNzKCcnKSk7XG4gIH1cblxuICAvLyBTZXJpYWxpemUgYWxsIGV4dHJhY3RlZCBtZXNzYWdlc1xuICBjb25zdCBzZXJpYWxpemVyID0gYXdhaXQgY3JlYXRlU2VyaWFsaXplcihcbiAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlLFxuICAgIG5vcm1hbGl6ZWRPcHRpb25zLmZvcm1hdCxcbiAgICBub3JtYWxpemVkT3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGUsXG4gICAgZXh0cmFjdGlvblJlc3VsdC5iYXNlUGF0aCxcbiAgICBleHRyYWN0aW9uUmVzdWx0LnVzZUxlZ2FjeUlkcyxcbiAgICBkaWFnbm9zdGljcyxcbiAgKTtcbiAgY29uc3QgY29udGVudCA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplKGV4dHJhY3Rpb25SZXN1bHQubWVzc2FnZXMpO1xuXG4gIC8vIEVuc3VyZSBkaXJlY3RvcnkgZXhpc3RzXG4gIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmRpcm5hbWUobm9ybWFsaXplZE9wdGlvbnMub3V0RmlsZSk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXRQYXRoKSkge1xuICAgIGZzLm1rZGlyU3luYyhvdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfVxuXG4gIC8vIFdyaXRlIHRyYW5zbGF0aW9uIGZpbGVcbiAgZnMud3JpdGVGaWxlU3luYyhub3JtYWxpemVkT3B0aW9ucy5vdXRGaWxlLCBjb250ZW50KTtcblxuICBpZiAobm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGBFeHRyYWN0aW9uIENvbXBsZXRlLiAoTWVzc2FnZXM6ICR7ZXh0cmFjdGlvblJlc3VsdC5tZXNzYWdlcy5sZW5ndGh9KWApO1xuICB9XG5cbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0UGF0aDogbm9ybWFsaXplZE9wdGlvbnMub3V0RmlsZSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVTZXJpYWxpemVyKFxuICBsb2NhbGl6ZVRvb2xzTW9kdWxlOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpLFxuICBmb3JtYXQ6IEZvcm1hdCxcbiAgc291cmNlTG9jYWxlOiBzdHJpbmcsXG4gIGJhc2VQYXRoOiBzdHJpbmcsXG4gIHVzZUxlZ2FjeUlkczogYm9vbGVhbixcbiAgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzLFxuKSB7XG4gIGNvbnN0IHtcbiAgICBYbWJUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgTGVnYWN5TWVzc2FnZUlkTWlncmF0aW9uU2VyaWFsaXplcixcbiAgICBBcmJUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgWGxpZmYxVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICAgIFhsaWZmMlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBTaW1wbGVKc29uVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgIGNhc2UgRm9ybWF0LlhtYjpcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IFhtYlRyYW5zbGF0aW9uU2VyaWFsaXplcihiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcyk7XG4gICAgY2FzZSBGb3JtYXQuWGxmOlxuICAgIGNhc2UgRm9ybWF0LlhsaWY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmY6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjFUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcywge30pO1xuICAgIGNhc2UgRm9ybWF0LlhsZjI6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmYyOlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHJldHVybiBuZXcgWGxpZmYyVHJhbnNsYXRpb25TZXJpYWxpemVyKHNvdXJjZUxvY2FsZSwgYmFzZVBhdGggYXMgYW55LCB1c2VMZWdhY3lJZHMsIHt9KTtcbiAgICBjYXNlIEZvcm1hdC5Kc29uOlxuICAgICAgcmV0dXJuIG5ldyBTaW1wbGVKc29uVHJhbnNsYXRpb25TZXJpYWxpemVyKHNvdXJjZUxvY2FsZSk7XG4gICAgY2FzZSBGb3JtYXQuTGVnYWN5TWlncmF0ZTpcbiAgICAgIHJldHVybiBuZXcgTGVnYWN5TWVzc2FnZUlkTWlncmF0aW9uU2VyaWFsaXplcihkaWFnbm9zdGljcyk7XG4gICAgY2FzZSBGb3JtYXQuQXJiOlxuICAgICAgY29uc3QgZmlsZVN5c3RlbSA9IHtcbiAgICAgICAgcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShmcm9tLCB0byk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBBcmJUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIGZpbGVTeXN0ZW0gYXMgYW55KTtcbiAgfVxufVxuIl19