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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFHL0QseUVBQW1FO0FBRW5FOzs7Ozs7R0FNRztBQUdILElBQUksT0FBTyxHQUFVLEVBQUUsQ0FBQztBQUN4QixJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxpQkFBc0IsQ0FBQztBQUMzQixJQUFJLFNBQXFCLENBQUM7QUFDMUIsSUFBSSxTQUFxQixDQUFDO0FBRTFCLHNDQUFzQztBQUN0Qyx1QkFBdUIsS0FBWSxFQUFFLFFBQWUsRUFBRSxPQUFPLEdBQUcsS0FBSztJQUNuRSxNQUFNLFFBQVEsR0FBRztRQUNmLFFBQVEsRUFBRSxJQUFJO1FBQ2QsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7SUFFRixNQUFNLGNBQWMsR0FBRyxRQUFRO1NBRTVCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7U0FFcEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQU0sUUFBUSxFQUFLLElBQUksRUFBRyxDQUFDLENBQUM7SUFFM0MsbURBQW1EO0lBQ25ELHVEQUF1RDtJQUN2RCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osS0FBSyxDQUFDLE9B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Q0FBQztRQUNULENBQUM7SUFDSCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxDQUFDLE9BQU8sR0FBRztJQUNmLHlDQUF5QyxFQUFFLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQztJQUM1RCw0REFBNEQsRUFBRSxDQUFDLE1BQU0sRUFBRSxpQkFBaUIsQ0FBQztJQUN6Rix3REFBd0QsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUM7SUFDakYsbURBQW1ELEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDO0lBQ2hGLG9EQUFvRCxFQUFFLENBQUMsU0FBUyxFQUFFLGtCQUFrQixDQUFDO0NBQ3RGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmNvbnN0IHdlYnBhY2tEZXZNaWRkbGV3YXJlID0gcmVxdWlyZSgnd2VicGFjay1kZXYtbWlkZGxld2FyZScpO1xuXG5pbXBvcnQgeyBBc3NldFBhdHRlcm4gfSBmcm9tICcuLi8uLi9icm93c2VyJztcbmltcG9ydCB7IEthcm1hV2VicGFja0ZhaWx1cmVDYiB9IGZyb20gJy4va2FybWEtd2VicGFjay1mYWlsdXJlLWNiJztcblxuLyoqXG4gKiBFbnVtZXJhdGUgbmVlZGVkIChidXQgbm90IHJlcXVpcmUvaW1wb3J0ZWQpIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZVxuICogIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpXG4gKiByZXF1aXJlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKVxuICovXG5cblxubGV0IGJsb2NrZWQ6IGFueVtdID0gW107XG5sZXQgaXNCbG9ja2VkID0gZmFsc2U7XG5sZXQgd2VicGFja01pZGRsZXdhcmU6IGFueTtcbmxldCBzdWNjZXNzQ2I6ICgpID0+IHZvaWQ7XG5sZXQgZmFpbHVyZUNiOiAoKSA9PiB2b2lkO1xuXG4vLyBBZGQgZmlsZXMgdG8gdGhlIEthcm1hIGZpbGVzIGFycmF5LlxuZnVuY3Rpb24gYWRkS2FybWFGaWxlcyhmaWxlczogYW55W10sIG5ld0ZpbGVzOiBhbnlbXSwgcHJlcGVuZCA9IGZhbHNlKSB7XG4gIGNvbnN0IGRlZmF1bHRzID0ge1xuICAgIGluY2x1ZGVkOiB0cnVlLFxuICAgIHNlcnZlZDogdHJ1ZSxcbiAgICB3YXRjaGVkOiB0cnVlXG4gIH07XG5cbiAgY29uc3QgcHJvY2Vzc2VkRmlsZXMgPSBuZXdGaWxlc1xuICAgIC8vIFJlbW92ZSBnbG9icyB0aGF0IGRvIG5vdCBtYXRjaCBhbnkgZmlsZXMsIG90aGVyd2lzZSBLYXJtYSB3aWxsIHNob3cgYSB3YXJuaW5nIGZvciB0aGVzZS5cbiAgICAuZmlsdGVyKGZpbGUgPT4gZ2xvYi5zeW5jKGZpbGUucGF0dGVybiwgeyBub2RpcjogdHJ1ZSB9KS5sZW5ndGggIT0gMClcbiAgICAvLyBGaWxsIGluIHBhdHRlcm4gcHJvcGVydGllcyB3aXRoIGRlZmF1bHRzLlxuICAgIC5tYXAoZmlsZSA9PiAoeyAuLi5kZWZhdWx0cywgLi4uZmlsZSB9KSk7XG5cbiAgLy8gSXQncyBpbXBvcnRhbnQgdG8gbm90IHJlcGxhY2UgdGhlIGFycmF5LCBiZWNhdXNlXG4gIC8vIGthcm1hIGFscmVhZHkgaGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBleGlzdGluZyBhcnJheS5cbiAgaWYgKHByZXBlbmQpIHtcbiAgICBmaWxlcy51bnNoaWZ0KC4uLnByb2Nlc3NlZEZpbGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlcy5wdXNoKC4uLnByb2Nlc3NlZEZpbGVzKTtcbiAgfVxufVxuXG5jb25zdCBpbml0OiBhbnkgPSAoY29uZmlnOiBhbnksIGVtaXR0ZXI6IGFueSwgY3VzdG9tRmlsZUhhbmRsZXJzOiBhbnkpID0+IHtcbiAgY29uc3Qgb3B0aW9ucyA9IGNvbmZpZy5idWlsZFdlYnBhY2sub3B0aW9ucztcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBjb25maWcuYnVpbGRXZWJwYWNrLnByb2plY3RSb290IGFzIHN0cmluZztcbiAgc3VjY2Vzc0NiID0gY29uZmlnLmJ1aWxkV2VicGFjay5zdWNjZXNzQ2I7XG4gIGZhaWx1cmVDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suZmFpbHVyZUNiO1xuXG4gIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJyk7XG4gIC8vIEFkZCBhIHJlcG9ydGVyIHRoYXQgZml4ZXMgc291cmNlbWFwIHVybHMuXG4gIGlmIChvcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMudW5zaGlmdCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcicpO1xuXG4gICAgLy8gQ29kZSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS90c2NoYXViL2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydC5cbiAgICAvLyBXZSBjYW4ndCB1c2UgaXQgZGlyZWN0bHkgYmVjYXVzZSB3ZSBuZWVkIHRvIGFkZCBpdCBjb25kaXRpb25hbGx5IGluIHRoaXMgZmlsZSwgYW5kIGthcm1hXG4gICAgLy8gZnJhbWV3b3JrcyBjYW5ub3QgYmUgYWRkZWQgZHluYW1pY2FsbHkuXG4gICAgY29uc3Qgc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpKTtcbiAgICBjb25zdCBrc21zUGF0aCA9IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ2thcm1hLXNvdXJjZS1tYXAtc3VwcG9ydCcpKTtcblxuICAgIGFkZEthcm1hRmlsZXMoY29uZmlnLmZpbGVzLCBbXG4gICAgICB7IHBhdHRlcm46IHBhdGguam9pbihzbXNQYXRoLCAnYnJvd3Nlci1zb3VyY2UtbWFwLXN1cHBvcnQuanMnKSwgd2F0Y2hlZDogZmFsc2UgfSxcbiAgICAgIHsgcGF0dGVybjogcGF0aC5qb2luKGtzbXNQYXRoLCAnY2xpZW50LmpzJyksIHdhdGNoZWQ6IGZhbHNlIH1cbiAgICBdLCB0cnVlKTtcbiAgfVxuXG4gIC8vIEFkZCB3ZWJwYWNrIGNvbmZpZy5cbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGNvbmZpZy5idWlsZFdlYnBhY2sud2VicGFja0NvbmZpZztcbiAgY29uc3Qgd2VicGFja01pZGRsZXdhcmVDb25maWcgPSB7XG4gICAgbG9nTGV2ZWw6ICdlcnJvcicsIC8vIEhpZGUgd2VicGFjayBvdXRwdXQgYmVjYXVzZSBpdHMgbm9pc3kuXG4gICAgd2F0Y2hPcHRpb25zOiB7IHBvbGw6IG9wdGlvbnMucG9sbCB9LFxuICAgIHB1YmxpY1BhdGg6ICcvX2thcm1hX3dlYnBhY2tfLycsXG4gIH07XG5cbiAgLy8gRmluaXNoIEthcm1hIHJ1biBlYXJseSBpbiBjYXNlIG9mIGNvbXBpbGF0aW9uIGVycm9yLlxuICBjb25zdCBjb21waWxhdGlvbkVycm9yQ2IgPSAoKSA9PiBlbWl0dGVyLmVtaXQoJ3J1bl9jb21wbGV0ZScsIFtdLCB7IGV4aXRDb2RlOiAxIH0pO1xuICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgS2FybWFXZWJwYWNrRmFpbHVyZUNiKGNvbXBpbGF0aW9uRXJyb3JDYikpO1xuXG4gIC8vIFVzZSBleGlzdGluZyBjb25maWcgaWYgYW55LlxuICBjb25maWcud2VicGFjayA9IE9iamVjdC5hc3NpZ24od2VicGFja0NvbmZpZywgY29uZmlnLndlYnBhY2spO1xuICBjb25maWcud2VicGFja01pZGRsZXdhcmUgPSBPYmplY3QuYXNzaWduKHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnLCBjb25maWcud2VicGFja01pZGRsZXdhcmUpO1xuXG4gIC8vIFdoZW4gdXNpbmcgY29kZS1jb3ZlcmFnZSwgYXV0by1hZGQgY292ZXJhZ2UtaXN0YW5idWwuXG4gIGNvbmZpZy5yZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzIHx8IFtdO1xuICBpZiAob3B0aW9ucy5jb2RlQ292ZXJhZ2UgJiYgY29uZmlnLnJlcG9ydGVycy5pbmRleE9mKCdjb3ZlcmFnZS1pc3RhbmJ1bCcpID09PSAtMSkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMucHVzaCgnY292ZXJhZ2UtaXN0YW5idWwnKTtcbiAgfVxuXG4gIC8vIE91ciBjdXN0b20gY29udGV4dCBhbmQgZGVidWcgZmlsZXMgbGlzdCB0aGUgd2VicGFjayBidW5kbGVzIGRpcmVjdGx5IGluc3RlYWQgb2YgdXNpbmdcbiAgLy8gdGhlIGthcm1hIGZpbGVzIGFycmF5LlxuICBjb25maWcuY3VzdG9tQ29udGV4dEZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWNvbnRleHQuaHRtbGA7XG4gIGNvbmZpZy5jdXN0b21EZWJ1Z0ZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWRlYnVnLmh0bWxgO1xuXG4gIC8vIEFkZCB0aGUgcmVxdWVzdCBibG9ja2VyIGFuZCB0aGUgd2VicGFjayBzZXJ2ZXIgZmFsbGJhY2suXG4gIGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlID0gY29uZmlnLmJlZm9yZU1pZGRsZXdhcmUgfHwgW107XG4gIGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlLnB1c2goJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJyk7XG4gIGNvbmZpZy5taWRkbGV3YXJlID0gY29uZmlnLm1pZGRsZXdhcmUgfHwgW107XG4gIGNvbmZpZy5taWRkbGV3YXJlLnB1c2goJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1mYWxsYmFjaycpO1xuXG4gIC8vIERlbGV0ZSBnbG9iYWwgc3R5bGVzIGVudHJ5LCB3ZSBkb24ndCB3YW50IHRvIGxvYWQgdGhlbS5cbiAgZGVsZXRlIHdlYnBhY2tDb25maWcuZW50cnkuc3R5bGVzO1xuXG4gIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICB3ZWJwYWNrQ29uZmlnLndhdGNoID0gb3B0aW9ucy53YXRjaDtcbiAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgICAgIGNvbXBpbGVyLnBsdWdpbignYWZ0ZXItZW52aXJvbm1lbnQnLCAoKSA9PiB7XG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICAvLyBGaWxlcyBuZWVkIHRvIGJlIHNlcnZlZCBmcm9tIGEgY3VzdG9tIHBhdGggZm9yIEthcm1hLlxuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5wYXRoID0gJy9fa2FybWFfd2VicGFja18vJztcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucHVibGljUGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG5cbiAgbGV0IGNvbXBpbGVyOiBhbnk7XG4gIHRyeSB7XG4gICAgY29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihlLnN0YWNrIHx8IGUpO1xuICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5kZXRhaWxzKTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIFsnaW52YWxpZCcsICd3YXRjaC1ydW4nLCAncnVuJ10uZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgIGNvbXBpbGVyLnBsdWdpbihuYW1lLCBmdW5jdGlvbiAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgICAgaXNCbG9ja2VkID0gdHJ1ZTtcblxuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICBjb21waWxlci5wbHVnaW4oJ2RvbmUnLCAoc3RhdHM6IGFueSkgPT4ge1xuICAgIC8vIERvbid0IHJlZnJlc2gga2FybWEgd2hlbiB0aGVyZSBhcmUgd2VicGFjayBlcnJvcnMuXG4gICAgaWYgKHN0YXRzLmNvbXBpbGF0aW9uLmVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVtaXR0ZXIucmVmcmVzaEZpbGVzKCk7XG4gICAgICBpc0Jsb2NrZWQgPSBmYWxzZTtcbiAgICAgIGJsb2NrZWQuZm9yRWFjaCgoY2IpID0+IGNiKCkpO1xuICAgICAgYmxvY2tlZCA9IFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgd2VicGFja01pZGRsZXdhcmUgPSBuZXcgd2VicGFja0Rldk1pZGRsZXdhcmUoY29tcGlsZXIsIHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnKTtcblxuICAvLyBGb3J3YXJkIHJlcXVlc3RzIHRvIHdlYnBhY2sgc2VydmVyLlxuICBjdXN0b21GaWxlSGFuZGxlcnMucHVzaCh7XG4gICAgdXJsUmVnZXg6IC9eXFwvX2thcm1hX3dlYnBhY2tfXFwvLiovLFxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uIGhhbmRsZXIocmVxOiBhbnksIHJlczogYW55KSB7XG4gICAgICB3ZWJwYWNrTWlkZGxld2FyZShyZXEsIHJlcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBFbnN1cmUgc2NyaXB0IGFuZCBzdHlsZSBidW5kbGVzIGFyZSBzZXJ2ZWQuXG4gICAgICAgIC8vIFRoZXkgYXJlIG1lbnRpb25lZCBpbiB0aGUgY3VzdG9tIGthcm1hIGNvbnRleHQgcGFnZSBhbmQgd2UgZG9uJ3Qgd2FudCB0aGVtIHRvIDQwNC5cbiAgICAgICAgY29uc3QgYWx3YXlzU2VydmUgPSBbXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vcnVudGltZS5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vcG9seWZpbGxzLmpzJyxcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy9zY3JpcHRzLmpzJyxcbiAgICAgICAgICAnL19rYXJtYV93ZWJwYWNrXy92ZW5kb3IuanMnLFxuICAgICAgICBdO1xuICAgICAgICBpZiAoYWx3YXlzU2VydmUuaW5kZXhPZihyZXEudXJsKSAhPSAtMSkge1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNDtcbiAgICAgICAgICByZXMuZW5kKCdOb3QgZm91bmQnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICBlbWl0dGVyLm9uKCdleGl0JywgKGRvbmU6IGFueSkgPT4ge1xuICAgIHdlYnBhY2tNaWRkbGV3YXJlLmNsb3NlKCk7XG4gICAgZG9uZSgpO1xuICB9KTtcbn07XG5cbmluaXQuJGluamVjdCA9IFsnY29uZmlnJywgJ2VtaXR0ZXInLCAnY3VzdG9tRmlsZUhhbmRsZXJzJ107XG5cbi8vIEJsb2NrIHJlcXVlc3RzIHVudGlsIHRoZSBXZWJwYWNrIGNvbXBpbGF0aW9uIGlzIGRvbmUuXG5mdW5jdGlvbiByZXF1ZXN0QmxvY2tlcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChfcmVxdWVzdDogYW55LCBfcmVzcG9uc2U6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmIChpc0Jsb2NrZWQpIHtcbiAgICAgIGJsb2NrZWQucHVzaChuZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gRW1pdHMgYnVpbGRlciBldmVudHMuXG5jb25zdCBldmVudFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSkge1xuICBiYXNlUmVwb3J0ZXJEZWNvcmF0b3IodGhpcyk7XG5cbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyczogYW55LCByZXN1bHRzOiBhbnkpIHtcbiAgICBpZiAocmVzdWx0cy5leGl0Q29kZSA9PT0gMCkge1xuICAgICAgc3VjY2Vzc0NiICYmIHN1Y2Nlc3NDYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmYWlsdXJlQ2IgJiYgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9XG59O1xuXG5ldmVudFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvciddO1xuXG4vLyBTdHJpcCB0aGUgc2VydmVyIGFkZHJlc3MgYW5kIHdlYnBhY2sgc2NoZW1lICh3ZWJwYWNrOi8vKSBmcm9tIGVycm9yIGxvZy5cbmNvbnN0IHNvdXJjZU1hcFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIGNvbnN0IHJlcG9ydGVyTmFtZSA9ICdAYW5ndWxhci9jbGknO1xuICBjb25zdCBoYXNUcmFpbGluZ1JlcG9ydGVycyA9IGNvbmZpZy5yZXBvcnRlcnMuc2xpY2UoLTEpLnBvcCgpICE9PSByZXBvcnRlck5hbWU7XG5cbiAgLy8gQ29waWVkIGZyb20gXCJrYXJtYS1qYXNtaW5lLWRpZmYtcmVwb3J0ZXJcIiBzb3VyY2UgY29kZTpcbiAgLy8gSW4gY2FzZSwgd2hlbiBtdWx0aXBsZSByZXBvcnRlcnMgYXJlIHVzZWQgaW4gY29uanVuY3Rpb25cbiAgLy8gd2l0aCBpbml0U291cmNlbWFwUmVwb3J0ZXIsIHRoZXkgYm90aCB3aWxsIHNob3cgcmVwZXRpdGl2ZSBsb2dcbiAgLy8gbWVzc2FnZXMgd2hlbiBkaXNwbGF5aW5nIGV2ZXJ5dGhpbmcgdGhhdCBzdXBwb3NlZCB0byB3cml0ZSB0byB0ZXJtaW5hbC5cbiAgLy8gU28ganVzdCBzdXBwcmVzcyBhbnkgbG9ncyBmcm9tIGluaXRTb3VyY2VtYXBSZXBvcnRlciBieSBkb2luZyBub3RoaW5nIG9uXG4gIC8vIGJyb3dzZXIgbG9nLCBiZWNhdXNlIGl0IGlzIGFuIHV0aWxpdHkgcmVwb3J0ZXIsXG4gIC8vIHVubGVzcyBpdCdzIGFsb25lIGluIHRoZSBcInJlcG9ydGVyc1wiIG9wdGlvbiBhbmQgYmFzZSByZXBvcnRlciBpcyB1c2VkLlxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICB0aGlzLndyaXRlQ29tbW9uTXNnID0gZnVuY3Rpb24gKCkgeyB9O1xuICB9XG5cbiAgY29uc3QgdXJsUmVnZXhwID0gL1xcKGh0dHA6XFwvXFwvbG9jYWxob3N0OlxcZCtcXC9fa2FybWFfd2VicGFja19cXC93ZWJwYWNrOlxcLy9naTtcblxuICB0aGlzLm9uU3BlY0NvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyOiBhbnksIHJlc3VsdDogYW55KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQubG9nLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5sb2cuZm9yRWFjaCgobG9nOiBzdHJpbmcsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgIHJlc3VsdC5sb2dbaWR4XSA9IGxvZy5yZXBsYWNlKHVybFJlZ2V4cCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xufTtcblxuc291cmNlTWFwUmVwb3J0ZXIuJGluamVjdCA9IFsnYmFzZVJlcG9ydGVyRGVjb3JhdG9yJywgJ2NvbmZpZyddO1xuXG4vLyBXaGVuIGEgcmVxdWVzdCBpcyBub3QgZm91bmQgaW4gdGhlIGthcm1hIHNlcnZlciwgdHJ5IGxvb2tpbmcgZm9yIGl0IGZyb20gdGhlIHdlYnBhY2sgc2VydmVyIHJvb3QuXG5mdW5jdGlvbiBmYWxsYmFja01pZGRsZXdhcmUoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAocmVxOiBhbnksIHJlczogYW55LCBuZXh0OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKHdlYnBhY2tNaWRkbGV3YXJlKSB7XG4gICAgICBjb25zdCB3ZWJwYWNrVXJsID0gJy9fa2FybWFfd2VicGFja18nICsgcmVxLnVybDtcbiAgICAgIGNvbnN0IHdlYnBhY2tSZXEgPSB7IC4uLnJlcSwgdXJsOiB3ZWJwYWNrVXJsIH1cbiAgICAgIHdlYnBhY2tNaWRkbGV3YXJlKHdlYnBhY2tSZXEsIHJlcywgbmV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnZnJhbWV3b3JrOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJzogWydmYWN0b3J5JywgaW5pdF0sXG4gICdyZXBvcnRlcjpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tc291cmNlbWFwLXJlcG9ydGVyJzogWyd0eXBlJywgc291cmNlTWFwUmVwb3J0ZXJdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLWV2ZW50LXJlcG9ydGVyJzogWyd0eXBlJywgZXZlbnRSZXBvcnRlcl0sXG4gICdtaWRkbGV3YXJlOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ibG9ja2VyJzogWydmYWN0b3J5JywgcmVxdWVzdEJsb2NrZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tZmFsbGJhY2snOiBbJ2ZhY3RvcnknLCBmYWxsYmFja01pZGRsZXdhcmVdXG59O1xuIl19