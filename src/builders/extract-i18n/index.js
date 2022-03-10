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
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const webpack_1 = __importDefault(require("webpack"));
const i18n_options_1 = require("../../utils/i18n-options");
const load_esm_1 = require("../../utils/load-esm");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const stats_1 = require("../../webpack/utils/stats");
const schema_1 = require("../browser/schema");
const schema_2 = require("./schema");
function getI18nOutfile(format) {
    switch (format) {
        case 'xmb':
            return 'messages.xmb';
        case 'xlf':
        case 'xlif':
        case 'xliff':
        case 'xlf2':
        case 'xliff2':
            return 'messages.xlf';
        case 'json':
        case 'legacy-migrate':
            return 'messages.json';
        case 'arb':
            return 'messages.arb';
        default:
            throw new Error(`Unsupported format "${format}"`);
    }
}
async function getSerializer(localizeToolsModule, format, sourceLocale, basePath, useLegacyIds, diagnostics) {
    const { XmbTranslationSerializer, LegacyMessageIdMigrationSerializer, ArbTranslationSerializer, Xliff1TranslationSerializer, Xliff2TranslationSerializer, SimpleJsonTranslationSerializer, } = localizeToolsModule;
    switch (format) {
        case schema_2.Format.Xmb:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new XmbTranslationSerializer(basePath, useLegacyIds);
        case schema_2.Format.Xlf:
        case schema_2.Format.Xlif:
        case schema_2.Format.Xliff:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Xliff1TranslationSerializer(sourceLocale, basePath, useLegacyIds, {});
        case schema_2.Format.Xlf2:
        case schema_2.Format.Xliff2:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Xliff2TranslationSerializer(sourceLocale, basePath, useLegacyIds, {});
        case schema_2.Format.Json:
            return new SimpleJsonTranslationSerializer(sourceLocale);
        case schema_2.Format.LegacyMigrate:
            return new LegacyMessageIdMigrationSerializer(diagnostics);
        case schema_2.Format.Arb:
            const fileSystem = {
                relative(from, to) {
                    return path.relative(from, to);
                },
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new ArbTranslationSerializer(sourceLocale, basePath, fileSystem);
    }
}
function normalizeFormatOption(options) {
    let format = options.format;
    switch (format) {
        case schema_2.Format.Xlf:
        case schema_2.Format.Xlif:
        case schema_2.Format.Xliff:
            format = schema_2.Format.Xlf;
            break;
        case schema_2.Format.Xlf2:
        case schema_2.Format.Xliff2:
            format = schema_2.Format.Xlf2;
            break;
    }
    // Default format is xliff1
    return format !== null && format !== void 0 ? format : schema_2.Format.Xlf;
}
class NoEmitPlugin {
    apply(compiler) {
        compiler.hooks.shouldEmit.tap('angular-no-emit', () => false);
    }
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
async function execute(options, context, transforms) {
    var _a;
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const browserOptions = await context.validateOptions(await context.getTargetOptions(browserTarget), await context.getBuilderNameForTarget(browserTarget));
    const format = normalizeFormatOption(options);
    // We need to determine the outFile name so that AngularCompiler can retrieve it.
    let outFile = options.outFile || getI18nOutfile(format);
    if (options.outputPath) {
        // AngularCompilerPlugin doesn't support genDir so we have to adjust outFile instead.
        outFile = path.join(options.outputPath, outFile);
    }
    outFile = path.resolve(context.workspaceRoot, outFile);
    if (!context.target || !context.target.project) {
        throw new Error('The builder requires a target.');
    }
    try {
        require.resolve('@angular/localize');
    }
    catch (_b) {
        return {
            success: false,
            error: `i18n extraction requires the '@angular/localize' package.`,
            outputPath: outFile,
        };
    }
    const metadata = await context.getProjectMetadata(context.target);
    const i18n = (0, i18n_options_1.createI18nOptions)(metadata);
    let useLegacyIds = true;
    const ivyMessages = [];
    const builderOptions = {
        ...browserOptions,
        optimization: false,
        sourceMap: {
            scripts: true,
            styles: false,
            vendor: true,
        },
        buildOptimizer: false,
        aot: true,
        progress: options.progress,
        budgets: [],
        assets: [],
        scripts: [],
        styles: [],
        deleteOutputPath: false,
        extractLicenses: false,
        subresourceIntegrity: false,
        outputHashing: schema_1.OutputHashing.None,
        namedChunks: true,
        allowedCommonJsDependencies: undefined,
    };
    const { config, projectRoot } = await (0, webpack_browser_config_1.generateBrowserWebpackConfigFromContext)(builderOptions, context, (wco) => {
        var _a;
        // Default value for legacy message ids is currently true
        useLegacyIds = (_a = wco.tsConfig.options.enableI18nLegacyMessageIdFormat) !== null && _a !== void 0 ? _a : true;
        const partials = [
            { plugins: [new NoEmitPlugin()] },
            (0, configs_1.getCommonConfig)(wco),
        ];
        // Add Ivy application file extractor support
        partials.unshift({
            module: {
                rules: [
                    {
                        test: /\.[cm]?[tj]sx?$/,
                        loader: require.resolve('./ivy-extract-loader'),
                        options: {
                            messageHandler: (messages) => ivyMessages.push(...messages),
                        },
                    },
                ],
            },
        });
        // Replace all stylesheets with empty content
        partials.push({
            module: {
                rules: [
                    {
                        test: /\.(css|scss|sass|styl|less)$/,
                        loader: require.resolve('./empty-loader'),
                    },
                ],
            },
        });
        return partials;
    });
    // All the localize usages are setup to first try the ESM entry point then fallback to the deep imports.
    // This provides interim compatibility while the framework is transitioned to bundled ESM packages.
    const localizeToolsModule = await (0, load_esm_1.loadEsmModule)('@angular/localize/tools');
    const webpackResult = await (0, build_webpack_1.runWebpack)((await ((_a = transforms === null || transforms === void 0 ? void 0 : transforms.webpackConfiguration) === null || _a === void 0 ? void 0 : _a.call(transforms, config))) || config, context, {
        logging: (0, stats_1.createWebpackLoggingCallback)(builderOptions, context.logger),
        webpackFactory: webpack_1.default,
    }).toPromise();
    // Set the outputPath to the extraction output location for downstream consumers
    webpackResult.outputPath = outFile;
    // Complete if Webpack build failed
    if (!webpackResult.success) {
        return webpackResult;
    }
    const basePath = config.context || projectRoot;
    const { checkDuplicateMessages } = localizeToolsModule;
    // The filesystem is used to create a relative path for each file
    // from the basePath.  This relative path is then used in the error message.
    const checkFileSystem = {
        relative(from, to) {
            return path.relative(from, to);
        },
    };
    const diagnostics = checkDuplicateMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkFileSystem, ivyMessages, 'warning', 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    basePath);
    if (diagnostics.messages.length > 0) {
        context.logger.warn(diagnostics.formatDiagnostics(''));
    }
    // Serialize all extracted messages
    const serializer = await getSerializer(localizeToolsModule, format, i18n.sourceLocale, basePath, useLegacyIds, diagnostics);
    const content = serializer.serialize(ivyMessages);
    // Ensure directory exists
    const outputPath = path.dirname(outFile);
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    // Write translation file
    fs.writeFileSync(outFile, content);
    return webpackResult;
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9leHRyYWN0LWkxOG4vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBa0c7QUFDbEcsaUVBQXdFO0FBSXhFLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0Isc0RBQWlEO0FBRWpELDJEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSwrRUFBNkY7QUFDN0YsbURBQXdEO0FBQ3hELHFEQUF5RTtBQUN6RSw4Q0FBbUY7QUFDbkYscUNBQTBDO0FBSTFDLFNBQVMsY0FBYyxDQUFDLE1BQTBCO0lBQ2hELFFBQVEsTUFBTSxFQUFFO1FBQ2QsS0FBSyxLQUFLO1lBQ1IsT0FBTyxjQUFjLENBQUM7UUFDeEIsS0FBSyxLQUFLLENBQUM7UUFDWCxLQUFLLE1BQU0sQ0FBQztRQUNaLEtBQUssT0FBTyxDQUFDO1FBQ2IsS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLFFBQVE7WUFDWCxPQUFPLGNBQWMsQ0FBQztRQUN4QixLQUFLLE1BQU0sQ0FBQztRQUNaLEtBQUssZ0JBQWdCO1lBQ25CLE9BQU8sZUFBZSxDQUFDO1FBQ3pCLEtBQUssS0FBSztZQUNSLE9BQU8sY0FBYyxDQUFDO1FBQ3hCO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsTUFBTSxHQUFHLENBQUMsQ0FBQztLQUNyRDtBQUNILENBQUM7QUFFRCxLQUFLLFVBQVUsYUFBYSxDQUMxQixtQkFBNkQsRUFDN0QsTUFBYyxFQUNkLFlBQW9CLEVBQ3BCLFFBQWdCLEVBQ2hCLFlBQXFCLEVBQ3JCLFdBQXdCO0lBRXhCLE1BQU0sRUFDSix3QkFBd0IsRUFDeEIsa0NB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c2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgY3JlYXRlQnVpbGRlciwgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgQnVpbGRSZXN1bHQsIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBKc29uT2JqZWN0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZE1lc3NhZ2UgYXMgTG9jYWxpemVNZXNzYWdlIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUnO1xuaW1wb3J0IHR5cGUgeyBEaWFnbm9zdGljcyB9IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgd2VicGFjaywgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgY3JlYXRlSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgRm9ybWF0LCBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnMgPSBTY2hlbWE7XG5cbmZ1bmN0aW9uIGdldEkxOG5PdXRmaWxlKGZvcm1hdDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSAneG1iJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMueG1iJztcbiAgICBjYXNlICd4bGYnOlxuICAgIGNhc2UgJ3hsaWYnOlxuICAgIGNhc2UgJ3hsaWZmJzpcbiAgICBjYXNlICd4bGYyJzpcbiAgICBjYXNlICd4bGlmZjInOlxuICAgICAgcmV0dXJuICdtZXNzYWdlcy54bGYnO1xuICAgIGNhc2UgJ2pzb24nOlxuICAgIGNhc2UgJ2xlZ2FjeS1taWdyYXRlJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMuanNvbic7XG4gICAgY2FzZSAnYXJiJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMuYXJiJztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmb3JtYXQgXCIke2Zvcm1hdH1cImApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFNlcmlhbGl6ZXIoXG4gIGxvY2FsaXplVG9vbHNNb2R1bGU6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyksXG4gIGZvcm1hdDogRm9ybWF0LFxuICBzb3VyY2VMb2NhbGU6IHN0cmluZyxcbiAgYmFzZVBhdGg6IHN0cmluZyxcbiAgdXNlTGVnYWN5SWRzOiBib29sZWFuLFxuICBkaWFnbm9zdGljczogRGlhZ25vc3RpY3MsXG4pIHtcbiAgY29uc3Qge1xuICAgIFhtYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyLFxuICAgIEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBYbGlmZjFUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgWGxpZmYyVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICAgIFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gIH0gPSBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuXG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWG1iOlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHJldHVybiBuZXcgWG1iVHJhbnNsYXRpb25TZXJpYWxpemVyKGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzKTtcbiAgICBjYXNlIEZvcm1hdC5YbGY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjpcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IFhsaWZmMVRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzLCB7fSk7XG4gICAgY2FzZSBGb3JtYXQuWGxmMjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjI6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjJUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcywge30pO1xuICAgIGNhc2UgRm9ybWF0Lkpzb246XG4gICAgICByZXR1cm4gbmV3IFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlKTtcbiAgICBjYXNlIEZvcm1hdC5MZWdhY3lNaWdyYXRlOlxuICAgICAgcmV0dXJuIG5ldyBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyKGRpYWdub3N0aWNzKTtcbiAgICBjYXNlIEZvcm1hdC5BcmI6XG4gICAgICBjb25zdCBmaWxlU3lzdGVtID0ge1xuICAgICAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgZmlsZVN5c3RlbSBhcyBhbnkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUZvcm1hdE9wdGlvbihvcHRpb25zOiBFeHRyYWN0STE4bkJ1aWxkZXJPcHRpb25zKTogRm9ybWF0IHtcbiAgbGV0IGZvcm1hdCA9IG9wdGlvbnMuZm9ybWF0O1xuXG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWGxmOlxuICAgIGNhc2UgRm9ybWF0LlhsaWY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmY6XG4gICAgICBmb3JtYXQgPSBGb3JtYXQuWGxmO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBGb3JtYXQuWGxmMjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjI6XG4gICAgICBmb3JtYXQgPSBGb3JtYXQuWGxmMjtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gRGVmYXVsdCBmb3JtYXQgaXMgeGxpZmYxXG4gIHJldHVybiBmb3JtYXQgPz8gRm9ybWF0LlhsZjtcbn1cblxuY2xhc3MgTm9FbWl0UGx1Z2luIHtcbiAgYXBwbHkoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5zaG91bGRFbWl0LnRhcCgnYW5ndWxhci1uby1lbWl0JywgKCkgPT4gZmFsc2UpO1xuICB9XG59XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zPzoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgfSxcbik6IFByb21pc2U8QnVpbGRSZXN1bHQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxKc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zPihcbiAgICBhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCksXG4gICAgYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KSxcbiAgKTtcblxuICBjb25zdCBmb3JtYXQgPSBub3JtYWxpemVGb3JtYXRPcHRpb24ob3B0aW9ucyk7XG5cbiAgLy8gV2UgbmVlZCB0byBkZXRlcm1pbmUgdGhlIG91dEZpbGUgbmFtZSBzbyB0aGF0IEFuZ3VsYXJDb21waWxlciBjYW4gcmV0cmlldmUgaXQuXG4gIGxldCBvdXRGaWxlID0gb3B0aW9ucy5vdXRGaWxlIHx8IGdldEkxOG5PdXRmaWxlKGZvcm1hdCk7XG4gIGlmIChvcHRpb25zLm91dHB1dFBhdGgpIHtcbiAgICAvLyBBbmd1bGFyQ29tcGlsZXJQbHVnaW4gZG9lc24ndCBzdXBwb3J0IGdlbkRpciBzbyB3ZSBoYXZlIHRvIGFkanVzdCBvdXRGaWxlIGluc3RlYWQuXG4gICAgb3V0RmlsZSA9IHBhdGguam9pbihvcHRpb25zLm91dHB1dFBhdGgsIG91dEZpbGUpO1xuICB9XG4gIG91dEZpbGUgPSBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvdXRGaWxlKTtcblxuICBpZiAoIWNvbnRleHQudGFyZ2V0IHx8ICFjb250ZXh0LnRhcmdldC5wcm9qZWN0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogYGkxOG4gZXh0cmFjdGlvbiByZXF1aXJlcyB0aGUgJ0Bhbmd1bGFyL2xvY2FsaXplJyBwYWNrYWdlLmAsXG4gICAgICBvdXRwdXRQYXRoOiBvdXRGaWxlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKGNvbnRleHQudGFyZ2V0KTtcbiAgY29uc3QgaTE4biA9IGNyZWF0ZUkxOG5PcHRpb25zKG1ldGFkYXRhKTtcblxuICBsZXQgdXNlTGVnYWN5SWRzID0gdHJ1ZTtcblxuICBjb25zdCBpdnlNZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW10gPSBbXTtcbiAgY29uc3QgYnVpbGRlck9wdGlvbnMgPSB7XG4gICAgLi4uYnJvd3Nlck9wdGlvbnMsXG4gICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHNjcmlwdHM6IHRydWUsXG4gICAgICBzdHlsZXM6IGZhbHNlLFxuICAgICAgdmVuZG9yOiB0cnVlLFxuICAgIH0sXG4gICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgIGFvdDogdHJ1ZSxcbiAgICBwcm9ncmVzczogb3B0aW9ucy5wcm9ncmVzcyxcbiAgICBidWRnZXRzOiBbXSxcbiAgICBhc3NldHM6IFtdLFxuICAgIHNjcmlwdHM6IFtdLFxuICAgIHN0eWxlczogW10sXG4gICAgZGVsZXRlT3V0cHV0UGF0aDogZmFsc2UsXG4gICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eTogZmFsc2UsXG4gICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llczogdW5kZWZpbmVkLFxuICB9O1xuICBjb25zdCB7IGNvbmZpZywgcHJvamVjdFJvb3QgfSA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICBidWlsZGVyT3B0aW9ucyxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IHtcbiAgICAgIC8vIERlZmF1bHQgdmFsdWUgZm9yIGxlZ2FjeSBtZXNzYWdlIGlkcyBpcyBjdXJyZW50bHkgdHJ1ZVxuICAgICAgdXNlTGVnYWN5SWRzID0gd2NvLnRzQ29uZmlnLm9wdGlvbnMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA/PyB0cnVlO1xuXG4gICAgICBjb25zdCBwYXJ0aWFsczogKFByb21pc2U8Q29uZmlndXJhdGlvbj4gfCBDb25maWd1cmF0aW9uKVtdID0gW1xuICAgICAgICB7IHBsdWdpbnM6IFtuZXcgTm9FbWl0UGx1Z2luKCldIH0sXG4gICAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgXTtcblxuICAgICAgLy8gQWRkIEl2eSBhcHBsaWNhdGlvbiBmaWxlIGV4dHJhY3RvciBzdXBwb3J0XG4gICAgICBwYXJ0aWFscy51bnNoaWZ0KHtcbiAgICAgICAgbW9kdWxlOiB7XG4gICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9pdnktZXh0cmFjdC1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VIYW5kbGVyOiAobWVzc2FnZXM6IExvY2FsaXplTWVzc2FnZVtdKSA9PiBpdnlNZXNzYWdlcy5wdXNoKC4uLm1lc3NhZ2VzKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBSZXBsYWNlIGFsbCBzdHlsZXNoZWV0cyB3aXRoIGVtcHR5IGNvbnRlbnRcbiAgICAgIHBhcnRpYWxzLnB1c2goe1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0ZXN0OiAvXFwuKGNzc3xzY3NzfHNhc3N8c3R5bHxsZXNzKSQvLFxuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9lbXB0eS1sb2FkZXInKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcGFydGlhbHM7XG4gICAgfSxcbiAgKTtcblxuICAvLyBBbGwgdGhlIGxvY2FsaXplIHVzYWdlcyBhcmUgc2V0dXAgdG8gZmlyc3QgdHJ5IHRoZSBFU00gZW50cnkgcG9pbnQgdGhlbiBmYWxsYmFjayB0byB0aGUgZGVlcCBpbXBvcnRzLlxuICAvLyBUaGlzIHByb3ZpZGVzIGludGVyaW0gY29tcGF0aWJpbGl0eSB3aGlsZSB0aGUgZnJhbWV3b3JrIGlzIHRyYW5zaXRpb25lZCB0byBidW5kbGVkIEVTTSBwYWNrYWdlcy5cbiAgY29uc3QgbG9jYWxpemVUb29sc01vZHVsZSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKT4oXG4gICAgJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyxcbiAgKTtcbiAgY29uc3Qgd2VicGFja1Jlc3VsdCA9IGF3YWl0IHJ1bldlYnBhY2soXG4gICAgKGF3YWl0IHRyYW5zZm9ybXM/LndlYnBhY2tDb25maWd1cmF0aW9uPy4oY29uZmlnKSkgfHwgY29uZmlnLFxuICAgIGNvbnRleHQsXG4gICAge1xuICAgICAgbG9nZ2luZzogY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhidWlsZGVyT3B0aW9ucywgY29udGV4dC5sb2dnZXIpLFxuICAgICAgd2VicGFja0ZhY3Rvcnk6IHdlYnBhY2ssXG4gICAgfSxcbiAgKS50b1Byb21pc2UoKTtcblxuICAvLyBTZXQgdGhlIG91dHB1dFBhdGggdG8gdGhlIGV4dHJhY3Rpb24gb3V0cHV0IGxvY2F0aW9uIGZvciBkb3duc3RyZWFtIGNvbnN1bWVyc1xuICB3ZWJwYWNrUmVzdWx0Lm91dHB1dFBhdGggPSBvdXRGaWxlO1xuXG4gIC8vIENvbXBsZXRlIGlmIFdlYnBhY2sgYnVpbGQgZmFpbGVkXG4gIGlmICghd2VicGFja1Jlc3VsdC5zdWNjZXNzKSB7XG4gICAgcmV0dXJuIHdlYnBhY2tSZXN1bHQ7XG4gIH1cblxuICBjb25zdCBiYXNlUGF0aCA9IGNvbmZpZy5jb250ZXh0IHx8IHByb2plY3RSb290O1xuXG4gIGNvbnN0IHsgY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICAvLyBUaGUgZmlsZXN5c3RlbSBpcyB1c2VkIHRvIGNyZWF0ZSBhIHJlbGF0aXZlIHBhdGggZm9yIGVhY2ggZmlsZVxuICAvLyBmcm9tIHRoZSBiYXNlUGF0aC4gIFRoaXMgcmVsYXRpdmUgcGF0aCBpcyB0aGVuIHVzZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UuXG4gIGNvbnN0IGNoZWNrRmlsZVN5c3RlbSA9IHtcbiAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gIH07XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyhcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNoZWNrRmlsZVN5c3RlbSBhcyBhbnksXG4gICAgaXZ5TWVzc2FnZXMsXG4gICAgJ3dhcm5pbmcnLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgYmFzZVBhdGggYXMgYW55LFxuICApO1xuICBpZiAoZGlhZ25vc3RpY3MubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oZGlhZ25vc3RpY3MuZm9ybWF0RGlhZ25vc3RpY3MoJycpKTtcbiAgfVxuXG4gIC8vIFNlcmlhbGl6ZSBhbGwgZXh0cmFjdGVkIG1lc3NhZ2VzXG4gIGNvbnN0IHNlcmlhbGl6ZXIgPSBhd2FpdCBnZXRTZXJpYWxpemVyKFxuICAgIGxvY2FsaXplVG9vbHNNb2R1bGUsXG4gICAgZm9ybWF0LFxuICAgIGkxOG4uc291cmNlTG9jYWxlLFxuICAgIGJhc2VQYXRoLFxuICAgIHVzZUxlZ2FjeUlkcyxcbiAgICBkaWFnbm9zdGljcyxcbiAgKTtcbiAgY29uc3QgY29udGVudCA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplKGl2eU1lc3NhZ2VzKTtcblxuICAvLyBFbnN1cmUgZGlyZWN0b3J5IGV4aXN0c1xuICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5kaXJuYW1lKG91dEZpbGUpO1xuICBpZiAoIWZzLmV4aXN0c1N5bmMob3V0cHV0UGF0aCkpIHtcbiAgICBmcy5ta2RpclN5bmMob3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH1cblxuICAvLyBXcml0ZSB0cmFuc2xhdGlvbiBmaWxlXG4gIGZzLndyaXRlRmlsZVN5bmMob3V0RmlsZSwgY29udGVudCk7XG5cbiAgcmV0dXJuIHdlYnBhY2tSZXN1bHQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8RXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucz4oZXhlY3V0ZSk7XG4iXX0=