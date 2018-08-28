"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const glob = require("glob");
const webpack = require("webpack");
const webpackDevMiddleware = require('webpack-dev-middleware');
const karma_webpack_failure_cb_1 = require("./karma-webpack-failure-cb");
/**
 * Enumerate needed (but not require/imported) dependencies from this file
 *  to let the dependency validator know they are used.
 *
 * require('source-map-support')
 * require('karma-source-map-support')
 */
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
        watched: true
    };
    const processedFiles = newFiles
        // Remove globs that do not match any files, otherwise Karma will show a warning for these.
        .filter(file => glob.sync(file.pattern, { nodir: true }).length != 0)
        // Fill in pattern properties with defaults.
        .map(file => (Object.assign({}, defaults, file)));
    // It's important to not replace the array, because
    // karma already has a reference to the existing array.
    if (prepend) {
        files.unshift(...processedFiles);
    }
    else {
        files.push(...processedFiles);
    }
}
const init = (config, emitter, customFileHandlers) => {
    if (!config.buildWebpack) {
        throw new Error(`The '@angular-devkit/build-angular/plugins/karma' karma plugin is meant to` +
            ` be used from within Angular CLI and will not work correctly outside of it.`);
    }
    const options = config.buildWebpack.options;
    const projectRoot = config.buildWebpack.projectRoot;
    successCb = config.buildWebpack.successCb;
    failureCb = config.buildWebpack.failureCb;
    config.reporters.unshift('@angular-devkit/build-angular--event-reporter');
    // When using code-coverage, auto-add coverage-istanbul.
    config.reporters = config.reporters || [];
    if (options.codeCoverage && config.reporters.indexOf('coverage-istanbul') === -1) {
        config.reporters.unshift('coverage-istanbul');
    }
    // Add a reporter that fixes sourcemap urls.
    if (options.sourceMap) {
        config.reporters.unshift('@angular-devkit/build-angular--sourcemap-reporter');
        // Code taken from https://github.com/tschaub/karma-source-map-support.
        // We can't use it directly because we need to add it conditionally in this file, and karma
        // frameworks cannot be added dynamically.
        const smsPath = path.dirname(require.resolve('source-map-support'));
        const ksmsPath = path.dirname(require.resolve('karma-source-map-support'));
        addKarmaFiles(config.files, [
            { pattern: path.join(smsPath, 'browser-source-map-support.js'), watched: false },
            { pattern: path.join(ksmsPath, 'client.js'), watched: false }
        ], true);
    }
    // Add webpack config.
    const webpackConfig = config.buildWebpack.webpackConfig;
    const webpackMiddlewareConfig = {
        logLevel: 'error',
        watchOptions: { poll: options.poll },
        publicPath: '/_karma_webpack_/',
    };
    const compilationErrorCb = (error, errors) => {
        // Notify potential listeners of the compile error
        emitter.emit('compile_error', errors);
        // Finish Karma run early in case of compilation error.
        emitter.emit('run_complete', [], { exitCode: 1 });
        // Unblock any karma requests (potentially started using `karma run`)
        unblock();
    };
    webpackConfig.plugins.push(new karma_webpack_failure_cb_1.KarmaWebpackFailureCb(compilationErrorCb));
    // Use existing config if any.
    config.webpack = Object.assign(webpackConfig, config.webpack);
    config.webpackMiddleware = Object.assign(webpackMiddlewareConfig, config.webpackMiddleware);
    // Our custom context and debug files list the webpack bundles directly instead of using
    // the karma files array.
    config.customContextFile = `${__dirname}/karma-context.html`;
    config.customDebugFile = `${__dirname}/karma-debug.html`;
    // Add the request blocker and the webpack server fallback.
    config.beforeMiddleware = config.beforeMiddleware || [];
    config.beforeMiddleware.push('@angular-devkit/build-angular--blocker');
    config.middleware = config.middleware || [];
    config.middleware.push('@angular-devkit/build-angular--fallback');
    // Delete global styles entry, we don't want to load them.
    delete webpackConfig.entry.styles;
    // The webpack tier owns the watch behavior so we want to force it in the config.
    webpackConfig.watch = !config.singleRun;
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
    webpackConfig.output.path = '/_karma_webpack_/';
    webpackConfig.output.publicPath = '/_karma_webpack_/';
    webpackConfig.output.devtoolModuleFilenameTemplate = '[namespace]/[resource-path]?[loaders]';
    let compiler;
    try {
        compiler = webpack(webpackConfig);
    }
    catch (e) {
        console.error(e.stack || e);
        if (e.details) {
            console.error(e.details);
        }
        throw e;
    }
    function handler(callback) {
        isBlocked = true;
        if (typeof callback === 'function') {
            callback();
        }
    }
    compiler.hooks.invalid.tap('karma', () => handler());
    compiler.hooks.watchRun.tapAsync('karma', (_, callback) => handler(callback));
    compiler.hooks.run.tapAsync('karma', (_, callback) => handler(callback));
    function unblock() {
        isBlocked = false;
        blocked.forEach((cb) => cb());
        blocked = [];
    }
    compiler.hooks.done.tap('karma', (stats) => {
        // Don't refresh karma when there are webpack errors.
        if (stats.compilation.errors.length === 0) {
            emitter.refreshFiles();
        }
        unblock();
    });
    webpackMiddleware = new webpackDevMiddleware(compiler, webpackMiddlewareConfig);
    // Forward requests to webpack server.
    customFileHandlers.push({
        urlRegex: /^\/_karma_webpack_\/.*/,
        handler: function handler(req, res) {
            webpackMiddleware(req, res, function () {
                // Ensure script and style bundles are served.
                // They are mentioned in the custom karma context page and we don't want them to 404.
                const alwaysServe = [
                    '/_karma_webpack_/runtime.js',
                    '/_karma_webpack_/polyfills.js',
                    '/_karma_webpack_/scripts.js',
                    '/_karma_webpack_/vendor.js',
                ];
                if (alwaysServe.indexOf(req.url) != -1) {
                    res.statusCode = 200;
                    res.end();
                }
                else {
                    res.statusCode = 404;
                    res.end('Not found');
                }
            });
        }
    });
    emitter.on('exit', (done) => {
        webpackMiddleware.close();
        done();
    });
};
init.$inject = ['config', 'emitter', 'customFileHandlers'];
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
    context.writeCommonMsg = function () { };
    const reporterName = '@angular/cli';
    const hasTrailingReporters = config.reporters.slice(-1).pop() !== reporterName;
    if (hasTrailingReporters) {
        context.writeCommonMsg = function () { };
    }
}
// Emits builder events.
const eventReporter = function (baseReporterDecorator, config) {
    baseReporterDecorator(this);
    muteDuplicateReporterLogging(this, config);
    this.onRunComplete = function (_browsers, results) {
        if (results.exitCode === 0) {
            successCb && successCb();
        }
        else {
            failureCb && failureCb();
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
    const urlRegexp = /\(http:\/\/localhost:\d+\/_karma_webpack_\/webpack:\//gi;
    this.onSpecComplete = function (_browser, result) {
        if (!result.success && result.log.length > 0) {
            result.log.forEach((log, idx) => {
                result.log[idx] = log.replace(urlRegexp, '');
            });
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
    return function (req, res, next) {
        if (webpackMiddleware) {
            const webpackUrl = '/_karma_webpack_' + req.url;
            const webpackReq = Object.assign({}, req, { url: webpackUrl });
            webpackMiddleware(webpackReq, res, next);
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
    'middleware:@angular-devkit/build-angular--fallback': ['factory', fallbackMiddleware]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRztBQUNILGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0Qyx1QkFBdUIsS0FBWSxFQUFFLFFBQWUsRUFBRSxPQUFPLEdBQUcsS0FBSztJQUNuRSxNQUFNLFFBQVEsR0FBRztRQUNmLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7SUFFRixNQUFNLGNBQWMsR0FBRyxRQUFRO1FBQzdCLDJGQUEyRjtTQUMxRixNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO1FBQ3JFLDRDQUE0QztTQUMzQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQkFBTSxRQUFRLEVBQUssSUFBSSxFQUFHLENBQUMsQ0FBQztJQUUzQyxtREFBbUQ7SUFDbkQsdURBQXVEO0lBQ3ZELElBQUksT0FBTyxF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LENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDLENBQUM7SUFFRixtQ0FBbUM7SUFDbkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUM7SUFFOUIsa0NBQWtDO0lBQ2xDLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQztBQUVGLGlCQUFpQixDQUFDLE9BQU8sR0FBRyxDQUFDLHVCQUF1QixFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRWhFLG9HQUFvRztBQUNwRztJQUNFLE9BQU8sVUFBVSxHQUFRLEVBQUUsR0FBUSxFQUFFLElBQWdCO1FBQ25ELElBQUksaUJBQWlCLEVBQUU7WUFDckIsTUFBTSxVQUFVLEdBQUcsa0JBQWtCLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztZQUNoRCxNQUFNLFVBQVUscUJBQVEsR0FBRyxJQUFFLEdBQUcsRUFBRSxVQUFVLEdBQUUsQ0FBQTtZQUM5QyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzFDO2FBQU07WUFDTCxJQUFJLEVBQUUsQ0FBQztTQUNSO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUc7SUFDZix5Q0FBeUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7SUFDNUQsNERBQTRELEVBQUUsQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLENBQUM7SUFDekYsd0RBQXdELEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO0lBQ2pGLG1EQUFtRCxFQUFFLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQztJQUNoRixvREFBb0QsRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztDQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5jb25zdCB3ZWJwYWNrRGV2TWlkZGxld2FyZSA9IHJlcXVpcmUoJ3dlYnBhY2stZGV2LW1pZGRsZXdhcmUnKTtcblxuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgS2FybWFXZWJwYWNrRmFpbHVyZUNiIH0gZnJvbSAnLi9rYXJtYS13ZWJwYWNrLWZhaWx1cmUtY2InO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBuZWVkZWQgKGJ1dCBub3QgcmVxdWlyZS9pbXBvcnRlZCkgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlXG4gKiAgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvciBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc291cmNlLW1hcC1zdXBwb3J0JylcbiAqIHJlcXVpcmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpXG4gKi9cblxuXG5sZXQgYmxvY2tlZDogYW55W10gPSBbXTtcbmxldCBpc0Jsb2NrZWQgPSBmYWxzZTtcbmxldCB3ZWJwYWNrTWlkZGxld2FyZTogYW55O1xubGV0IHN1Y2Nlc3NDYjogKCkgPT4gdm9pZDtcbmxldCBmYWlsdXJlQ2I6ICgpID0+IHZvaWQ7XG5cbi8vIEFkZCBmaWxlcyB0byB0aGUgS2FybWEgZmlsZXMgYXJyYXkuXG5mdW5jdGlvbiBhZGRLYXJtYUZpbGVzKGZpbGVzOiBhbnlbXSwgbmV3RmlsZXM6IGFueVtdLCBwcmVwZW5kID0gZmFsc2UpIHtcbiAgY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgaW5jbHVkZWQ6IHRydWUsXG4gICAgc2VydmVkOiB0cnVlLFxuICAgIHdhdGNoZWQ6IHRydWVcbiAgfTtcblxuICBjb25zdCBwcm9jZXNzZWRGaWxlcyA9IG5ld0ZpbGVzXG4gICAgLy8gUmVtb3ZlIGdsb2JzIHRoYXQgZG8gbm90IG1hdGNoIGFueSBmaWxlcywgb3RoZXJ3aXNlIEthcm1hIHdpbGwgc2hvdyBhIHdhcm5pbmcgZm9yIHRoZXNlLlxuICAgIC5maWx0ZXIoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZS5wYXR0ZXJuLCB7IG5vZGlyOiB0cnVlIH0pLmxlbmd0aCAhPSAwKVxuICAgIC8vIEZpbGwgaW4gcGF0dGVybiBwcm9wZXJ0aWVzIHdpdGggZGVmYXVsdHMuXG4gICAgLm1hcChmaWxlID0+ICh7IC4uLmRlZmF1bHRzLCAuLi5maWxlIH0pKTtcblxuICAvLyBJdCdzIGltcG9ydGFudCB0byBub3QgcmVwbGFjZSB0aGUgYXJyYXksIGJlY2F1c2VcbiAgLy8ga2FybWEgYWxyZWFkeSBoYXMgYSByZWZlcmVuY2UgdG8gdGhlIGV4aXN0aW5nIGFycmF5LlxuICBpZiAocHJlcGVuZCkge1xuICAgIGZpbGVzLnVuc2hpZnQoLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVzLnB1c2goLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9XG59XG5cbmNvbnN0IGluaXQ6IGFueSA9IChjb25maWc6IGFueSwgZW1pdHRlcjogYW55LCBjdXN0b21GaWxlSGFuZGxlcnM6IGFueSkgPT4ge1xuICBpZiAoIWNvbmZpZy5idWlsZFdlYnBhY2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScga2FybWEgcGx1Z2luIGlzIG1lYW50IHRvYCArXG4gICAgYCBiZSB1c2VkIGZyb20gd2l0aGluIEFuZ3VsYXIgQ0xJIGFuZCB3aWxsIG5vdCB3b3JrIGNvcnJlY3RseSBvdXRzaWRlIG9mIGl0LmBcbiAgICApXG4gIH1cbiAgY29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5idWlsZFdlYnBhY2sub3B0aW9ucztcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBjb25maWcuYnVpbGRXZWJwYWNrLnByb2plY3RSb290IGFzIHN0cmluZztcbiAgc3VjY2Vzc0NiID0gY29uZmlnLmJ1aWxkV2VicGFjay5zdWNjZXNzQ2I7XG4gIGZhaWx1cmVDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suZmFpbHVyZUNiO1xuXG4gIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJyk7XG5cbiAgLy8gV2hlbiB1c2luZyBjb2RlLWNvdmVyYWdlLCBhdXRvLWFkZCBjb3ZlcmFnZS1pc3RhbmJ1bC5cbiAgY29uZmlnLnJlcG9ydGVycyA9IGNvbmZpZy5yZXBvcnRlcnMgfHwgW107XG4gIGlmIChvcHRpb25zLmNvZGVDb3ZlcmFnZSAmJiBjb25maWcucmVwb3J0ZXJzLmluZGV4T2YoJ2NvdmVyYWdlLWlzdGFuYnVsJykgPT09IC0xKSB7XG4gICAgY29uZmlnLnJlcG9ydGVycy51bnNoaWZ0KCdjb3ZlcmFnZS1pc3RhbmJ1bCcpO1xuICB9XG5cbiAgLy8gQWRkIGEgcmVwb3J0ZXIgdGhhdCBmaXhlcyBzb3VyY2VtYXAgdXJscy5cbiAgaWYgKG9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgY29uZmlnLnJlcG9ydGVycy51bnNoaWZ0KCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJyk7XG5cbiAgICAvLyBDb2RlIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3RzY2hhdWIva2FybWEtc291cmNlLW1hcC1zdXBwb3J0LlxuICAgIC8vIFdlIGNhbid0IHVzZSBpdCBkaXJlY3RseSBiZWNhdXNlIHdlIG5lZWQgdG8gYWRkIGl0IGNvbmRpdGlvbmFsbHkgaW4gdGhpcyBmaWxlLCBhbmQga2FybWFcbiAgICAvLyBmcmFtZXdvcmtzIGNhbm5vdCBiZSBhZGRlZCBkeW5hbWljYWxseS5cbiAgICBjb25zdCBzbXNQYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1zdXBwb3J0JykpO1xuICAgIGNvbnN0IGtzbXNQYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgna2FybWEtc291cmNlLW1hcC1zdXBwb3J0JykpO1xuXG4gICAgYWRkS2FybWFGaWxlcyhjb25maWcuZmlsZXMsIFtcbiAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKHNtc1BhdGgsICdicm93c2VyLXNvdXJjZS1tYXAtc3VwcG9ydC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9LFxuICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oa3Ntc1BhdGgsICdjbGllbnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfVxuICAgIF0sIHRydWUpO1xuICB9XG5cbiAgLy8gQWRkIHdlYnBhY2sgY29uZmlnLlxuICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gY29uZmlnLmJ1aWxkV2VicGFjay53ZWJwYWNrQ29uZmlnO1xuICBjb25zdCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyA9IHtcbiAgICBsb2dMZXZlbDogJ2Vycm9yJywgLy8gSGlkZSB3ZWJwYWNrIG91dHB1dCBiZWNhdXNlIGl0cyBub2lzeS5cbiAgICB3YXRjaE9wdGlvbnM6IHsgcG9sbDogb3B0aW9ucy5wb2xsIH0sXG4gICAgcHVibGljUGF0aDogJy9fa2FybWFfd2VicGFja18vJyxcbiAgfTtcblxuICBjb25zdCBjb21waWxhdGlvbkVycm9yQ2IgPSAoZXJyb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgZXJyb3JzOiBzdHJpbmdbXSkgPT4ge1xuICAgIC8vIE5vdGlmeSBwb3RlbnRpYWwgbGlzdGVuZXJzIG9mIHRoZSBjb21waWxlIGVycm9yXG4gICAgZW1pdHRlci5lbWl0KCdjb21waWxlX2Vycm9yJywgZXJyb3JzKTtcblxuICAgIC8vIEZpbmlzaCBLYXJtYSBydW4gZWFybHkgaW4gY2FzZSBvZiBjb21waWxhdGlvbiBlcnJvci5cbiAgICBlbWl0dGVyLmVtaXQoJ3J1bl9jb21wbGV0ZScsIFtdLCB7IGV4aXRDb2RlOiAxIH0pO1xuXG4gICAgLy8gVW5ibG9jayBhbnkga2FybWEgcmVxdWVzdHMgKHBvdGVudGlhbGx5IHN0YXJ0ZWQgdXNpbmcgYGthcm1hIHJ1bmApXG4gICAgdW5ibG9jaygpO1xuICB9XG4gIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKG5ldyBLYXJtYVdlYnBhY2tGYWlsdXJlQ2IoY29tcGlsYXRpb25FcnJvckNiKSk7XG5cbiAgLy8gVXNlIGV4aXN0aW5nIGNvbmZpZyBpZiBhbnkuXG4gIGNvbmZpZy53ZWJwYWNrID0gT2JqZWN0LmFzc2lnbih3ZWJwYWNrQ29uZmlnLCBjb25maWcud2VicGFjayk7XG4gIGNvbmZpZy53ZWJwYWNrTWlkZGxld2FyZSA9IE9iamVjdC5hc3NpZ24od2VicGFja01pZGRsZXdhcmVDb25maWcsIGNvbmZpZy53ZWJwYWNrTWlkZGxld2FyZSk7XG5cbiAgLy8gT3VyIGN1c3RvbSBjb250ZXh0IGFuZCBkZWJ1ZyBmaWxlcyBsaXN0IHRoZSB3ZWJwYWNrIGJ1bmRsZXMgZGlyZWN0bHkgaW5zdGVhZCBvZiB1c2luZ1xuICAvLyB0aGUga2FybWEgZmlsZXMgYXJyYXkuXG4gIGNvbmZpZy5jdXN0b21Db250ZXh0RmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtY29udGV4dC5odG1sYDtcbiAgY29uZmlnLmN1c3RvbURlYnVnRmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtZGVidWcuaHRtbGA7XG5cbiAgLy8gQWRkIHRoZSByZXF1ZXN0IGJsb2NrZXIgYW5kIHRoZSB3ZWJwYWNrIHNlcnZlciBmYWxsYmFjay5cbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUgPSBjb25maWcuYmVmb3JlTWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWJsb2NrZXInKTtcbiAgY29uZmlnLm1pZGRsZXdhcmUgPSBjb25maWcubWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLm1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWZhbGxiYWNrJyk7XG5cbiAgLy8gRGVsZXRlIGdsb2JhbCBzdHlsZXMgZW50cnksIHdlIGRvbid0IHdhbnQgdG8gbG9hZCB0aGVtLlxuICBkZWxldGUgd2VicGFja0NvbmZpZy5lbnRyeS5zdHlsZXM7XG5cbiAgLy8gVGhlIHdlYnBhY2sgdGllciBvd25zIHRoZSB3YXRjaCBiZWhhdmlvciBzbyB3ZSB3YW50IHRvIGZvcmNlIGl0IGluIHRoZSBjb25maWcuXG4gIHdlYnBhY2tDb25maWcud2F0Y2ggPSAhY29uZmlnLnNpbmdsZVJ1bjtcbiAgaWYgKGNvbmZpZy5zaW5nbGVSdW4pIHtcbiAgICAvLyBUaGVyZSdzIG5vIG9wdGlvbiB0byB0dXJuIG9mZiBmaWxlIHdhdGNoaW5nIGluIHdlYnBhY2stZGV2LXNlcnZlciwgYnV0XG4gICAgLy8gd2UgY2FuIG92ZXJyaWRlIHRoZSBmaWxlIHdhdGNoZXIgaW5zdGVhZC5cbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMudW5zaGlmdCh7XG4gICAgICBhcHBseTogKGNvbXBpbGVyOiBhbnkpID0+IHsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2thcm1hJywgKCkgPT4ge1xuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHsgfSB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgLy8gRmlsZXMgbmVlZCB0byBiZSBzZXJ2ZWQgZnJvbSBhIGN1c3RvbSBwYXRoIGZvciBLYXJtYS5cbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnB1YmxpY1BhdGggPSAnL19rYXJtYV93ZWJwYWNrXy8nO1xuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5kZXZ0b29sTW9kdWxlRmlsZW5hbWVUZW1wbGF0ZSA9ICdbbmFtZXNwYWNlXS9bcmVzb3VyY2UtcGF0aF0/W2xvYWRlcnNdJztcblxuICBsZXQgY29tcGlsZXI6IGFueTtcbiAgdHJ5IHtcbiAgICBjb21waWxlciA9IHdlYnBhY2sod2VicGFja0NvbmZpZyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKGUuc3RhY2sgfHwgZSk7XG4gICAgaWYgKGUuZGV0YWlscykge1xuICAgICAgY29uc29sZS5lcnJvcihlLmRldGFpbHMpO1xuICAgIH1cbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlcihjYWxsYmFjaz86ICgpID0+IHZvaWQpIHtcbiAgICBpc0Jsb2NrZWQgPSB0cnVlO1xuXG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cblxuICBjb21waWxlci5ob29rcy5pbnZhbGlkLnRhcCgna2FybWEnLCAoKSA9PiBoYW5kbGVyKCkpO1xuXG4gIGNvbXBpbGVyLmhvb2tzLndhdGNoUnVuLnRhcEFzeW5jKCdrYXJtYScsIChfOiBhbnksIGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiBoYW5kbGVyKGNhbGxiYWNrKSk7XG5cbiAgY29tcGlsZXIuaG9va3MucnVuLnRhcEFzeW5jKCdrYXJtYScsIChfOiBhbnksIGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiBoYW5kbGVyKGNhbGxiYWNrKSk7XG5cbiAgZnVuY3Rpb24gdW5ibG9jaygpe1xuICAgIGlzQmxvY2tlZCA9IGZhbHNlO1xuICAgIGJsb2NrZWQuZm9yRWFjaCgoY2IpID0+IGNiKCkpO1xuICAgIGJsb2NrZWQgPSBbXTtcbiAgfVxuXG4gIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwKCdrYXJtYScsIChzdGF0czogYW55KSA9PiB7XG4gICAgLy8gRG9uJ3QgcmVmcmVzaCBrYXJtYSB3aGVuIHRoZXJlIGFyZSB3ZWJwYWNrIGVycm9ycy5cbiAgICBpZiAoc3RhdHMuY29tcGlsYXRpb24uZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZW1pdHRlci5yZWZyZXNoRmlsZXMoKTtcbiAgICB9XG4gICAgdW5ibG9jaygpO1xuICB9KTtcblxuICB3ZWJwYWNrTWlkZGxld2FyZSA9IG5ldyB3ZWJwYWNrRGV2TWlkZGxld2FyZShjb21waWxlciwgd2VicGFja01pZGRsZXdhcmVDb25maWcpO1xuXG4gIC8vIEZvcndhcmQgcmVxdWVzdHMgdG8gd2VicGFjayBzZXJ2ZXIuXG4gIGN1c3RvbUZpbGVIYW5kbGVycy5wdXNoKHtcbiAgICB1cmxSZWdleDogL15cXC9fa2FybWFfd2VicGFja19cXC8uKi8sXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gaGFuZGxlcihyZXE6IGFueSwgcmVzOiBhbnkpIHtcbiAgICAgIHdlYnBhY2tNaWRkbGV3YXJlKHJlcSwgcmVzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIEVuc3VyZSBzY3JpcHQgYW5kIHN0eWxlIGJ1bmRsZXMgYXJlIHNlcnZlZC5cbiAgICAgICAgLy8gVGhleSBhcmUgbWVudGlvbmVkIGluIHRoZSBjdXN0b20ga2FybWEgY29udGV4dCBwYWdlIGFuZCB3ZSBkb24ndCB3YW50IHRoZW0gdG8gNDA0LlxuICAgICAgICBjb25zdCBhbHdheXNTZXJ2ZSA9IFtcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy9ydW50aW1lLmpzJyxcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy9wb2x5ZmlsbHMuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3NjcmlwdHMuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3ZlbmRvci5qcycsXG4gICAgICAgIF07XG4gICAgICAgIGlmIChhbHdheXNTZXJ2ZS5pbmRleE9mKHJlcS51cmwpICE9IC0xKSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA0O1xuICAgICAgICAgIHJlcy5lbmQoJ05vdCBmb3VuZCcpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGVtaXR0ZXIub24oJ2V4aXQnLCAoZG9uZTogYW55KSA9PiB7XG4gICAgd2VicGFja01pZGRsZXdhcmUuY2xvc2UoKTtcbiAgICBkb25lKCk7XG4gIH0pO1xufTtcblxuaW5pdC4kaW5qZWN0ID0gWydjb25maWcnLCAnZW1pdHRlcicsICdjdXN0b21GaWxlSGFuZGxlcnMnXTtcblxuLy8gQmxvY2sgcmVxdWVzdHMgdW50aWwgdGhlIFdlYnBhY2sgY29tcGlsYXRpb24gaXMgZG9uZS5cbmZ1bmN0aW9uIHJlcXVlc3RCbG9ja2VyKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKF9yZXF1ZXN0OiBhbnksIF9yZXNwb25zZTogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKGlzQmxvY2tlZCkge1xuICAgICAgYmxvY2tlZC5wdXNoKG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9O1xufVxuXG4vLyBDb3BpZWQgZnJvbSBcImthcm1hLWphc21pbmUtZGlmZi1yZXBvcnRlclwiIHNvdXJjZSBjb2RlOlxuLy8gSW4gY2FzZSwgd2hlbiBtdWx0aXBsZSByZXBvcnRlcnMgYXJlIHVzZWQgaW4gY29uanVuY3Rpb25cbi8vIHdpdGggaW5pdFNvdXJjZW1hcFJlcG9ydGVyLCB0aGV5IGJvdGggd2lsbCBzaG93IHJlcGV0aXRpdmUgbG9nXG4vLyBtZXNzYWdlcyB3aGVuIGRpc3BsYXlpbmcgZXZlcnl0aGluZyB0aGF0IHN1cHBvc2VkIHRvIHdyaXRlIHRvIHRlcm1pbmFsLlxuLy8gU28ganVzdCBzdXBwcmVzcyBhbnkgbG9ncyBmcm9tIGluaXRTb3VyY2VtYXBSZXBvcnRlciBieSBkb2luZyBub3RoaW5nIG9uXG4vLyBicm93c2VyIGxvZywgYmVjYXVzZSBpdCBpcyBhbiB1dGlsaXR5IHJlcG9ydGVyLFxuLy8gdW5sZXNzIGl0J3MgYWxvbmUgaW4gdGhlIFwicmVwb3J0ZXJzXCIgb3B0aW9uIGFuZCBiYXNlIHJlcG9ydGVyIGlzIHVzZWQuXG5mdW5jdGlvbiBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKGNvbnRleHQ6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgY29udGV4dC53cml0ZUNvbW1vbk1zZyA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgY29uc3QgcmVwb3J0ZXJOYW1lID0gJ0Bhbmd1bGFyL2NsaSc7XG4gIGNvbnN0IGhhc1RyYWlsaW5nUmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycy5zbGljZSgtMSkucG9wKCkgIT09IHJlcG9ydGVyTmFtZTtcblxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICBjb250ZXh0LndyaXRlQ29tbW9uTXNnID0gZnVuY3Rpb24gKCkgeyB9O1xuICB9XG59XG5cbi8vIEVtaXRzIGJ1aWxkZXIgZXZlbnRzLlxuY29uc3QgZXZlbnRSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKHRoaXMsIGNvbmZpZyk7XG5cbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyczogYW55LCByZXN1bHRzOiBhbnkpIHtcbiAgICBpZiAocmVzdWx0cy5leGl0Q29kZSA9PT0gMCkge1xuICAgICAgc3VjY2Vzc0NiICYmIHN1Y2Nlc3NDYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmYWlsdXJlQ2IgJiYgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5ldmVudFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gU3RyaXAgdGhlIHNlcnZlciBhZGRyZXNzIGFuZCB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG5jb25zdCBzb3VyY2VNYXBSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKHRoaXMsIGNvbmZpZyk7XG5cbiAgY29uc3QgdXJsUmVnZXhwID0gL1xcKGh0dHA6XFwvXFwvbG9jYWxob3N0OlxcZCtcXC9fa2FybWFfd2VicGFja19cXC93ZWJwYWNrOlxcLy9naTtcblxuICB0aGlzLm9uU3BlY0NvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyOiBhbnksIHJlc3VsdDogYW55KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQubG9nLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5sb2cuZm9yRWFjaCgobG9nOiBzdHJpbmcsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgIHJlc3VsdC5sb2dbaWR4XSA9IGxvZy5yZXBsYWNlKHVybFJlZ2V4cCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBjb21wbGV0ZSBtZXNzYWdlXG4gIHRoaXMub25SdW5Db21wbGV0ZSA9ICgpID0+IHt9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBmYWlsdXJlIG1lc3NhZ2VcbiAgdGhpcy5zcGVjRmFpbHVyZSA9ICgpID0+IHt9O1xufTtcblxuc291cmNlTWFwUmVwb3J0ZXIuJGluamVjdCA9IFsnYmFzZVJlcG9ydGVyRGVjb3JhdG9yJywgJ2NvbmZpZyddO1xuXG4vLyBXaGVuIGEgcmVxdWVzdCBpcyBub3QgZm91bmQgaW4gdGhlIGthcm1hIHNlcnZlciwgdHJ5IGxvb2tpbmcgZm9yIGl0IGZyb20gdGhlIHdlYnBhY2sgc2VydmVyIHJvb3QuXG5mdW5jdGlvbiBmYWxsYmFja01pZGRsZXdhcmUoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAocmVxOiBhbnksIHJlczogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKHdlYnBhY2tNaWRkbGV3YXJlKSB7XG4gICAgICBjb25zdCB3ZWJwYWNrVXJsID0gJy9fa2FybWFfd2VicGFja18nICsgcmVxLnVybDtcbiAgICAgIGNvbnN0IHdlYnBhY2tSZXEgPSB7IC4uLnJlcSwgdXJsOiB3ZWJwYWNrVXJsIH1cbiAgICAgIHdlYnBhY2tNaWRkbGV3YXJlKHdlYnBhY2tSZXEsIHJlcywgbmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnZnJhbWV3b3JrOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogWydmYWN0b3J5JywgaW5pdF0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJzogWyd0eXBlJywgc291cmNlTWFwUmVwb3J0ZXJdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJzogWyd0eXBlJywgZXZlbnRSZXBvcnRlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJzogWydmYWN0b3J5JywgcmVxdWVzdEJsb2NrZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snOiBbJ2ZhY3RvcnknLCBmYWxsYmFja01pZGRsZXdhcmVdXG59O1xuIl19