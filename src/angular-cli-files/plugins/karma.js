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
        .filter(file => glob.sync(file.pattern, { nodir: true }).length != 0)
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
// Emits builder events.
const eventReporter = function (baseReporterDecorator) {
    baseReporterDecorator(this);
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
eventReporter.$inject = ['baseReporterDecorator'];
// Strip the server address and webpack scheme (webpack://) from error log.
const sourceMapReporter = function (baseReporterDecorator, config) {
    baseReporterDecorator(this);
    const reporterName = '@angular/cli';
    const hasTrailingReporters = config.reporters.slice(-1).pop() !== reporterName;
    // Copied from "karma-jasmine-diff-reporter" source code:
    // In case, when multiple reporters are used in conjunction
    // with initSourcemapReporter, they both will show repetitive log
    // messages when displaying everything that supposed to write to terminal.
    // So just suppress any logs from initSourcemapReporter by doing nothing on
    // browser log, because it is an utility reporter,
    // unless it's alone in the "reporters" option and base reporter is used.
    if (hasTrailingReporters) {
        this.writeCommonMsg = function () { };
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRztBQUNILGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0Qyx1QkFBdUIsS0FBWSxFQUFFLFFBQWUsRUFBRSxPQUFPLEdBQUcsS0FBSztJQUNuRSxNQUFNLFFBQVEsR0FBRztRQUNmLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7SUFFRixNQUFNLGNBQWMsR0FBRyxRQUFRO1NBRTVCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7U0FFcEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQU0sUUFBUSxFQUFLLElBQUksRUFBRyxDQUFDLENBQUM7SUFFM0MsbURBQW1EO0lBQ25ELHVEQUF1RDtJQUN2RCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNOLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQztJQUNoQyxDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sSUFBSSxHQUFRLENBQUMsTUFBVyxFQUFFLE9BQVksRUFBRSxrQkFBdUIsRUFBRSxFQUFFO0lBQ3ZFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyw0RUFBNEU7WUFDNUYsNkVBQTZFLENBQzVFLENBQUE7SUFDSCxDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7SUFDNUMsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxXQUFxQixDQUFDO0lBQzlELFNBQVMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQztJQUMxQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFFMUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsK0NBQStDLENBQUMsQ0FBQztJQUUxRSx3REFBd0Q7SUFDeEQsTUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztJQUMxQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELDRDQUE0QztJQUM1QyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxtREFBbUQsQ0FBQyxDQUFDO1FBRTlFLHVFQUF1RTtRQUN2RSwyRkFBMkY7UUFDM0YsMENBQTBDO1FBQzFDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFDcEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztRQUUzRSxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUMxQixFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSwrQkFBK0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7WUFDaEYsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTtTQUM5RCxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQUVELHNCQUFzQjtJQUN0QixNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQztJQUN4RCxNQUFNLHVCQUF1QixHQUFHO1FBQzlCLFFBQVEsRUFBRSxPQUFPO1FBQ2pCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFO1FBQ3BDLFVBQVUsRUFBRSxtQkFBbUI7S0FDaEMsQ0FBQztJQUVGLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxLQUF5QixFQUFFLE1BQWdCLEVBQUUsRUFBRTtRQUN6RSxrREFBa0Q7UUFDbEQsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFdEMsdURBQXVEO1FBQ3ZELE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRWxELHFFQUFxRTtRQUNyRSxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUMsQ0FBQTtJQUNELGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksZ0RBQXFCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBRTFFLDhCQUE4QjtJQUM5QixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5RCxNQUFNLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUU1Rix3RkFBd0Y7SUFDeEYseUJBQXlCO0lBQ3pCLE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxHQUFHLFNBQVMscUJBQXFCLENBQUM7SUFDN0QsTUFBTSxDQUFDLGVBQWUsR0FBRyxHQUFHLFNBQVMsbUJBQW1CLENBQUM7SUFFekQsMkRBQTJEO0lBQzNELE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLElBQUksRUFBRSxDQUFDO0lBQ3hELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUN2RSxNQUFNLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO0lBQzVDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHlDQUF5QyxDQUFDLENBQUM7SUFFbEUsMERBQTBEO0lBQzFELE9BQU8sYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFFbEMsaUZBQWlGO0lBQ2pGLGFBQWEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ3hDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLHlFQUF5RTtRQUN6RSw0Q0FBNEM7UUFDNUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDNUIsS0FBSyxFQUFFLENBQUMsUUFBYSxFQUFFLEVBQUU7Z0JBQ3ZCLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7b0JBQ2hELFFBQVEsQ0FBQyxlQUFlLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xELENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDRCx3REFBd0Q7SUFDeEQsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7SUFDaEQsYUFBYSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsbUJBQW1CLENBQUM7SUFFdEQsSUFBSSxRQUFhLENBQUM7SUFDbEIsSUFBSSxDQUFDO1FBQ0gsUUFBUSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNYLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM1QixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNkLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFDRCxNQUFNLENBQUMsQ0FBQztJQUNWLENBQUM7SUFFRCxpQkFBaUIsUUFBcUI7UUFDcEMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUVqQixFQUFFLENBQUMsQ0FBQyxPQUFPLFFBQVEsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ25DLFFBQVEsRUFBRSxDQUFDO1FBQ2IsQ0FBQztJQUNILENBQUM7SUFFRCxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFFckQsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQU0sRUFBRSxRQUFvQixFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUUvRixRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBTSxFQUFFLFFBQW9CLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRTFGO1FBQ0UsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUNsQixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzlCLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDZixDQUFDO0lBRUQsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQVUsRUFBRSxFQUFFO1FBQzlDLHFEQUFxRDtRQUNyRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUNELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQyxDQUFDLENBQUM7SUFFSCxpQkFBaUIsR0FBRyxJQUFJLG9CQUFvQixDQUFDLFFBQVEsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO0lBRWhGLHNDQUFzQztJQUN0QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUFDdEIsUUFBUSxFQUFFLHdCQUF3QjtRQUNsQyxPQUFPLEVBQUUsaUJBQWlCLEdBQVEsRUFBRSxHQUFRO1lBQzFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7Z0JBQzFCLDhDQUE4QztnQkFDOUMscUZBQXFGO2dCQUNyRixNQUFNLFdBQVcsR0FBRztvQkFDbEIsNkJBQTZCO29CQUM3QiwrQkFBK0I7b0JBQy9CLDZCQUE2QjtvQkFDN0IsNEJBQTRCO2lCQUM3QixDQUFDO2dCQUNGLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdkMsR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7b0JBQ3JCLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDWixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLEdBQUcsQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDO29CQUNyQixHQUFHLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUN2QixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFTLEVBQUUsRUFBRTtRQUMvQixpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMxQixJQUFJLEVBQUUsQ0FBQztJQUNULENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDO0FBRUYsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztBQUUzRCx3REFBd0Q7QUFDeEQ7SUFDRSxNQUFNLENBQUMsVUFBVSxRQUFhLEVBQUUsU0FBYyxFQUFFLElBQWdCO1FBQzlELEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDZCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksRUFBRSxDQUFDO1FBQ1QsQ0FBQztJQUNILENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCx3QkFBd0I7QUFDeEIsTUFBTSxhQUFhLEdBQVEsVUFBcUIscUJBQTBCO0lBQ3hFLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTVCLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxTQUFjLEVBQUUsT0FBWTtRQUN6RCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0IsU0FBUyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQzNCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLFNBQVMsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUMzQixDQUFDO0lBQ0gsQ0FBQyxDQUFBO0lBRUQsa0NBQWtDO0lBQ2xDLElBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQztBQUVGLGFBQWEsQ0FBQyxPQUFPLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBRWxELDJFQUEyRTtBQUMzRSxNQUFNLGlCQUFpQixHQUFRLFVBQXFCLHFCQUEwQixFQUFFLE1BQVc7SUFDekYscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFNUIsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0lBQ3BDLE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxZQUFZLENBQUM7SUFFL0UseURBQXlEO0lBQ3pELDJEQUEyRDtJQUMzRCxpRUFBaUU7SUFDakUsMEVBQTBFO0lBQzFFLDJFQUEyRTtJQUMzRSxrREFBa0Q7SUFDbEQseUVBQXlFO0lBQ3pFLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUN6QixJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxNQUFNLFNBQVMsR0FBRyx5REFBeUQsQ0FBQztJQUU1RSxJQUFJLENBQUMsY0FBYyxHQUFHLFVBQVUsUUFBYSxFQUFFLE1BQVc7UUFDeEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFXLEVBQUUsR0FBVyxFQUFFLEVBQUU7Z0JBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDL0MsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0lBRUYsbUNBQW1DO0lBQ25DLElBQUksQ0FBQyxhQUFhLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0lBRTlCLGtDQUFrQztJQUNsQyxJQUFJLENBQUMsV0FBVyxHQUFHLEdBQUcsRUFBRSxHQUFFLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUM7QUFFRixpQkFBaUIsQ0FBQyxPQUFPLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUVoRSxvR0FBb0c7QUFDcEc7SUFDRSxNQUFNLENBQUMsVUFBVSxHQUFRLEVBQUUsR0FBUSxFQUFFLElBQWdCO1FBQ25ELEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUN0QixNQUFNLFVBQVUsR0FBRyxrQkFBa0IsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDO1lBQ2hELE1BQU0sVUFBVSxxQkFBUSxHQUFHLElBQUUsR0FBRyxFQUFFLFVBQVUsR0FBRSxDQUFBO1lBQzlDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxFQUFFLENBQUM7UUFDVCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUc7SUFDZix5Q0FBeUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7SUFDNUQsNERBQTRELEVBQUUsQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLENBQUM7SUFDekYsd0RBQXdELEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO0lBQ2pGLG1EQUFtRCxFQUFFLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQztJQUNoRixvREFBb0QsRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztDQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5jb25zdCB3ZWJwYWNrRGV2TWlkZGxld2FyZSA9IHJlcXVpcmUoJ3dlYnBhY2stZGV2LW1pZGRsZXdhcmUnKTtcblxuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgS2FybWFXZWJwYWNrRmFpbHVyZUNiIH0gZnJvbSAnLi9rYXJtYS13ZWJwYWNrLWZhaWx1cmUtY2InO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBuZWVkZWQgKGJ1dCBub3QgcmVxdWlyZS9pbXBvcnRlZCkgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlXG4gKiAgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvciBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc291cmNlLW1hcC1zdXBwb3J0JylcbiAqIHJlcXVpcmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpXG4gKi9cblxuXG5sZXQgYmxvY2tlZDogYW55W10gPSBbXTtcbmxldCBpc0Jsb2NrZWQgPSBmYWxzZTtcbmxldCB3ZWJwYWNrTWlkZGxld2FyZTogYW55O1xubGV0IHN1Y2Nlc3NDYjogKCkgPT4gdm9pZDtcbmxldCBmYWlsdXJlQ2I6ICgpID0+IHZvaWQ7XG5cbi8vIEFkZCBmaWxlcyB0byB0aGUgS2FybWEgZmlsZXMgYXJyYXkuXG5mdW5jdGlvbiBhZGRLYXJtYUZpbGVzKGZpbGVzOiBhbnlbXSwgbmV3RmlsZXM6IGFueVtdLCBwcmVwZW5kID0gZmFsc2UpIHtcbiAgY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgaW5jbHVkZWQ6IHRydWUsXG4gICAgc2VydmVkOiB0cnVlLFxuICAgIHdhdGNoZWQ6IHRydWVcbiAgfTtcblxuICBjb25zdCBwcm9jZXNzZWRGaWxlcyA9IG5ld0ZpbGVzXG4gICAgLy8gUmVtb3ZlIGdsb2JzIHRoYXQgZG8gbm90IG1hdGNoIGFueSBmaWxlcywgb3RoZXJ3aXNlIEthcm1hIHdpbGwgc2hvdyBhIHdhcm5pbmcgZm9yIHRoZXNlLlxuICAgIC5maWx0ZXIoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZS5wYXR0ZXJuLCB7IG5vZGlyOiB0cnVlIH0pLmxlbmd0aCAhPSAwKVxuICAgIC8vIEZpbGwgaW4gcGF0dGVybiBwcm9wZXJ0aWVzIHdpdGggZGVmYXVsdHMuXG4gICAgLm1hcChmaWxlID0+ICh7IC4uLmRlZmF1bHRzLCAuLi5maWxlIH0pKTtcblxuICAvLyBJdCdzIGltcG9ydGFudCB0byBub3QgcmVwbGFjZSB0aGUgYXJyYXksIGJlY2F1c2VcbiAgLy8ga2FybWEgYWxyZWFkeSBoYXMgYSByZWZlcmVuY2UgdG8gdGhlIGV4aXN0aW5nIGFycmF5LlxuICBpZiAocHJlcGVuZCkge1xuICAgIGZpbGVzLnVuc2hpZnQoLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVzLnB1c2goLi4ucHJvY2Vzc2VkRmlsZXMpO1xuICB9XG59XG5cbmNvbnN0IGluaXQ6IGFueSA9IChjb25maWc6IGFueSwgZW1pdHRlcjogYW55LCBjdXN0b21GaWxlSGFuZGxlcnM6IGFueSkgPT4ge1xuICBpZiAoIWNvbmZpZy5idWlsZFdlYnBhY2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScga2FybWEgcGx1Z2luIGlzIG1lYW50IHRvYCArXG4gICAgYCBiZSB1c2VkIGZyb20gd2l0aGluIEFuZ3VsYXIgQ0xJIGFuZCB3aWxsIG5vdCB3b3JrIGNvcnJlY3RseSBvdXRzaWRlIG9mIGl0LmBcbiAgICApXG4gIH1cbiAgY29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5idWlsZFdlYnBhY2sub3B0aW9ucztcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBjb25maWcuYnVpbGRXZWJwYWNrLnByb2plY3RSb290IGFzIHN0cmluZztcbiAgc3VjY2Vzc0NiID0gY29uZmlnLmJ1aWxkV2VicGFjay5zdWNjZXNzQ2I7XG4gIGZhaWx1cmVDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suZmFpbHVyZUNiO1xuXG4gIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJyk7XG5cbiAgLy8gV2hlbiB1c2luZyBjb2RlLWNvdmVyYWdlLCBhdXRvLWFkZCBjb3ZlcmFnZS1pc3RhbmJ1bC5cbiAgY29uZmlnLnJlcG9ydGVycyA9IGNvbmZpZy5yZXBvcnRlcnMgfHwgW107XG4gIGlmIChvcHRpb25zLmNvZGVDb3ZlcmFnZSAmJiBjb25maWcucmVwb3J0ZXJzLmluZGV4T2YoJ2NvdmVyYWdlLWlzdGFuYnVsJykgPT09IC0xKSB7XG4gICAgY29uZmlnLnJlcG9ydGVycy51bnNoaWZ0KCdjb3ZlcmFnZS1pc3RhbmJ1bCcpO1xuICB9XG5cbiAgLy8gQWRkIGEgcmVwb3J0ZXIgdGhhdCBmaXhlcyBzb3VyY2VtYXAgdXJscy5cbiAgaWYgKG9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgY29uZmlnLnJlcG9ydGVycy51bnNoaWZ0KCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJyk7XG5cbiAgICAvLyBDb2RlIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3RzY2hhdWIva2FybWEtc291cmNlLW1hcC1zdXBwb3J0LlxuICAgIC8vIFdlIGNhbid0IHVzZSBpdCBkaXJlY3RseSBiZWNhdXNlIHdlIG5lZWQgdG8gYWRkIGl0IGNvbmRpdGlvbmFsbHkgaW4gdGhpcyBmaWxlLCBhbmQga2FybWFcbiAgICAvLyBmcmFtZXdvcmtzIGNhbm5vdCBiZSBhZGRlZCBkeW5hbWljYWxseS5cbiAgICBjb25zdCBzbXNQYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1zdXBwb3J0JykpO1xuICAgIGNvbnN0IGtzbXNQYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgna2FybWEtc291cmNlLW1hcC1zdXBwb3J0JykpO1xuXG4gICAgYWRkS2FybWFGaWxlcyhjb25maWcuZmlsZXMsIFtcbiAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKHNtc1BhdGgsICdicm93c2VyLXNvdXJjZS1tYXAtc3VwcG9ydC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9LFxuICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oa3Ntc1BhdGgsICdjbGllbnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfVxuICAgIF0sIHRydWUpO1xuICB9XG5cbiAgLy8gQWRkIHdlYnBhY2sgY29uZmlnLlxuICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gY29uZmlnLmJ1aWxkV2VicGFjay53ZWJwYWNrQ29uZmlnO1xuICBjb25zdCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyA9IHtcbiAgICBsb2dMZXZlbDogJ2Vycm9yJywgLy8gSGlkZSB3ZWJwYWNrIG91dHB1dCBiZWNhdXNlIGl0cyBub2lzeS5cbiAgICB3YXRjaE9wdGlvbnM6IHsgcG9sbDogb3B0aW9ucy5wb2xsIH0sXG4gICAgcHVibGljUGF0aDogJy9fa2FybWFfd2VicGFja18vJyxcbiAgfTtcblxuICBjb25zdCBjb21waWxhdGlvbkVycm9yQ2IgPSAoZXJyb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgZXJyb3JzOiBzdHJpbmdbXSkgPT4ge1xuICAgIC8vIE5vdGlmeSBwb3RlbnRpYWwgbGlzdGVuZXJzIG9mIHRoZSBjb21waWxlIGVycm9yXG4gICAgZW1pdHRlci5lbWl0KCdjb21waWxlX2Vycm9yJywgZXJyb3JzKTtcblxuICAgIC8vIEZpbmlzaCBLYXJtYSBydW4gZWFybHkgaW4gY2FzZSBvZiBjb21waWxhdGlvbiBlcnJvci5cbiAgICBlbWl0dGVyLmVtaXQoJ3J1bl9jb21wbGV0ZScsIFtdLCB7IGV4aXRDb2RlOiAxIH0pO1xuXG4gICAgLy8gVW5ibG9jayBhbnkga2FybWEgcmVxdWVzdHMgKHBvdGVudGlhbGx5IHN0YXJ0ZWQgdXNpbmcgYGthcm1hIHJ1bmApXG4gICAgdW5ibG9jaygpO1xuICB9XG4gIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKG5ldyBLYXJtYVdlYnBhY2tGYWlsdXJlQ2IoY29tcGlsYXRpb25FcnJvckNiKSk7XG5cbiAgLy8gVXNlIGV4aXN0aW5nIGNvbmZpZyBpZiBhbnkuXG4gIGNvbmZpZy53ZWJwYWNrID0gT2JqZWN0LmFzc2lnbih3ZWJwYWNrQ29uZmlnLCBjb25maWcud2VicGFjayk7XG4gIGNvbmZpZy53ZWJwYWNrTWlkZGxld2FyZSA9IE9iamVjdC5hc3NpZ24od2VicGFja01pZGRsZXdhcmVDb25maWcsIGNvbmZpZy53ZWJwYWNrTWlkZGxld2FyZSk7XG5cbiAgLy8gT3VyIGN1c3RvbSBjb250ZXh0IGFuZCBkZWJ1ZyBmaWxlcyBsaXN0IHRoZSB3ZWJwYWNrIGJ1bmRsZXMgZGlyZWN0bHkgaW5zdGVhZCBvZiB1c2luZ1xuICAvLyB0aGUga2FybWEgZmlsZXMgYXJyYXkuXG4gIGNvbmZpZy5jdXN0b21Db250ZXh0RmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtY29udGV4dC5odG1sYDtcbiAgY29uZmlnLmN1c3RvbURlYnVnRmlsZSA9IGAke19fZGlybmFtZX0va2FybWEtZGVidWcuaHRtbGA7XG5cbiAgLy8gQWRkIHRoZSByZXF1ZXN0IGJsb2NrZXIgYW5kIHRoZSB3ZWJwYWNrIHNlcnZlciBmYWxsYmFjay5cbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUgPSBjb25maWcuYmVmb3JlTWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWJsb2NrZXInKTtcbiAgY29uZmlnLm1pZGRsZXdhcmUgPSBjb25maWcubWlkZGxld2FyZSB8fCBbXTtcbiAgY29uZmlnLm1pZGRsZXdhcmUucHVzaCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWZhbGxiYWNrJyk7XG5cbiAgLy8gRGVsZXRlIGdsb2JhbCBzdHlsZXMgZW50cnksIHdlIGRvbid0IHdhbnQgdG8gbG9hZCB0aGVtLlxuICBkZWxldGUgd2VicGFja0NvbmZpZy5lbnRyeS5zdHlsZXM7XG5cbiAgLy8gVGhlIHdlYnBhY2sgdGllciBvd25zIHRoZSB3YXRjaCBiZWhhdmlvciBzbyB3ZSB3YW50IHRvIGZvcmNlIGl0IGluIHRoZSBjb25maWcuXG4gIHdlYnBhY2tDb25maWcud2F0Y2ggPSAhY29uZmlnLnNpbmdsZVJ1bjtcbiAgaWYgKGNvbmZpZy5zaW5nbGVSdW4pIHtcbiAgICAvLyBUaGVyZSdzIG5vIG9wdGlvbiB0byB0dXJuIG9mZiBmaWxlIHdhdGNoaW5nIGluIHdlYnBhY2stZGV2LXNlcnZlciwgYnV0XG4gICAgLy8gd2UgY2FuIG92ZXJyaWRlIHRoZSBmaWxlIHdhdGNoZXIgaW5zdGVhZC5cbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMudW5zaGlmdCh7XG4gICAgICBhcHBseTogKGNvbXBpbGVyOiBhbnkpID0+IHsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2thcm1hJywgKCkgPT4ge1xuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHsgfSB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgLy8gRmlsZXMgbmVlZCB0byBiZSBzZXJ2ZWQgZnJvbSBhIGN1c3RvbSBwYXRoIGZvciBLYXJtYS5cbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnB1YmxpY1BhdGggPSAnL19rYXJtYV93ZWJwYWNrXy8nO1xuXG4gIGxldCBjb21waWxlcjogYW55O1xuICB0cnkge1xuICAgIGNvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZS5zdGFjayB8fCBlKTtcbiAgICBpZiAoZS5kZXRhaWxzKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUuZGV0YWlscyk7XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVyKGNhbGxiYWNrPzogKCkgPT4gdm9pZCkge1xuICAgIGlzQmxvY2tlZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfVxuXG4gIGNvbXBpbGVyLmhvb2tzLmludmFsaWQudGFwKCdrYXJtYScsICgpID0+IGhhbmRsZXIoKSk7XG5cbiAgY29tcGlsZXIuaG9va3Mud2F0Y2hSdW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICBjb21waWxlci5ob29rcy5ydW4udGFwQXN5bmMoJ2thcm1hJywgKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IGhhbmRsZXIoY2FsbGJhY2spKTtcblxuICBmdW5jdGlvbiB1bmJsb2NrKCl7XG4gICAgaXNCbG9ja2VkID0gZmFsc2U7XG4gICAgYmxvY2tlZC5mb3JFYWNoKChjYikgPT4gY2IoKSk7XG4gICAgYmxvY2tlZCA9IFtdO1xuICB9XG5cbiAgY29tcGlsZXIuaG9va3MuZG9uZS50YXAoJ2thcm1hJywgKHN0YXRzOiBhbnkpID0+IHtcbiAgICAvLyBEb24ndCByZWZyZXNoIGthcm1hIHdoZW4gdGhlcmUgYXJlIHdlYnBhY2sgZXJyb3JzLlxuICAgIGlmIChzdGF0cy5jb21waWxhdGlvbi5lcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBlbWl0dGVyLnJlZnJlc2hGaWxlcygpO1xuICAgIH1cbiAgICB1bmJsb2NrKCk7XG4gIH0pO1xuXG4gIHdlYnBhY2tNaWRkbGV3YXJlID0gbmV3IHdlYnBhY2tEZXZNaWRkbGV3YXJlKGNvbXBpbGVyLCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyk7XG5cbiAgLy8gRm9yd2FyZCByZXF1ZXN0cyB0byB3ZWJwYWNrIHNlcnZlci5cbiAgY3VzdG9tRmlsZUhhbmRsZXJzLnB1c2goe1xuICAgIHVybFJlZ2V4OiAvXlxcL19rYXJtYV93ZWJwYWNrX1xcLy4qLyxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBoYW5kbGVyKHJlcTogYW55LCByZXM6IGFueSkge1xuICAgICAgd2VicGFja01pZGRsZXdhcmUocmVxLCByZXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gRW5zdXJlIHNjcmlwdCBhbmQgc3R5bGUgYnVuZGxlcyBhcmUgc2VydmVkLlxuICAgICAgICAvLyBUaGV5IGFyZSBtZW50aW9uZWQgaW4gdGhlIGN1c3RvbSBrYXJtYSBjb250ZXh0IHBhZ2UgYW5kIHdlIGRvbid0IHdhbnQgdGhlbSB0byA0MDQuXG4gICAgICAgIGNvbnN0IGFsd2F5c1NlcnZlID0gW1xuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3J1bnRpbWUuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3BvbHlmaWxscy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vc2NyaXB0cy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vdmVuZG9yLmpzJyxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKGFsd2F5c1NlcnZlLmluZGV4T2YocmVxLnVybCkgIT0gLTEpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgICAgcmVzLmVuZCgnTm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgZW1pdHRlci5vbignZXhpdCcsIChkb25lOiBhbnkpID0+IHtcbiAgICB3ZWJwYWNrTWlkZGxld2FyZS5jbG9zZSgpO1xuICAgIGRvbmUoKTtcbiAgfSk7XG59O1xuXG5pbml0LiRpbmplY3QgPSBbJ2NvbmZpZycsICdlbWl0dGVyJywgJ2N1c3RvbUZpbGVIYW5kbGVycyddO1xuXG4vLyBCbG9jayByZXF1ZXN0cyB1bnRpbCB0aGUgV2VicGFjayBjb21waWxhdGlvbiBpcyBkb25lLlxuZnVuY3Rpb24gcmVxdWVzdEJsb2NrZXIoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoX3JlcXVlc3Q6IGFueSwgX3Jlc3BvbnNlOiBhbnksIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICBibG9ja2VkLnB1c2gobmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIEVtaXRzIGJ1aWxkZXIgZXZlbnRzLlxuY29uc3QgZXZlbnRSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIHRoaXMub25SdW5Db21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcnM6IGFueSwgcmVzdWx0czogYW55KSB7XG4gICAgaWYgKHJlc3VsdHMuZXhpdENvZGUgPT09IDApIHtcbiAgICAgIHN1Y2Nlc3NDYiAmJiBzdWNjZXNzQ2IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFpbHVyZUNiICYmIGZhaWx1cmVDYigpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGF2b2lkIGR1cGxpY2F0ZSBmYWlsdXJlIG1lc3NhZ2VcbiAgdGhpcy5zcGVjRmFpbHVyZSA9ICgpID0+IHt9O1xufTtcblxuZXZlbnRSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InXTtcblxuLy8gU3RyaXAgdGhlIHNlcnZlciBhZGRyZXNzIGFuZCB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG5jb25zdCBzb3VyY2VNYXBSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBjb25zdCByZXBvcnRlck5hbWUgPSAnQGFuZ3VsYXIvY2xpJztcbiAgY29uc3QgaGFzVHJhaWxpbmdSZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzLnNsaWNlKC0xKS5wb3AoKSAhPT0gcmVwb3J0ZXJOYW1lO1xuXG4gIC8vIENvcGllZCBmcm9tIFwia2FybWEtamFzbWluZS1kaWZmLXJlcG9ydGVyXCIgc291cmNlIGNvZGU6XG4gIC8vIEluIGNhc2UsIHdoZW4gbXVsdGlwbGUgcmVwb3J0ZXJzIGFyZSB1c2VkIGluIGNvbmp1bmN0aW9uXG4gIC8vIHdpdGggaW5pdFNvdXJjZW1hcFJlcG9ydGVyLCB0aGV5IGJvdGggd2lsbCBzaG93IHJlcGV0aXRpdmUgbG9nXG4gIC8vIG1lc3NhZ2VzIHdoZW4gZGlzcGxheWluZyBldmVyeXRoaW5nIHRoYXQgc3VwcG9zZWQgdG8gd3JpdGUgdG8gdGVybWluYWwuXG4gIC8vIFNvIGp1c3Qgc3VwcHJlc3MgYW55IGxvZ3MgZnJvbSBpbml0U291cmNlbWFwUmVwb3J0ZXIgYnkgZG9pbmcgbm90aGluZyBvblxuICAvLyBicm93c2VyIGxvZywgYmVjYXVzZSBpdCBpcyBhbiB1dGlsaXR5IHJlcG9ydGVyLFxuICAvLyB1bmxlc3MgaXQncyBhbG9uZSBpbiB0aGUgXCJyZXBvcnRlcnNcIiBvcHRpb24gYW5kIGJhc2UgcmVwb3J0ZXIgaXMgdXNlZC5cbiAgaWYgKGhhc1RyYWlsaW5nUmVwb3J0ZXJzKSB7XG4gICAgdGhpcy53cml0ZUNvbW1vbk1zZyA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgfVxuXG4gIGNvbnN0IHVybFJlZ2V4cCA9IC9cXChodHRwOlxcL1xcL2xvY2FsaG9zdDpcXGQrXFwvX2thcm1hX3dlYnBhY2tfXFwvd2VicGFjazpcXC8vZ2k7XG5cbiAgdGhpcy5vblNwZWNDb21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcjogYW55LCByZXN1bHQ6IGFueSkge1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LmxvZy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQubG9nLmZvckVhY2goKGxvZzogc3RyaW5nLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICByZXN1bHQubG9nW2lkeF0gPSBsb2cucmVwbGFjZSh1cmxSZWdleHAsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICAvLyBhdm9pZCBkdXBsaWNhdGUgY29tcGxldGUgbWVzc2FnZVxuICB0aGlzLm9uUnVuQ29tcGxldGUgPSAoKSA9PiB7fTtcblxuICAvLyBhdm9pZCBkdXBsaWNhdGUgZmFpbHVyZSBtZXNzYWdlXG4gIHRoaXMuc3BlY0ZhaWx1cmUgPSAoKSA9PiB7fTtcbn07XG5cbnNvdXJjZU1hcFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gV2hlbiBhIHJlcXVlc3QgaXMgbm90IGZvdW5kIGluIHRoZSBrYXJtYSBzZXJ2ZXIsIHRyeSBsb29raW5nIGZvciBpdCBmcm9tIHRoZSB3ZWJwYWNrIHNlcnZlciByb290LlxuZnVuY3Rpb24gZmFsbGJhY2tNaWRkbGV3YXJlKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHJlcTogYW55LCByZXM6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmICh3ZWJwYWNrTWlkZGxld2FyZSkge1xuICAgICAgY29uc3Qgd2VicGFja1VybCA9ICcvX2thcm1hX3dlYnBhY2tfJyArIHJlcS51cmw7XG4gICAgICBjb25zdCB3ZWJwYWNrUmVxID0geyAuLi5yZXEsIHVybDogd2VicGFja1VybCB9XG4gICAgICB3ZWJwYWNrTWlkZGxld2FyZSh3ZWJwYWNrUmVxLCByZXMsIG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ2ZyYW1ld29yazpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcic6IFsnZmFjdG9yeScsIGluaXRdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcic6IFsndHlwZScsIHNvdXJjZU1hcFJlcG9ydGVyXSxcbiAgJ3JlcG9ydGVyOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcic6IFsndHlwZScsIGV2ZW50UmVwb3J0ZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcic6IFsnZmFjdG9yeScsIHJlcXVlc3RCbG9ja2VyXSxcbiAgJ21pZGRsZXdhcmU6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWZhbGxiYWNrJzogWydmYWN0b3J5JywgZmFsbGJhY2tNaWRkbGV3YXJlXVxufTtcbiJdfQ==