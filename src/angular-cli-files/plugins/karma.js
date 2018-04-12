"use strict";
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
    const options = config.buildWebpack.options;
    const projectRoot = config.buildWebpack.projectRoot;
    successCb = config.buildWebpack.successCb;
    failureCb = config.buildWebpack.failureCb;
    config.reporters.unshift('@angular-devkit/build-angular--event-reporter');
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
    // Finish Karma run early in case of compilation error.
    const compilationErrorCb = () => emitter.emit('run_complete', [], { exitCode: 1 });
    webpackConfig.plugins.push(new karma_webpack_failure_cb_1.KarmaWebpackFailureCb(compilationErrorCb));
    // Use existing config if any.
    config.webpack = Object.assign(webpackConfig, config.webpack);
    config.webpackMiddleware = Object.assign(webpackMiddlewareConfig, config.webpackMiddleware);
    // When using code-coverage, auto-add coverage-istanbul.
    config.reporters = config.reporters || [];
    if (options.codeCoverage && config.reporters.indexOf('coverage-istanbul') === -1) {
        config.reporters.push('coverage-istanbul');
    }
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
    webpackConfig.watch = options.watch;
    if (!options.watch) {
        // There's no option to turn off file watching in webpack-dev-server, but
        // we can override the file watcher instead.
        webpackConfig.plugins.unshift({
            apply: (compiler) => {
                compiler.plugin('after-environment', () => {
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
    ['invalid', 'watch-run', 'run'].forEach(function (name) {
        compiler.plugin(name, function (_, callback) {
            isBlocked = true;
            if (typeof callback === 'function') {
                callback();
            }
        });
    });
    compiler.plugin('done', (stats) => {
        // Don't refresh karma when there are webpack errors.
        if (stats.compilation.errors.length === 0) {
            emitter.refreshFiles();
            isBlocked = false;
            blocked.forEach((cb) => cb());
            blocked = [];
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0Qyx1QkFBdUIsS0FBWSxFQUFFLFFBQWUsRUFBRSxPQUFPLEdBQUcsS0FBSztJQUNuRSxNQUFNLFFBQVEsR0FBRztRQUNmLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7SUFFRixNQUFNLGNBQWMsR0FBRyxRQUFRO1NBRTVCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7U0FFcEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQU0sUUFBUSxFQUFLLElBQUksRUFBRyxDQUFDLENBQUM7SUFFM0MsbURBQW1EO0lBQ25ELHVEQUF1RDtJQUN2RCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNOLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQztJQUNoQyxDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sSUFBSSxHQUFRLENBQUMsTUFBVyxFQUFFLE9BQVksRUFBRSxrQkFBdUIsRUFBRSxFQUFFO0lBQ3ZFLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBQzVDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsV0FBcUIsQ0FBQztJQUM5RCxTQUFTLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFDMUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDO0lBRTFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLCtDQUErQyxDQUFDLENBQUM7SUFDMUUsNENBQTRDO0lBQzVDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFFOUUsdUVBQXVFO1FBQ3ZFLDJGQUEyRjtRQUMzRiwwQ0FBMEM7UUFDMUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUNwRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1FBRTNFLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFO1lBQzFCLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLCtCQUErQixDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTtZQUNoRixFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO1NBQzlELEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQsc0JBQXNCO0lBQ3RCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDO0lBQ3hELE1BQU0sdUJBQXVCLEdBQUc7UUFDOUIsUUFBUSxFQUFFLE9BQU87UUFDakIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUU7UUFDcEMsVUFBVSxFQUFFLG1CQUFtQjtLQUNoQyxDQUFDO0lBRUYsdURBQXVEO0lBQ3ZELE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkYsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxnREFBcUIsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7SUFFMUUsOEJBQThCO0lBQzlCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlELE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLHVCQUF1QixFQUFFLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBRTVGLHdEQUF3RDtJQUN4RCxNQUFNLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDO0lBQzFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakYsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRUQsd0ZBQXdGO0lBQ3hGLHlCQUF5QjtJQUN6QixNQUFNLENBQUMsaUJBQWlCLEdBQUcsR0FBRyxTQUFTLHFCQUFxQixDQUFDO0lBQzdELE1BQU0sQ0FBQyxlQUFlLEdBQUcsR0FBRyxTQUFTLG1CQUFtQixDQUFDO0lBRXpELDJEQUEyRDtJQUMzRCxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixJQUFJLEVBQUUsQ0FBQztJQUN4RCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxDQUFDLENBQUM7SUFDdkUsTUFBTSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztJQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0lBRWxFLDBEQUEwRDtJQUMxRCxPQUFPLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBRWxDLGlGQUFpRjtJQUNqRixhQUFhLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDcEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNuQix5RUFBeUU7UUFDekUsNENBQTRDO1FBQzVDLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1lBQzVCLEtBQUssRUFBRSxDQUFDLFFBQWEsRUFBRSxFQUFFO2dCQUN2QixRQUFRLENBQUMsTUFBTSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsRUFBRTtvQkFDeEMsUUFBUSxDQUFDLGVBQWUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELHdEQUF3RDtJQUN4RCxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksR0FBRyxtQkFBbUIsQ0FBQztJQUNoRCxhQUFhLENBQUMsTUFBTSxDQUFDLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQztJQUV0RCxJQUFJLFFBQWEsQ0FBQztJQUNsQixJQUFJLENBQUM7UUFDSCxRQUFRLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1gsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzVCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2QsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUNELE1BQU0sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztJQUVELENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJO1FBQ3BELFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBTSxFQUFFLFFBQW9CO1lBQzFELFNBQVMsR0FBRyxJQUFJLENBQUM7WUFFakIsRUFBRSxDQUFDLENBQUMsT0FBTyxRQUFRLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsUUFBUSxFQUFFLENBQUM7WUFDYixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBVSxFQUFFLEVBQUU7UUFDckMscURBQXFEO1FBQ3JELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN2QixTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDOUIsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILGlCQUFpQixHQUFHLElBQUksb0JBQW9CLENBQUMsUUFBUSxFQUFFLHVCQUF1QixDQUFDLENBQUM7SUFFaEYsc0NBQXNDO0lBQ3RDLGtCQUFrQixDQUFDLElBQUksQ0FBQztRQUN0QixRQUFRLEVBQUUsd0JBQXdCO1FBQ2xDLE9BQU8sRUFBRSxpQkFBaUIsR0FBUSxFQUFFLEdBQVE7WUFDMUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtnQkFDMUIsOENBQThDO2dCQUM5QyxxRkFBcUY7Z0JBQ3JGLE1BQU0sV0FBVyxHQUFHO29CQUNsQiw2QkFBNkI7b0JBQzdCLCtCQUErQjtvQkFDL0IsNkJBQTZCO29CQUM3Qiw0QkFBNEI7aUJBQzdCLENBQUM7Z0JBQ0YsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN2QyxHQUFHLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQztvQkFDckIsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNaLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7b0JBQ3JCLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3ZCLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDLENBQUM7SUFFSCxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQVMsRUFBRSxFQUFFO1FBQy9CLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzFCLElBQUksRUFBRSxDQUFDO0lBQ1QsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUM7QUFFRixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0FBRTNELHdEQUF3RDtBQUN4RDtJQUNFLE1BQU0sQ0FBQyxVQUFVLFFBQWEsRUFBRSxTQUFjLEVBQUUsSUFBZ0I7UUFDOUQsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNkLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxFQUFFLENBQUM7UUFDVCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELHdCQUF3QjtBQUN4QixNQUFNLGFBQWEsR0FBUSxVQUFxQixxQkFBMEI7SUFDeEUscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFNUIsSUFBSSxDQUFDLGFBQWEsR0FBRyxVQUFVLFNBQWMsRUFBRSxPQUFZO1FBQ3pELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixTQUFTLElBQUksU0FBUyxFQUFFLENBQUM7UUFDM0IsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sU0FBUyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQzNCLENBQUM7SUFDSCxDQUFDLENBQUE7QUFDSCxDQUFDLENBQUM7QUFFRixhQUFhLENBQUMsT0FBTyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUVsRCwyRUFBMkU7QUFDM0UsTUFBTSxpQkFBaUIsR0FBUSxVQUFxQixxQkFBMEIsRUFBRSxNQUFXO0lBQ3pGLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTVCLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQztJQUNwQyxNQUFNLG9CQUFvQixHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssWUFBWSxDQUFDO0lBRS9FLHlEQUF5RDtJQUN6RCwyREFBMkQ7SUFDM0QsaUVBQWlFO0lBQ2pFLDBFQUEwRTtJQUMxRSwyRUFBMkU7SUFDM0Usa0RBQWtEO0lBQ2xELHlFQUF5RTtJQUN6RSxFQUFFLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsTUFBTSxTQUFTLEdBQUcseURBQXlELENBQUM7SUFFNUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxVQUFVLFFBQWEsRUFBRSxNQUFXO1FBQ3hELEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBVyxFQUFFLEdBQVcsRUFBRSxFQUFFO2dCQUM5QyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGLGlCQUFpQixDQUFDLE9BQU8sR0FBRyxDQUFDLHVCQUF1QixFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRWhFLG9HQUFvRztBQUNwRztJQUNFLE1BQU0sQ0FBQyxVQUFVLEdBQVEsRUFBRSxHQUFRLEVBQUUsSUFBZ0I7UUFDbkQsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLE1BQU0sVUFBVSxHQUFHLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUM7WUFDaEQsTUFBTSxVQUFVLHFCQUFRLEdBQUcsSUFBRSxHQUFHLEVBQUUsVUFBVSxHQUFFLENBQUE7WUFDOUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLEVBQUUsQ0FBQztRQUNULENBQUM7SUFDSCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxDQUFDLE9BQU8sR0FBRztJQUNmLHlDQUF5QyxFQUFFLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQztJQUM1RCw0REFBNEQsRUFBRSxDQUFDLE1BQU0sRUFBRSxpQkFBaUIsQ0FBQztJQUN6Rix3REFBd0QsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUM7SUFDakYsbURBQW1ELEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDO0lBQ2hGLG9EQUFvRCxFQUFFLENBQUMsU0FBUyxFQUFFLGtCQUFrQixDQUFDO0NBQ3RGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmNvbnN0IHdlYnBhY2tEZXZNaWRkbGV3YXJlID0gcmVxdWlyZSgnd2VicGFjay1kZXYtbWlkZGxld2FyZScpO1xuXG5pbXBvcnQgeyBBc3NldFBhdHRlcm4gfSBmcm9tICcuLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBLYXJtYVdlYnBhY2tGYWlsdXJlQ2IgfSBmcm9tICcuL2thcm1hLXdlYnBhY2stZmFpbHVyZS1jYic7XG5cbi8qKlxuICogRW51bWVyYXRlIG5lZWRlZCAoYnV0IG5vdCByZXF1aXJlL2ltcG9ydGVkKSBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGVcbiAqICB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKVxuICogcmVxdWlyZSgna2FybWEtc291cmNlLW1hcC1zdXBwb3J0JylcbiAqL1xuXG5cbmxldCBibG9ja2VkOiBhbnlbXSA9IFtdO1xubGV0IGlzQmxvY2tlZCA9IGZhbHNlO1xubGV0IHdlYnBhY2tNaWRkbGV3YXJlOiBhbnk7XG5sZXQgc3VjY2Vzc0NiOiAoKSA9PiB2b2lkO1xubGV0IGZhaWx1cmVDYjogKCkgPT4gdm9pZDtcblxuLy8gQWRkIGZpbGVzIHRvIHRoZSBLYXJtYSBmaWxlcyBhcnJheS5cbmZ1bmN0aW9uIGFkZEthcm1hRmlsZXMoZmlsZXM6IGFueVtdLCBuZXdGaWxlczogYW55W10sIHByZXBlbmQgPSBmYWxzZSkge1xuICBjb25zdCBkZWZhdWx0cyA9IHtcbiAgICBpbmNsdWRlZDogdHJ1ZSxcbiAgICBzZXJ2ZWQ6IHRydWUsXG4gICAgd2F0Y2hlZDogdHJ1ZVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NlZEZpbGVzID0gbmV3RmlsZXNcbiAgICAvLyBSZW1vdmUgZ2xvYnMgdGhhdCBkbyBub3QgbWF0Y2ggYW55IGZpbGVzLCBvdGhlcndpc2UgS2FybWEgd2lsbCBzaG93IGEgd2FybmluZyBmb3IgdGhlc2UuXG4gICAgLmZpbHRlcihmaWxlID0+IGdsb2Iuc3luYyhmaWxlLnBhdHRlcm4sIHsgbm9kaXI6IHRydWUgfSkubGVuZ3RoICE9IDApXG4gICAgLy8gRmlsbCBpbiBwYXR0ZXJuIHByb3BlcnRpZXMgd2l0aCBkZWZhdWx0cy5cbiAgICAubWFwKGZpbGUgPT4gKHsgLi4uZGVmYXVsdHMsIC4uLmZpbGUgfSkpO1xuXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIG5vdCByZXBsYWNlIHRoZSBhcnJheSwgYmVjYXVzZVxuICAvLyBrYXJtYSBhbHJlYWR5IGhhcyBhIHJlZmVyZW5jZSB0byB0aGUgZXhpc3RpbmcgYXJyYXkuXG4gIGlmIChwcmVwZW5kKSB7XG4gICAgZmlsZXMudW5zaGlmdCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZXMucHVzaCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH1cbn1cblxuY29uc3QgaW5pdDogYW55ID0gKGNvbmZpZzogYW55LCBlbWl0dGVyOiBhbnksIGN1c3RvbUZpbGVIYW5kbGVyczogYW55KSA9PiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBjb25maWcuYnVpbGRXZWJwYWNrLm9wdGlvbnM7XG4gIGNvbnN0IHByb2plY3RSb290ID0gY29uZmlnLmJ1aWxkV2VicGFjay5wcm9qZWN0Um9vdCBhcyBzdHJpbmc7XG4gIHN1Y2Nlc3NDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suc3VjY2Vzc0NiO1xuICBmYWlsdXJlQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLmZhaWx1cmVDYjtcblxuICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcicpO1xuICAvLyBBZGQgYSByZXBvcnRlciB0aGF0IGZpeGVzIHNvdXJjZW1hcCB1cmxzLlxuICBpZiAob3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInKTtcblxuICAgIC8vIENvZGUgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdHNjaGF1Yi9rYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQuXG4gICAgLy8gV2UgY2FuJ3QgdXNlIGl0IGRpcmVjdGx5IGJlY2F1c2Ugd2UgbmVlZCB0byBhZGQgaXQgY29uZGl0aW9uYWxseSBpbiB0aGlzIGZpbGUsIGFuZCBrYXJtYVxuICAgIC8vIGZyYW1ld29ya3MgY2Fubm90IGJlIGFkZGVkIGR5bmFtaWNhbGx5LlxuICAgIGNvbnN0IHNtc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG4gICAgY29uc3Qga3Ntc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG5cbiAgICBhZGRLYXJtYUZpbGVzKGNvbmZpZy5maWxlcywgW1xuICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oc21zUGF0aCwgJ2Jyb3dzZXItc291cmNlLW1hcC1zdXBwb3J0LmpzJyksIHdhdGNoZWQ6IGZhbHNlIH0sXG4gICAgICB7IHBhdHRlcm46IHBhdGguam9pbihrc21zUGF0aCwgJ2NsaWVudC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9XG4gICAgXSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBBZGQgd2VicGFjayBjb25maWcuXG4gIGNvbnN0IHdlYnBhY2tDb25maWcgPSBjb25maWcuYnVpbGRXZWJwYWNrLndlYnBhY2tDb25maWc7XG4gIGNvbnN0IHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnID0ge1xuICAgIGxvZ0xldmVsOiAnZXJyb3InLCAvLyBIaWRlIHdlYnBhY2sgb3V0cHV0IGJlY2F1c2UgaXRzIG5vaXN5LlxuICAgIHdhdGNoT3B0aW9uczogeyBwb2xsOiBvcHRpb25zLnBvbGwgfSxcbiAgICBwdWJsaWNQYXRoOiAnL19rYXJtYV93ZWJwYWNrXy8nLFxuICB9O1xuXG4gIC8vIEZpbmlzaCBLYXJtYSBydW4gZWFybHkgaW4gY2FzZSBvZiBjb21waWxhdGlvbiBlcnJvci5cbiAgY29uc3QgY29tcGlsYXRpb25FcnJvckNiID0gKCkgPT4gZW1pdHRlci5lbWl0KCdydW5fY29tcGxldGUnLCBbXSwgeyBleGl0Q29kZTogMSB9KTtcbiAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IEthcm1hV2VicGFja0ZhaWx1cmVDYihjb21waWxhdGlvbkVycm9yQ2IpKTtcblxuICAvLyBVc2UgZXhpc3RpbmcgY29uZmlnIGlmIGFueS5cbiAgY29uZmlnLndlYnBhY2sgPSBPYmplY3QuYXNzaWduKHdlYnBhY2tDb25maWcsIGNvbmZpZy53ZWJwYWNrKTtcbiAgY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlID0gT2JqZWN0LmFzc2lnbih3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZywgY29uZmlnLndlYnBhY2tNaWRkbGV3YXJlKTtcblxuICAvLyBXaGVuIHVzaW5nIGNvZGUtY292ZXJhZ2UsIGF1dG8tYWRkIGNvdmVyYWdlLWlzdGFuYnVsLlxuICBjb25maWcucmVwb3J0ZXJzID0gY29uZmlnLnJlcG9ydGVycyB8fCBbXTtcbiAgaWYgKG9wdGlvbnMuY29kZUNvdmVyYWdlICYmIGNvbmZpZy5yZXBvcnRlcnMuaW5kZXhPZignY292ZXJhZ2UtaXN0YW5idWwnKSA9PT0gLTEpIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnB1c2goJ2NvdmVyYWdlLWlzdGFuYnVsJyk7XG4gIH1cblxuICAvLyBPdXIgY3VzdG9tIGNvbnRleHQgYW5kIGRlYnVnIGZpbGVzIGxpc3QgdGhlIHdlYnBhY2sgYnVuZGxlcyBkaXJlY3RseSBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIHRoZSBrYXJtYSBmaWxlcyBhcnJheS5cbiAgY29uZmlnLmN1c3RvbUNvbnRleHRGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1jb250ZXh0Lmh0bWxgO1xuICBjb25maWcuY3VzdG9tRGVidWdGaWxlID0gYCR7X19kaXJuYW1lfS9rYXJtYS1kZWJ1Zy5odG1sYDtcblxuICAvLyBBZGQgdGhlIHJlcXVlc3QgYmxvY2tlciBhbmQgdGhlIHdlYnBhY2sgc2VydmVyIGZhbGxiYWNrLlxuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZSA9IGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcicpO1xuICBjb25maWcubWlkZGxld2FyZSA9IGNvbmZpZy5taWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcubWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snKTtcblxuICAvLyBEZWxldGUgZ2xvYmFsIHN0eWxlcyBlbnRyeSwgd2UgZG9uJ3Qgd2FudCB0byBsb2FkIHRoZW0uXG4gIGRlbGV0ZSB3ZWJwYWNrQ29uZmlnLmVudHJ5LnN0eWxlcztcblxuICAvLyBUaGUgd2VicGFjayB0aWVyIG93bnMgdGhlIHdhdGNoIGJlaGF2aW9yIHNvIHdlIHdhbnQgdG8gZm9yY2UgaXQgaW4gdGhlIGNvbmZpZy5cbiAgd2VicGFja0NvbmZpZy53YXRjaCA9IG9wdGlvbnMud2F0Y2g7XG4gIGlmICghb3B0aW9ucy53YXRjaCkge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4geyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgICAgICBjb21waWxlci5wbHVnaW4oJ2FmdGVyLWVudmlyb25tZW50JywgKCkgPT4ge1xuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHsgfSB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgLy8gRmlsZXMgbmVlZCB0byBiZSBzZXJ2ZWQgZnJvbSBhIGN1c3RvbSBwYXRoIGZvciBLYXJtYS5cbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG4gIHdlYnBhY2tDb25maWcub3V0cHV0LnB1YmxpY1BhdGggPSAnL19rYXJtYV93ZWJwYWNrXy8nO1xuXG4gIGxldCBjb21waWxlcjogYW55O1xuICB0cnkge1xuICAgIGNvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZS5zdGFjayB8fCBlKTtcbiAgICBpZiAoZS5kZXRhaWxzKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUuZGV0YWlscyk7XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cblxuICBbJ2ludmFsaWQnLCAnd2F0Y2gtcnVuJywgJ3J1biddLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBjb21waWxlci5wbHVnaW4obmFtZSwgZnVuY3Rpb24gKF86IGFueSwgY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICAgIGlzQmxvY2tlZCA9IHRydWU7XG5cbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgY29tcGlsZXIucGx1Z2luKCdkb25lJywgKHN0YXRzOiBhbnkpID0+IHtcbiAgICAvLyBEb24ndCByZWZyZXNoIGthcm1hIHdoZW4gdGhlcmUgYXJlIHdlYnBhY2sgZXJyb3JzLlxuICAgIGlmIChzdGF0cy5jb21waWxhdGlvbi5lcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBlbWl0dGVyLnJlZnJlc2hGaWxlcygpO1xuICAgICAgaXNCbG9ja2VkID0gZmFsc2U7XG4gICAgICBibG9ja2VkLmZvckVhY2goKGNiKSA9PiBjYigpKTtcbiAgICAgIGJsb2NrZWQgPSBbXTtcbiAgICB9XG4gIH0pO1xuXG4gIHdlYnBhY2tNaWRkbGV3YXJlID0gbmV3IHdlYnBhY2tEZXZNaWRkbGV3YXJlKGNvbXBpbGVyLCB3ZWJwYWNrTWlkZGxld2FyZUNvbmZpZyk7XG5cbiAgLy8gRm9yd2FyZCByZXF1ZXN0cyB0byB3ZWJwYWNrIHNlcnZlci5cbiAgY3VzdG9tRmlsZUhhbmRsZXJzLnB1c2goe1xuICAgIHVybFJlZ2V4OiAvXlxcL19rYXJtYV93ZWJwYWNrX1xcLy4qLyxcbiAgICBoYW5kbGVyOiBmdW5jdGlvbiBoYW5kbGVyKHJlcTogYW55LCByZXM6IGFueSkge1xuICAgICAgd2VicGFja01pZGRsZXdhcmUocmVxLCByZXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gRW5zdXJlIHNjcmlwdCBhbmQgc3R5bGUgYnVuZGxlcyBhcmUgc2VydmVkLlxuICAgICAgICAvLyBUaGV5IGFyZSBtZW50aW9uZWQgaW4gdGhlIGN1c3RvbSBrYXJtYSBjb250ZXh0IHBhZ2UgYW5kIHdlIGRvbid0IHdhbnQgdGhlbSB0byA0MDQuXG4gICAgICAgIGNvbnN0IGFsd2F5c1NlcnZlID0gW1xuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3J1bnRpbWUuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3BvbHlmaWxscy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vc2NyaXB0cy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vdmVuZG9yLmpzJyxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKGFsd2F5c1NlcnZlLmluZGV4T2YocmVxLnVybCkgIT0gLTEpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgICAgcmVzLmVuZCgnTm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgZW1pdHRlci5vbignZXhpdCcsIChkb25lOiBhbnkpID0+IHtcbiAgICB3ZWJwYWNrTWlkZGxld2FyZS5jbG9zZSgpO1xuICAgIGRvbmUoKTtcbiAgfSk7XG59O1xuXG5pbml0LiRpbmplY3QgPSBbJ2NvbmZpZycsICdlbWl0dGVyJywgJ2N1c3RvbUZpbGVIYW5kbGVycyddO1xuXG4vLyBCbG9jayByZXF1ZXN0cyB1bnRpbCB0aGUgV2VicGFjayBjb21waWxhdGlvbiBpcyBkb25lLlxuZnVuY3Rpb24gcmVxdWVzdEJsb2NrZXIoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoX3JlcXVlc3Q6IGFueSwgX3Jlc3BvbnNlOiBhbnksIG5leHQ6ICgpID0+IHZvaWQpIHtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICBibG9ja2VkLnB1c2gobmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIEVtaXRzIGJ1aWxkZXIgZXZlbnRzLlxuY29uc3QgZXZlbnRSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIHRoaXMub25SdW5Db21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcnM6IGFueSwgcmVzdWx0czogYW55KSB7XG4gICAgaWYgKHJlc3VsdHMuZXhpdENvZGUgPT09IDApIHtcbiAgICAgIHN1Y2Nlc3NDYiAmJiBzdWNjZXNzQ2IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFpbHVyZUNiICYmIGZhaWx1cmVDYigpO1xuICAgIH1cbiAgfVxufTtcblxuZXZlbnRSZXBvcnRlci4kaW5qZWN0ID0gWydiYXNlUmVwb3J0ZXJEZWNvcmF0b3InXTtcblxuLy8gU3RyaXAgdGhlIHNlcnZlciBhZGRyZXNzIGFuZCB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG5jb25zdCBzb3VyY2VNYXBSZXBvcnRlcjogYW55ID0gZnVuY3Rpb24gKHRoaXM6IGFueSwgYmFzZVJlcG9ydGVyRGVjb3JhdG9yOiBhbnksIGNvbmZpZzogYW55KSB7XG4gIGJhc2VSZXBvcnRlckRlY29yYXRvcih0aGlzKTtcblxuICBjb25zdCByZXBvcnRlck5hbWUgPSAnQGFuZ3VsYXIvY2xpJztcbiAgY29uc3QgaGFzVHJhaWxpbmdSZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzLnNsaWNlKC0xKS5wb3AoKSAhPT0gcmVwb3J0ZXJOYW1lO1xuXG4gIC8vIENvcGllZCBmcm9tIFwia2FybWEtamFzbWluZS1kaWZmLXJlcG9ydGVyXCIgc291cmNlIGNvZGU6XG4gIC8vIEluIGNhc2UsIHdoZW4gbXVsdGlwbGUgcmVwb3J0ZXJzIGFyZSB1c2VkIGluIGNvbmp1bmN0aW9uXG4gIC8vIHdpdGggaW5pdFNvdXJjZW1hcFJlcG9ydGVyLCB0aGV5IGJvdGggd2lsbCBzaG93IHJlcGV0aXRpdmUgbG9nXG4gIC8vIG1lc3NhZ2VzIHdoZW4gZGlzcGxheWluZyBldmVyeXRoaW5nIHRoYXQgc3VwcG9zZWQgdG8gd3JpdGUgdG8gdGVybWluYWwuXG4gIC8vIFNvIGp1c3Qgc3VwcHJlc3MgYW55IGxvZ3MgZnJvbSBpbml0U291cmNlbWFwUmVwb3J0ZXIgYnkgZG9pbmcgbm90aGluZyBvblxuICAvLyBicm93c2VyIGxvZywgYmVjYXVzZSBpdCBpcyBhbiB1dGlsaXR5IHJlcG9ydGVyLFxuICAvLyB1bmxlc3MgaXQncyBhbG9uZSBpbiB0aGUgXCJyZXBvcnRlcnNcIiBvcHRpb24gYW5kIGJhc2UgcmVwb3J0ZXIgaXMgdXNlZC5cbiAgaWYgKGhhc1RyYWlsaW5nUmVwb3J0ZXJzKSB7XG4gICAgdGhpcy53cml0ZUNvbW1vbk1zZyA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgfVxuXG4gIGNvbnN0IHVybFJlZ2V4cCA9IC9cXChodHRwOlxcL1xcL2xvY2FsaG9zdDpcXGQrXFwvX2thcm1hX3dlYnBhY2tfXFwvd2VicGFjazpcXC8vZ2k7XG5cbiAgdGhpcy5vblNwZWNDb21wbGV0ZSA9IGZ1bmN0aW9uIChfYnJvd3NlcjogYW55LCByZXN1bHQ6IGFueSkge1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LmxvZy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQubG9nLmZvckVhY2goKGxvZzogc3RyaW5nLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICByZXN1bHQubG9nW2lkeF0gPSBsb2cucmVwbGFjZSh1cmxSZWdleHAsICcnKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn07XG5cbnNvdXJjZU1hcFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvcicsICdjb25maWcnXTtcblxuLy8gV2hlbiBhIHJlcXVlc3QgaXMgbm90IGZvdW5kIGluIHRoZSBrYXJtYSBzZXJ2ZXIsIHRyeSBsb29raW5nIGZvciBpdCBmcm9tIHRoZSB3ZWJwYWNrIHNlcnZlciByb290LlxuZnVuY3Rpb24gZmFsbGJhY2tNaWRkbGV3YXJlKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHJlcTogYW55LCByZXM6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmICh3ZWJwYWNrTWlkZGxld2FyZSkge1xuICAgICAgY29uc3Qgd2VicGFja1VybCA9ICcvX2thcm1hX3dlYnBhY2tfJyArIHJlcS51cmw7XG4gICAgICBjb25zdCB3ZWJwYWNrUmVxID0geyAuLi5yZXEsIHVybDogd2VicGFja1VybCB9XG4gICAgICB3ZWJwYWNrTWlkZGxld2FyZSh3ZWJwYWNrUmVxLCByZXMsIG5leHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0KCk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ2ZyYW1ld29yazpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcic6IFsnZmFjdG9yeScsIGluaXRdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcic6IFsndHlwZScsIHNvdXJjZU1hcFJlcG9ydGVyXSxcbiAgJ3JlcG9ydGVyOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcic6IFsndHlwZScsIGV2ZW50UmVwb3J0ZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcic6IFsnZmFjdG9yeScsIHJlcXVlc3RCbG9ja2VyXSxcbiAgJ21pZGRsZXdhcmU6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWZhbGxiYWNrJzogWydmYWN0b3J5JywgZmFsbGJhY2tNaWRkbGV3YXJlXVxufTtcbiJdfQ==