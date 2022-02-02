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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9leHRyYWN0LWkxOG4vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUFrRztBQUNsRyxpRUFBd0U7QUFJeEUsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QixzREFBaUQ7QUFFakQsMkRBQTZEO0FBQzdELG1EQUFxRDtBQUNyRCx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUE2RjtBQUM3RixtREFBd0Q7QUFDeEQscURBQXlFO0FBQ3pFLDhDQUFtRjtBQUNuRixxQ0FBMEM7QUFJMUMsU0FBUyxjQUFjLENBQUMsTUFBMEI7SUFDaEQsUUFBUSxNQUFNLEVBQUU7UUFDZCxLQUFLLEtBQUs7WUFDUixPQUFPLGNBQWMsQ0FBQztRQUN4QixLQUFLLEtBQUssQ0FBQztRQUNYLEtBQUssTUFBTSxDQUFDO1FBQ1osS0FBSyxPQUFPLENBQUM7UUFDYixLQUFLLE1BQU0sQ0FBQztRQUNaLEtBQUssUUFBUTtZQUNYLE9BQU8sY0FBYyxDQUFDO1FBQ3hCLEtBQUssTUFBTSxDQUFDO1FBQ1osS0FBSyxnQkFBZ0I7WUFDbkIsT0FBTyxlQUFlLENBQUM7UUFDekIsS0FBSyxLQUFLO1lBQ1IsT0FBTyxjQUFjLENBQUM7UUFDeEI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixNQUFNLEdBQUcsQ0FBQyxDQUFDO0tBQ3JEO0FBQ0gsQ0FBQztBQUVELEtBQUssVUFBVSxhQUFhLENBQzFCLG1CQUE2RCxFQUM3RCxNQUFjLEVBQ2QsWUFBb0IsRUFDcEIsUUFBZ0IsRUFDaEIsWUFBcUIsRUFDckIsV0FBd0I7SUFFeEIsTUFBTSxFQUNKLHdCQUF3QixFQUN4QixrQ0FBa0Ms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KiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBjcmVhdGVCdWlsZGVyLCB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBCdWlsZFJlc3VsdCwgcnVuV2VicGFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IEpzb25PYmplY3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkTWVzc2FnZSBhcyBMb2NhbGl6ZU1lc3NhZ2UgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgdHlwZSB7IERpYWdub3N0aWNzIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB3ZWJwYWNrLCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBjcmVhdGVJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBGb3JtYXQsIFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgRXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucyA9IFNjaGVtYSAmIEpzb25PYmplY3Q7XG5cbmZ1bmN0aW9uIGdldEkxOG5PdXRmaWxlKGZvcm1hdDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSAneG1iJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMueG1iJztcbiAgICBjYXNlICd4bGYnOlxuICAgIGNhc2UgJ3hsaWYnOlxuICAgIGNhc2UgJ3hsaWZmJzpcbiAgICBjYXNlICd4bGYyJzpcbiAgICBjYXNlICd4bGlmZjInOlxuICAgICAgcmV0dXJuICdtZXNzYWdlcy54bGYnO1xuICAgIGNhc2UgJ2pzb24nOlxuICAgIGNhc2UgJ2xlZ2FjeS1taWdyYXRlJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMuanNvbic7XG4gICAgY2FzZSAnYXJiJzpcbiAgICAgIHJldHVybiAnbWVzc2FnZXMuYXJiJztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmb3JtYXQgXCIke2Zvcm1hdH1cImApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFNlcmlhbGl6ZXIoXG4gIGxvY2FsaXplVG9vbHNNb2R1bGU6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyksXG4gIGZvcm1hdDogRm9ybWF0LFxuICBzb3VyY2VMb2NhbGU6IHN0cmluZyxcbiAgYmFzZVBhdGg6IHN0cmluZyxcbiAgdXNlTGVnYWN5SWRzOiBib29sZWFuLFxuICBkaWFnbm9zdGljczogRGlhZ25vc3RpY3MsXG4pIHtcbiAgY29uc3Qge1xuICAgIFhtYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyLFxuICAgIEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcixcbiAgICBYbGlmZjFUcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gICAgWGxpZmYyVHJhbnNsYXRpb25TZXJpYWxpemVyLFxuICAgIFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIsXG4gIH0gPSBsb2NhbGl6ZVRvb2xzTW9kdWxlO1xuXG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWG1iOlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHJldHVybiBuZXcgWG1iVHJhbnNsYXRpb25TZXJpYWxpemVyKGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzKTtcbiAgICBjYXNlIEZvcm1hdC5YbGY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjpcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IFhsaWZmMVRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgdXNlTGVnYWN5SWRzLCB7fSk7XG4gICAgY2FzZSBGb3JtYXQuWGxmMjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjI6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgcmV0dXJuIG5ldyBYbGlmZjJUcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlLCBiYXNlUGF0aCBhcyBhbnksIHVzZUxlZ2FjeUlkcywge30pO1xuICAgIGNhc2UgRm9ybWF0Lkpzb246XG4gICAgICByZXR1cm4gbmV3IFNpbXBsZUpzb25UcmFuc2xhdGlvblNlcmlhbGl6ZXIoc291cmNlTG9jYWxlKTtcbiAgICBjYXNlIEZvcm1hdC5MZWdhY3lNaWdyYXRlOlxuICAgICAgcmV0dXJuIG5ldyBMZWdhY3lNZXNzYWdlSWRNaWdyYXRpb25TZXJpYWxpemVyKGRpYWdub3N0aWNzKTtcbiAgICBjYXNlIEZvcm1hdC5BcmI6XG4gICAgICBjb25zdCBmaWxlU3lzdGVtID0ge1xuICAgICAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICByZXR1cm4gbmV3IEFyYlRyYW5zbGF0aW9uU2VyaWFsaXplcihzb3VyY2VMb2NhbGUsIGJhc2VQYXRoIGFzIGFueSwgZmlsZVN5c3RlbSBhcyBhbnkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUZvcm1hdE9wdGlvbihvcHRpb25zOiBFeHRyYWN0STE4bkJ1aWxkZXJPcHRpb25zKTogRm9ybWF0IHtcbiAgbGV0IGZvcm1hdCA9IG9wdGlvbnMuZm9ybWF0O1xuXG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBGb3JtYXQuWGxmOlxuICAgIGNhc2UgRm9ybWF0LlhsaWY6XG4gICAgY2FzZSBGb3JtYXQuWGxpZmY6XG4gICAgICBmb3JtYXQgPSBGb3JtYXQuWGxmO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBGb3JtYXQuWGxmMjpcbiAgICBjYXNlIEZvcm1hdC5YbGlmZjI6XG4gICAgICBmb3JtYXQgPSBGb3JtYXQuWGxmMjtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gRGVmYXVsdCBmb3JtYXQgaXMgeGxpZmYxXG4gIHJldHVybiBmb3JtYXQgPz8gRm9ybWF0LlhsZjtcbn1cblxuY2xhc3MgTm9FbWl0UGx1Z2luIHtcbiAgYXBwbHkoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5zaG91bGRFbWl0LnRhcCgnYW5ndWxhci1uby1lbWl0JywgKCkgPT4gZmFsc2UpO1xuICB9XG59XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zPzoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgfSxcbik6IFByb21pc2U8QnVpbGRSZXN1bHQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxKc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zPihcbiAgICBhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCksXG4gICAgYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KSxcbiAgKTtcblxuICBjb25zdCBmb3JtYXQgPSBub3JtYWxpemVGb3JtYXRPcHRpb24ob3B0aW9ucyk7XG5cbiAgLy8gV2UgbmVlZCB0byBkZXRlcm1pbmUgdGhlIG91dEZpbGUgbmFtZSBzbyB0aGF0IEFuZ3VsYXJDb21waWxlciBjYW4gcmV0cmlldmUgaXQuXG4gIGxldCBvdXRGaWxlID0gb3B0aW9ucy5vdXRGaWxlIHx8IGdldEkxOG5PdXRmaWxlKGZvcm1hdCk7XG4gIGlmIChvcHRpb25zLm91dHB1dFBhdGgpIHtcbiAgICAvLyBBbmd1bGFyQ29tcGlsZXJQbHVnaW4gZG9lc24ndCBzdXBwb3J0IGdlbkRpciBzbyB3ZSBoYXZlIHRvIGFkanVzdCBvdXRGaWxlIGluc3RlYWQuXG4gICAgb3V0RmlsZSA9IHBhdGguam9pbihvcHRpb25zLm91dHB1dFBhdGgsIG91dEZpbGUpO1xuICB9XG4gIG91dEZpbGUgPSBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvdXRGaWxlKTtcblxuICBpZiAoIWNvbnRleHQudGFyZ2V0IHx8ICFjb250ZXh0LnRhcmdldC5wcm9qZWN0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogYGkxOG4gZXh0cmFjdGlvbiByZXF1aXJlcyB0aGUgJ0Bhbmd1bGFyL2xvY2FsaXplJyBwYWNrYWdlLmAsXG4gICAgICBvdXRwdXRQYXRoOiBvdXRGaWxlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKGNvbnRleHQudGFyZ2V0KTtcbiAgY29uc3QgaTE4biA9IGNyZWF0ZUkxOG5PcHRpb25zKG1ldGFkYXRhKTtcblxuICBsZXQgdXNlTGVnYWN5SWRzID0gdHJ1ZTtcblxuICBjb25zdCBpdnlNZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW10gPSBbXTtcbiAgY29uc3QgYnVpbGRlck9wdGlvbnMgPSB7XG4gICAgLi4uYnJvd3Nlck9wdGlvbnMsXG4gICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHNjcmlwdHM6IHRydWUsXG4gICAgICBzdHlsZXM6IGZhbHNlLFxuICAgICAgdmVuZG9yOiB0cnVlLFxuICAgIH0sXG4gICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgIGFvdDogdHJ1ZSxcbiAgICBwcm9ncmVzczogb3B0aW9ucy5wcm9ncmVzcyxcbiAgICBidWRnZXRzOiBbXSxcbiAgICBhc3NldHM6IFtdLFxuICAgIHNjcmlwdHM6IFtdLFxuICAgIHN0eWxlczogW10sXG4gICAgZGVsZXRlT3V0cHV0UGF0aDogZmFsc2UsXG4gICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eTogZmFsc2UsXG4gICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llczogdW5kZWZpbmVkLFxuICB9O1xuICBjb25zdCB7IGNvbmZpZywgcHJvamVjdFJvb3QgfSA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICBidWlsZGVyT3B0aW9ucyxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IHtcbiAgICAgIC8vIERlZmF1bHQgdmFsdWUgZm9yIGxlZ2FjeSBtZXNzYWdlIGlkcyBpcyBjdXJyZW50bHkgdHJ1ZVxuICAgICAgdXNlTGVnYWN5SWRzID0gd2NvLnRzQ29uZmlnLm9wdGlvbnMuZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCA/PyB0cnVlO1xuXG4gICAgICBjb25zdCBwYXJ0aWFsczogKFByb21pc2U8Q29uZmlndXJhdGlvbj4gfCBDb25maWd1cmF0aW9uKVtdID0gW1xuICAgICAgICB7IHBsdWdpbnM6IFtuZXcgTm9FbWl0UGx1Z2luKCldIH0sXG4gICAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgXTtcblxuICAgICAgLy8gQWRkIEl2eSBhcHBsaWNhdGlvbiBmaWxlIGV4dHJhY3RvciBzdXBwb3J0XG4gICAgICBwYXJ0aWFscy51bnNoaWZ0KHtcbiAgICAgICAgbW9kdWxlOiB7XG4gICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9pdnktZXh0cmFjdC1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VIYW5kbGVyOiAobWVzc2FnZXM6IExvY2FsaXplTWVzc2FnZVtdKSA9PiBpdnlNZXNzYWdlcy5wdXNoKC4uLm1lc3NhZ2VzKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBSZXBsYWNlIGFsbCBzdHlsZXNoZWV0cyB3aXRoIGVtcHR5IGNvbnRlbnRcbiAgICAgIHBhcnRpYWxzLnB1c2goe1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0ZXN0OiAvXFwuKGNzc3xzY3NzfHNhc3N8c3R5bHxsZXNzKSQvLFxuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9lbXB0eS1sb2FkZXInKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gcGFydGlhbHM7XG4gICAgfSxcbiAgKTtcblxuICAvLyBBbGwgdGhlIGxvY2FsaXplIHVzYWdlcyBhcmUgc2V0dXAgdG8gZmlyc3QgdHJ5IHRoZSBFU00gZW50cnkgcG9pbnQgdGhlbiBmYWxsYmFjayB0byB0aGUgZGVlcCBpbXBvcnRzLlxuICAvLyBUaGlzIHByb3ZpZGVzIGludGVyaW0gY29tcGF0aWJpbGl0eSB3aGlsZSB0aGUgZnJhbWV3b3JrIGlzIHRyYW5zaXRpb25lZCB0byBidW5kbGVkIEVTTSBwYWNrYWdlcy5cbiAgY29uc3QgbG9jYWxpemVUb29sc01vZHVsZSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnKT4oXG4gICAgJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJyxcbiAgKTtcbiAgY29uc3Qgd2VicGFja1Jlc3VsdCA9IGF3YWl0IHJ1bldlYnBhY2soXG4gICAgKGF3YWl0IHRyYW5zZm9ybXM/LndlYnBhY2tDb25maWd1cmF0aW9uPy4oY29uZmlnKSkgfHwgY29uZmlnLFxuICAgIGNvbnRleHQsXG4gICAge1xuICAgICAgbG9nZ2luZzogY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhidWlsZGVyT3B0aW9ucywgY29udGV4dC5sb2dnZXIpLFxuICAgICAgd2VicGFja0ZhY3Rvcnk6IHdlYnBhY2ssXG4gICAgfSxcbiAgKS50b1Byb21pc2UoKTtcblxuICAvLyBTZXQgdGhlIG91dHB1dFBhdGggdG8gdGhlIGV4dHJhY3Rpb24gb3V0cHV0IGxvY2F0aW9uIGZvciBkb3duc3RyZWFtIGNvbnN1bWVyc1xuICB3ZWJwYWNrUmVzdWx0Lm91dHB1dFBhdGggPSBvdXRGaWxlO1xuXG4gIC8vIENvbXBsZXRlIGlmIFdlYnBhY2sgYnVpbGQgZmFpbGVkXG4gIGlmICghd2VicGFja1Jlc3VsdC5zdWNjZXNzKSB7XG4gICAgcmV0dXJuIHdlYnBhY2tSZXN1bHQ7XG4gIH1cblxuICBjb25zdCBiYXNlUGF0aCA9IGNvbmZpZy5jb250ZXh0IHx8IHByb2plY3RSb290O1xuXG4gIGNvbnN0IHsgY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyB9ID0gbG9jYWxpemVUb29sc01vZHVsZTtcblxuICAvLyBUaGUgZmlsZXN5c3RlbSBpcyB1c2VkIHRvIGNyZWF0ZSBhIHJlbGF0aXZlIHBhdGggZm9yIGVhY2ggZmlsZVxuICAvLyBmcm9tIHRoZSBiYXNlUGF0aC4gIFRoaXMgcmVsYXRpdmUgcGF0aCBpcyB0aGVuIHVzZWQgaW4gdGhlIGVycm9yIG1lc3NhZ2UuXG4gIGNvbnN0IGNoZWNrRmlsZVN5c3RlbSA9IHtcbiAgICByZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pO1xuICAgIH0sXG4gIH07XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gY2hlY2tEdXBsaWNhdGVNZXNzYWdlcyhcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNoZWNrRmlsZVN5c3RlbSBhcyBhbnksXG4gICAgaXZ5TWVzc2FnZXMsXG4gICAgJ3dhcm5pbmcnLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgYmFzZVBhdGggYXMgYW55LFxuICApO1xuICBpZiAoZGlhZ25vc3RpY3MubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oZGlhZ25vc3RpY3MuZm9ybWF0RGlhZ25vc3RpY3MoJycpKTtcbiAgfVxuXG4gIC8vIFNlcmlhbGl6ZSBhbGwgZXh0cmFjdGVkIG1lc3NhZ2VzXG4gIGNvbnN0IHNlcmlhbGl6ZXIgPSBhd2FpdCBnZXRTZXJpYWxpemVyKFxuICAgIGxvY2FsaXplVG9vbHNNb2R1bGUsXG4gICAgZm9ybWF0LFxuICAgIGkxOG4uc291cmNlTG9jYWxlLFxuICAgIGJhc2VQYXRoLFxuICAgIHVzZUxlZ2FjeUlkcyxcbiAgICBkaWFnbm9zdGljcyxcbiAgKTtcbiAgY29uc3QgY29udGVudCA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplKGl2eU1lc3NhZ2VzKTtcblxuICAvLyBFbnN1cmUgZGlyZWN0b3J5IGV4aXN0c1xuICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5kaXJuYW1lKG91dEZpbGUpO1xuICBpZiAoIWZzLmV4aXN0c1N5bmMob3V0cHV0UGF0aCkpIHtcbiAgICBmcy5ta2RpclN5bmMob3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH1cblxuICAvLyBXcml0ZSB0cmFuc2xhdGlvbiBmaWxlXG4gIGZzLndyaXRlRmlsZVN5bmMob3V0RmlsZSwgY29udGVudCk7XG5cbiAgcmV0dXJuIHdlYnBhY2tSZXN1bHQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8RXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucz4oZXhlY3V0ZSk7XG4iXX0=