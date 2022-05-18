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
        config.files.unshift({
            pattern: path.join(smsPath, 'browser-source-map-support.js'),
            included: true,
            served: true,
            watched: false,
        }, { pattern: path.join(ksmsPath, 'client.js'), included: true, served: true, watched: false });
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
        compiler.close(() => done());
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMva2FybWEva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtILDJDQUE2QjtBQUM3QixzREFBOEI7QUFDOUIsb0ZBQTBEO0FBRTFELDZDQUF3RDtBQUN4RCxvREFBZ0U7QUFHaEUsZ0RBQTJEO0FBRTNELE1BQU0sc0JBQXNCLEdBQUcsaUJBQWlCLENBQUM7QUFFakQsSUFBSSxPQUFPLEdBQVUsRUFBRSxDQUFDO0FBQ3hCLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztBQUN0QixJQUFJLGlCQUFzQixDQUFDO0FBQzNCLElBQUksU0FBcUIsQ0FBQztBQUMxQixJQUFJLFNBQXFCLENBQUM7QUFFMUIsTUFBTSxJQUFJLEdBQVEsQ0FBQyxNQUFXLEVBQUUsT0FBWSxFQUFFLEVBQUU7SUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUU7UUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FDYiw0RUFBNEU7WUFDMUUsNkVBQTZFLENBQ2hGLENBQUM7S0FDSDtJQUNELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBdUIsQ0FBQztJQUM1RCxNQUFNLE1BQU0sR0FBbUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksSUFBQSwwQkFBbUIsR0FBRSxDQUFDO0lBQ25GLFNBQVMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQztJQUMxQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFFMUMsNENBQTRDO0lBQzVDLElBQUksSUFBQSwyQkFBbUIsRUFBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENB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QUFDO2dCQUNGLElBQUksT0FBTyxDQUFDLEdBQUcsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDcEQsUUFBUSxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7b0JBQzFCLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQztpQkFDaEI7cUJBQU07b0JBQ0wsSUFBSSxFQUFFLENBQUM7aUJBQ1I7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO2FBQU07WUFDTCxJQUFJLEVBQUUsQ0FBQztTQUNSO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUc7SUFDZix5Q0FBeUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7SUFDNUQsNERBQTRELEVBQUUsQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLENBQUM7SUFDekYsd0RBQXdELEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO0lBQ2pGLG1EQUFtRCxFQUFFLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQztJQUNoRixvREFBb0QsRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztDQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgd2VicGFja0Rldk1pZGRsZXdhcmUgZnJvbSAnd2VicGFjay1kZXYtbWlkZGxld2FyZSc7XG5cbmltcG9ydCB7IHN0YXRzRXJyb3JzVG9TdHJpbmcgfSBmcm9tICcuLi8uLi91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBjcmVhdGVDb25zb2xlTG9nZ2VyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvaW5kZXgnO1xuXG5jb25zdCBLQVJNQV9BUFBMSUNBVElPTl9QQVRIID0gJ19rYXJtYV93ZWJwYWNrXyc7XG5cbmxldCBibG9ja2VkOiBhbnlbXSA9IFtdO1xubGV0IGlzQmxvY2tlZCA9IGZhbHNlO1xubGV0IHdlYnBhY2tNaWRkbGV3YXJlOiBhbnk7XG5sZXQgc3VjY2Vzc0NiOiAoKSA9PiB2b2lkO1xubGV0IGZhaWx1cmVDYjogKCkgPT4gdm9pZDtcblxuY29uc3QgaW5pdDogYW55ID0gKGNvbmZpZzogYW55LCBlbWl0dGVyOiBhbnkpID0+IHtcbiAgaWYgKCFjb25maWcuYnVpbGRXZWJwYWNrKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFRoZSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScga2FybWEgcGx1Z2luIGlzIG1lYW50IHRvYCArXG4gICAgICAgIGAgYmUgdXNlZCBmcm9tIHdpdGhpbiBBbmd1bGFyIENMSSBhbmQgd2lsbCBub3Qgd29yayBjb3JyZWN0bHkgb3V0c2lkZSBvZiBpdC5gLFxuICAgICk7XG4gIH1cbiAgY29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5idWlsZFdlYnBhY2sub3B0aW9ucyBhcyBCdWlsZE9wdGlvbnM7XG4gIGNvbnN0IGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIgPSBjb25maWcuYnVpbGRXZWJwYWNrLmxvZ2dlciB8fCBjcmVhdGVDb25zb2xlTG9nZ2VyKCk7XG4gIHN1Y2Nlc3NDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suc3VjY2Vzc0NiO1xuICBmYWlsdXJlQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLmZhaWx1cmVDYjtcblxuICAvLyBBZGQgYSByZXBvcnRlciB0aGF0IGZpeGVzIHNvdXJjZW1hcCB1cmxzLlxuICBpZiAobm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCkuc2NyaXB0cykge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcicpO1xuXG4gICAgLy8gQ29kZSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS90c2NoYXViL2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydC5cbiAgICAvLyBXZSBjYW4ndCB1c2UgaXQgZGlyZWN0bHkgYmVjYXVzZSB3ZSBuZWVkIHRvIGFkZCBpdCBjb25kaXRpb25hbGx5IGluIHRoaXMgZmlsZSwgYW5kIGthcm1hXG4gICAgLy8gZnJhbWV3b3JrcyBjYW5ub3QgYmUgYWRkZWQgZHluYW1pY2FsbHkuXG4gICAgY29uc3Qgc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpKTtcbiAgICBjb25zdCBrc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpKTtcblxuICAgIGNvbmZpZy5maWxlcy51bnNoaWZ0KFxuICAgICAge1xuICAgICAgICBwYXR0ZXJuOiBwYXRoLmpvaW4oc21zUGF0aCwgJ2Jyb3dzZXItc291cmNlLW1hcC1zdXBwb3J0LmpzJyksXG4gICAgICAgIGluY2x1ZGVkOiB0cnVlLFxuICAgICAgICBzZXJ2ZWQ6IHRydWUsXG4gICAgICAgIHdhdGNoZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKGtzbXNQYXRoLCAnY2xpZW50LmpzJyksIGluY2x1ZGVkOiB0cnVlLCBzZXJ2ZWQ6IHRydWUsIHdhdGNoZWQ6IGZhbHNlIH0sXG4gICAgKTtcbiAgfVxuXG4gIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJyk7XG5cbiAgLy8gV2hlbiB1c2luZyBjb2RlLWNvdmVyYWdlLCBhdXRvLWFkZCBrYXJtYS1jb3ZlcmFnZS5cbiAgaWYgKFxuICAgIG9wdGlvbnMuY29kZUNvdmVyYWdlICYmXG4gICAgIWNvbmZpZy5yZXBvcnRlcnMuc29tZSgocjogc3RyaW5nKSA9PiByID09PSAnY292ZXJhZ2UnIHx8IHIgPT09ICdjb3ZlcmFnZS1pc3RhbmJ1bCcpXG4gICkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMucHVzaCgnY292ZXJhZ2UnKTtcbiAgfVxuXG4gIC8vIEFkZCB3ZWJwYWNrIGNvbmZpZy5cbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGNvbmZpZy5idWlsZFdlYnBhY2sud2VicGFja0NvbmZpZztcbiAgY29uc3Qgd2VicGFja01pZGRsZXdhcmVDb25maWcgPSB7XG4gICAgLy8gSGlkZSB3ZWJwYWNrIG91dHB1dCBiZWNhdXNlIGl0cyBub2lzeS5cbiAgICBzdGF0czogZmFsc2UsXG4gICAgcHVibGljUGF0aDogYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L2AsXG4gIH07XG5cbiAgLy8gVXNlIGV4aXN0aW5nIGNvbmZpZyBpZiBhbnkuXG4gIGNvbmZpZy53ZWJwYWNrID0geyAuLi53ZWJwYWNrQ29uZmlnLCAuLi5jb25maWcud2VicGFjayB9O1xuICBjb25maWcud2VicGFja01pZGRsZXdhcmUgPSB7IC4uLndlYnBhY2tNaWRkbGV3YXJlQ29uZmlnLCAuLi5jb25maWcud2VicGFja01pZGRsZXdhcmUgfTtcblxuICAvLyBPdXIgY3VzdG9tIGNvbnRleHQgYW5kIGRlYnVnIGZpbGVzIGxpc3QgdGhlIHdlYnBhY2sgYnVuZGxlcyBkaXJlY3RseSBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIHRoZSBrYXJtYSBmaWxlcyBhcnJheS5cbiAgY29uZmlnLmN1c3RvbUNvbnRleHRGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1jb250ZXh0Lmh0bWxgO1xuICBjb25maWcuY3VzdG9tRGVidWdGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1kZWJ1Zy5odG1sYDtcblxuICAvLyBBZGQgdGhlIHJlcXVlc3QgYmxvY2tlciBhbmQgdGhlIHdlYnBhY2sgc2VydmVyIGZhbGxiYWNrLlxuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZSA9IGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcicpO1xuICBjb25maWcubWlkZGxld2FyZSA9IGNvbmZpZy5taWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcubWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snKTtcblxuICBpZiAoY29uZmlnLnNpbmdsZVJ1bikge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgna2FybWEnLCAoKSA9PiB7XG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4ge30gfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIC8vIEZpbGVzIG5lZWQgdG8gYmUgc2VydmVkIGZyb20gYSBjdXN0b20gcGF0aCBmb3IgS2FybWEuXG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnBhdGggPSBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vYDtcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucHVibGljUGF0aCA9IGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9gO1xuXG4gIGNvbnN0IGNvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnLCAoZXJyb3IsIHN0YXRzKSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICBpZiAoc3RhdHM/Lmhhc0Vycm9ycygpKSB7XG4gICAgICAvLyBPbmx5IGdlbmVyYXRlIG5lZWRlZCBKU09OIHN0YXRzIGFuZCB3aGVuIG5lZWRlZC5cbiAgICAgIGNvbnN0IHN0YXRzSnNvbiA9IHN0YXRzPy50b0pzb24oe1xuICAgICAgICBhbGw6IGZhbHNlLFxuICAgICAgICBjaGlsZHJlbjogdHJ1ZSxcbiAgICAgICAgZXJyb3JzOiB0cnVlLFxuICAgICAgICB3YXJuaW5nczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICBsb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyhzdGF0c0pzb24sIHsgY29sb3JzOiB0cnVlIH0pKTtcblxuICAgICAgLy8gTm90aWZ5IHBvdGVudGlhbCBsaXN0ZW5lcnMgb2YgdGhlIGNvbXBpbGUgZXJyb3IuXG4gICAgICBlbWl0dGVyLmVtaXQoJ2NvbXBpbGVfZXJyb3InLCB7XG4gICAgICAgIGVycm9yczogc3RhdHNKc29uLmVycm9ycz8ubWFwKChlKSA9PiBlLm1lc3NhZ2UpLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmlzaCBLYXJtYSBydW4gZWFybHkgaW4gY2FzZSBvZiBjb21waWxhdGlvbiBlcnJvci5cbiAgICAgIGVtaXR0ZXIuZW1pdCgncnVuX2NvbXBsZXRlJywgW10sIHsgZXhpdENvZGU6IDEgfSk7XG5cbiAgICAgIC8vIEVtaXQgYSBmYWlsdXJlIGJ1aWxkIGV2ZW50IGlmIHRoZXJlIGFyZSBjb21waWxhdGlvbiBlcnJvcnMuXG4gICAgICBmYWlsdXJlQ2IoKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGhhbmRsZXIoY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaXNCbG9ja2VkID0gdHJ1ZTtcbiAgICBjYWxsYmFjaz8uKCk7XG4gIH1cblxuICBjb21waWxlci5ob29rcy5pbnZhbGlkLnRhcCgna2FybWEnLCAoKSA9PiBoYW5kbGVyKCkpO1xuICBjb21waWxlci5ob29rcy53YXRjaFJ1bi50YXBBc3luYygna2FybWEnLCAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gaGFuZGxlcihjYWxsYmFjaykpO1xuICBjb21waWxlci5ob29rcy5ydW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICB3ZWJwYWNrTWlkZGxld2FyZSA9IHdlYnBhY2tEZXZNaWRkbGV3YXJlKGNvbXBpbGVyLCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyk7XG4gIGVtaXR0ZXIub24oJ2V4aXQnLCAoZG9uZTogYW55KSA9PiB7XG4gICAgd2VicGFja01pZGRsZXdhcmUuY2xvc2UoKTtcbiAgICBjb21waWxlci5jbG9zZSgoKSA9PiBkb25lKCkpO1xuICB9KTtcblxuICBmdW5jdGlvbiB1bmJsb2NrKCkge1xuICAgIGlzQmxvY2tlZCA9IGZhbHNlO1xuICAgIGJsb2NrZWQuZm9yRWFjaCgoY2IpID0+IGNiKCkpO1xuICAgIGJsb2NrZWQgPSBbXTtcbiAgfVxuXG4gIGxldCBsYXN0Q29tcGlsYXRpb25IYXNoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGxldCBpc0ZpcnN0UnVuID0gdHJ1ZTtcblxuICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICBjb21waWxlci5ob29rcy5kb25lLnRhcCgna2FybWEnLCAoc3RhdHMpID0+IHtcbiAgICAgIGlmIChpc0ZpcnN0UnVuKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgbmVlZGVkIHRvIGJsb2NrIEthcm1hIGZyb20gbGF1bmNoaW5nIGJyb3dzZXJzIGJlZm9yZSBXZWJwYWNrIHdyaXRlcyB0aGUgYXNzZXRzIGluIG1lbW9yeS5cbiAgICAgICAgLy8gU2VlIHRoZSBiZWxvdzpcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2thcm1hLXJ1bm5lci9rYXJtYS1jaHJvbWUtbGF1bmNoZXIvaXNzdWVzLzE1NCNpc3N1ZWNvbW1lbnQtOTg2NjYxOTM3XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yMjQ5NVxuICAgICAgICBpc0ZpcnN0UnVuID0gZmFsc2U7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICAgIGxhc3RDb21waWxhdGlvbkhhc2ggPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRzLmhhc2ggIT0gbGFzdENvbXBpbGF0aW9uSGFzaCkge1xuICAgICAgICAvLyBSZWZyZXNoIGthcm1hIG9ubHkgd2hlbiB0aGVyZSBhcmUgbm8gd2VicGFjayBlcnJvcnMsIGFuZCBpZiB0aGUgY29tcGlsYXRpb24gY2hhbmdlZC5cbiAgICAgICAgbGFzdENvbXBpbGF0aW9uSGFzaCA9IHN0YXRzLmhhc2g7XG4gICAgICAgIGVtaXR0ZXIucmVmcmVzaEZpbGVzKCk7XG4gICAgICB9XG5cbiAgICAgIHVuYmxvY2soKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5pbml0LiRpbmplY3QgPSBbJ2NvbmZpZycsICdlbWl0dGVyJ107XG5cbi8vIEJsb2NrIHJlcXVlc3RzIHVudGlsIHRoZSBXZWJwYWNrIGNvbXBpbGF0aW9uIGlzIGRvbmUuXG5mdW5jdGlvbiByZXF1ZXN0QmxvY2tlcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChfcmVxdWVzdDogYW55LCBfcmVzcG9uc2U6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmIChpc0Jsb2NrZWQpIHtcbiAgICAgIGJsb2NrZWQucHVzaChuZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gQ29waWVkIGZyb20gXCJrYXJtYS1qYXNtaW5lLWRpZmYtcmVwb3J0ZXJcIiBzb3VyY2UgY29kZTpcbi8vIEluIGNhc2UsIHdoZW4gbXVsdGlwbGUgcmVwb3J0ZXJzIGFyZSB1c2VkIGluIGNvbmp1bmN0aW9uXG4vLyB3aXRoIGluaXRTb3VyY2VtYXBSZXBvcnRlciwgdGhleSBib3RoIHdpbGwgc2hvdyByZXBldGl0aXZlIGxvZ1xuLy8gbWVzc2FnZXMgd2hlbiBkaXNwbGF5aW5nIGV2ZXJ5dGhpbmcgdGhhdCBzdXBwb3NlZCB0byB3cml0ZSB0byB0ZXJtaW5hbC5cbi8vIFNvIGp1c3Qgc3VwcHJlc3MgYW55IGxvZ3MgZnJvbSBpbml0U291cmNlbWFwUmVwb3J0ZXIgYnkgZG9pbmcgbm90aGluZyBvblxuLy8gYnJvd3NlciBsb2csIGJlY2F1c2UgaXQgaXMgYW4gdXRpbGl0eSByZXBvcnRlcixcbi8vIHVubGVzcyBpdCdzIGFsb25lIGluIHRoZSBcInJlcG9ydGVyc1wiIG9wdGlvbiBhbmQgYmFzZSByZXBvcnRlciBpcyB1c2VkLlxuZnVuY3Rpb24gbXV0ZUR1cGxpY2F0ZVJlcG9ydGVyTG9nZ2luZyhjb250ZXh0OiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGNvbnRleHQud3JpdGVDb21tb25Nc2cgPSAoKSA9PiB7fTtcbiAgY29uc3QgcmVwb3J0ZXJOYW1lID0gJ0Bhbmd1bGFyL2NsaSc7XG4gIGNvbnN0IGhhc1RyYWlsaW5nUmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycy5zbGljZSgtMSkucG9wKCkgIT09IHJlcG9ydGVyTmFtZTtcblxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICBjb250ZXh0LndyaXRlQ29tbW9uTXNnID0gKCkgPT4ge307XG4gIH1cbn1cblxuLy8gRW1pdHMgYnVpbGRlciBldmVudHMuXG5jb25zdCBldmVudFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICB0aGlzLm9uUnVuQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXJzOiBhbnksIHJlc3VsdHM6IGFueSkge1xuICAgIGlmIChyZXN1bHRzLmV4aXRDb2RlID09PSAwKSB7XG4gICAgICBzdWNjZXNzQ2IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBmYWlsdXJlIG1lc3NhZ2VcbiAgdGhpcy5zcGVjRmFpbHVyZSA9ICgpID0+IHt9O1xufTtcblxuZXZlbnRSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InLCAnY29uZmlnJ107XG5cbi8vIFN0cmlwIHRoZSBzZXJ2ZXIgYWRkcmVzcyBhbmQgd2VicGFjayBzY2hlbWUgKHdlYnBhY2s6Ly8pIGZyb20gZXJyb3IgbG9nLlxuY29uc3Qgc291cmNlTWFwUmVwb3J0ZXI6IGFueSA9IGZ1bmN0aW9uICh0aGlzOiBhbnksIGJhc2VSZXBvcnRlckRlY29yYXRvcjogYW55LCBjb25maWc6IGFueSkge1xuICBiYXNlUmVwb3J0ZXJEZWNvcmF0b3IodGhpcyk7XG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICBjb25zdCB1cmxSZWdleHAgPSAvaHR0cDpcXC9cXC9sb2NhbGhvc3Q6XFxkK1xcL19rYXJtYV93ZWJwYWNrX1xcLyh3ZWJwYWNrOlxcLyk/L2dpO1xuXG4gIHRoaXMub25TcGVjQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXI6IGFueSwgcmVzdWx0OiBhbnkpIHtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICByZXN1bHQubG9nID0gcmVzdWx0LmxvZy5tYXAoKGw6IHN0cmluZykgPT4gbC5yZXBsYWNlKHVybFJlZ2V4cCwgJycpKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGNvbXBsZXRlIG1lc3NhZ2VcbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gKCkgPT4ge307XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5zb3VyY2VNYXBSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InLCAnY29uZmlnJ107XG5cbi8vIFdoZW4gYSByZXF1ZXN0IGlzIG5vdCBmb3VuZCBpbiB0aGUga2FybWEgc2VydmVyLCB0cnkgbG9va2luZyBmb3IgaXQgZnJvbSB0aGUgd2VicGFjayBzZXJ2ZXIgcm9vdC5cbmZ1bmN0aW9uIGZhbGxiYWNrTWlkZGxld2FyZSgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChyZXF1ZXN0OiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzcG9uc2U6IGh0dHAuU2VydmVyUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAod2VicGFja01pZGRsZXdhcmUpIHtcbiAgICAgIGlmIChyZXF1ZXN0LnVybCAmJiAhbmV3IFJlZ0V4cChgXFxcXC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9XFxcXC8uKmApLnRlc3QocmVxdWVzdC51cmwpKSB7XG4gICAgICAgIHJlcXVlc3QudXJsID0gJy8nICsgS0FSTUFfQVBQTElDQVRJT05fUEFUSCArIHJlcXVlc3QudXJsO1xuICAgICAgfVxuICAgICAgd2VicGFja01pZGRsZXdhcmUocmVxdWVzdCwgcmVzcG9uc2UsICgpID0+IHtcbiAgICAgICAgY29uc3QgYWx3YXlzU2VydmUgPSBbXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3J1bnRpbWUuanNgLFxuICAgICAgICAgIGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9wb2x5ZmlsbHMuanNgLFxuICAgICAgICAgIGAvJHtLQVJNQV9BUFBMSUNBVElPTl9QQVRIfS9zY3JpcHRzLmpzYCxcbiAgICAgICAgICBgLyR7S0FSTUFfQVBQTElDQVRJT05fUEFUSH0vc3R5bGVzLmNzc2AsXG4gICAgICAgICAgYC8ke0tBUk1BX0FQUExJQ0FUSU9OX1BBVEh9L3ZlbmRvci5qc2AsXG4gICAgICAgIF07XG4gICAgICAgIGlmIChyZXF1ZXN0LnVybCAmJiBhbHdheXNTZXJ2ZS5pbmNsdWRlcyhyZXF1ZXN0LnVybCkpIHtcbiAgICAgICAgICByZXNwb25zZS5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlc3BvbnNlLmVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnZnJhbWV3b3JrOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogWydmYWN0b3J5JywgaW5pdF0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJzogWyd0eXBlJywgc291cmNlTWFwUmVwb3J0ZXJdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJzogWyd0eXBlJywgZXZlbnRSZXBvcnRlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJzogWydmYWN0b3J5JywgcmVxdWVzdEJsb2NrZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snOiBbJ2ZhY3RvcnknLCBmYWxsYmFja01pZGRsZXdhcmVdLFxufTtcbiJdfQ==