"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const path = require("path");
const operators_1 = require("rxjs/operators");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const stats_1 = require("../angular-cli-files/utilities/stats");
const webpackMerge = require('webpack-merge');
class ExtractI18nBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const architect = this.context.architect;
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const [project, targetName, configuration] = options.browserTarget.split(':');
        // Override browser build watch setting.
        const overrides = { watch: false };
        const browserTargetSpec = { project, target: targetName, configuration, overrides };
        const browserBuilderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        const webpackBuilder = new build_webpack_1.WebpackBuilder(this.context);
        const loggingCb = (stats, config, logger) => {
            const json = stats.toJson();
            if (stats.hasWarnings()) {
                this.context.logger.warn(stats_1.statsWarningsToString(json, config.stats));
            }
            if (stats.hasErrors()) {
                this.context.logger.error(stats_1.statsErrorsToString(json, config.stats));
            }
        };
        return architect.getBuilderDescription(browserBuilderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(browserBuilderConfig, browserDescription)), operators_1.map(browserBuilderConfig => browserBuilderConfig.options), operators_1.concatMap((validatedBrowserOptions) => {
            const browserOptions = validatedBrowserOptions;
            // We need to determine the outFile name so that AngularCompiler can retrieve it.
            let outFile = options.outFile || getI18nOutfile(options.i18nFormat);
            if (options.outputPath) {
                // AngularCompilerPlugin doesn't support genDir so we have to adjust outFile instead.
                outFile = path.join(options.outputPath, outFile);
            }
            // Extracting i18n uses the browser target webpack config with some specific options.
            const webpackConfig = this.buildWebpackConfig(root, projectRoot, Object.assign({}, browserOptions, { optimization: {
                    scripts: false,
                    styles: false,
                }, i18nLocale: options.i18nLocale, i18nFormat: options.i18nFormat, i18nFile: outFile, aot: true, progress: options.progress, assets: [], scripts: [], styles: [] }));
            return webpackBuilder.runWebpack(webpackConfig, loggingCb);
        }));
    }
    buildWebpackConfig(root, projectRoot, options) {
        let wco;
        const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        wco = {
            root: core_1.getSystemPath(root),
            logger: this.context.logger,
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: options,
            tsConfig,
            tsConfigPath,
            supportES2015: false,
        };
        const webpackConfigs = [
            // We don't need to write to disk.
            { plugins: [new InMemoryOutputPlugin()] },
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getAotConfig(wco, true),
            webpack_configs_1.getStylesConfig(wco),
            webpack_configs_1.getStatsConfig(wco),
        ];
        return webpackMerge(webpackConfigs);
    }
}
exports.ExtractI18nBuilder = ExtractI18nBuilder;
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
class InMemoryOutputPlugin {
    constructor() { }
    apply(compiler) {
        // tslint:disable-next-line:no-any
        compiler.outputFileSystem = new webpack.MemoryOutputFileSystem();
    }
}
exports.default = ExtractI18nBuilder;
