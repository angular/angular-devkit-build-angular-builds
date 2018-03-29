"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
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
    // Add assets. This logic is mimics the one present in GlobCopyWebpackPlugin, but proxies
    // asset requests to the Webpack server.
    if (options.assets) {
        config.proxies = config.proxies || {};
        options.assets.forEach((pattern) => {
            // TODO: use smart defaults in schema to do this instead.
            // Default input to be projectRoot.
            pattern.input = pattern.input || projectRoot;
            // Determine Karma proxy path.
            let proxyPath;
            if (fs.existsSync(path.join(pattern.input, pattern.glob))) {
                proxyPath = path.join(pattern.output, pattern.glob);
            }
            else {
                // For globs (paths that don't exist), proxy pattern.output to pattern.input.
                proxyPath = path.join(pattern.output);
            }
            // Proxy paths must have only forward slashes.
            proxyPath = proxyPath.replace(/\\/g, '/');
            config.proxies['/' + proxyPath] = '/_karma_webpack_/' + proxyPath;
        });
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
    // Add the request blocker.
    config.beforeMiddleware = config.beforeMiddleware || [];
    config.beforeMiddleware.push('@angular-devkit/build-angular--blocker');
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
    const middleware = new webpackDevMiddleware(compiler, webpackMiddlewareConfig);
    // Forward requests to webpack server.
    customFileHandlers.push({
        urlRegex: /^\/_karma_webpack_\/.*/,
        handler: function handler(req, res) {
            middleware(req, res, function () {
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
        middleware.close();
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
module.exports = {
    'framework:@angular-devkit/build-angular': ['factory', init],
    'reporter:@angular-devkit/build-angular--sourcemap-reporter': ['type', sourceMapReporter],
    'reporter:@angular-devkit/build-angular--event-reporter': ['type', eventReporter],
    'middleware:@angular-devkit/build-angular--blocker': ['factory', requestBlocker]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2FybWEuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMva2FybWEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBRS9ELDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLG1DQUFtQztBQUNuQyxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBRy9ELHlFQUFtRTtBQUVuRTs7Ozs7O0dBTUc7QUFHSCxJQUFJLE9BQU8sR0FBVSxFQUFFLENBQUM7QUFDeEIsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBQ3RCLElBQUksU0FBcUIsQ0FBQztBQUMxQixJQUFJLFNBQXFCLENBQUM7QUFFMUIsc0NBQXNDO0FBQ3RDLHVCQUF1QixLQUFZLEVBQUUsUUFBZSxFQUFFLE9BQU8sR0FBRyxLQUFLO0lBQ25FLE1BQU0sUUFBUSxHQUFHO1FBQ2YsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsSUFBSTtRQUNaLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztJQUVGLE1BQU0sY0FBYyxHQUFHLFFBQVE7U0FFNUIsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztTQUVwRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQkFBTSxRQUFRLEVBQUssSUFBSSxFQUFHLENBQUMsQ0FBQztJQUUzQyxtREFBbUQ7SUFDbkQsdURBQXVEO0lBQ3ZELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDWixLQUFLLENBQUMsT0FBTyxDQUFDLEdB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eEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFXLEVBQUUsR0FBVyxFQUFFLEVBQUU7Z0JBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDL0MsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRUYsaUJBQWlCLENBQUMsT0FBTyxHQUFHLENBQUMsdUJBQXVCLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFaEUsTUFBTSxDQUFDLE9BQU8sR0FBRztJQUNmLHlDQUF5QyxFQUFFLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQztJQUM1RCw0REFBNEQsRUFBRSxDQUFDLE1BQU0sRUFBRSxpQkFBaUIsQ0FBQztJQUN6Rix3REFBd0QsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUM7SUFDakYsbURBQW1ELEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDO0NBQ2pGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmNvbnN0IHdlYnBhY2tEZXZNaWRkbGV3YXJlID0gcmVxdWlyZSgnd2VicGFjay1kZXYtbWlkZGxld2FyZScpO1xuXG5pbXBvcnQgeyBBc3NldFBhdHRlcm4gfSBmcm9tICcuLi9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IEthcm1hV2VicGFja0ZhaWx1cmVDYiB9IGZyb20gJy4va2FybWEtd2VicGFjay1mYWlsdXJlLWNiJztcblxuLyoqXG4gKiBFbnVtZXJhdGUgbmVlZGVkIChidXQgbm90IHJlcXVpcmUvaW1wb3J0ZWQpIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZVxuICogIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpXG4gKiByZXF1aXJlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKVxuICovXG5cblxubGV0IGJsb2NrZWQ6IGFueVtdID0gW107XG5sZXQgaXNCbG9ja2VkID0gZmFsc2U7XG5sZXQgc3VjY2Vzc0NiOiAoKSA9PiB2b2lkO1xubGV0IGZhaWx1cmVDYjogKCkgPT4gdm9pZDtcblxuLy8gQWRkIGZpbGVzIHRvIHRoZSBLYXJtYSBmaWxlcyBhcnJheS5cbmZ1bmN0aW9uIGFkZEthcm1hRmlsZXMoZmlsZXM6IGFueVtdLCBuZXdGaWxlczogYW55W10sIHByZXBlbmQgPSBmYWxzZSkge1xuICBjb25zdCBkZWZhdWx0cyA9IHtcbiAgICBpbmNsdWRlZDogdHJ1ZSxcbiAgICBzZXJ2ZWQ6IHRydWUsXG4gICAgd2F0Y2hlZDogdHJ1ZVxuICB9O1xuXG4gIGNvbnN0IHByb2Nlc3NlZEZpbGVzID0gbmV3RmlsZXNcbiAgICAvLyBSZW1vdmUgZ2xvYnMgdGhhdCBkbyBub3QgbWF0Y2ggYW55IGZpbGVzLCBvdGhlcndpc2UgS2FybWEgd2lsbCBzaG93IGEgd2FybmluZyBmb3IgdGhlc2UuXG4gICAgLmZpbHRlcihmaWxlID0+IGdsb2Iuc3luYyhmaWxlLnBhdHRlcm4sIHsgbm9kaXI6IHRydWUgfSkubGVuZ3RoICE9IDApXG4gICAgLy8gRmlsbCBpbiBwYXR0ZXJuIHByb3BlcnRpZXMgd2l0aCBkZWZhdWx0cy5cbiAgICAubWFwKGZpbGUgPT4gKHsgLi4uZGVmYXVsdHMsIC4uLmZpbGUgfSkpO1xuXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIG5vdCByZXBsYWNlIHRoZSBhcnJheSwgYmVjYXVzZVxuICAvLyBrYXJtYSBhbHJlYWR5IGhhcyBhIHJlZmVyZW5jZSB0byB0aGUgZXhpc3RpbmcgYXJyYXkuXG4gIGlmIChwcmVwZW5kKSB7XG4gICAgZmlsZXMudW5zaGlmdCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZXMucHVzaCguLi5wcm9jZXNzZWRGaWxlcyk7XG4gIH1cbn1cblxuY29uc3QgaW5pdDogYW55ID0gKGNvbmZpZzogYW55LCBlbWl0dGVyOiBhbnksIGN1c3RvbUZpbGVIYW5kbGVyczogYW55KSA9PiB7XG4gIGNvbnN0IG9wdGlvbnMgPSBjb25maWcuYnVpbGRXZWJwYWNrLm9wdGlvbnM7XG4gIGNvbnN0IHByb2plY3RSb290ID0gY29uZmlnLmJ1aWxkV2VicGFjay5wcm9qZWN0Um9vdCBhcyBzdHJpbmc7XG4gIHN1Y2Nlc3NDYiA9IGNvbmZpZy5idWlsZFdlYnBhY2suc3VjY2Vzc0NiO1xuICBmYWlsdXJlQ2IgPSBjb25maWcuYnVpbGRXZWJwYWNrLmZhaWx1cmVDYjtcblxuICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcicpO1xuICAvLyBBZGQgYSByZXBvcnRlciB0aGF0IGZpeGVzIHNvdXJjZW1hcCB1cmxzLlxuICBpZiAob3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25maWcucmVwb3J0ZXJzLnVuc2hpZnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1zb3VyY2VtYXAtcmVwb3J0ZXInKTtcblxuICAgIC8vIENvZGUgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdHNjaGF1Yi9rYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQuXG4gICAgLy8gV2UgY2FuJ3QgdXNlIGl0IGRpcmVjdGx5IGJlY2F1c2Ugd2UgbmVlZCB0byBhZGQgaXQgY29uZGl0aW9uYWxseSBpbiB0aGlzIGZpbGUsIGFuZCBrYXJtYVxuICAgIC8vIGZyYW1ld29ya3MgY2Fubm90IGJlIGFkZGVkIGR5bmFtaWNhbGx5LlxuICAgIGNvbnN0IHNtc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG4gICAgY29uc3Qga3Ntc1BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdrYXJtYS1zb3VyY2UtbWFwLXN1cHBvcnQnKSk7XG5cbiAgICBhZGRLYXJtYUZpbGVzKGNvbmZpZy5maWxlcywgW1xuICAgICAgeyBwYXR0ZXJuOiBwYXRoLmpvaW4oc21zUGF0aCwgJ2Jyb3dzZXItc291cmNlLW1hcC1zdXBwb3J0LmpzJyksIHdhdGNoZWQ6IGZhbHNlIH0sXG4gICAgICB7IHBhdHRlcm46IHBhdGguam9pbihrc21zUGF0aCwgJ2NsaWVudC5qcycpLCB3YXRjaGVkOiBmYWxzZSB9XG4gICAgXSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBBZGQgYXNzZXRzLiBUaGlzIGxvZ2ljIGlzIG1pbWljcyB0aGUgb25lIHByZXNlbnQgaW4gR2xvYkNvcHlXZWJwYWNrUGx1Z2luLCBidXQgcHJveGllc1xuICAvLyBhc3NldCByZXF1ZXN0cyB0byB0aGUgV2VicGFjayBzZXJ2ZXIuXG4gIGlmIChvcHRpb25zLmFzc2V0cykge1xuICAgIGNvbmZpZy5wcm94aWVzID0gY29uZmlnLnByb3hpZXMgfHwge307XG4gICAgb3B0aW9ucy5hc3NldHMuZm9yRWFjaCgocGF0dGVybjogQXNzZXRQYXR0ZXJuKSA9PiB7XG4gICAgICAvLyBUT0RPOiB1c2Ugc21hcnQgZGVmYXVsdHMgaW4gc2NoZW1hIHRvIGRvIHRoaXMgaW5zdGVhZC5cbiAgICAgIC8vIERlZmF1bHQgaW5wdXQgdG8gYmUgcHJvamVjdFJvb3QuXG4gICAgICBwYXR0ZXJuLmlucHV0ID0gcGF0dGVybi5pbnB1dCB8fCBwcm9qZWN0Um9vdDtcblxuICAgICAgLy8gRGV0ZXJtaW5lIEthcm1hIHByb3h5IHBhdGguXG4gICAgICBsZXQgcHJveHlQYXRoOiBzdHJpbmc7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocGF0dGVybi5pbnB1dCwgcGF0dGVybi5nbG9iKSkpIHtcbiAgICAgICAgcHJveHlQYXRoID0gcGF0aC5qb2luKHBhdHRlcm4ub3V0cHV0LCBwYXR0ZXJuLmdsb2IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRm9yIGdsb2JzIChwYXRocyB0aGF0IGRvbid0IGV4aXN0KSwgcHJveHkgcGF0dGVybi5vdXRwdXQgdG8gcGF0dGVybi5pbnB1dC5cbiAgICAgICAgcHJveHlQYXRoID0gcGF0aC5qb2luKHBhdHRlcm4ub3V0cHV0KTtcbiAgICAgIH1cbiAgICAgIC8vIFByb3h5IHBhdGhzIG11c3QgaGF2ZSBvbmx5IGZvcndhcmQgc2xhc2hlcy5cbiAgICAgIHByb3h5UGF0aCA9IHByb3h5UGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBjb25maWcucHJveGllc1snLycgKyBwcm94eVBhdGhdID0gJy9fa2FybWFfd2VicGFja18vJyArIHByb3h5UGF0aDtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEFkZCB3ZWJwYWNrIGNvbmZpZy5cbiAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGNvbmZpZy5idWlsZFdlYnBhY2sud2VicGFja0NvbmZpZztcbiAgY29uc3Qgd2VicGFja01pZGRsZXdhcmVDb25maWcgPSB7XG4gICAgbG9nTGV2ZWw6ICdlcnJvcicsIC8vIEhpZGUgd2VicGFjayBvdXRwdXQgYmVjYXVzZSBpdHMgbm9pc3kuXG4gICAgd2F0Y2hPcHRpb25zOiB7IHBvbGw6IG9wdGlvbnMucG9sbCB9LFxuICAgIHB1YmxpY1BhdGg6ICcvX2thcm1hX3dlYnBhY2tfLycsXG4gIH07XG5cbiAgLy8gRmluaXNoIEthcm1hIHJ1biBlYXJseSBpbiBjYXNlIG9mIGNvbXBpbGF0aW9uIGVycm9yLlxuICBjb25zdCBjb21waWxhdGlvbkVycm9yQ2IgPSAoKSA9PiBlbWl0dGVyLmVtaXQoJ3J1bl9jb21wbGV0ZScsIFtdLCB7IGV4aXRDb2RlOiAxIH0pO1xuICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgS2FybWFXZWJwYWNrRmFpbHVyZUNiKGNvbXBpbGF0aW9uRXJyb3JDYikpO1xuXG4gIC8vIFVzZSBleGlzdGluZyBjb25maWcgaWYgYW55LlxuICBjb25maWcud2VicGFjayA9IE9iamVjdC5hc3NpZ24od2VicGFja0NvbmZpZywgY29uZmlnLndlYnBhY2spO1xuICBjb25maWcud2VicGFja01pZGRsZXdhcmUgPSBPYmplY3QuYXNzaWduKHdlYnBhY2tNaWRkbGV3YXJlQ29uZmlnLCBjb25maWcud2VicGFja01pZGRsZXdhcmUpO1xuXG4gIC8vIFdoZW4gdXNpbmcgY29kZS1jb3ZlcmFnZSwgYXV0by1hZGQgY292ZXJhZ2UtaXN0YW5idWwuXG4gIGNvbmZpZy5yZXBvcnRlcnMgPSBjb25maWcucmVwb3J0ZXJzIHx8IFtdO1xuICBpZiAob3B0aW9ucy5jb2RlQ292ZXJhZ2UgJiYgY29uZmlnLnJlcG9ydGVycy5pbmRleE9mKCdjb3ZlcmFnZS1pc3RhbmJ1bCcpID09PSAtMSkge1xuICAgIGNvbmZpZy5yZXBvcnRlcnMucHVzaCgnY292ZXJhZ2UtaXN0YW5idWwnKTtcbiAgfVxuXG4gIC8vIE91ciBjdXN0b20gY29udGV4dCBhbmQgZGVidWcgZmlsZXMgbGlzdCB0aGUgd2VicGFjayBidW5kbGVzIGRpcmVjdGx5IGluc3RlYWQgb2YgdXNpbmdcbiAgLy8gdGhlIGthcm1hIGZpbGVzIGFycmF5LlxuICBjb25maWcuY3VzdG9tQ29udGV4dEZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWNvbnRleHQuaHRtbGA7XG4gIGNvbmZpZy5jdXN0b21EZWJ1Z0ZpbGUgPSBgJHtfX2Rpcm5hbWV9L2thcm1hLWRlYnVnLmh0bWxgO1xuXG4gIC8vIEFkZCB0aGUgcmVxdWVzdCBibG9ja2VyLlxuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZSA9IGNvbmZpZy5iZWZvcmVNaWRkbGV3YXJlIHx8IFtdO1xuICBjb25maWcuYmVmb3JlTWlkZGxld2FyZS5wdXNoKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcicpO1xuXG4gIC8vIERlbGV0ZSBnbG9iYWwgc3R5bGVzIGVudHJ5LCB3ZSBkb24ndCB3YW50IHRvIGxvYWQgdGhlbS5cbiAgZGVsZXRlIHdlYnBhY2tDb25maWcuZW50cnkuc3R5bGVzO1xuXG4gIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICB3ZWJwYWNrQ29uZmlnLndhdGNoID0gb3B0aW9ucy53YXRjaDtcbiAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgICAgIGNvbXBpbGVyLnBsdWdpbignYWZ0ZXItZW52aXJvbm1lbnQnLCAoKSA9PiB7XG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICAvLyBGaWxlcyBuZWVkIHRvIGJlIHNlcnZlZCBmcm9tIGEgY3VzdG9tIHBhdGggZm9yIEthcm1hLlxuICB3ZWJwYWNrQ29uZmlnLm91dHB1dC5wYXRoID0gJy9fa2FybWFfd2VicGFja18vJztcbiAgd2VicGFja0NvbmZpZy5vdXRwdXQucHVibGljUGF0aCA9ICcvX2thcm1hX3dlYnBhY2tfLyc7XG5cbiAgbGV0IGNvbXBpbGVyOiBhbnk7XG4gIHRyeSB7XG4gICAgY29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihlLnN0YWNrIHx8IGUpO1xuICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5kZXRhaWxzKTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIFsnaW52YWxpZCcsICd3YXRjaC1ydW4nLCAncnVuJ10uZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgIGNvbXBpbGVyLnBsdWdpbihuYW1lLCBmdW5jdGlvbiAoXzogYW55LCBjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgICAgaXNCbG9ja2VkID0gdHJ1ZTtcblxuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICBjb21waWxlci5wbHVnaW4oJ2RvbmUnLCAoc3RhdHM6IGFueSkgPT4ge1xuICAgIC8vIERvbid0IHJlZnJlc2gga2FybWEgd2hlbiB0aGVyZSBhcmUgd2VicGFjayBlcnJvcnMuXG4gICAgaWYgKHN0YXRzLmNvbXBpbGF0aW9uLmVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVtaXR0ZXIucmVmcmVzaEZpbGVzKCk7XG4gICAgICBpc0Jsb2NrZWQgPSBmYWxzZTtcbiAgICAgIGJsb2NrZWQuZm9yRWFjaCgoY2IpID0+IGNiKCkpO1xuICAgICAgYmxvY2tlZCA9IFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgbWlkZGxld2FyZSA9IG5ldyB3ZWJwYWNrRGV2TWlkZGxld2FyZShjb21waWxlciwgd2VicGFja01pZGRsZXdhcmVDb25maWcpO1xuXG4gIC8vIEZvcndhcmQgcmVxdWVzdHMgdG8gd2VicGFjayBzZXJ2ZXIuXG4gIGN1c3RvbUZpbGVIYW5kbGVycy5wdXNoKHtcbiAgICB1cmxSZWdleDogL15cXC9fa2FybWFfd2VicGFja19cXC8uKi8sXG4gICAgaGFuZGxlcjogZnVuY3Rpb24gaGFuZGxlcihyZXE6IGFueSwgcmVzOiBhbnkpIHtcbiAgICAgIG1pZGRsZXdhcmUocmVxLCByZXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gRW5zdXJlIHNjcmlwdCBhbmQgc3R5bGUgYnVuZGxlcyBhcmUgc2VydmVkLlxuICAgICAgICAvLyBUaGV5IGFyZSBtZW50aW9uZWQgaW4gdGhlIGN1c3RvbSBrYXJtYSBjb250ZXh0IHBhZ2UgYW5kIHdlIGRvbid0IHdhbnQgdGhlbSB0byA0MDQuXG4gICAgICAgIGNvbnN0IGFsd2F5c1NlcnZlID0gW1xuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3J1bnRpbWUuanMnLFxuICAgICAgICAgICcvX2thcm1hX3dlYnBhY2tfL3BvbHlmaWxscy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vc2NyaXB0cy5qcycsXG4gICAgICAgICAgJy9fa2FybWFfd2VicGFja18vdmVuZG9yLmpzJyxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKGFsd2F5c1NlcnZlLmluZGV4T2YocmVxLnVybCkgIT0gLTEpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDQ7XG4gICAgICAgICAgcmVzLmVuZCgnTm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgZW1pdHRlci5vbignZXhpdCcsIChkb25lOiBhbnkpID0+IHtcbiAgICBtaWRkbGV3YXJlLmNsb3NlKCk7XG4gICAgZG9uZSgpO1xuICB9KTtcbn07XG5cbmluaXQuJGluamVjdCA9IFsnY29uZmlnJywgJ2VtaXR0ZXInLCAnY3VzdG9tRmlsZUhhbmRsZXJzJ107XG5cbi8vIEJsb2NrIHJlcXVlc3RzIHVudGlsIHRoZSBXZWJwYWNrIGNvbXBpbGF0aW9uIGlzIGRvbmUuXG5mdW5jdGlvbiByZXF1ZXN0QmxvY2tlcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChfcmVxdWVzdDogYW55LCBfcmVzcG9uc2U6IGFueSwgbmV4dDogKCkgPT4gdm9pZCkge1xuICAgIGlmIChpc0Jsb2NrZWQpIHtcbiAgICAgIGJsb2NrZWQucHVzaChuZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gRW1pdHMgYnVpbGRlciBldmVudHMuXG5jb25zdCBldmVudFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSkge1xuICBiYXNlUmVwb3J0ZXJEZWNvcmF0b3IodGhpcyk7XG5cbiAgdGhpcy5vblJ1bkNvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyczogYW55LCByZXN1bHRzOiBhbnkpIHtcbiAgICBpZiAocmVzdWx0cy5leGl0Q29kZSA9PT0gMCkge1xuICAgICAgc3VjY2Vzc0NiICYmIHN1Y2Nlc3NDYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmYWlsdXJlQ2IgJiYgZmFpbHVyZUNiKCk7XG4gICAgfVxuICB9XG59O1xuXG5ldmVudFJlcG9ydGVyLiRpbmplY3QgPSBbJ2Jhc2VSZXBvcnRlckRlY29yYXRvciddO1xuXG4vLyBTdHJpcCB0aGUgc2VydmVyIGFkZHJlc3MgYW5kIHdlYnBhY2sgc2NoZW1lICh3ZWJwYWNrOi8vKSBmcm9tIGVycm9yIGxvZy5cbmNvbnN0IHNvdXJjZU1hcFJlcG9ydGVyOiBhbnkgPSBmdW5jdGlvbiAodGhpczogYW55LCBiYXNlUmVwb3J0ZXJEZWNvcmF0b3I6IGFueSwgY29uZmlnOiBhbnkpIHtcbiAgYmFzZVJlcG9ydGVyRGVjb3JhdG9yKHRoaXMpO1xuXG4gIGNvbnN0IHJlcG9ydGVyTmFtZSA9ICdAYW5ndWxhci9jbGknO1xuICBjb25zdCBoYXNUcmFpbGluZ1JlcG9ydGVycyA9IGNvbmZpZy5yZXBvcnRlcnMuc2xpY2UoLTEpLnBvcCgpICE9PSByZXBvcnRlck5hbWU7XG5cbiAgLy8gQ29waWVkIGZyb20gXCJrYXJtYS1qYXNtaW5lLWRpZmYtcmVwb3J0ZXJcIiBzb3VyY2UgY29kZTpcbiAgLy8gSW4gY2FzZSwgd2hlbiBtdWx0aXBsZSByZXBvcnRlcnMgYXJlIHVzZWQgaW4gY29uanVuY3Rpb25cbiAgLy8gd2l0aCBpbml0U291cmNlbWFwUmVwb3J0ZXIsIHRoZXkgYm90aCB3aWxsIHNob3cgcmVwZXRpdGl2ZSBsb2dcbiAgLy8gbWVzc2FnZXMgd2hlbiBkaXNwbGF5aW5nIGV2ZXJ5dGhpbmcgdGhhdCBzdXBwb3NlZCB0byB3cml0ZSB0byB0ZXJtaW5hbC5cbiAgLy8gU28ganVzdCBzdXBwcmVzcyBhbnkgbG9ncyBmcm9tIGluaXRTb3VyY2VtYXBSZXBvcnRlciBieSBkb2luZyBub3RoaW5nIG9uXG4gIC8vIGJyb3dzZXIgbG9nLCBiZWNhdXNlIGl0IGlzIGFuIHV0aWxpdHkgcmVwb3J0ZXIsXG4gIC8vIHVubGVzcyBpdCdzIGFsb25lIGluIHRoZSBcInJlcG9ydGVyc1wiIG9wdGlvbiBhbmQgYmFzZSByZXBvcnRlciBpcyB1c2VkLlxuICBpZiAoaGFzVHJhaWxpbmdSZXBvcnRlcnMpIHtcbiAgICB0aGlzLndyaXRlQ29tbW9uTXNnID0gZnVuY3Rpb24gKCkgeyB9O1xuICB9XG5cbiAgY29uc3QgdXJsUmVnZXhwID0gL1xcKGh0dHA6XFwvXFwvbG9jYWxob3N0OlxcZCtcXC9fa2FybWFfd2VicGFja19cXC93ZWJwYWNrOlxcLy9naTtcblxuICB0aGlzLm9uU3BlY0NvbXBsZXRlID0gZnVuY3Rpb24gKF9icm93c2VyOiBhbnksIHJlc3VsdDogYW55KSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQubG9nLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5sb2cuZm9yRWFjaCgobG9nOiBzdHJpbmcsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgIHJlc3VsdC5sb2dbaWR4XSA9IGxvZy5yZXBsYWNlKHVybFJlZ2V4cCwgJycpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xufTtcblxuc291cmNlTWFwUmVwb3J0ZXIuJGluamVjdCA9IFsnYmFzZVJlcG9ydGVyRGVjb3JhdG9yJywgJ2NvbmZpZyddO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ2ZyYW1ld29yazpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcic6IFsnZmFjdG9yeScsIGluaXRdLFxuICAncmVwb3J0ZXI6QGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXItLXNvdXJjZW1hcC1yZXBvcnRlcic6IFsndHlwZScsIHNvdXJjZU1hcFJlcG9ydGVyXSxcbiAgJ3JlcG9ydGVyOkBhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyLS1ldmVudC1yZXBvcnRlcic6IFsndHlwZScsIGV2ZW50UmVwb3J0ZXJdLFxuICAnbWlkZGxld2FyZTpAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci0tYmxvY2tlcic6IFsnZmFjdG9yeScsIHJlcXVlc3RCbG9ja2VyXVxufTtcbiJdfQ==