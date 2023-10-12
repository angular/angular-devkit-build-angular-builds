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
        localizeToolsModule =
            await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
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
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.buildTarget);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2V4dHJhY3QtaTE4bi9idWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsc0RBQXlCO0FBQ3pCLDBEQUE2QjtBQUc3QixtREFBcUQ7QUFDckQseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSx1Q0FBNkM7QUFDN0MscUNBQXVFO0FBRXZFOztHQUVHO0FBQ0ksS0FBSyxVQUFVLE9BQU8sQ0FDM0IsT0FBa0MsRUFDbEMsT0FBdUIsRUFDdkIsVUFFQztJQUVELHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUM7UUFFdEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELHlCQUF5QjtJQUN6QixJQUFBLHdDQUE4QixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUV0RCxxQ0FBcUM7SUFDckMsNERBQTREO0lBQzVELElBQUksbUJBQW1CLENBQUM7SUFDeEIsSUFBSTtRQUNGLG1CQUFtQjtZQUNqQixNQUFNLElBQUEsd0JBQWEsRUFBMkMseUJBQXlCLENBQUMsQ0FBQztLQUM1RjtJQUFDLE1BQU07UUFDTixPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxLQUFLLEVBQ0gsMkRBQTJEO2dCQUMzRCxzREFBc0Q7U0FDekQsQ0FBQztLQUNIO0lBRUQsb0JBQW9CO0lBQ3BCLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFBLDBC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QUFDLEdBQUc7WUFDYixNQUFNLFVBQVUsR0FBRztnQkFDakIsUUFBUSxDQUFDLElBQVksRUFBRSxFQUFVO29CQUMvQixPQUFPLG1CQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDakMsQ0FBQzthQUNGLENBQUM7WUFFRiw4REFBOEQ7WUFDOUQsT0FBTyxJQUFJLHdCQUF3QixDQUFDLFlBQVksRUFBRSxRQUFlLEVBQUUsVUFBaUIsQ0FBQyxDQUFDO0tBQ3pGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IERpYWdub3N0aWNzIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnO1xuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgdHlwZSB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnMsIEZvcm1hdCB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogRXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM/OiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihgVGhlICdleHRyYWN0LWkxOG4nIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgLy8gTG9hZCB0aGUgQW5ndWxhciBsb2NhbGl6ZSBwYWNrYWdlLlxuICAvLyBUaGUgcGFja2FnZSBpcyBhIHBlZXIgZGVwZW5kZW5jeSBhbmQgbWlnaHQgbm90IGJlIHByZXNlbnRcbiAgbGV0IGxvY2FsaXplVG9vbHNNb2R1bGU7XG4gIHRyeSB7XG4gICAgbG9jYWxpemVUb29sc01vZHVsZSA9XG4gICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyk+KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjpcbiAgICAgICAgYGkxOG4gZXh0cmFjdGlvbiByZXF1aXJlcyB0aGUgJ0Bhbmd1bGFyL2xvY2FsaXplJyBwYWNrYWdlLmAgK1xuICAgICAgICBgIFlvdSBjYW4gYWRkIGl0IGJ5IHVzaW5nICduZyBhZGQgQGFuZ3VsYXIvbG9jYWxpemUnLmAsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSBvcHRpb25zXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgb3B0aW9ucyk7XG4gIGNvbnN0IGJ1aWxkZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChub3JtYWxpemVkT3B0aW9ucy5idWlsZFRhcmdldCk7XG5cbiAgLy8gRXh0cmFjdCBtZXNzYWdlcyBiYXNlZCBvbiBjb25maWd1cmVkIGJ1aWxkZXJcbiAgbGV0IGV4dHJhY3Rpb25SZXN1bHQ7XG4gIGlmIChcbiAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJyB8fFxuICAgIGJ1aWxkZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YnJvd3Nlci1lc2J1aWxkJ1xuICApIHtcbiAgICBjb25zdCB7IGV4dHJhY3RNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCcuL2FwcGxpY2F0aW9uLWV4dHJhY3Rpb24nKTtcbiAgICBleHRyYWN0aW9uUmVzdWx0ID0gYXdhaXQgZXh0cmFjdE1lc3NhZ2VzKFxuICAgICAgbm9ybWFsaXplZE9wdGlvbnMsXG4gICAgICBidWlsZGVyTmFtZSxcbiAgICAgIGNvbnRleHQsXG4gICAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlLk1lc3NhZ2VFeHRyYWN0b3IsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICAvLyBPdGhlciBidWlsZCBzeXN0ZW1zIGhhbmRsZSBzdGFsZSBjYWNoZSBwdXJnaW5nIGRpcmVjdGx5LlxuICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgY29uc3QgeyBleHRyYWN0TWVzc2FnZXMgfSA9IGF3YWl0IGltcG9ydCgnLi93ZWJwYWNrLWV4dHJhY3Rpb24nKTtcbiAgICBleHRyYWN0aW9uUmVzdWx0ID0gYXdhaXQgZXh0cmFjdE1lc3NhZ2VzKG5vcm1hbGl6ZWRPcHRpb25zLCBidWlsZGVyTmFtZSwgY29udGV4dCwgdHJhbnNmb3Jtcyk7XG4gIH1cblxuICAvLyBSZXR1cm4gdGhlIGJ1aWxkZXIgcmVzdWx0IGlmIGl0IGZhaWxlZFxuICBpZiAoIWV4dHJhY3Rpb25SZXN1bHQuYnVpbGRlclJlc3VsdC5zdWNjZXNzKSB7XG4gICAgcmV0dXJuIGV4dHJhY3Rpb25SZXN1bHQuYnVpbGRlclJlc3VsdDtcbiAgfVxuXG4gIC8vIFBlcmZvcm0gZHVwbGljYXRlIG1lc3NhZ2UgY2hlY2tzXG4gIGNvbnN0IHsgY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICAvLyBUaGUgZmlsZXN5c3RlbSBpcyB1c2VkIHRvIGNyZWF0ZSBhIHJlbGF0aXZlIHBhdGggZm9yIGVhY2ggZmlsZVxuICAvLyBmcm9tIHRoZSBiYXNlUGF0aC4gIFRoaXMgcmVsYXRpdmUgcGF0aCBpcyB0aGVuIHVzZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UuXG4gIGNvbnN0IGNoZWNrRmlsZVN5c3RlbSA9IHtcbiAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gIH07XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyhcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNoZWNrRmlsZVN5c3RlbSBhcyBhbnksXG4gICAgZXh0cmFjdGlvblJlc3VsdC5tZXNzYWdlcyxcbiAgICAnd2FybmluZycsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBleHRyYWN0aW9uUmVzdWx0LmJhc2VQYXRoIGFzIGFueSxcbiAgKTtcbiAgaWYgKGRpYWdub3N0aWNzLm1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGRpYWdub3N0aWNzLmZvcm1hdERpYWdub3N0aWNzKCcnKSk7XG4gIH1cblxuICAvLyBTZXJpYWxpemUgYWxsIGV4dHJhY3RlZCBtZXNzYWdlc1xuICBjb25zdCBzZXJpYWxpemVyID0gYXdhaXQgY3JlYXRlU2VyaWFsaXplcihcbiAgICBsb2NhbGl6ZVRvb2xzTW9kdWxlLFxuICAgIG5vcm1hbGl6ZWRPcHRpb25zLmZvcm1hdCxcbiAgICBub3JtYWxpemVkT3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGUsXG4gICAgZXh0cmFjdGlvblJlc3VsdC5iYXNlUGF0aCxcbiAgICBleHRyYWN0aW9uUmVzdWx0LnVzZUxlZ2FjeUlkcyxcbiAgICBkaWFnbm9zdGljcyxcbiAgKTtcbiAgY29uc3QgY29udGVudCA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplKGV4dHJhY3Rpb25SZXN1bHQubWVzc2FnZXMpO1xuXG4gIC8vIEVuc3VyZSBkaXJlY3RvcnkgZXhpc3RzXG4gIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmRpcm5hbWUobm9ybWFsaXplZE9wdGlvbnMub3V0RmlsZSk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXRQYXRoKSkge1xuICAgIGZzLm1rZGlyU3luYyhvdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfVxuXG4gIC8vIFdyaXRlIHRyYW5zbGF0aW9uIGZpbGVcbiAgZnMud3JpdGVGaWxlU3luYyhub3JtYWxpemVkT3B0aW9ucy5vdXRGaWxlLCBjb250ZW50KTtcblxuICBpZiAobm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGBFeHRyYWN0aW9uIENvbXBsZXRlLiAoTWVzc2FnZXM6ICR7ZXh0cmFjdGlvblJlc3VsdC5tZXNzYWdlcy5sZW5ndGh9KWApO1xuICB9XG5cbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgb3V0cHV0UGF0aDogbm9ybWFsaXplZE9wdGlvbnMub3V0RmlsZSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVTZXJpYWxpemVyKFxuICBsb2NhbGl6ZVRvb2xzTW9kdWxlOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9sb2NhbGl6ZS90b29scycpLFxuICBmb3JtYXQ6IEZvcm1hdCxcbiAgc291cmNlTG9jYWxlOiBzdHJpbmcsXG4gIGJhc2VQYXRoOiBzdHJpbmcsXG4gIHVzZUxlZ2FjeUlkczogYm9vbGVhbixcbiAgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzLFxuKSB7XG4gIGNvbnN0IHtcbiAgICBYbWJUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgTGVnYWN5TWVzc2FnZUlkTWlncmF0aW9uU2VyaWFsaXplcixcbiAgICBBcmJUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgWGxpZmYxVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICAgIFhsaWZmMlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBTaW1wbGVKc29uVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgIGNhc2UgRm9ybWF0LlhtYjpcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IFhtYlRyYW5zbGF0aW9uU2VyaWFsaXplcihiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcyk7XG4gICAgY2FzZSBGb3JtYXQuWGxmOlxuICAgIGNhc2UgRm9ybWF0LlhsaWY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmY6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjFUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcywge30pO1xuICAgIGNhc2UgRm9ybWF0LlhsZjI6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmYyOlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHJldHVybiBuZXcgWGxpZmYyVHJhbnNsYXRpb25TZXJpYWxpemVyKHNvdXJjZUxvY2FsZSwgYmFzZVBhdGggYXMgYW55LCB1c2VMZWdhY3lJZHMsIHt9KTtcbiAgICBjYXNlIEZvcm1hdC5Kc29uOlxuICAgICAgcmV0dXJuIG5ldyBTaW1wbGVKc29uVHJhbnNsYXRpb25TZXJpYWxpemVyKHNvdXJjZUxvY2FsZSk7XG4gICAgY2FzZSBGb3JtYXQuTGVnYWN5TWlncmF0ZTpcbiAgICAgIHJldHVybiBuZXcgTGVnYWN5TWVzc2FnZUlkTWlncmF0aW9uU2VyaWFsaXplcihkaWFnbm9zdGljcyk7XG4gICAgY2FzZSBGb3JtYXQuQXJiOlxuICAgICAgY29uc3QgZmlsZVN5c3RlbSA9IHtcbiAgICAgICAgcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShmcm9tLCB0byk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBBcmJUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIGZpbGVTeXN0ZW0gYXMgYW55KTtcbiAgfVxufVxuIl19