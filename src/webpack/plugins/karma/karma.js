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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMva2FybWEva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsMkNBQTZCO0FBQzdCLDJDQUE2QjtBQUM3QixzREFBOEI7QUFDOUIsb0ZBQTBEO0FBRTFELDZDQUF3RDtBQUN4RCxvREFBZ0U7QUFHaEUsZ0RBQTJEO0FBRTNELE1BQU0sc0JBQXNCLEdBQUcsaUJBQWlCLENBQUM7QUFFakQsSUFBSSxPQUFPLEdBQVUsRUFBRSxDQUFDO0FBQ3hCLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztBQUN0QixJQUFJLGlCQUFzQixDQUFDO0FBQzNCLElBQUksU0FBcUIsQ0FBQztBQUMxQixJQUFJLFNBQXFCLENBQUM7QUFFMUIsc0NBQXNDO0FBQ3RDLFNBQVMsYUFBYSxDQUFDLEtBQVksRUFBRSxRQUFlLEVBQUUsT0FBTyxHQUFHLEtBQUs7SUFDbkUsTUFBTSxRQUFRLEdBQUc7UUFDZixRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxJQUFJO1FBQ1osT0FBTyxFQUFFLElBQUk7S0FDZCxDQUFDO0lBRUYsTUFBTSxjQUFjLEdBQUcsUUFBUTtRQUM3QiwyRkFBMkY7U0FDMUYsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO1FBQ3ZFLDRDQUE0QztTQUMzQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLFFBQVEsRUFBRSxHQUFHLElB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d0RBQXdELEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO0lBQ2pGLG1EQUFtRCxFQUFFLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQztJQUNoRixvREFBb0QsRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztDQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHdlYnBhY2tEZXZNaWRkbGV3YXJlIGZyb20gJ3dlYnBhY2stZGV2LW1pZGRsZXdhcmUnO1xuXG5pbXBvcnQgeyBzdGF0c0Vycm9yc1RvU3RyaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgY3JlYXRlQ29uc29sZUxvZ2dlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlL25vZGUnO1xuaW1wb3J0IHsgbG9nZ2luZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplU291cmNlTWFwcyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2luZGV4JztcblxuY29uc3QgS0FSTUFfQVBQTElDQVRJT05fUEFUSCA9ICdfa2FybWFfd2VicGFja18nO1xuXG5sZXQgYmxvY2tlZDogYW55W10gPSBbXTtcbmxldCBpc0Jsb2NrZWQgPSBmYWxzZTtcbmxldCB3ZWJwYWNrTWlkZGxld2FyZTogYW55O1xubGV0IHN1Y2Nlc3NDYjogKCkgPT4gdm9pZDtcbmxldCBmYWlsdXJlQ2I6ICgpID0+IHZvaWQ7XG5cbi8vIEFkZCBmaWxlcyB0byB0aGUgS2FybWEgZmlsZXMgYXJyYXkuXG5mdW5jdGlvbiBhZGRLYXJtYUZpbGVzKGZpbGVzOiBhbnlbXSwgbmV3RmlsZXM6IGFueVtdLCBwcmVwZW5kID0gZmFsc2UpIHtcbiAgY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgaW5jbHVkZWQ6IHRydWUsXG4gICAgc2VydmVkOiB0cnVlLFxuICAgIHdhdGNoZWQ6IHRydWUsXG4gIH07XG5cbiAgY29uc3QgcHJvY2Vzc2VkRmlsZXMgPSBuZXdGaWxlc1xuICAgIC8vIFJlbW92ZSBnbG9icyB0aGF0IGRvIG5vdCBtYXRjaCBhbnkgZmlsZXMsIG90aGVyd2lzZSBLYXJtYSB3aWxsIHNob3cgYSB3YXJuaW5nIGZvciB0aGVzZS5cbiAgICAuZmlsdGVyKChmaWxlKSA9PiBnbG9iLnN5bmMoZmlsZS5wYXR0ZXJuLCB7IG5vZGlyOiB0cnVlIH0pLmxlbmd0aCAhPSAwKVxuICAgIC8vIEZpbGwgaW4gcGF0dGVybiBwcm9wZXJ0aWVzIHdpdGggZGVmYXVsdHMuXG4gICAgLm1hcCgoZmlsZSkgPT4gKHsgLi4uZGVmYXVsdHMsIC4uLmZpbGUgfSkpO1xuXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIG5vdCByZXBsYWNlIHRoZSBhcnJheSwgYmVjYXVzZVxuICAvLyBrYXJtYSBhbHJlYWR5IGhhcyBhIHJlZmVyZW5jZSB0byB0aGUgZXhpc3RpbmcgYXJyYXkuXG4gIGlmIChwcmVwZW5kKSB7XG4gICAgZmlsZXMudW5zaGlmdCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZXMucHVzaCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH1cbn1cblxuY29uc3QgaW5pdDogYW55ID0gKGNvbmZpZzogYW55LCBlbWl0dGVyOiBhbnkpID0+IHtcbiAgaWYgKCFjb25maWcuYnVpbGRXZWJwYWNrKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFRoZSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScga2FybWEgcGx1Z2luIGlzIG1lYW50IHRvYCArXG4gICAgICAgIGAgYmUgdXNlZCBmcm9tIHdpdGhpbiBBbmd1bGFyIENMSSBhbmQgd2lsbCBub3Qgd29yayBjb3JyZWN0bHkgb3V0c2lkZSBvZiBpdC5gLFxuICAgICk7XG4gIH1cbiAgY29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5idWlsZFdlYnBhY2sub3B0aW9ucyBhcyBCdWlsZE9wdGlvbnM7XG4gIGNvbnN0IGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIgPSBjb25maWcuYnVpbGRXZWJwYWNrLmxvZ2dlciB8fCBjcmVhdGVDb25zb2xlTG9nZ2VyKCk7XG4gIHN1Y2Nlc3NDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suc3VjY2Vzc0NiO1xuICBmYWlsdXJlQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLmZhaWx1cmVDYjtcblxuICAvLyBBZGQgYSByZXBvcnRlciB0aGF0IGZpeGVzIHNvdXJjZW1hcCB1cmxzLlxuICBpZiAobm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCkuc2NyaXB0cykge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcicpO1xuXG4gICAgLy8gQ29kZSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS90c2NoYXViL2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydC5cbiAgICAvLyBXZSBjYW4ndCB1c2UgaXQgZGlyZWN0bHkgYmVjYXVzZSB3ZSBuZWVkIHRvIGFkZCBpdCBjb25kaXRpb25hbGx5IGluIHRoaXMgZmlsZSwgYW5kIGthcm1hXG4gICAgLy8gZnJhbWV3b3JrcyBjYW5ub3QgYmUgYWRkZWQgZHluYW1pY2FsbHkuXG4gICAgY29uc3Qgc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpKTtcbiAgICBjb25zdCBrc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpKTtcblxuICAgIGFkZEthcm1hRmlsZXMoXG4gICAgICBjb25maWcuZmlsZXMsXG4gICAgICBbXG4gICAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKHNtc1BhdGgsICdicm93c2VyLXNvdXJjZS1tYXAtc3VwcG9ydC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9LFxuICAgICAgICB7IHBhdHRlcm46IHBhdGguam9pbihrc21zUGF0aCwgJ2NsaWVudC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9LFxuICAgICAgXSxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgfVxuXG4gIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJyk7XG5cbiAgLy8gV2hlbiB1c2luZyBjb2RlLWNvdmVyYWdlLCBhdXRvLWFkZCBrYXJtYS1jb3ZlcmFnZS5cbiAgaWYgKFxuICAgIG9wdGlvbnMuY29kZUNvdmVyYWdlICYmXG4gICAgIWNvbmZpZy5yZXBvcnRlcnMuc29tZSgocjogc3RyaW5nKSA9PiByID09PSAnY292ZXJhZ2UnIHx8IHIgPT09ICdjb3ZlcmFnZS1pc3RhbmJ1bCcpXG4gICkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMucHVzaCgnY292ZXJhZ2UnKTtcbiAgfVxuXG4gIC8vIEFkZCB3ZWJwYWNrIGNvbmZpZy5cbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGNvbmZpZy5idWlsZFdlYnBhY2sud2VicGFja0NvbmZpZztcbiAgY29uc3Qgd2VicGFja01pZGRsZXdhcmVDb25maWcgPSB7XG4gICAgLy8gSGlkZSB3ZWJwYWNrIG91dHB1dCBiZWNhdXNlIGl0cyBub2lzeS5cbiAgICBzdGF0czogZmFsc2UsXG4gICAgcHVibGljUGF0aDogYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L2AsXG4gIH07XG5cbiAgLy8gVXNlIGV4aXN0aW5nIGNvbmZpZyBpZiBhbnkuXG4gIGNvbmZpZy53ZWJwYWNrID0geyAuLi53ZWJwYWNrQ29uZmlnLCAuLi5jb25maWcud2VicGFjayB9O1xuICBjb25maWcud2VicGFja01pZGRsZXdhcmUgPSB7IC4uLndlYnBhY2tNaWRkbGV3YXJlQ29uZmlnLCAuLi5jb25maWcud2VicGFja01pZGRsZXdhcmUgfTtcblxuICAvLyBPdXIgY3VzdG9tIGNvbnRleHQgYW5kIGRlYnVnIGZpbGVzIGxpc3QgdGhlIHdlYnBhY2sgYnVuZGxlcyBkaXJlY3RseSBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIHRoZSBrYXJtYSBmaWxlcyBhcnJheS5cbiAgY29uZmlnLmN1c3RvbUNvbnRleHRGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1jb250ZXh0Lmh0bWxgO1xuICBjb25maWcuY3VzdG9tRGVidWdGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1kZWJ1Zy5odG1sYDtcblxuICAvLyBBZGQgdGhlIHJlcXVlc3QgYmxvY2tlciBhbmQgdGhlIHdlYnBhY2sgc2VydmVyIGZhbGxiYWNrLlxuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZSA9IGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcicpO1xuICBjb25maWcubWlkZGxld2FyZSA9IGNvbmZpZy5taWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcubWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snKTtcblxuICBpZiAoY29uZmlnLnNpbmdsZVJ1bikge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgna2FybWEnLCAoKSA9PiB7XG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4ge30gfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIC8vIEZpbGVzIG5lZWQgdG8gYmUgc2VydmVkIGZyb20gYSBjdXN0b20gcGF0aCBmb3IgS2FybWEuXG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnBhdGggPSBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vYDtcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucHVibGljUGF0aCA9IGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9gO1xuXG4gIGNvbnN0IGNvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnLCAoZXJyb3IsIHN0YXRzKSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICBpZiAoc3RhdHM/Lmhhc0Vycm9ycygpKSB7XG4gICAgICAvLyBPbmx5IGdlbmVyYXRlIG5lZWRlZCBKU09OIHN0YXRzIGFuZCB3aGVuIG5lZWRlZC5cbiAgICAgIGNvbnN0IHN0YXRzSnNvbiA9IHN0YXRzPy50b0pzb24oe1xuICAgICAgICBhbGw6IGZhbHNlLFxuICAgICAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICAgICAgZXJyb3JzOiB0cnVlLFxuICAgICAgICB3YXJuaW5nczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICBsb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyhzdGF0c0pzb24sIHsgY29sb3JzOiB0cnVlIH0pKTtcblxuICAgICAgLy8gTm90aWZ5IHBvdGVudGlhbCBsaXN0ZW5lcnMgb2YgdGhlIGNvbXBpbGUgZXJyb3IuXG4gICAgICBlbWl0dGVyLmVtaXQoJ2NvbXBpbGVfZXJyb3InLCB7XG4gICAgICAgIGVycm9yczogc3RhdHNKc29uLmVycm9ycz8ubWFwKChlKSA9PiBlLm1lc3NhZ2UpLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmlzaCBLYXJtYSBydW4gZWFybHkgaW4gY2FzZSBvZiBjb21waWxhdGlvbiBlcnJvci5cbiAgICAgIGVtaXR0ZXIuZW1pdCgncnVuX2NvbXBsZXRlJywgW10sIHsgZXhpdENvZGU6IDEgfSk7XG5cbiAgICAgIC8vIEVtaXQgYSBmYWlsdXJlIGJ1aWxkIGV2ZW50IGlmIHRoZXJlIGFyZSBjb21waWxhdGlvbiBlcnJvcnMuXG4gICAgICBmYWlsdXJlQ2IoKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGhhbmRsZXIoY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaXNCbG9ja2VkID0gdHJ1ZTtcbiAgICBjYWxsYmFjaz8uKCk7XG4gIH1cblxuICBjb21waWxlci5ob29rcy5pbnZhbGlkLnRhcCgna2FybWEnLCAoKSA9PiBoYW5kbGVyKCkpO1xuICBjb21waWxlci5ob29rcy53YXRjaFJ1bi50YXBBc3luYygna2FybWEnLCAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gaGFuZGxlcihjYWxsYmFjaykpO1xuICBjb21waWxlci5ob29rcy5ydW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICB3ZWJwYWNrTWlkZGxld2FyZSA9IHdlYnBhY2tEZXZNaWRkbGV3YXJlKGNvbXBpbGVyLCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyk7XG4gIGVtaXR0ZXIub24oJ2V4aXQnLCAoZG9uZTogYW55KSA9PiB7XG4gICAgd2VicGFja01pZGRsZXdhcmUuY2xvc2UoKTtcbiAgICBkb25lKCk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHVuYmxvY2soKSB7XG4gICAgaXNCbG9ja2VkID0gZmFsc2U7XG4gICAgYmxvY2tlZC5mb3JFYWNoKChjYikgPT4gY2IoKSk7XG4gICAgYmxvY2tlZCA9IFtdO1xuICB9XG5cbiAgbGV0IGxhc3RDb21waWxhdGlvbkhhc2g6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgbGV0IGlzRmlyc3RSdW4gPSB0cnVlO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwKCdrYXJtYScsIChzdGF0cykgPT4ge1xuICAgICAgaWYgKGlzRmlyc3RSdW4pIHtcbiAgICAgICAgLy8gVGhpcyBpcyBuZWVkZWQgdG8gYmxvY2sgS2FybWEgZnJvbSBsYXVuY2hpbmcgYnJvd3NlcnMgYmVmb3JlIFdlYnBhY2sgd3JpdGVzIHRoZSBhc3NldHMgaW4gbWVtb3J5LlxuICAgICAgICAvLyBTZWUgdGhlIGJlbG93OlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20va2FybWEtcnVubmVyL2thcm1hLWNocm9tZS1sYXVuY2hlci9pc3N1ZXMvMTU0I2lzc3VlY29tbWVudC05ODY2NjE5MzdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzIyNDk1XG4gICAgICAgIGlzRmlyc3RSdW4gPSBmYWxzZTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgbGFzdENvbXBpbGF0aW9uSGFzaCA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdHMuaGFzaCAhPSBsYXN0Q29tcGlsYXRpb25IYXNoKSB7XG4gICAgICAgIC8vIFJlZnJlc2gga2FybWEgb25seSB3aGVuIHRoZXJlIGFyZSBubyB3ZWJwYWNrIGVycm9ycywgYW5kIGlmIHRoZSBjb21waWxhdGlvbiBjaGFuZ2VkLlxuICAgICAgICBsYXN0Q29tcGlsYXRpb25IYXNoID0gc3RhdHMuaGFzaDtcbiAgICAgICAgZW1pdHRlci5yZWZyZXNoRmlsZXMoKTtcbiAgICAgIH1cblxuICAgICAgdW5ibG9jaygpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbmluaXQuJGluamVjdCA9IFsnY29uZmlnJywgJ2VtaXR0ZXInXTtcblxuLy8gQmxvY2sgcmVxdWVzdHMgdW50aWwgdGhlIFdlYnBhY2sgY29tcGlsYXRpb24gaXMgZG9uZS5cbmZ1bmN0aW9uIHJlcXVlc3RCbG9ja2VyKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKF9yZXF1ZXN0OiBhbnksIF9yZXNwb25zZTogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKGlzQmxvY2tlZCkge1xuICAgICAgYmxvY2tlZC5wdXNoKG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9O1xufVxuXG4vLyBDb3BpZWQgZnJvbSBcImthcm1hLWphc21pbmUtZGlmZi1yZXBvcnRlclwiIHNvdXJjZSBjb2RlOlxuLy8gSW4gY2FzZSwgd2hlbiBtdWx0aXBsZSByZXBvcnRlcnMgYXJlIHVzZWQgaW4gY29uanVuY3Rpb25cbi8vIHdpdGggaW5pdFNvdXJjZW1hcFJlcG9ydGVyLCB0aGV5IGJvdGggd2lsbCBzaG93IHJlcGV0aXRpdmUgbG9nXG4vLyBtZXNzYWdlcyB3aGVuIGRpc3BsYXlpbmcgZXZlcnl0aGluZyB0aGF0IHN1cHBvc2VkIHRvIHdyaXRlIHRvIHRlcm1pbmFsLlxuLy8gU28ganVzdCBzdXBwcmVzcyBhbnkgbG9ncyBmcm9tIGluaXRTb3VyY2VtYXBSZXBvcnRlciBieSBkb2luZyBub3RoaW5nIG9uXG4vLyBicm93c2VyIGxvZywgYmVjYXVzZSBpdCBpcyBhbiB1dGlsaXR5IHJlcG9ydGVyLFxuLy8gdW5sZXNzIGl0J3MgYWxvbmUgaW4gdGhlIFwicmVwb3J0ZXJzXCIgb3B0aW9uIGFuZCBiYXNlIHJlcG9ydGVyIGlzIHVzZWQuXG5mdW5jdGlvbiBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKGNvbnRleHQ6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgY29udGV4dC53cml0ZUNvbW1vbk1zZyA9ICgpID0+IHt9O1xuICBjb25zdCByZXBvcnRlck5hbWUgPSAnQGFuZ3VsYXIvY2xpJztcbiAgY29uc3QgaGFzVHJhaWxpbmdSZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzLnNsaWNlKC0xKS5wb3AoKSAhPT0gcmVwb3J0ZXJOYW1lO1xuXG4gIGlmIChoYXNUcmFpbGluZ1JlcG9ydGVycykge1xuICAgIGNvbnRleHQud3JpdGVDb21tb25Nc2cgPSAoKSA9PiB7fTtcbiAgfVxufVxuXG4vLyBFbWl0cyBidWlsZGVyIGV2ZW50cy5cbmNvbnN0IGV2ZW50UmVwb3J0ZXI6IGFueSA9IGZ1bmN0aW9uICh0aGlzOiBhbnksIGJhc2VSZXBvcnRlckRlY29yYXRvcjogYW55LCBjb25maWc6IGFueSkge1xuICBiYXNlUmVwb3J0ZXJEZWNvcmF0b3IodGhpcyk7XG5cbiAgbXV0ZUR1cGxpY2F0ZVJlcG9ydGVyTG9nZ2luZyh0aGlzLCBjb25maWcpO1xuXG4gIHRoaXMub25SdW5Db21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcnM6IGFueSwgcmVzdWx0czogYW55KSB7XG4gICAgaWYgKHJlc3VsdHMuZXhpdENvZGUgPT09IDApIHtcbiAgICAgIHN1Y2Nlc3NDYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmYWlsdXJlQ2IoKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5ldmVudFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gU3RyaXAgdGhlIHNlcnZlciBhZGRyZXNzIGFuZCB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG5jb25zdCBzb3VyY2VNYXBSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcbiAgbXV0ZUR1cGxpY2F0ZVJlcG9ydGVyTG9nZ2luZyh0aGlzLCBjb25maWcpO1xuXG4gIGNvbnN0IHVybFJlZ2V4cCA9IC9odHRwOlxcL1xcL2xvY2FsaG9zdDpcXGQrXFwvX2thcm1hX3dlYnBhY2tfXFwvKHdlYnBhY2s6XFwvKT8vZ2k7XG5cbiAgdGhpcy5vblNwZWNDb21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcjogYW55LCByZXN1bHQ6IGFueSkge1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJlc3VsdC5sb2cgPSByZXN1bHQubG9nLm1hcCgobDogc3RyaW5nKSA9PiBsLnJlcGxhY2UodXJsUmVnZXhwLCAnJykpO1xuICAgIH1cbiAgfTtcblxuICAvLyBhdm9pZCBkdXBsaWNhdGUgY29tcGxldGUgbWVzc2FnZVxuICB0aGlzLm9uUnVuQ29tcGxldGUgPSAoKSA9PiB7fTtcblxuICAvLyBhdm9pZCBkdXBsaWNhdGUgZmFpbHVyZSBtZXNzYWdlXG4gIHRoaXMuc3BlY0ZhaWx1cmUgPSAoKSA9PiB7fTtcbn07XG5cbnNvdXJjZU1hcFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gV2hlbiBhIHJlcXVlc3QgaXMgbm90IGZvdW5kIGluIHRoZSBrYXJtYSBzZXJ2ZXIsIHRyeSBsb29raW5nIGZvciBpdCBmcm9tIHRoZSB3ZWJwYWNrIHNlcnZlciByb290LlxuZnVuY3Rpb24gZmFsbGJhY2tNaWRkbGV3YXJlKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHJlcXVlc3Q6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXNwb25zZTogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmICh3ZWJwYWNrTWlkZGxld2FyZSkge1xuICAgICAgaWYgKHJlcXVlc3QudXJsICYmICFuZXcgUmVnRXhwKGBcXFxcLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH1cXFxcLy4qYCkudGVzdChyZXF1ZXN0LnVybCkpIHtcbiAgICAgICAgcmVxdWVzdC51cmwgPSAnLycgKyBLQVJNQV9BUFBMSUNBVElPTl9QQVRIICsgcmVxdWVzdC51cmw7XG4gICAgICB9XG4gICAgICB3ZWJwYWNrTWlkZGxld2FyZShyZXF1ZXN0LCByZXNwb25zZSwgKCkgPT4ge1xuICAgICAgICBjb25zdCBhbHdheXNTZXJ2ZSA9IFtcbiAgICAgICAgICBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vcnVudGltZS5qc2AsXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3BvbHlmaWxscy5qc2AsXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3NjcmlwdHMuanNgLFxuICAgICAgICAgIGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9zdHlsZXMuY3NzYCxcbiAgICAgICAgICBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vdmVuZG9yLmpzYCxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKHJlcXVlc3QudXJsICYmIGFsd2F5c1NlcnZlLmluY2x1ZGVzKHJlcXVlc3QudXJsKSkge1xuICAgICAgICAgIHJlc3BvbnNlLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzcG9uc2UuZW5kKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdmcmFtZXdvcms6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXInOiBbJ2ZhY3RvcnknLCBpbml0XSxcbiAgJ3JlcG9ydGVyOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInOiBbJ3R5cGUnLCBzb3VyY2VNYXBSZXBvcnRlcl0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZXZlbnQtcmVwb3J0ZXInOiBbJ3R5cGUnLCBldmVudFJlcG9ydGVyXSxcbiAgJ21pZGRsZXdhcmU6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWJsb2NrZXInOiBbJ2ZhY3RvcnknLCByZXF1ZXN0QmxvY2tlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1mYWxsYmFjayc6IFsnZmFjdG9yeScsIGZhbGxiYWNrTWlkZGxld2FyZV0sXG59O1xuIl19