"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const fs = require("fs");
const path = require("path");
const semver_1 = require("semver");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const stats_1 = require("../angular-cli-files/utilities/stats");
const i18n_options_1 = require("../utils/i18n-options");
const version_1 = require("../utils/version");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
const schema_1 = require("./schema");
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
        default:
            throw new Error(`Unsupported format "${format}"`);
    }
}
async function getSerializer(format, sourceLocale, basePath, useLegacyIds = true) {
    switch (format) {
        case schema_1.Format.Xmb:
            const { XmbTranslationSerializer } = await Promise.resolve().then(() => require('@angular/localize/src/tools/src/extract/translation_files/xmb_translation_serializer'));
            // tslint:disable-next-line: no-any
            return new XmbTranslationSerializer(basePath, useLegacyIds);
        case schema_1.Format.Xlf:
        case schema_1.Format.Xlif:
        case schema_1.Format.Xliff:
            const { Xliff1TranslationSerializer } = await Promise.resolve().then(() => require('@angular/localize/src/tools/src/extract/translation_files/xliff1_translation_serializer'));
            // tslint:disable-next-line: no-any
            return new Xliff1TranslationSerializer(sourceLocale, basePath, useLegacyIds);
        case schema_1.Format.Xlf2:
        case schema_1.Format.Xliff2:
            const { Xliff2TranslationSerializer } = await Promise.resolve().then(() => require('@angular/localize/src/tools/src/extract/translation_files/xliff2_translation_serializer'));
            // tslint:disable-next-line: no-any
            return new Xliff2TranslationSerializer(sourceLocale, basePath, useLegacyIds);
    }
}
class InMemoryOutputPlugin {
    apply(compiler) {
        // tslint:disable-next-line:no-any
        compiler.outputFileSystem = new webpack.MemoryOutputFileSystem();
    }
}
async function execute(options, context, transforms) {
    var _a;
    // Check Angular version.
    version_1.assertCompatibleAngularVersion(context.workspaceRoot, context.logger);
    const browserTarget = architect_1.targetFromTargetString(options.browserTarget);
    const browserOptions = await context.validateOptions(await context.getTargetOptions(browserTarget), await context.getBuilderNameForTarget(browserTarget));
    if (options.i18nFormat !== schema_1.Format.Xlf) {
        options.format = options.i18nFormat;
    }
    switch (options.format) {
        case schema_1.Format.Xlf:
        case schema_1.Format.Xlif:
        case schema_1.Format.Xliff:
            options.format = schema_1.Format.Xlf;
            break;
        case schema_1.Format.Xlf2:
        case schema_1.Format.Xliff2:
            options.format = schema_1.Format.Xlf2;
            break;
        case undefined:
            options.format = schema_1.Format.Xlf;
            break;
    }
    // We need to determine the outFile name so that AngularCompiler can retrieve it.
    let outFile = options.outFile || getI18nOutfile(options.format);
    if (options.outputPath) {
        // AngularCompilerPlugin doesn't support genDir so we have to adjust outFile instead.
        outFile = path.join(options.outputPath, outFile);
    }
    if (!context.target || !context.target.project) {
        throw new Error('The builder requires a target.');
    }
    const metadata = await context.getProjectMetadata(context.target);
    const i18n = i18n_options_1.createI18nOptions(metadata);
    let usingIvy = false;
    const ivyMessages = [];
    const { config, projectRoot } = await webpack_browser_config_1.generateBrowserWebpackConfigFromContext({
        ...browserOptions,
        optimization: {
            scripts: false,
            styles: false,
        },
        sourceMap: {
            scripts: true,
        },
        buildOptimizer: false,
        i18nLocale: options.i18nLocale || i18n.sourceLocale,
        i18nFormat: options.format,
        i18nFile: outFile,
        aot: true,
        progress: options.progress,
        assets: [],
        scripts: [],
        styles: [],
        deleteOutputPath: false,
    }, context, (wco) => {
        const isIvyApplication = wco.tsConfig.options.enableIvy !== false;
        // Ivy-based extraction is currently opt-in
        if (options.ivy) {
            if (!isIvyApplication) {
                context.logger.warn('Ivy extraction enabled but application is not Ivy enabled. Extraction may fail.');
            }
            usingIvy = true;
        }
        else if (isIvyApplication) {
            context.logger.warn('Ivy extraction not enabled but application is Ivy enabled. ' +
                'If the extraction fails, the `--ivy` flag will enable Ivy extraction.');
        }
        const partials = [
            { plugins: [new InMemoryOutputPlugin()] },
            webpack_configs_1.getCommonConfig(wco),
            // Only use VE extraction if not using Ivy
            webpack_configs_1.getAotConfig(wco, !usingIvy),
            webpack_configs_1.getStylesConfig(wco),
            webpack_configs_1.getStatsConfig(wco),
        ];
        // Add Ivy application file extractor support
        if (usingIvy) {
            partials.unshift({
                module: {
                    rules: [
                        {
                            test: /\.ts$/,
                            loader: require.resolve('./ivy-extract-loader'),
                            options: {
                                messageHandler: (messages) => ivyMessages.push(...messages),
                            },
                        },
                    ],
                },
            });
        }
        return partials;
    });
    if (usingIvy) {
        let validLocalizePackage = false;
        try {
            const { version: localizeVersion } = require('@angular/localize/package.json');
            validLocalizePackage = semver_1.gte(localizeVersion, '10.1.0-next.0', { includePrerelease: true });
        }
        catch (_b) { }
        if (!validLocalizePackage) {
            context.logger.error("Ivy extraction requires the '@angular/localize' package version 10.1.0 or higher.");
            return { success: false };
        }
    }
    const logging = (stats, config) => {
        const json = stats.toJson({ errors: true, warnings: true });
        if (stats_1.statsHasWarnings(json)) {
            context.logger.warn(stats_1.statsWarningsToString(json, config.stats));
        }
        if (stats_1.statsHasErrors(json)) {
            context.logger.error(stats_1.statsErrorsToString(json, config.stats));
        }
    };
    const webpackResult = await build_webpack_1.runWebpack((await ((_a = transforms === null || transforms === void 0 ? void 0 : transforms.webpackConfiguration) === null || _a === void 0 ? void 0 : _a.call(transforms, config))) || config, context, {
        logging,
        webpackFactory: await Promise.resolve().then(() => require('webpack')),
    }).toPromise();
    // Complete if using VE
    if (!usingIvy) {
        return webpackResult;
    }
    // Nothing to process if the Webpack build failed
    if (!webpackResult.success) {
        return webpackResult;
    }
    // Serialize all extracted messages
    const serializer = await getSerializer(options.format, i18n.sourceLocale, config.context || projectRoot);
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
exports.default = architect_1.createBuilder(execute);
