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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRztBQUNILGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0QyxTQUFTLGFBQWEsQ0FBQyxLQUFZLEVBQUUsUUFBZSxFQUFFLE9BQU8sR0FBRyxLQUFLO0lBQ25FLE1BQU0sUUFBUSxHQUFHO1FBQ2YsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLFFBQVE7UUFDN0IsMkZBQTJGO1NBQzFGLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7UUFDckUsNENBQTRDO1NBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFNLFFBQVEsRUFBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDO0lBRTNDLG1EQUFtRDtJQUNuRCx1REFBdUQ7SUFDdkQsSUFB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bnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmNvbnN0IHdlYnBhY2tEZXZNaWRkbGV3YXJlID0gcmVxdWlyZSgnd2VicGFjay1kZXYtbWlkZGxld2FyZScpO1xuXG5pbXBvcnQgeyBBc3NldFBhdHRlcm4gfSBmcm9tICcuLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBLYXJtYVdlYnBhY2tGYWlsdXJlQ2IgfSBmcm9tICcuL2thcm1hLXdlYnBhY2stZmFpbHVyZS1jYic7XG5cbi8qKlxuICogRW51bWVyYXRlIG5lZWRlZCAoYnV0IG5vdCByZXF1aXJlL2ltcG9ydGVkKSBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGVcbiAqICB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKVxuICogcmVxdWlyZSgna2FybWEtc291cmNlLW1hcC1zdXBwb3J0JylcbiAqL1xuXG5cbmxldCBibG9ja2VkOiBhbnlbXSA9IFtdO1xubGV0IGlzQmxvY2tlZCA9IGZhbHNlO1xubGV0IHdlYnBhY2tNaWRkbGV3YXJlOiBhbnk7XG5sZXQgc3VjY2Vzc0NiOiAoKSA9PiB2b2lkO1xubGV0IGZhaWx1cmVDYjogKCkgPT4gdm9pZDtcblxuLy8gQWRkIGZpbGVzIHRvIHRoZSBLYXJtYSBmaWxlcyBhcnJheS5cbmZ1bmN0aW9uIGFkZEthcm1hRmlsZXMoZmlsZXM6IGFueVtdLCBuZXdGaWxlczogYW55W10sIHByZXBlbmQgPSBmYWxzZSkge1xuICBjb25zdCBkZWZhdWx0cyA9IHtcbiAgICBpbmNsdWRlZDogdHJ1ZSxcbiAgICBzZXJ2ZWQ6IHRydWUsXG4gICAgd2F0Y2hlZDogdHJ1ZVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NlZEZpbGVzID0gbmV3RmlsZXNcbiAgICAvLyBSZW1vdmUgZ2xvYnMgdGhhdCBkbyBub3QgbWF0Y2ggYW55IGZpbGVzLCBvdGhlcndpc2UgS2FybWEgd2lsbCBzaG93IGEgd2FybmluZyBmb3IgdGhlc2UuXG4gICAgLmZpbHRlcihmaWxlID0+IGdsb2Iuc3luYyhmaWxlLnBhdHRlcm4sIHsgbm9kaXI6IHRydWUgfSkubGVuZ3RoICE9IDApXG4gICAgLy8gRmlsbCBpbiBwYXR0ZXJuIHByb3BlcnRpZXMgd2l0aCBkZWZhdWx0cy5cbiAgICAubWFwKGZpbGUgPT4gKHsgLi4uZGVmYXVsdHMsIC4uLmZpbGUgfSkpO1xuXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIG5vdCByZXBsYWNlIHRoZSBhcnJheSwgYmVjYXVzZVxuICAvLyBrYXJtYSBhbHJlYWR5IGhhcyBhIHJlZmVyZW5jZSB0byB0aGUgZXhpc3RpbmcgYXJyYXkuXG4gIGlmIChwcmVwZW5kKSB7XG4gICAgZmlsZXMudW5zaGlmdCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZXMucHVzaCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH1cbn1cblxuY29uc3QgaW5pdDogYW55ID0gKGNvbmZpZzogYW55LCBlbWl0dGVyOiBhbnksIGN1c3RvbUZpbGVIYW5kbGVyczogYW55KSA9PiB7XG4gIGlmICghY29uZmlnLmJ1aWxkV2VicGFjaykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci9wbHVnaW5zL2thcm1hJyBrYXJtYSBwbHVnaW4gaXMgbWVhbnQgdG9gICtcbiAgICBgIGJlIHVzZWQgZnJvbSB3aXRoaW4gQW5ndWxhciBDTEkgYW5kIHdpbGwgbm90IHdvcmsgY29ycmVjdGx5IG91dHNpZGUgb2YgaXQuYFxuICAgIClcbiAgfVxuICBjb25zdCBvcHRpb25zID0gY29uZmlnLmJ1aWxkV2VicGFjay5vcHRpb25zO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IGNvbmZpZy5idWlsZFdlYnBhY2sucHJvamVjdFJvb3QgYXMgc3RyaW5nO1xuICBzdWNjZXNzQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLnN1Y2Nlc3NDYjtcbiAgZmFpbHVyZUNiID0gY29uZmlnLmJ1aWxkV2VicGFjay5mYWlsdXJlQ2I7XG5cbiAgY29uZmlnLnJlcG9ydGVycy51bnNoaWZ0KCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZXZlbnQtcmVwb3J0ZXInKTtcblxuICAvLyBXaGVuIHVzaW5nIGNvZGUtY292ZXJhZ2UsIGF1dG8tYWRkIGNvdmVyYWdlLWlzdGFuYnVsLlxuICBjb25maWcucmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycyB8fCBbXTtcbiAgaWYgKG9wdGlvbnMuY29kZUNvdmVyYWdlICYmIGNvbmZpZy5yZXBvcnRlcnMuaW5kZXhPZignY292ZXJhZ2UtaXN0YW5idWwnKSA9PT0gLTEpIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ2NvdmVyYWdlLWlzdGFuYnVsJyk7XG4gIH1cblxuICAvLyBBZGQgYSByZXBvcnRlciB0aGF0IGZpeGVzIHNvdXJjZW1hcCB1cmxzLlxuICBpZiAob3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInKTtcblxuICAgIC8vIENvZGUgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdHNjaGF1Yi9rYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQuXG4gICAgLy8gV2UgY2FuJ3QgdXNlIGl0IGRpcmVjdGx5IGJlY2F1c2Ugd2UgbmVlZCB0byBhZGQgaXQgY29uZGl0aW9uYWxseSBpbiB0aGlzIGZpbGUsIGFuZCBrYXJtYVxuICAgIC8vIGZyYW1ld29ya3MgY2Fubm90IGJlIGFkZGVkIGR5bmFtaWNhbGx5LlxuICAgIGNvbnN0IHNtc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG4gICAgY29uc3Qga3Ntc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG5cbiAgICBhZGRLYXJtYUZpbGVzKGNvbmZpZy5maWxlcywgW1xuICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oc21zUGF0aCwgJ2Jyb3dzZXItc291cmNlLW1hcC1zdXBwb3J0LmpzJyksIHdhdGNoZWQ6IGZhbHNlIH0sXG4gICAgICB7IHBhdHRlcm46IHBhdGguam9pbihrc21zUGF0aCwgJ2NsaWVudC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9XG4gICAgXSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBBZGQgd2VicGFjayBjb25maWcuXG4gIGNvbnN0IHdlYnBhY2tDb25maWcgPSBjb25maWcuYnVpbGRXZWJwYWNrLndlYnBhY2tDb25maWc7XG4gIGNvbnN0IHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnID0ge1xuICAgIGxvZ0xldmVsOiAnZXJyb3InLCAvLyBIaWRlIHdlYnBhY2sgb3V0cHV0IGJlY2F1c2UgaXRzIG5vaXN5LlxuICAgIHdhdGNoT3B0aW9uczogeyBwb2xsOiBvcHRpb25zLnBvbGwgfSxcbiAgICBwdWJsaWNQYXRoOiAnL19rYXJtYV93ZWJwYWNrXy8nLFxuICB9O1xuXG4gIGNvbnN0IGNvbXBpbGF0aW9uRXJyb3JDYiA9IChlcnJvcjogc3RyaW5nIHwgdW5kZWZpbmVkLCBlcnJvcnM6IHN0cmluZ1tdKSA9PiB7XG4gICAgLy8gTm90aWZ5IHBvdGVudGlhbCBsaXN0ZW5lcnMgb2YgdGhlIGNvbXBpbGUgZXJyb3JcbiAgICBlbWl0dGVyLmVtaXQoJ2NvbXBpbGVfZXJyb3InLCBlcnJvcnMpO1xuXG4gICAgLy8gRmluaXNoIEthcm1hIHJ1biBlYXJseSBpbiBjYXNlIG9mIGNvbXBpbGF0aW9uIGVycm9yLlxuICAgIGVtaXR0ZXIuZW1pdCgncnVuX2NvbXBsZXRlJywgW10sIHsgZXhpdENvZGU6IDEgfSk7XG5cbiAgICAvLyBVbmJsb2NrIGFueSBrYXJtYSByZXF1ZXN0cyAocG90ZW50aWFsbHkgc3RhcnRlZCB1c2luZyBga2FybWEgcnVuYClcbiAgICB1bmJsb2NrKCk7XG4gIH1cbiAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IEthcm1hV2VicGFja0ZhaWx1cmVDYihjb21waWxhdGlvbkVycm9yQ2IpKTtcblxuICAvLyBVc2UgZXhpc3RpbmcgY29uZmlnIGlmIGFueS5cbiAgY29uZmlnLndlYnBhY2sgPSBPYmplY3QuYXNzaWduKHdlYnBhY2tDb25maWcsIGNvbmZpZy53ZWJwYWNrKTtcbiAgY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlID0gT2JqZWN0LmFzc2lnbih3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZywgY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlKTtcblxuICAvLyBPdXIgY3VzdG9tIGNvbnRleHQgYW5kIGRlYnVnIGZpbGVzIGxpc3QgdGhlIHdlYnBhY2sgYnVuZGxlcyBkaXJlY3RseSBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIHRoZSBrYXJtYSBmaWxlcyBhcnJheS5cbiAgY29uZmlnLmN1c3RvbUNvbnRleHRGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1jb250ZXh0Lmh0bWxgO1xuICBjb25maWcuY3VzdG9tRGVidWdGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1kZWJ1Zy5odG1sYDtcblxuICAvLyBBZGQgdGhlIHJlcXVlc3QgYmxvY2tlciBhbmQgdGhlIHdlYnBhY2sgc2VydmVyIGZhbGxiYWNrLlxuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZSA9IGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcicpO1xuICBjb25maWcubWlkZGxld2FyZSA9IGNvbmZpZy5taWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcubWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snKTtcblxuICAvLyBEZWxldGUgZ2xvYmFsIHN0eWxlcyBlbnRyeSwgd2UgZG9uJ3Qgd2FudCB0byBsb2FkIHRoZW0uXG4gIGRlbGV0ZSB3ZWJwYWNrQ29uZmlnLmVudHJ5LnN0eWxlcztcblxuICAvLyBUaGUgd2VicGFjayB0aWVyIG93bnMgdGhlIHdhdGNoIGJlaGF2aW9yIHNvIHdlIHdhbnQgdG8gZm9yY2UgaXQgaW4gdGhlIGNvbmZpZy5cbiAgd2VicGFja0NvbmZpZy53YXRjaCA9ICFjb25maWcuc2luZ2xlUnVuO1xuICBpZiAoY29uZmlnLnNpbmdsZVJ1bikge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4geyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgna2FybWEnLCAoKSA9PiB7XG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICAvLyBGaWxlcyBuZWVkIHRvIGJlIHNlcnZlZCBmcm9tIGEgY3VzdG9tIHBhdGggZm9yIEthcm1hLlxuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5wYXRoID0gJy9fa2FybWFfd2VicGFja18vJztcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucHVibGljUGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG4gIHdlYnBhY2tDb25maWcub3V0cHV0LmRldnRvb2xNb2R1bGVGaWxlbmFtZVRlbXBsYXRlID0gJ1tuYW1lc3BhY2VdL1tyZXNvdXJjZS1wYXRoXT9bbG9hZGVyc10nO1xuXG4gIGxldCBjb21waWxlcjogYW55O1xuICB0cnkge1xuICAgIGNvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZS5zdGFjayB8fCBlKTtcbiAgICBpZiAoZS5kZXRhaWxzKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUuZGV0YWlscyk7XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVyKGNhbGxiYWNrPzogKCkgPT4gdm9pZCkge1xuICAgIGlzQmxvY2tlZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfVxuXG4gIGNvbXBpbGVyLmhvb2tzLmludmFsaWQudGFwKCdrYXJtYScsICgpID0+IGhhbmRsZXIoKSk7XG5cbiAgY29tcGlsZXIuaG9va3Mud2F0Y2hSdW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICBjb21waWxlci5ob29rcy5ydW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICBmdW5jdGlvbiB1bmJsb2NrKCl7XG4gICAgaXNCbG9ja2VkID0gZmFsc2U7XG4gICAgYmxvY2tlZC5mb3JFYWNoKChjYikgPT4gY2IoKSk7XG4gICAgYmxvY2tlZCA9IFtdO1xuICB9XG5cbiAgY29tcGlsZXIuaG9va3MuZG9uZS50YXAoJ2thcm1hJywgKHN0YXRzOiBhbnkpID0+IHtcbiAgICAvLyBEb24ndCByZWZyZXNoIGthcm1hIHdoZW4gdGhlcmUgYXJlIHdlYnBhY2sgZXJyb3JzLlxuICAgIGlmIChzdGF0cy5jb21waWxhdGlvbi5lcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBlbWl0dGVyLnJlZnJlc2hGaWxlcygpO1xuICAgIH1cbiAgICB1bmJsb2NrKCk7XG4gIH0pO1xuXG4gIHdlYnBhY2tNaWRkbGV3YXJlID0gbmV3IHdlYnBhY2tEZXZNaWRkbGV3YXJlKGNvbXBpbGVyLCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyk7XG5cbiAgLy8gRm9yd2FyZCByZXF1ZXN0cyB0byB3ZWJwYWNrIHNlcnZlci5cbiAgY3VzdG9tRmlsZUhhbmRsZXJzLnB1c2goe1xuICAgIHVybFJlZ2V4OiAvXlxcL19rYXJtYV93ZWJwYWNrX1xcLy4qLyxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBoYW5kbGVyKHJlcTogYW55LCByZXM6IGFueSkge1xuICAgICAgd2VicGFja01pZGRsZXdhcmUocmVxLCByZXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gRW5zdXJlIHNjcmlwdCBhbmQgc3R5bGUgYnVuZGxlcyBhcmUgc2VydmVkLlxuICAgICAgICAvLyBUaGV5IGFyZSBtZW50aW9uZWQgaW4gdGhlIGN1c3RvbSBrYXJtYSBjb250ZXh0IHBhZ2UgYW5kIHdlIGRvbid0IHdhbnQgdGhlbSB0byA0MDQuXG4gICAgICAgIGNvbnN0IGFsd2F5c1NlcnZlID0gW1xuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3J1bnRpbWUuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3BvbHlmaWxscy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vc2NyaXB0cy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vdmVuZG9yLmpzJyxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKGFsd2F5c1NlcnZlLmluZGV4T2YocmVxLnVybCkgIT0gLTEpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgICAgcmVzLmVuZCgnTm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgZW1pdHRlci5vbignZXhpdCcsIChkb25lOiBhbnkpID0+IHtcbiAgICB3ZWJwYWNrTWlkZGxld2FyZS5jbG9zZSgpO1xuICAgIGRvbmUoKTtcbiAgfSk7XG59O1xuXG5pbml0LiRpbmplY3QgPSBbJ2NvbmZpZycsICdlbWl0dGVyJywgJ2N1c3RvbUZpbGVIYW5kbGVycyddO1xuXG4vLyBCbG9jayByZXF1ZXN0cyB1bnRpbCB0aGUgV2VicGFjayBjb21waWxhdGlvbiBpcyBkb25lLlxuZnVuY3Rpb24gcmVxdWVzdEJsb2NrZXIoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoX3JlcXVlc3Q6IGFueSwgX3Jlc3BvbnNlOiBhbnksIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICBibG9ja2VkLnB1c2gobmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIENvcGllZCBmcm9tIFwia2FybWEtamFzbWluZS1kaWZmLXJlcG9ydGVyXCIgc291cmNlIGNvZGU6XG4vLyBJbiBjYXNlLCB3aGVuIG11bHRpcGxlIHJlcG9ydGVycyBhcmUgdXNlZCBpbiBjb25qdW5jdGlvblxuLy8gd2l0aCBpbml0U291cmNlbWFwUmVwb3J0ZXIsIHRoZXkgYm90aCB3aWxsIHNob3cgcmVwZXRpdGl2ZSBsb2dcbi8vIG1lc3NhZ2VzIHdoZW4gZGlzcGxheWluZyBldmVyeXRoaW5nIHRoYXQgc3VwcG9zZWQgdG8gd3JpdGUgdG8gdGVybWluYWwuXG4vLyBTbyBqdXN0IHN1cHByZXNzIGFueSBsb2dzIGZyb20gaW5pdFNvdXJjZW1hcFJlcG9ydGVyIGJ5IGRvaW5nIG5vdGhpbmcgb25cbi8vIGJyb3dzZXIgbG9nLCBiZWNhdXNlIGl0IGlzIGFuIHV0aWxpdHkgcmVwb3J0ZXIsXG4vLyB1bmxlc3MgaXQncyBhbG9uZSBpbiB0aGUgXCJyZXBvcnRlcnNcIiBvcHRpb24gYW5kIGJhc2UgcmVwb3J0ZXIgaXMgdXNlZC5cbmZ1bmN0aW9uIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcoY29udGV4dDogYW55LCBjb25maWc6IGFueSkge1xuICBjb250ZXh0LndyaXRlQ29tbW9uTXNnID0gZnVuY3Rpb24gKCkgeyB9O1xuICBjb25zdCByZXBvcnRlck5hbWUgPSAnQGFuZ3VsYXIvY2xpJztcbiAgY29uc3QgaGFzVHJhaWxpbmdSZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzLnNsaWNlKC0xKS5wb3AoKSAhPT0gcmVwb3J0ZXJOYW1lO1xuXG4gIGlmIChoYXNUcmFpbGluZ1JlcG9ydGVycykge1xuICAgIGNvbnRleHQud3JpdGVDb21tb25Nc2cgPSBmdW5jdGlvbiAoKSB7IH07XG4gIH1cbn1cblxuLy8gRW1pdHMgYnVpbGRlciBldmVudHMuXG5jb25zdCBldmVudFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICB0aGlzLm9uUnVuQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXJzOiBhbnksIHJlc3VsdHM6IGFueSkge1xuICAgIGlmIChyZXN1bHRzLmV4aXRDb2RlID09PSAwKSB7XG4gICAgICBzdWNjZXNzQ2IgJiYgc3VjY2Vzc0NiKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZhaWx1cmVDYiAmJiBmYWlsdXJlQ2IoKTtcbiAgICB9XG4gIH1cblxuICAvLyBhdm9pZCBkdXBsaWNhdGUgZmFpbHVyZSBtZXNzYWdlXG4gIHRoaXMuc3BlY0ZhaWx1cmUgPSAoKSA9PiB7fTtcbn07XG5cbmV2ZW50UmVwb3J0ZXIuJGluamVjdCA9IFsnYmFzZVJlcG9ydGVyRGVjb3JhdG9yJywgJ2NvbmZpZyddO1xuXG4vLyBTdHJpcCB0aGUgc2VydmVyIGFkZHJlc3MgYW5kIHdlYnBhY2sgc2NoZW1lICh3ZWJwYWNrOi8vKSBmcm9tIGVycm9yIGxvZy5cbmNvbnN0IHNvdXJjZU1hcFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIG11dGVEdXBsaWNhdGVSZXBvcnRlckxvZ2dpbmcodGhpcywgY29uZmlnKTtcblxuICBjb25zdCB1cmxSZWdleHAgPSAvXFwoaHR0cDpcXC9cXC9sb2NhbGhvc3Q6XFxkK1xcL19rYXJtYV93ZWJwYWNrX1xcL3dlYnBhY2s6XFwvL2dpO1xuXG4gIHRoaXMub25TcGVjQ29tcGxldGUgPSBmdW5jdGlvbiAoX2Jyb3dzZXI6IGFueSwgcmVzdWx0OiBhbnkpIHtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5sb2cubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0LmxvZy5mb3JFYWNoKChsb2c6IHN0cmluZywgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgcmVzdWx0LmxvZ1tpZHhdID0gbG9nLnJlcGxhY2UodXJsUmVnZXhwLCAnJyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGNvbXBsZXRlIG1lc3NhZ2VcbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gKCkgPT4ge307XG5cbiAgLy8gYXZvaWQgZHVwbGljYXRlIGZhaWx1cmUgbWVzc2FnZVxuICB0aGlzLnNwZWNGYWlsdXJlID0gKCkgPT4ge307XG59O1xuXG5zb3VyY2VNYXBSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InLCAnY29uZmlnJ107XG5cbi8vIFdoZW4gYSByZXF1ZXN0IGlzIG5vdCBmb3VuZCBpbiB0aGUga2FybWEgc2VydmVyLCB0cnkgbG9va2luZyBmb3IgaXQgZnJvbSB0aGUgd2VicGFjayBzZXJ2ZXIgcm9vdC5cbmZ1bmN0aW9uIGZhbGxiYWNrTWlkZGxld2FyZSgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChyZXE6IGFueSwgcmVzOiBhbnksIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAod2VicGFja01pZGRsZXdhcmUpIHtcbiAgICAgIGNvbnN0IHdlYnBhY2tVcmwgPSAnL19rYXJtYV93ZWJwYWNrXycgKyByZXEudXJsO1xuICAgICAgY29uc3Qgd2VicGFja1JlcSA9IHsgLi4ucmVxLCB1cmw6IHdlYnBhY2tVcmwgfVxuICAgICAgd2VicGFja01pZGRsZXdhcmUod2VicGFja1JlcSwgcmVzLCBuZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdmcmFtZXdvcms6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXInOiBbJ2ZhY3RvcnknLCBpbml0XSxcbiAgJ3JlcG9ydGVyOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInOiBbJ3R5cGUnLCBzb3VyY2VNYXBSZXBvcnRlcl0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZXZlbnQtcmVwb3J0ZXInOiBbJ3R5cGUnLCBldmVudFJlcG9ydGVyXSxcbiAgJ21pZGRsZXdhcmU6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWJsb2NrZXInOiBbJ2ZhY3RvcnknLCByZXF1ZXN0QmxvY2tlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1mYWxsYmFjayc6IFsnZmFjdG9yeScsIGZhbGxiYWNrTWlkZGxld2FyZV1cbn07XG4iXX0=