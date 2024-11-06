"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
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
exports.execute = execute;
exports.writeTestFiles = writeTestFiles;
const build_1 = require("@angular/build");
const private_1 = require("@angular/build/private");
const crypto_1 = require("crypto");
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const schema_1 = require("../browser-esbuild/schema");
const find_tests_1 = require("./find-tests");
class ApplicationBuildError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ApplicationBuildError';
    }
}
const LATEST_BUILD_FILES_TOKEN = 'angularLatestBuildFiles';
class AngularAssetsMiddleware {
    serveFile;
    latestBuildFiles;
    static $inject = ['serveFile', LATEST_BUILD_FILES_TOKEN];
    static NAME = 'angular-test-assets';
    constructor(serveFile, latestBuildFiles) {
        this.serveFile = serveFile;
        this.latestBuildFiles = latestBuildFiles;
    }
    handle(req, res, next) {
        let err = null;
        try {
            const url = new URL(`http://${req.headers['host']}${req.url}`);
            const file = this.latestBuildFiles.files[url.pathname.slice(1)];
            if (file?.origin === 'disk') {
                this.serveFile(file.inputPath, undefined, res);
                return;
            }
            else if (file?.origin === 'memory') {
                // Include pathname to help with Content-Type headers.
                this.serveFile(`/unused/${url.pathname}`, undefined, res, undefined, file.contents, true);
                return;
            }
        }
        catch (e) {
            err = e;
        }
        next(err);
    }
    static createPlugin(initialFiles) {
        return {
            [LATEST_BUILD_FILES_TOKEN]: ['value', { files: { ...initialFiles.files } }],
            [`middleware:${AngularAssetsMiddleware.NAME}`]: [
                'factory',
                Object.assign((...args) => {
                    const inst = new AngularAssetsMiddleware(...args);
                    return inst.handle.bind(inst);
                }, AngularAssetsMiddleware),
            ],
        };
    }
}
function injectKarmaReporter(context, buildOptions, buildIterator, karmaConfig, subscriber) {
    const reporterName = 'angular-progress-notifier';
    class ProgressNotifierReporter {
        emitter;
        latestBuildFiles;
        static $inject = ['emitter', LATEST_BUILD_FILES_TOKEN];
        constructor(emitter, latestBuildFiles) {
            this.emitter = emitter;
            this.latestBuildFiles = latestBuildFiles;
            this.startWatchingBuild();
        }
        startWatchingBuild() {
            void (async () => {
                // This is effectively "for await of but skip what's already consumed".
                let isDone = false; // to mark the loop condition as "not constant".
                while (!isDone) {
                    const { done, value: buildOutput } = await buildIterator.next();
                    if (done) {
                        isDone = true;
                        break;
                    }
                    if (buildOutput.kind === private_1.ResultKind.Failure) {
                        subscriber.next({ success: false, message: 'Build failed' });
                    }
                    else if (buildOutput.kind === private_1.ResultKind.Incremental ||
                        buildOutput.kind === private_1.ResultKind.Full) {
                        if (buildOutput.kind === private_1.ResultKind.Full) {
                            this.latestBuildFiles.files = buildOutput.files;
                        }
                        else {
                            this.latestBuildFiles.files = {
                                ...this.latestBuildFiles.files,
                                ...buildOutput.files,
                            };
                        }
                        await writeTestFiles(buildOutput.files, buildOptions.outputPath);
                        this.emitter.refreshFiles();
                    }
                }
            })();
        }
        onRunComplete = function (_browsers, results) {
            if (results.exitCode === 0) {
                subscriber.next({ success: true });
            }
            else {
                subscriber.next({ success: false });
            }
        };
    }
    karmaConfig.reporters ??= [];
    karmaConfig.reporters.push(reporterName);
    karmaConfig.plugins ??= [];
    karmaConfig.plugins.push({
        [`reporter:${reporterName}`]: [
            'factory',
            Object.assign((...args) => new ProgressNotifierReporter(...args), ProgressNotifierReporter),
        ],
    });
}
function execute(options, context, karmaOptions, transforms = {}) {
    return (0, rxjs_1.from)(initializeApplication(options, context, karmaOptions, transforms)).pipe((0, rxjs_1.switchMap)(([karma, karmaConfig, buildOptions, buildIterator]) => new rxjs_1.Observable((subscriber) => {
        // If `--watch` is explicitly enabled or if we are keeping the Karma
        // process running, we should hook Karma into the build.
        if (buildIterator) {
            injectKarmaReporter(context, buildOptions, buildIterator, karmaConfig, subscriber);
        }
        // Complete the observable once the Karma server returns.
        const karmaServer = new karma.Server(karmaConfig, (exitCode) => {
            subscriber.next({ success: exitCode === 0 });
            subscriber.complete();
        });
        const karmaStart = karmaServer.start();
        // Cleanup, signal Karma to exit.
        return () => {
            void karmaStart.then(() => karmaServer.stop());
        };
    })), (0, rxjs_1.catchError)((err) => {
        if (err instanceof ApplicationBuildError) {
            return (0, rxjs_1.of)({ success: false, message: err.message });
        }
        throw err;
    }), (0, rxjs_1.defaultIfEmpty)({ success: false }));
}
async function getProjectSourceRoot(context) {
    // We have already validated that the project name is set before calling this function.
    const projectName = context.target?.project;
    if (!projectName) {
        return context.workspaceRoot;
    }
    const projectMetadata = await context.getProjectMetadata(projectName);
    const sourceRoot = (projectMetadata.sourceRoot ?? projectMetadata.root ?? '');
    return path.join(context.workspaceRoot, sourceRoot);
}
function normalizePolyfills(polyfills) {
    if (typeof polyfills === 'string') {
        return [polyfills];
    }
    return polyfills ?? [];
}
async function collectEntrypoints(options, context, projectSourceRoot) {
    // Glob for files to test.
    const testFiles = await (0, find_tests_1.findTests)(options.include ?? [], options.exclude ?? [], context.workspaceRoot, projectSourceRoot);
    const seen = new Set();
    return new Map(Array.from(testFiles, (testFile) => {
        const relativePath = path
            .relative(testFile.startsWith(projectSourceRoot) ? projectSourceRoot : context.workspaceRoot, testFile)
            .replace(/^[./]+/, '_')
            .replace(/\//g, '-');
        let uniqueName = `spec-${path.basename(relativePath, path.extname(relativePath))}`;
        let suffix = 2;
        while (seen.has(uniqueName)) {
            uniqueName = `${relativePath}-${suffix}`;
            ++suffix;
        }
        seen.add(uniqueName);
        return [uniqueName, testFile];
    }));
}
async function initializeApplication(options, context, karmaOptions, transforms = {}) {
    if (transforms.webpackConfiguration) {
        context.logger.warn(`This build is using the application builder but transforms.webpackConfiguration was provided. The transform will be ignored.`);
    }
    const outputPath = path.join(context.workspaceRoot, 'dist/test-out', (0, crypto_1.randomUUID)());
    const projectSourceRoot = await getProjectSourceRoot(context);
    const [karma, entryPoints] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('karma'))),
        collectEntrypoints(options, context, projectSourceRoot),
        fs.rm(outputPath, { recursive: true, force: true }),
    ]);
    const mainName = 'test_main';
    if (options.main) {
        entryPoints.set(mainName, options.main);
    }
    else {
        entryPoints.set(mainName, '@angular-devkit/build-angular/src/builders/karma/init_test_bed.js');
    }
    const instrumentForCoverage = options.codeCoverage
        ? createInstrumentationFilter(projectSourceRoot, getInstrumentationExcludedPaths(context.workspaceRoot, options.codeCoverageExclude ?? []))
        : undefined;
    const buildOptions = {
        assets: options.assets,
        entryPoints,
        tsConfig: options.tsConfig,
        outputPath,
        aot: false,
        index: false,
        outputHashing: schema_1.OutputHashing.None,
        optimization: false,
        sourceMap: {
            scripts: true,
            styles: true,
            vendor: true,
        },
        instrumentForCoverage,
        styles: options.styles,
        polyfills: normalizePolyfills(options.polyfills),
        webWorkerTsConfig: options.webWorkerTsConfig,
        watch: options.watch ?? !karmaOptions.singleRun,
    };
    // Build tests with `application` builder, using test files as entry points.
    const [buildOutput, buildIterator] = await first((0, private_1.buildApplicationInternal)(buildOptions, context), { cancel: !buildOptions.watch });
    if (buildOutput.kind === private_1.ResultKind.Failure) {
        throw new ApplicationBuildError('Build failed');
    }
    else if (buildOutput.kind !== private_1.ResultKind.Full) {
        throw new ApplicationBuildError('A full build result is required from the application builder.');
    }
    // Write test files
    await writeTestFiles(buildOutput.files, buildOptions.outputPath);
    karmaOptions.files ??= [];
    karmaOptions.files.push(
    // Serve polyfills first.
    { pattern: `${outputPath}/polyfills.js`, type: 'module', watched: false }, 
    // Serve global setup script.
    { pattern: `${outputPath}/${mainName}.js`, type: 'module', watched: false }, 
    // Serve all source maps.
    { pattern: `${outputPath}/*.map`, included: false, watched: false }, 
    // These are the test entrypoints.
    { pattern: `${outputPath}/spec-*.js`, type: 'module', watched: false });
    if (hasChunkOrWorkerFiles(buildOutput.files)) {
        karmaOptions.files.push(
        // Allow loading of chunk-* files but don't include them all on load.
        {
            pattern: `${outputPath}/{chunk,worker}-*.js`,
            type: 'module',
            included: false,
            watched: false,
        });
    }
    if (options.styles?.length) {
        // Serve CSS outputs on page load, these are the global styles.
        karmaOptions.files.push({ pattern: `${outputPath}/*.css`, type: 'css', watched: false });
    }
    const parsedKarmaConfig = await karma.config.parseConfig(options.karmaConfig && path.resolve(context.workspaceRoot, options.karmaConfig), transforms.karmaOptions ? transforms.karmaOptions(karmaOptions) : karmaOptions, { promiseConfig: true, throwErrors: true });
    // Remove the webpack plugin/framework:
    // Alternative would be to make the Karma plugin "smart" but that's a tall order
    // with managing unneeded imports etc..
    parsedKarmaConfig.plugins ??= [];
    const pluginLengthBefore = parsedKarmaConfig.plugins.length;
    parsedKarmaConfig.plugins = parsedKarmaConfig.plugins.filter((plugin) => {
        if (typeof plugin === 'string') {
            return plugin !== 'framework:@angular-devkit/build-angular';
        }
        return !plugin['framework:@angular-devkit/build-angular'];
    });
    parsedKarmaConfig.frameworks ??= [];
    parsedKarmaConfig.frameworks = parsedKarmaConfig.frameworks.filter((framework) => framework !== '@angular-devkit/build-angular');
    const pluginLengthAfter = parsedKarmaConfig.plugins.length;
    if (pluginLengthBefore !== pluginLengthAfter) {
        context.logger.warn(`Ignoring framework "@angular-devkit/build-angular" from karma config file because it's not compatible with the application builder.`);
    }
    parsedKarmaConfig.plugins.push(AngularAssetsMiddleware.createPlugin(buildOutput));
    parsedKarmaConfig.middleware ??= [];
    parsedKarmaConfig.middleware.push(AngularAssetsMiddleware.NAME);
    // When using code-coverage, auto-add karma-coverage.
    // This was done as part of the karma plugin for webpack.
    if (options.codeCoverage &&
        !parsedKarmaConfig.reporters?.some((r) => r === 'coverage' || r === 'coverage-istanbul')) {
        parsedKarmaConfig.reporters = (parsedKarmaConfig.reporters ?? []).concat(['coverage']);
    }
    return [karma, parsedKarmaConfig, buildOptions, buildIterator];
}
function hasChunkOrWorkerFiles(files) {
    return Object.keys(files).some((filename) => {
        return /(?:^|\/)(?:worker|chunk)[^/]+\.js$/.test(filename);
    });
}
async function writeTestFiles(files, testDir) {
    const directoryExists = new Set();
    // Writes the test related output files to disk and ensures the containing directories are present
    await (0, private_1.emitFilesToDisk)(Object.entries(files), async ([filePath, file]) => {
        if (file.type !== build_1.BuildOutputFileType.Browser && file.type !== build_1.BuildOutputFileType.Media) {
            return;
        }
        const fullFilePath = path.join(testDir, filePath);
        // Ensure output subdirectories exist
        const fileBasePath = path.dirname(fullFilePath);
        if (fileBasePath && !directoryExists.has(fileBasePath)) {
            await fs.mkdir(fileBasePath, { recursive: true });
            directoryExists.add(fileBasePath);
        }
        if (file.origin === 'memory') {
            // Write file contents
            await fs.writeFile(fullFilePath, file.contents);
        }
        else {
            // Copy file contents
            await fs.copyFile(file.inputPath, fullFilePath, fs.constants.COPYFILE_FICLONE);
        }
    });
}
/** Returns the first item yielded by the given generator and cancels the execution. */
async function first(generator, { cancel }) {
    if (!cancel) {
        const iterator = generator[Symbol.asyncIterator]();
        const firstValue = await iterator.next();
        if (firstValue.done) {
            throw new Error('Expected generator to emit at least once.');
        }
        return [firstValue.value, iterator];
    }
    for await (const value of generator) {
        return [value, null];
    }
    throw new Error('Expected generator to emit at least once.');
}
function createInstrumentationFilter(includedBasePath, excludedPaths) {
    return (request) => {
        return (!excludedPaths.has(request) &&
            !/\.(e2e|spec)\.tsx?$|[\\/]node_modules[\\/]/.test(request) &&
            request.startsWith(includedBasePath));
    };
}
function getInstrumentationExcludedPaths(root, excludedPaths) {
    const excluded = new Set();
    for (const excludeGlob of excludedPaths) {
        const excludePath = excludeGlob[0] === '/' ? excludeGlob.slice(1) : excludeGlob;
        fast_glob_1.default.sync(excludePath, { cwd: root }).forEach((p) => excluded.add(path.join(root, p)));
    }
    return excluded;
}
