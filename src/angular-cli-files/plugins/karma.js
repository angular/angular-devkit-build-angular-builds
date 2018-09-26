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
                    '/_karma_webpack_/styles.js',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRztBQUNILGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0QyxTQUFTLGFBQWEsQ0FBQyxLQUFZLEVBQUUsUUFBZSxFQUFFLE9BQU8sR0FBRyxLQUFLO0lBQ25FLE1BQU0sUUFBUSxHQUFHO1FBQ2YsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLFFBQVE7UUFDN0IsMkZBQTJGO1NBQzFGLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7UUFDckUsNENBQTRDO1NBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFNLFFBQVEsRUFBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDO0lBRTNDLG1EQUFtRDtJQUNuRCx1REFBdUQ7SUFDdkQsSUFB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Q0FBQyxDQUFDO1lBQy9DLENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDLENBQUM7SUFFRixtQ0FBbUM7SUFDbkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUM7SUFFOUIsa0NBQWtDO0lBQ2xDLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQztBQUVGLGlCQUFpQixDQUFDLE9BQU8sR0FBRyxDQUFDLHVCQUF1QixFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRWhFLG9HQUFvRztBQUNwRyxTQUFTLGtCQUFrQjtJQUN6QixPQUFPLFVBQVUsR0FBUSxFQUFFLEdBQVEsRUFBRSxJQUFnQjtRQUNuRCxJQUFJLGlCQUFpQixFQUFFO1lBQ3JCLE1BQU0sVUFBVSxHQUFHLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUM7WUFDaEQsTUFBTSxVQUFVLHFCQUFRLEdBQUcsSUFBRSxHQUFHLEVBQUUsVUFBVSxHQUFFLENBQUE7WUFDOUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUMxQzthQUFNO1lBQ0wsSUFBSSxFQUFFLENBQUM7U0FDUjtJQUNILENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLENBQUMsT0FBTyxHQUFHO0lBQ2YseUNBQXlDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDO0lBQzVELDREQUE0RCxFQUFFLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDO0lBQ3pGLHdEQUF3RCxFQUFFLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQztJQUNqRixtREFBbUQsRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUM7SUFDaEYsb0RBQW9ELEVBQUUsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUM7Q0FDdEYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuY29uc3Qgd2VicGFja0Rldk1pZGRsZXdhcmUgPSByZXF1aXJlKCd3ZWJwYWNrLWRldi1taWRkbGV3YXJlJyk7XG5cbmltcG9ydCB7IEFzc2V0UGF0dGVybiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IEthcm1hV2VicGFja0ZhaWx1cmVDYiB9IGZyb20gJy4va2FybWEtd2VicGFjay1mYWlsdXJlLWNiJztcblxuLyoqXG4gKiBFbnVtZXJhdGUgbmVlZGVkIChidXQgbm90IHJlcXVpcmUvaW1wb3J0ZWQpIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZVxuICogIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpXG4gKiByZXF1aXJlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKVxuICovXG5cblxubGV0IGJsb2NrZWQ6IGFueVtdID0gW107XG5sZXQgaXNCbG9ja2VkID0gZmFsc2U7XG5sZXQgd2VicGFja01pZGRsZXdhcmU6IGFueTtcbmxldCBzdWNjZXNzQ2I6ICgpID0+IHZvaWQ7XG5sZXQgZmFpbHVyZUNiOiAoKSA9PiB2b2lkO1xuXG4vLyBBZGQgZmlsZXMgdG8gdGhlIEthcm1hIGZpbGVzIGFycmF5LlxuZnVuY3Rpb24gYWRkS2FybWFGaWxlcyhmaWxlczogYW55W10sIG5ld0ZpbGVzOiBhbnlbXSwgcHJlcGVuZCA9IGZhbHNlKSB7XG4gIGNvbnN0IGRlZmF1bHRzID0ge1xuICAgIGluY2x1ZGVkOiB0cnVlLFxuICAgIHNlcnZlZDogdHJ1ZSxcbiAgICB3YXRjaGVkOiB0cnVlXG4gIH07XG5cbiAgY29uc3QgcHJvY2Vzc2VkRmlsZXMgPSBuZXdGaWxlc1xuICAgIC8vIFJlbW92ZSBnbG9icyB0aGF0IGRvIG5vdCBtYXRjaCBhbnkgZmlsZXMsIG90aGVyd2lzZSBLYXJtYSB3aWxsIHNob3cgYSB3YXJuaW5nIGZvciB0aGVzZS5cbiAgICAuZmlsdGVyKGZpbGUgPT4gZ2xvYi5zeW5jKGZpbGUucGF0dGVybiwgeyBub2RpcjogdHJ1ZSB9KS5sZW5ndGggIT0gMClcbiAgICAvLyBGaWxsIGluIHBhdHRlcm4gcHJvcGVydGllcyB3aXRoIGRlZmF1bHRzLlxuICAgIC5tYXAoZmlsZSA9PiAoeyAuLi5kZWZhdWx0cywgLi4uZmlsZSB9KSk7XG5cbiAgLy8gSXQncyBpbXBvcnRhbnQgdG8gbm90IHJlcGxhY2UgdGhlIGFycmF5LCBiZWNhdXNlXG4gIC8vIGthcm1hIGFscmVhZHkgaGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBleGlzdGluZyBhcnJheS5cbiAgaWYgKHByZXBlbmQpIHtcbiAgICBmaWxlcy51bnNoaWZ0KC4uLnByb2Nlc3NlZEZpbGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlcy5wdXNoKC4uLnByb2Nlc3NlZEZpbGVzKTtcbiAgfVxufVxuXG5jb25zdCBpbml0OiBhbnkgPSAoY29uZmlnOiBhbnksIGVtaXR0ZXI6IGFueSwgY3VzdG9tRmlsZUhhbmRsZXJzOiBhbnkpID0+IHtcbiAgaWYgKCFjb25maWcuYnVpbGRXZWJwYWNrKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyL3BsdWdpbnMva2FybWEnIGthcm1hIHBsdWdpbiBpcyBtZWFudCB0b2AgK1xuICAgIGAgYmUgdXNlZCBmcm9tIHdpdGhpbiBBbmd1bGFyIENMSSBhbmQgd2lsbCBub3Qgd29yayBjb3JyZWN0bHkgb3V0c2lkZSBvZiBpdC5gXG4gICAgKVxuICB9XG4gIGNvbnN0IG9wdGlvbnMgPSBjb25maWcuYnVpbGRXZWJwYWNrLm9wdGlvbnM7XG4gIGNvbnN0IHByb2plY3RSb290ID0gY29uZmlnLmJ1aWxkV2VicGFjay5wcm9qZWN0Um9vdCBhcyBzdHJpbmc7XG4gIHN1Y2Nlc3NDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suc3VjY2Vzc0NiO1xuICBmYWlsdXJlQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLmZhaWx1cmVDYjtcblxuICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcicpO1xuXG4gIC8vIFdoZW4gdXNpbmcgY29kZS1jb3ZlcmFnZSwgYXV0by1hZGQgY292ZXJhZ2UtaXN0YW5idWwuXG4gIGNvbmZpZy5yZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzIHx8IFtdO1xuICBpZiAob3B0aW9ucy5jb2RlQ292ZXJhZ2UgJiYgY29uZmlnLnJlcG9ydGVycy5pbmRleE9mKCdjb3ZlcmFnZS1pc3RhbmJ1bCcpID09PSAtMSkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnY292ZXJhZ2UtaXN0YW5idWwnKTtcbiAgfVxuXG4gIC8vIEFkZCBhIHJlcG9ydGVyIHRoYXQgZml4ZXMgc291cmNlbWFwIHVybHMuXG4gIGlmIChvcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcicpO1xuXG4gICAgLy8gQ29kZSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS90c2NoYXViL2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydC5cbiAgICAvLyBXZSBjYW4ndCB1c2UgaXQgZGlyZWN0bHkgYmVjYXVzZSB3ZSBuZWVkIHRvIGFkZCBpdCBjb25kaXRpb25hbGx5IGluIHRoaXMgZmlsZSwgYW5kIGthcm1hXG4gICAgLy8gZnJhbWV3b3JrcyBjYW5ub3QgYmUgYWRkZWQgZHluYW1pY2FsbHkuXG4gICAgY29uc3Qgc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpKTtcbiAgICBjb25zdCBrc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpKTtcblxuICAgIGFkZEthcm1hRmlsZXMoY29uZmlnLmZpbGVzLCBbXG4gICAgICB7IHBhdHRlcm46IHBhdGguam9pbihzbXNQYXRoLCAnYnJvd3Nlci1zb3VyY2UtbWFwLXN1cHBvcnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfSxcbiAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKGtzbXNQYXRoLCAnY2xpZW50LmpzJyksIHdhdGNoZWQ6IGZhbHNlIH1cbiAgICBdLCB0cnVlKTtcbiAgfVxuXG4gIC8vIEFkZCB3ZWJwYWNrIGNvbmZpZy5cbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGNvbmZpZy5idWlsZFdlYnBhY2sud2VicGFja0NvbmZpZztcbiAgY29uc3Qgd2VicGFja01pZGRsZXdhcmVDb25maWcgPSB7XG4gICAgbG9nTGV2ZWw6ICdlcnJvcicsIC8vIEhpZGUgd2VicGFjayBvdXRwdXQgYmVjYXVzZSBpdHMgbm9pc3kuXG4gICAgd2F0Y2hPcHRpb25zOiB7IHBvbGw6IG9wdGlvbnMucG9sbCB9LFxuICAgIHB1YmxpY1BhdGg6ICcvX2thcm1hX3dlYnBhY2tfLycsXG4gIH07XG5cbiAgY29uc3QgY29tcGlsYXRpb25FcnJvckNiID0gKGVycm9yOiBzdHJpbmcgfCB1bmRlZmluZWQsIGVycm9yczogc3RyaW5nW10pID0+IHtcbiAgICAvLyBOb3RpZnkgcG90ZW50aWFsIGxpc3RlbmVycyBvZiB0aGUgY29tcGlsZSBlcnJvclxuICAgIGVtaXR0ZXIuZW1pdCgnY29tcGlsZV9lcnJvcicsIGVycm9ycyk7XG5cbiAgICAvLyBGaW5pc2ggS2FybWEgcnVuIGVhcmx5IGluIGNhc2Ugb2YgY29tcGlsYXRpb24gZXJyb3IuXG4gICAgZW1pdHRlci5lbWl0KCdydW5fY29tcGxldGUnLCBbXSwgeyBleGl0Q29kZTogMSB9KTtcblxuICAgIC8vIFVuYmxvY2sgYW55IGthcm1hIHJlcXVlc3RzIChwb3RlbnRpYWxseSBzdGFydGVkIHVzaW5nIGBrYXJtYSBydW5gKVxuICAgIHVuYmxvY2soKTtcbiAgfVxuICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgS2FybWFXZWJwYWNrRmFpbHVyZUNiKGNvbXBpbGF0aW9uRXJyb3JDYikpO1xuXG4gIC8vIFVzZSBleGlzdGluZyBjb25maWcgaWYgYW55LlxuICBjb25maWcud2VicGFjayA9IE9iamVjdC5hc3NpZ24od2VicGFja0NvbmZpZywgY29uZmlnLndlYnBhY2spO1xuICBjb25maWcud2VicGFja01pZGRsZXdhcmUgPSBPYmplY3QuYXNzaWduKHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnLCBjb25maWcud2VicGFja01pZGRsZXdhcmUpO1xuXG4gIC8vIE91ciBjdXN0b20gY29udGV4dCBhbmQgZGVidWcgZmlsZXMgbGlzdCB0aGUgd2VicGFjayBidW5kbGVzIGRpcmVjdGx5IGluc3RlYWQgb2YgdXNpbmdcbiAgLy8gdGhlIGthcm1hIGZpbGVzIGFycmF5LlxuICBjb25maWcuY3VzdG9tQ29udGV4dEZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWNvbnRleHQuaHRtbGA7XG4gIGNvbmZpZy5jdXN0b21EZWJ1Z0ZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWRlYnVnLmh0bWxgO1xuXG4gIC8vIEFkZCB0aGUgcmVxdWVzdCBibG9ja2VyIGFuZCB0aGUgd2VicGFjayBzZXJ2ZXIgZmFsbGJhY2suXG4gIGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlID0gY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUgfHwgW107XG4gIGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlLnB1c2goJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJyk7XG4gIGNvbmZpZy5taWRkbGV3YXJlID0gY29uZmlnLm1pZGRsZXdhcmUgfHwgW107XG4gIGNvbmZpZy5taWRkbGV3YXJlLnB1c2goJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1mYWxsYmFjaycpO1xuXG4gIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICB3ZWJwYWNrQ29uZmlnLndhdGNoID0gIWNvbmZpZy5zaW5nbGVSdW47XG4gIGlmIChjb25maWcuc2luZ2xlUnVuKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdrYXJtYScsICgpID0+IHtcbiAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIC8vIEZpbGVzIG5lZWQgdG8gYmUgc2VydmVkIGZyb20gYSBjdXN0b20gcGF0aCBmb3IgS2FybWEuXG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnBhdGggPSAnL19rYXJtYV93ZWJwYWNrXy8nO1xuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5wdWJsaWNQYXRoID0gJy9fa2FybWFfd2VicGFja18vJztcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQuZGV2dG9vbE1vZHVsZUZpbGVuYW1lVGVtcGxhdGUgPSAnW25hbWVzcGFjZV0vW3Jlc291cmNlLXBhdGhdP1tsb2FkZXJzXSc7XG5cbiAgbGV0IGNvbXBpbGVyOiBhbnk7XG4gIHRyeSB7XG4gICAgY29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihlLnN0YWNrIHx8IGUpO1xuICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5kZXRhaWxzKTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZXIoY2FsbGJhY2s/OiAoKSA9PiB2b2lkKSB7XG4gICAgaXNCbG9ja2VkID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgY29tcGlsZXIuaG9va3MuaW52YWxpZC50YXAoJ2thcm1hJywgKCkgPT4gaGFuZGxlcigpKTtcblxuICBjb21waWxlci5ob29rcy53YXRjaFJ1bi50YXBBc3luYygna2FybWEnLCAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gaGFuZGxlcihjYWxsYmFjaykpO1xuXG4gIGNvbXBpbGVyLmhvb2tzLnJ1bi50YXBBc3luYygna2FybWEnLCAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gaGFuZGxlcihjYWxsYmFjaykpO1xuXG4gIGZ1bmN0aW9uIHVuYmxvY2soKXtcbiAgICBpc0Jsb2NrZWQgPSBmYWxzZTtcbiAgICBibG9ja2VkLmZvckVhY2goKGNiKSA9PiBjYigpKTtcbiAgICBibG9ja2VkID0gW107XG4gIH1cblxuICBjb21waWxlci5ob29rcy5kb25lLnRhcCgna2FybWEnLCAoc3RhdHM6IGFueSkgPT4ge1xuICAgIC8vIERvbid0IHJlZnJlc2gga2FybWEgd2hlbiB0aGVyZSBhcmUgd2VicGFjayBlcnJvcnMuXG4gICAgaWYgKHN0YXRzLmNvbXBpbGF0aW9uLmVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVtaXR0ZXIucmVmcmVzaEZpbGVzKCk7XG4gICAgfVxuICAgIHVuYmxvY2soKTtcbiAgfSk7XG5cbiAgd2VicGFja01pZGRsZXdhcmUgPSBuZXcgd2VicGFja0Rldk1pZGRsZXdhcmUoY29tcGlsZXIsIHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnKTtcblxuICAvLyBGb3J3YXJkIHJlcXVlc3RzIHRvIHdlYnBhY2sgc2VydmVyLlxuICBjdXN0b21GaWxlSGFuZGxlcnMucHVzaCh7XG4gICAgdXJsUmVnZXg6IC9eXFwvX2thcm1hX3dlYnBhY2tfXFwvLiovLFxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBhbnksIHJlczogYW55KSB7XG4gICAgICB3ZWJwYWNrTWlkZGxld2FyZShyZXEsIHJlcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBFbnN1cmUgc2NyaXB0IGFuZCBzdHlsZSBidW5kbGVzIGFyZSBzZXJ2ZWQuXG4gICAgICAgIC8vIFRoZXkgYXJlIG1lbnRpb25lZCBpbiB0aGUgY3VzdG9tIGthcm1hIGNvbnRleHQgcGFnZSBhbmQgd2UgZG9uJ3Qgd2FudCB0aGVtIHRvIDQwNC5cbiAgICAgICAgY29uc3QgYWx3YXlzU2VydmUgPSBbXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vcnVudGltZS5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vcG9seWZpbGxzLmpzJyxcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy9zY3JpcHRzLmpzJyxcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy9zdHlsZXMuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3ZlbmRvci5qcycsXG4gICAgICAgIF07XG4gICAgICAgIGlmIChhbHdheXNTZXJ2ZS5pbmRleE9mKHJlcS51cmwpICE9IC0xKSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA0O1xuICAgICAgICAgIHJlcy5lbmQoJ05vdCBmb3VuZCcpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGVtaXR0ZXIub24oJ2V4aXQnLCAoZG9uZTogYW55KSA9PiB7XG4gICAgd2VicGFja01pZGRsZXdhcmUuY2xvc2UoKTtcbiAgICBkb25lKCk7XG4gIH0pO1xufTtcblxuaW5pdC4kaW5qZWN0ID0gWydjb25maWcnLCAnZW1pdHRlcicsICdjdXN0b21GaWxlSGFuZGxlcnMnXTtcblxuLy8gQmxvY2sgcmVxdWVzdHMgdW50aWwgdGhlIFdlYnBhY2sgY29tcGlsYXRpb24gaXMgZG9uZS5cbmZ1bmN0aW9uIHJlcXVlc3RCbG9ja2VyKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKF9yZXF1ZXN0OiBhbnksIF9yZXNwb25zZTogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKGlzQmxvY2tlZCkge1xuICAgICAgYmxvY2tlZC5wdXNoKG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9O1xufVxuXG4vLyBDb3BpZWQgZnJvbSBcImthcm1hLWphc21pbmUtZGlmZi1yZXBvcnRlclwiIHNvdXJjZSBjb2RlOlxuLy8gSW4gY2FzZSwgd2hlbiBtdWx0aXBsZSByZXBvcnRlcnMgYXJlIHVzZWQgaW4gY29uanVuY3Rpb25cbi8vIHdpdGggaW5pdFNvdXJjZW1hcFJlcG9ydGVyLCB0aGV5IGJvdGggd2lsbCBzaG93IHJlcGV0aXRpdmUgbG9nXG4vLyBtZXNzYWdlcyB3aGVuIGRpc3BsYXlpbmcgZXZlcnl0aGluZyB0aGF0IHN1cHBvc2VkIHRvIHdyaXRlIHRvIHRlcm1pbmFsLlxuLy8gU28ganVzdCBzdXBwcmVzcyBhbnkgbG9ncyBmcm9tIGluaXRTb3VyY2VtYXBSZXBvcnRlciBieSBkb2luZyBub3RoaW5nIG9uXG4vLyBicm93c2VyIGxvZywgYmVjYXVzZSBpdCBpcyBhbiB1dGlsaXR5IHJlcG9ydGVyLFxuLy8gdW5sZXNzIGl0J3MgYWxvbmUgaW4gdGhlIFwicmVwb3J0ZXJzXCIgb3B0aW9uIGFuZCBiYXNlIHJlcG9ydGVyIGlzIHVzZWQuXG5mdW5jdGlvbiBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKGNvbnRleHQ6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgY29udGV4dC53cml0ZUNvbW1vbk1zZyA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgY29uc3QgcmVwb3J0ZXJOYW1lID0gJ0Bhbmd1bGFyL2NsaSc7XG4gIGNvbnN0IGhhc1RyYWlsaW5nUmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycy5zbGljZSgtMSkucG9wKCkgIT09IHJlcG9ydGVyTmFtZTtcblxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICBjb250ZXh0LndyaXRlQ29tbW9uTXNnID0gZnVuY3Rpb24gKCkgeyB9O1xuICB9XG59XG5cbi8vIEVtaXRzIGJ1aWxkZXIgZXZlbnRzLlxuY29uc3QgZXZlbnRSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKHRoaXMsIGNvbmZpZyk7XG5cbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyczogYW55LCByZXN1bHRzOiBhbnkpIHtcbiAgICBpZiAocmVzdWx0cy5leGl0Q29kZSA9PT0gMCkge1xuICAgICAgc3VjY2Vzc0NiICYmIHN1Y2Nlc3NDYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmYWlsdXJlQ2IgJiYgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5ldmVudFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gU3RyaXAgdGhlIHNlcnZlciBhZGRyZXNzIGFuZCB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG5jb25zdCBzb3VyY2VNYXBSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBtdXRlRHVwbGljYXRlUmVwb3J0ZXJMb2dnaW5nKHRoaXMsIGNvbmZpZyk7XG5cbiAgY29uc3QgdXJsUmVnZXhwID0gL1xcKGh0dHA6XFwvXFwvbG9jYWxob3N0OlxcZCtcXC9fa2FybWFfd2VicGFja19cXC93ZWJwYWNrOlxcLy9naTtcblxuICB0aGlzLm9uU3BlY0NvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyOiBhbnksIHJlc3VsdDogYW55KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQubG9nLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5sb2cuZm9yRWFjaCgobG9nOiBzdHJpbmcsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgIHJlc3VsdC5sb2dbaWR4XSA9IGxvZy5yZXBsYWNlKHVybFJlZ2V4cCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBjb21wbGV0ZSBtZXNzYWdlXG4gIHRoaXMub25SdW5Db21wbGV0ZSA9ICgpID0+IHt9O1xuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBmYWlsdXJlIG1lc3NhZ2VcbiAgdGhpcy5zcGVjRmFpbHVyZSA9ICgpID0+IHt9O1xufTtcblxuc291cmNlTWFwUmVwb3J0ZXIuJGluamVjdCA9IFsnYmFzZVJlcG9ydGVyRGVjb3JhdG9yJywgJ2NvbmZpZyddO1xuXG4vLyBXaGVuIGEgcmVxdWVzdCBpcyBub3QgZm91bmQgaW4gdGhlIGthcm1hIHNlcnZlciwgdHJ5IGxvb2tpbmcgZm9yIGl0IGZyb20gdGhlIHdlYnBhY2sgc2VydmVyIHJvb3QuXG5mdW5jdGlvbiBmYWxsYmFja01pZGRsZXdhcmUoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAocmVxOiBhbnksIHJlczogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKHdlYnBhY2tNaWRkbGV3YXJlKSB7XG4gICAgICBjb25zdCB3ZWJwYWNrVXJsID0gJy9fa2FybWFfd2VicGFja18nICsgcmVxLnVybDtcbiAgICAgIGNvbnN0IHdlYnBhY2tSZXEgPSB7IC4uLnJlcSwgdXJsOiB3ZWJwYWNrVXJsIH1cbiAgICAgIHdlYnBhY2tNaWRkbGV3YXJlKHdlYnBhY2tSZXEsIHJlcywgbmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnZnJhbWV3b3JrOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogWydmYWN0b3J5JywgaW5pdF0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJzogWyd0eXBlJywgc291cmNlTWFwUmVwb3J0ZXJdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJzogWyd0eXBlJywgZXZlbnRSZXBvcnRlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJzogWydmYWN0b3J5JywgcmVxdWVzdEJsb2NrZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snOiBbJ2ZhY3RvcnknLCBmYWxsYmFja01pZGRsZXdhcmVdXG59O1xuIl19