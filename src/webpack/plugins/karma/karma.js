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
const path = __importStar(require("path"));
const glob = __importStar(require("glob"));
const webpack_1 = __importDefault(require("webpack"));
const webpack_dev_middleware_1 = __importDefault(require("webpack-dev-middleware"));
const stats_1 = require("../../utils/stats");
const node_1 = require("@angular-devkit/core/node");
const index_1 = require("../../../utils/index");
const KARMA_APPLICATION_PATH = '_karma_webpack_';
let blocked = [];
let isBlocked = false;
let webpackMiddleware;
let successCb;
let failureCb;
// Add files to the Karma files array.
function addKarmaFiles(files, newFiles, prepend = false) {
    const defaults = {
        included: true,
        served: true,
        watched: true,
    };
    const processedFiles = newFiles
        // Remove globs that do not match any files, otherwise Karma will show a warning for these.
        .filter((file) => glob.sync(file.pattern, { nodir: true }).length != 0)
        // Fill in pattern properties with defaults.
        .map((file) => ({ ...defaults, ...file }));
    // It's important to not replace the array, because
    // karma already has a reference to the existing array.
    if (prepend) {
        files.unshift(...processedFiles);
    }
    else {
        files.push(...processedFiles);
    }
}
const init = (config, emitter) => {
    if (!config.buildWebpack) {
        throw new Error(`The '@angular-devkit/build-angular/plugins/karma' karma plugin is meant to` +
            ` be used from within Angular CLI and will not work correctly outside of it.`);
    }
    const options = config.buildWebpack.options;
    const logger = config.buildWebpack.logger || (0, node_1.createConsoleLogger)();
    successCb = config.buildWebpack.successCb;
    failureCb = config.buildWebpack.failureCb;
    // Add a reporter that fixes sourcemap urls.
    if ((0, index_1.normalizeSourceMaps)(options.sourceMap).scripts) {
        config.reporters.unshift('@angular-devkit/build-angular--sourcemap-reporter');
        // Code taken from https://github.com/tschaub/karma-source-map-support.
        // We can't use it directly because we need to add it conditionally in this file, and karma
        // frameworks cannot be added dynamically.
        const smsPath = path.dirname(require.resolve('source-map-support'));
        const ksmsPath = path.dirname(require.resolve('karma-source-map-support'));
        addKarmaFiles(config.files, [
            { pattern: path.join(smsPath, 'browser-source-map-support.js'), watched: false },
            { pattern: path.join(ksmsPath, 'client.js'), watched: false },
        ], true);
    }
    config.reporters.unshift('@angular-devkit/build-angular--event-reporter');
    // When using code-coverage, auto-add karma-coverage.
    if (options.codeCoverage &&
        !config.reporters.some((r) => r === 'coverage' || r === 'coverage-istanbul')) {
        config.reporters.push('coverage');
    }
    // Add webpack config.
    const webpackConfig = config.buildWebpack.webpackConfig;
    const webpackMiddlewareConfig = {
        // Hide webpack output because its noisy.
        stats: false,
        publicPath: `/${KARMA_APPLICATION_PATH}/`,
    };
    // Use existing config if any.
    config.webpack = { ...webpackConfig, ...config.webpack };
    config.webpackMiddleware = { ...webpackMiddlewareConfig, ...config.webpackMiddleware };
    // Our custom context and debug files list the webpack bundles directly instead of using
    // the karma files array.
    config.customContextFile = `${__dirname}/karma-context.html`;
    config.customDebugFile = `${__dirname}/karma-debug.html`;
    // Add the request blocker and the webpack server fallback.
    config.beforeMiddleware = config.beforeMiddleware || [];
    config.beforeMiddleware.push('@angular-devkit/build-angular--blocker');
    config.middleware = config.middleware || [];
    config.middleware.push('@angular-devkit/build-angular--fallback');
    if (config.singleRun) {
        // There's no option to turn off file watching in webpack-dev-server, but
        // we can override the file watcher instead.
        webpackConfig.plugins.unshift({
            apply: (compiler) => {
                compiler.hooks.afterEnvironment.tap('karma', () => {
                    compiler.watchFileSystem = { watch: () => { } };
                });
            },
        });
    }
    // Files need to be served from a custom path for Karma.
    webpackConfig.output.path = `/${KARMA_APPLICATION_PATH}/`;
    webpackConfig.output.publicPath = `/${KARMA_APPLICATION_PATH}/`;
    const compiler = (0, webpack_1.default)(webpackConfig, (error, stats) => {
        var _a;
        if (error) {
            throw error;
        }
        if (stats === null || stats === void 0 ? void 0 : stats.hasErrors()) {
            // Only generate needed JSON stats and when needed.
            const statsJson = stats === null || stats === void 0 ? void 0 : stats.toJson({
                all: false,
                children: true,
                errors: true,
                warnings: true,
            });
            logger.error((0, stats_1.statsErrorsToString)(statsJson, { colors: true }));
            // Notify potential listeners of the compile error.
            emitter.emit('compile_error', {
                errors: (_a = statsJson.errors) === null || _a === void 0 ? void 0 : _a.map((e) => e.message),
            });
            // Finish Karma run early in case of compilation error.
            emitter.emit('run_complete', [], { exitCode: 1 });
            // Emit a failure build event if there are compilation errors.
            failureCb();
        }
    });
    function handler(callback) {
        isBlocked = true;
        callback === null || callback === void 0 ? void 0 : callback();
    }
    compiler.hooks.invalid.tap('karma', () => handler());
    compiler.hooks.watchRun.tapAsync('karma', (_, callback) => handler(callback));
    compiler.hooks.run.tapAsync('karma', (_, callback) => handler(callback));
    webpackMiddleware = (0, webpack_dev_middleware_1.default)(compiler, webpackMiddlewareConfig);
    emitter.on('exit', (done) => {
        webpackMiddleware.close();
        done();
    });
    function unblock() {
        isBlocked = false;
        blocked.forEach((cb) => cb());
        blocked = [];
    }
    let lastCompilationHash;
    let isFirstRun = true;
    return new Promise((resolve) => {
        compiler.hooks.done.tap('karma', (stats) => {
            if (isFirstRun) {
                // This is needed to block Karma from launching browsers before Webpack writes the assets in memory.
                // See the below:
                // https://github.com/karma-runner/karma-chrome-launcher/issues/154#issuecomment-986661937
                // https://github.com/angular/angular-cli/issues/22495
                isFirstRun = false;
                resolve();
            }
            if (stats.hasErrors()) {
                lastCompilationHash = undefined;
            }
            else if (stats.hash != lastCompilationHash) {
                // Refresh karma only when there are no webpack errors, and if the compilation changed.
                lastCompilationHash = stats.hash;
                emitter.refreshFiles();
            }
            unblock();
        });
    });
};
init.$inject = ['config', 'emitter'];
// Block requests until the Webpack compilation is done.
function requestBlocker() {
    return function (_request, _response, next) {
        if (isBlocked) {
            blocked.push(next);
        }
        else {
            next();
        }
    };
}
// Copied from "karma-jasmine-diff-reporter" source code:
// In case, when multiple reporters are used in conjunction
// with initSourcemapReporter, they both will show repetitive log
// messages when displaying everything that supposed to write to terminal.
// So just suppress any logs from initSourcemapReporter by doing nothing on
// browser log, because it is an utility reporter,
// unless it's alone in the "reporters" option and base reporter is used.
function muteDuplicateReporterLogging(context, config) {
    context.writeCommonMsg = () => { };
    const reporterName = '@angular/cli';
    const hasTrailingReporters = config.reporters.slice(-1).pop() !== reporterName;
    if (hasTrailingReporters) {
        context.writeCommonMsg = () => { };
    }
}
// Emits builder events.
const eventReporter = function (baseReporterDecorator, config) {
    baseReporterDecorator(this);
    muteDuplicateReporterLogging(this, config);
    this.onRunComplete = function (_browsers, results) {
        if (results.exitCode === 0) {
            successCb();
        }
        else {
            failureCb();
        }
    };
    // avoid duplicate failure message
    this.specFailure = () => { };
};
eventReporter.$inject = ['baseReporterDecorator', 'config'];
// Strip the server address and webpack scheme (webpack://) from error log.
const sourceMapReporter = function (baseReporterDecorator, config) {
    baseReporterDecorator(this);
    muteDuplicateReporterLogging(this, config);
    const urlRegexp = /http:\/\/localhost:\d+\/_karma_webpack_\/(webpack:\/)?/gi;
    this.onSpecComplete = function (_browser, result) {
        if (!result.success) {
            result.log = result.log.map((l) => l.replace(urlRegexp, ''));
        }
    };
    // avoid duplicate complete message
    this.onRunComplete = () => { };
    // avoid duplicate failure message
    this.specFailure = () => { };
};
sourceMapReporter.$inject = ['baseReporterDecorator', 'config'];
// When a request is not found in the karma server, try looking for it from the webpack server root.
function fallbackMiddleware() {
    return function (request, response, next) {
        if (webpackMiddleware) {
            if (request.url && !new RegExp(`\\/${KARMA_APPLICATION_PATH}\\/.*`).test(request.url)) {
                request.url = '/' + KARMA_APPLICATION_PATH + request.url;
            }
            webpackMiddleware(request, response, () => {
                const alwaysServe = [
                    `/${KARMA_APPLICATION_PATH}/runtime.js`,
                    `/${KARMA_APPLICATION_PATH}/polyfills.js`,
                    `/${KARMA_APPLICATION_PATH}/scripts.js`,
                    `/${KARMA_APPLICATION_PATH}/styles.css`,
                    `/${KARMA_APPLICATION_PATH}/vendor.js`,
                ];
                if (request.url && alwaysServe.includes(request.url)) {
                    response.statusCode = 200;
                    response.end();
                }
                else {
                    next();
                }
            });
        }
        else {
            next();
        }
    };
}
module.exports = {
    'framework:@angular-devkit/build-angular': ['factory', init],
    'reporter:@angular-devkit/build-angular--sourcemap-reporter': ['type', sourceMapReporter],
    'reporter:@angular-devkit/build-angular--event-reporter': ['type', eventReporter],
    'middleware:@angular-devkit/build-angular--blocker': ['factory', requestBlocker],
    'middleware:@angular-devkit/build-angular--fallback': ['factory', fallbackMiddleware],
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMva2FybWEva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtILDJDQUE2QjtBQUM3QiwyQ0FBNkI7QUFDN0Isc0RBQThCO0FBQzlCLG9GQUEwRDtBQUUxRCw2Q0FBd0Q7QUFDeEQsb0RBQWdFO0FBR2hFLGdEQUEyRDtBQUUzRCxNQUFNLHNCQUFzQixHQUFHLGlCQUFpQixDQUFDO0FBRWpELElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0QyxTQUFTLGFBQWEsQ0FBQyxLQUFZLEVBQUUsUUFBZSxFQUFFLE9BQU8sR0FBRyxLQUFLO0lBQ25FLE1BQU0sUUFBUSxHQUFHO1FBQ2YsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLFFBQVE7UUFDN0IsMkZBQTJGO1NBQzFGLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUN2RSw0Q0FBNEM7U0FDM0MsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxRQUFRLEVBQUUsR0FB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Q3pGLHdEQUF3RCxFQUFFLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQztJQUNqRixtREFBbUQsRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUM7SUFDaEYsb0RBQW9ELEVBQUUsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUM7Q0FDdEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB3ZWJwYWNrRGV2TWlkZGxld2FyZSBmcm9tICd3ZWJwYWNrLWRldi1taWRkbGV3YXJlJztcblxuaW1wb3J0IHsgc3RhdHNFcnJvcnNUb1N0cmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IGNyZWF0ZUNvbnNvbGVMb2dnZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZS9ub2RlJztcbmltcG9ydCB7IGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9pbmRleCc7XG5cbmNvbnN0IEtBUk1BX0FQUExJQ0FUSU9OX1BBVEggPSAnX2thcm1hX3dlYnBhY2tfJztcblxubGV0IGJsb2NrZWQ6IGFueVtdID0gW107XG5sZXQgaXNCbG9ja2VkID0gZmFsc2U7XG5sZXQgd2VicGFja01pZGRsZXdhcmU6IGFueTtcbmxldCBzdWNjZXNzQ2I6ICgpID0+IHZvaWQ7XG5sZXQgZmFpbHVyZUNiOiAoKSA9PiB2b2lkO1xuXG4vLyBBZGQgZmlsZXMgdG8gdGhlIEthcm1hIGZpbGVzIGFycmF5LlxuZnVuY3Rpb24gYWRkS2FybWFGaWxlcyhmaWxlczogYW55W10sIG5ld0ZpbGVzOiBhbnlbXSwgcHJlcGVuZCA9IGZhbHNlKSB7XG4gIGNvbnN0IGRlZmF1bHRzID0ge1xuICAgIGluY2x1ZGVkOiB0cnVlLFxuICAgIHNlcnZlZDogdHJ1ZSxcbiAgICB3YXRjaGVkOiB0cnVlLFxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NlZEZpbGVzID0gbmV3RmlsZXNcbiAgICAvLyBSZW1vdmUgZ2xvYnMgdGhhdCBkbyBub3QgbWF0Y2ggYW55IGZpbGVzLCBvdGhlcndpc2UgS2FybWEgd2lsbCBzaG93IGEgd2FybmluZyBmb3IgdGhlc2UuXG4gICAgLmZpbHRlcigoZmlsZSkgPT4gZ2xvYi5zeW5jKGZpbGUucGF0dGVybiwgeyBub2RpcjogdHJ1ZSB9KS5sZW5ndGggIT0gMClcbiAgICAvLyBGaWxsIGluIHBhdHRlcm4gcHJvcGVydGllcyB3aXRoIGRlZmF1bHRzLlxuICAgIC5tYXAoKGZpbGUpID0+ICh7IC4uLmRlZmF1bHRzLCAuLi5maWxlIH0pKTtcblxuICAvLyBJdCdzIGltcG9ydGFudCB0byBub3QgcmVwbGFjZSB0aGUgYXJyYXksIGJlY2F1c2VcbiAgLy8ga2FybWEgYWxyZWFkeSBoYXMgYSByZWZlcmVuY2UgdG8gdGhlIGV4aXN0aW5nIGFycmF5LlxuICBpZiAocHJlcGVuZCkge1xuICAgIGZpbGVzLnVuc2hpZnQoLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVzLnB1c2goLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9XG59XG5cbmNvbnN0IGluaXQ6IGFueSA9IChjb25maWc6IGFueSwgZW1pdHRlcjogYW55KSA9PiB7XG4gIGlmICghY29uZmlnLmJ1aWxkV2VicGFjaykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBUaGUgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyL3BsdWdpbnMva2FybWEnIGthcm1hIHBsdWdpbiBpcyBtZWFudCB0b2AgK1xuICAgICAgICBgIGJlIHVzZWQgZnJvbSB3aXRoaW4gQW5ndWxhciBDTEkgYW5kIHdpbGwgbm90IHdvcmsgY29ycmVjdGx5IG91dHNpZGUgb2YgaXQuYCxcbiAgICApO1xuICB9XG4gIGNvbnN0IG9wdGlvbnMgPSBjb25maWcuYnVpbGRXZWJwYWNrLm9wdGlvbnMgYXMgQnVpbGRPcHRpb25zO1xuICBjb25zdCBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyID0gY29uZmlnLmJ1aWxkV2VicGFjay5sb2dnZXIgfHwgY3JlYXRlQ29uc29sZUxvZ2dlcigpO1xuICBzdWNjZXNzQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLnN1Y2Nlc3NDYjtcbiAgZmFpbHVyZUNiID0gY29uZmlnLmJ1aWxkV2VicGFjay5mYWlsdXJlQ2I7XG5cbiAgLy8gQWRkIGEgcmVwb3J0ZXIgdGhhdCBmaXhlcyBzb3VyY2VtYXAgdXJscy5cbiAgaWYgKG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXApLnNjcmlwdHMpIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInKTtcblxuICAgIC8vIENvZGUgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdHNjaGF1Yi9rYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQuXG4gICAgLy8gV2UgY2FuJ3QgdXNlIGl0IGRpcmVjdGx5IGJlY2F1c2Ugd2UgbmVlZCB0byBhZGQgaXQgY29uZGl0aW9uYWxseSBpbiB0aGlzIGZpbGUsIGFuZCBrYXJtYVxuICAgIC8vIGZyYW1ld29ya3MgY2Fubm90IGJlIGFkZGVkIGR5bmFtaWNhbGx5LlxuICAgIGNvbnN0IHNtc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG4gICAgY29uc3Qga3Ntc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG5cbiAgICBhZGRLYXJtYUZpbGVzKFxuICAgICAgY29uZmlnLmZpbGVzLFxuICAgICAgW1xuICAgICAgICB7IHBhdHRlcm46IHBhdGguam9pbihzbXNQYXRoLCAnYnJvd3Nlci1zb3VyY2UtbWFwLXN1cHBvcnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfSxcbiAgICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oa3Ntc1BhdGgsICdjbGllbnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfSxcbiAgICAgIF0sXG4gICAgICB0cnVlLFxuICAgICk7XG4gIH1cblxuICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcicpO1xuXG4gIC8vIFdoZW4gdXNpbmcgY29kZS1jb3ZlcmFnZSwgYXV0by1hZGQga2FybWEtY292ZXJhZ2UuXG4gIGlmIChcbiAgICBvcHRpb25zLmNvZGVDb3ZlcmFnZSAmJlxuICAgICFjb25maWcucmVwb3J0ZXJzLnNvbWUoKHI6IHN0cmluZykgPT4gciA9PT0gJ2NvdmVyYWdlJyB8fCByID09PSAnY292ZXJhZ2UtaXN0YW5idWwnKVxuICApIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnB1c2goJ2NvdmVyYWdlJyk7XG4gIH1cblxuICAvLyBBZGQgd2VicGFjayBjb25maWcuXG4gIGNvbnN0IHdlYnBhY2tDb25maWcgPSBjb25maWcuYnVpbGRXZWJwYWNrLndlYnBhY2tDb25maWc7XG4gIGNvbnN0IHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnID0ge1xuICAgIC8vIEhpZGUgd2VicGFjayBvdXRwdXQgYmVjYXVzZSBpdHMgbm9pc3kuXG4gICAgc3RhdHM6IGZhbHNlLFxuICAgIHB1YmxpY1BhdGg6IGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9gLFxuICB9O1xuXG4gIC8vIFVzZSBleGlzdGluZyBjb25maWcgaWYgYW55LlxuICBjb25maWcud2VicGFjayA9IHsgLi4ud2VicGFja0NvbmZpZywgLi4uY29uZmlnLndlYnBhY2sgfTtcbiAgY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlID0geyAuLi53ZWJwYWNrTWlkZGxld2FyZUNvbmZpZywgLi4uY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlIH07XG5cbiAgLy8gT3VyIGN1c3RvbSBjb250ZXh0IGFuZCBkZWJ1ZyBmaWxlcyBsaXN0IHRoZSB3ZWJwYWNrIGJ1bmRsZXMgZGlyZWN0bHkgaW5zdGVhZCBvZiB1c2luZ1xuICAvLyB0aGUga2FybWEgZmlsZXMgYXJyYXkuXG4gIGNvbmZpZy5jdXN0b21Db250ZXh0RmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtY29udGV4dC5odG1sYDtcbiAgY29uZmlnLmN1c3RvbURlYnVnRmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtZGVidWcuaHRtbGA7XG5cbiAgLy8gQWRkIHRoZSByZXF1ZXN0IGJsb2NrZXIgYW5kIHRoZSB3ZWJwYWNrIHNlcnZlciBmYWxsYmFjay5cbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUgPSBjb25maWcuYmVmb3JlTWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWJsb2NrZXInKTtcbiAgY29uZmlnLm1pZGRsZXdhcmUgPSBjb25maWcubWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLm1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWZhbGxiYWNrJyk7XG5cbiAgaWYgKGNvbmZpZy5zaW5nbGVSdW4pIHtcbiAgICAvLyBUaGVyZSdzIG5vIG9wdGlvbiB0byB0dXJuIG9mZiBmaWxlIHdhdGNoaW5nIGluIHdlYnBhY2stZGV2LXNlcnZlciwgYnV0XG4gICAgLy8gd2UgY2FuIG92ZXJyaWRlIHRoZSBmaWxlIHdhdGNoZXIgaW5zdGVhZC5cbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMudW5zaGlmdCh7XG4gICAgICBhcHBseTogKGNvbXBpbGVyOiBhbnkpID0+IHtcbiAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2thcm1hJywgKCkgPT4ge1xuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHt9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICAvLyBGaWxlcyBuZWVkIHRvIGJlIHNlcnZlZCBmcm9tIGEgY3VzdG9tIHBhdGggZm9yIEthcm1hLlxuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5wYXRoID0gYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L2A7XG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnB1YmxpY1BhdGggPSBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vYDtcblxuICBjb25zdCBjb21waWxlciA9IHdlYnBhY2sod2VicGFja0NvbmZpZywgKGVycm9yLCBzdGF0cykgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKHN0YXRzPy5oYXNFcnJvcnMoKSkge1xuICAgICAgLy8gT25seSBnZW5lcmF0ZSBuZWVkZWQgSlNPTiBzdGF0cyBhbmQgd2hlbiBuZWVkZWQuXG4gICAgICBjb25zdCBzdGF0c0pzb24gPSBzdGF0cz8udG9Kc29uKHtcbiAgICAgICAgYWxsOiBmYWxzZSxcbiAgICAgICAgY2hpbGRyZW46IHRydWUsXG4gICAgICAgIGVycm9yczogdHJ1ZSxcbiAgICAgICAgd2FybmluZ3M6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgbG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoc3RhdHNKc29uLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG5cbiAgICAgIC8vIE5vdGlmeSBwb3RlbnRpYWwgbGlzdGVuZXJzIG9mIHRoZSBjb21waWxlIGVycm9yLlxuICAgICAgZW1pdHRlci5lbWl0KCdjb21waWxlX2Vycm9yJywge1xuICAgICAgICBlcnJvcnM6IHN0YXRzSnNvbi5lcnJvcnM/Lm1hcCgoZSkgPT4gZS5tZXNzYWdlKSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBGaW5pc2ggS2FybWEgcnVuIGVhcmx5IGluIGNhc2Ugb2YgY29tcGlsYXRpb24gZXJyb3IuXG4gICAgICBlbWl0dGVyLmVtaXQoJ3J1bl9jb21wbGV0ZScsIFtdLCB7IGV4aXRDb2RlOiAxIH0pO1xuXG4gICAgICAvLyBFbWl0IGEgZmFpbHVyZSBidWlsZCBldmVudCBpZiB0aGVyZSBhcmUgY29tcGlsYXRpb24gZXJyb3JzLlxuICAgICAgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBoYW5kbGVyKGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlzQmxvY2tlZCA9IHRydWU7XG4gICAgY2FsbGJhY2s/LigpO1xuICB9XG5cbiAgY29tcGlsZXIuaG9va3MuaW52YWxpZC50YXAoJ2thcm1hJywgKCkgPT4gaGFuZGxlcigpKTtcbiAgY29tcGlsZXIuaG9va3Mud2F0Y2hSdW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcbiAgY29tcGlsZXIuaG9va3MucnVuLnRhcEFzeW5jKCdrYXJtYScsIChfOiBhbnksIGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiBoYW5kbGVyKGNhbGxiYWNrKSk7XG5cbiAgd2VicGFja01pZGRsZXdhcmUgPSB3ZWJwYWNrRGV2TWlkZGxld2FyZShjb21waWxlciwgd2VicGFja01pZGRsZXdhcmVDb25maWcpO1xuICBlbWl0dGVyLm9uKCdleGl0JywgKGRvbmU6IGFueSkgPT4ge1xuICAgIHdlYnBhY2tNaWRkbGV3YXJlLmNsb3NlKCk7XG4gICAgZG9uZSgpO1xuICB9KTtcblxuICBmdW5jdGlvbiB1bmJsb2NrKCkge1xuICAgIGlzQmxvY2tlZCA9IGZhbHNlO1xuICAgIGJsb2NrZWQuZm9yRWFjaCgoY2IpID0+IGNiKCkpO1xuICAgIGJsb2NrZWQgPSBbXTtcbiAgfVxuXG4gIGxldCBsYXN0Q29tcGlsYXRpb25IYXNoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGxldCBpc0ZpcnN0UnVuID0gdHJ1ZTtcblxuICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICBjb21waWxlci5ob29rcy5kb25lLnRhcCgna2FybWEnLCAoc3RhdHMpID0+IHtcbiAgICAgIGlmIChpc0ZpcnN0UnVuKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgbmVlZGVkIHRvIGJsb2NrIEthcm1hIGZyb20gbGF1bmNoaW5nIGJyb3dzZXJzIGJlZm9yZSBXZWJwYWNrIHdyaXRlcyB0aGUgYXNzZXRzIGluIG1lbW9yeS5cbiAgICAgICAgLy8gU2VlIHRoZSBiZWxvdzpcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2thcm1hLXJ1bm5lci9rYXJtYS1jaHJvbWUtbGF1bmNoZXIvaXNzdWVzLzE1NCNpc3N1ZWNvbW1lbnQtOTg2NjYxOTM3XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yMjQ5NVxuICAgICAgICBpc0ZpcnN0UnVuID0gZmFsc2U7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICAgIGxhc3RDb21waWxhdGlvbkhhc2ggPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRzLmhhc2ggIT0gbGFzdENvbXBpbGF0aW9uSGFzaCkge1xuICAgICAgICAvLyBSZWZyZXNoIGthcm1hIG9ubHkgd2hlbiB0aGVyZSBhcmUgbm8gd2VicGFjayBlcnJvcnMsIGFuZCBpZiB0aGUgY29tcGlsYXRpb24gY2hhbmdlZC5cbiAgICAgICAgbGFzdENvbXBpbGF0aW9uSGFzaCA9IHN0YXRzLmhhc2g7XG4gICAgICAgIGVtaXR0ZXIucmVmcmVzaEZpbGVzKCk7XG4gICAgICB9XG5cbiAgICAgIHVuYmxvY2soKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5pbml0LiRpbmplY3QgPSBbJ2NvbmZpZycsICdlbWl0dGVyJ107XG5cbi8vIEJsb2NrIHJlcXVlc3RzIHVudGlsIHRoZSBXZWJwYWNrIGNvbXBpbGF0aW9uIGlzIGRvbmUuXG5mdW5jdGlvbiByZXF1ZXN0QmxvY2tlcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChfcmVxdWVzdDogYW55LCBfcmVzcG9uc2U6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmIChpc0Jsb2NrZWQpIHtcbiAgICAgIGJsb2NrZWQucHVzaChuZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gQ29waWVkIGZyb20gXCJrYXJtYS1qYXNtaW5lLWRpZmYtcmVwb3J0ZXJcIiBzb3VyY2UgY29kZTpcbi8vIEluIGNhc2UsIHdoZW4gbXVsdGlwbGUgcmVwb3J0ZXJzIGFyZSB1c2VkIGluIGNvbmp1bmN0aW9uXG4vLyB3aXRoIGluaXRTb3VyY2VtYXBSZXBvcnRlciwgdGhleSBib3RoIHdpbGwgc2hvdyByZXBldGl0aXZlIGxvZ1xuLy8gbWVzc2FnZXMgd2hlbiBkaXNwbGF5aW5nIGV2ZXJ5dGhpbmcgdGhhdCBzdXBwb3NlZCB0byB3cml0ZSB0byB0ZXJtaW5hbC5cbi8vIFNvIGp1c3Qgc3VwcHJlc3MgYW55IGxvZ3MgZnJvbSBpbml0U291cmNlbWFwUmVwb3J0ZXIgYnkgZG9pbmcgbm90aGluZyBvblxuLy8gYnJvd3NlciBsb2csIGJlY2F1c2UgaXQgaXMgYW4gdXRpbGl0eSByZXBvcnRlcixcbi8vIHVubGVzcyBpdCdzIGFsb25lIGluIHRoZSBcInJlcG9ydGVyc1wiIG9wdGlvbiBhbmQgYmFzZSByZXBvcnRlciBpcyB1c2VkLlxuZnVuY3Rpb24gbXV0ZUR1cGxpY2F0ZVJlcG9ydGVyTG9nZ2luZyhjb250ZXh0OiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGNvbnRleHQud3JpdGVDb21tb25Nc2cgPSAoKSA9PiB7fTtcbiAgY29uc3QgcmVwb3J0ZXJOYW1lID0gJ0Bhbmd1bGFyL2NsaSc7XG4gIGNvbnN0IGhhc1RyYWlsaW5nUmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycy5zbGljZSgtMSkucG9wKCkgIT09IHJlcG9ydGVyTmFtZTtcblxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICBjb250ZXh0LndyaXRlQ29tbW9uTXNnID0gKCkgPT4ge307XG4gIH1cbn1cblxuLy8gRW1pdHMgYnVpbGRlciBldmVudHMuXG5jb25zdCBldmVudFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICB0aGlzLm9uUnVuQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXJzOiBhbnksIHJlc3VsdHM6IGFueSkge1xuICAgIGlmIChyZXN1bHRzLmV4aXRDb2RlID09PSAwKSB7XG4gICAgICBzdWNjZXNzQ2IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBmYWlsdXJlIG1lc3NhZ2VcbiAgdGhpcy5zcGVjRmFpbHVyZSA9ICgpID0+IHt9O1xufTtcblxuZXZlbnRSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InLCAnY29uZmlnJ107XG5cbi8vIFN0cmlwIHRoZSBzZXJ2ZXIgYWRkcmVzcyBhbmQgd2VicGFjayBzY2hlbWUgKHdlYnBhY2s6Ly8pIGZyb20gZXJyb3IgbG9nLlxuY29uc3Qgc291cmNlTWFwUmVwb3J0ZXI6IGFueSA9IGZ1bmN0aW9uICh0aGlzOiBhbnksIGJhc2VSZXBvcnRlckRlY29yYXRvcjogYW55LCBjb25maWc6IGFueSkge1xuICBiYXNlUmVwb3J0ZXJEZWNvcmF0b3IodGhpcyk7XG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICBjb25zdCB1cmxSZWdleHAgPSAvaHR0cDpcXC9cXC9sb2NhbGhvc3Q6XFxkK1xcL19rYXJtYV93ZWJwYWNrX1xcLyh3ZWJwYWNrOlxcLyk/L2dpO1xuXG4gIHRoaXMub25TcGVjQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXI6IGFueSwgcmVzdWx0OiBhbnkpIHtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICByZXN1bHQubG9nID0gcmVzdWx0LmxvZy5tYXAoKGw6IHN0cmluZykgPT4gbC5yZXBsYWNlKHVybFJlZ2V4cCwgJycpKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGNvbXBsZXRlIG1lc3NhZ2VcbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gKCkgPT4ge307XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5zb3VyY2VNYXBSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InLCAnY29uZmlnJ107XG5cbi8vIFdoZW4gYSByZXF1ZXN0IGlzIG5vdCBmb3VuZCBpbiB0aGUga2FybWEgc2VydmVyLCB0cnkgbG9va2luZyBmb3IgaXQgZnJvbSB0aGUgd2VicGFjayBzZXJ2ZXIgcm9vdC5cbmZ1bmN0aW9uIGZhbGxiYWNrTWlkZGxld2FyZSgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChyZXF1ZXN0OiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzcG9uc2U6IGh0dHAuU2VydmVyUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAod2VicGFja01pZGRsZXdhcmUpIHtcbiAgICAgIGlmIChyZXF1ZXN0LnVybCAmJiAhbmV3IFJlZ0V4cChgXFxcXC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9XFxcXC8uKmApLnRlc3QocmVxdWVzdC51cmwpKSB7XG4gICAgICAgIHJlcXVlc3QudXJsID0gJy8nICsgS0FSTUFfQVBQTElDQVRJT05fUEFUSCArIHJlcXVlc3QudXJsO1xuICAgICAgfVxuICAgICAgd2VicGFja01pZGRsZXdhcmUocmVxdWVzdCwgcmVzcG9uc2UsICgpID0+IHtcbiAgICAgICAgY29uc3QgYWx3YXlzU2VydmUgPSBbXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3J1bnRpbWUuanNgLFxuICAgICAgICAgIGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9wb2x5ZmlsbHMuanNgLFxuICAgICAgICAgIGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9zY3JpcHRzLmpzYCxcbiAgICAgICAgICBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vc3R5bGVzLmNzc2AsXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3ZlbmRvci5qc2AsXG4gICAgICAgIF07XG4gICAgICAgIGlmIChyZXF1ZXN0LnVybCAmJiBhbHdheXNTZXJ2ZS5pbmNsdWRlcyhyZXF1ZXN0LnVybCkpIHtcbiAgICAgICAgICByZXNwb25zZS5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlc3BvbnNlLmVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnZnJhbWV3b3JrOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogWydmYWN0b3J5JywgaW5pdF0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJzogWyd0eXBlJywgc291cmNlTWFwUmVwb3J0ZXJdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJzogWyd0eXBlJywgZXZlbnRSZXBvcnRlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJzogWydmYWN0b3J5JywgcmVxdWVzdEJsb2NrZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snOiBbJ2ZhY3RvcnknLCBmYWxsYmFja01pZGRsZXdhcmVdLFxufTtcbiJdfQ==