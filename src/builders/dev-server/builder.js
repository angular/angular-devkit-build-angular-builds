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
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const rxjs_1 = require("rxjs");
const check_port_1 = require("../../utils/check-port");
const purge_cache_1 = require("../../utils/purge-cache");
const options_1 = require("./options");
/**
 * A Builder that executes a development server based on the provided browser target option.
 * @param options Dev Server options.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 * transforming webpack configuration before passing it to webpack).
 *
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context, transforms = {}, plugins) {
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'dev-server' builder requires a target to be specified.`);
        return rxjs_1.EMPTY;
    }
    return (0, rxjs_1.defer)(() => initialize(options, projectName, context)).pipe((0, rxjs_1.switchMap)(({ builderName, normalizedOptions }) => {
        // Use vite-based development server for esbuild-based builds
        if (builderName === '@angular-devkit/build-angular:application' ||
            builderName === '@angular-devkit/build-angular:browser-esbuild' ||
            normalizedOptions.forceEsbuild) {
            if (Object.keys(transforms).length > 0) {
                throw new Error('The `application` and `browser-esbuild` builders do not support Webpack transforms.');
            }
            return (0, rxjs_1.defer)(() => Promise.resolve().then(() => __importStar(require('./vite-server')))).pipe((0, rxjs_1.switchMap)(({ serveWithVite }) => serveWithVite(normalizedOptions, builderName, context, plugins)));
        }
        if (plugins?.length) {
            throw new Error('Only the `application` and `browser-esbuild` builders support plugins.');
        }
        // Use Webpack for all other browser targets
        return (0, rxjs_1.defer)(() => Promise.resolve().then(() => __importStar(require('./webpack-server')))).pipe((0, rxjs_1.switchMap)(({ serveWebpackBrowser }) => serveWebpackBrowser(normalizedOptions, builderName, context, transforms)));
    }));
}
exports.execute = execute;
async function initialize(initialOptions, projectName, context) {
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, initialOptions);
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.buildTarget);
    if (!normalizedOptions.disableHostCheck &&
        !/^127\.\d+\.\d+\.\d+/g.test(normalizedOptions.host) &&
        normalizedOptions.host !== 'localhost') {
        context.logger.warn(`
Warning: This is a simple server for use in testing or debugging Angular applications
locally. It hasn't been reviewed for security issues.

Binding this server to an open connection can result in compromising your application or
computer. Using a different host than the one passed to the "--host" flag might result in
websocket connection issues. You might need to use "--disable-host-check" if that's the
case.
    `);
    }
    if (normalizedOptions.disableHostCheck) {
        context.logger.warn('Warning: Running a server with --disable-host-check is a security risk. ' +
            'See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a for more information.');
    }
    if (normalizedOptions.forceEsbuild && !builderName.startsWith('@angular-devkit/build-angular:')) {
        context.logger.warn('Warning: Forcing the use of the esbuild-based build system with third-party builders' +
            ' may cause unexpected behavior and/or build failures.');
    }
    normalizedOptions.port = await (0, check_port_1.checkPort)(normalizedOptions.port, normalizedOptions.host);
    return { builderName, normalizedOptions };
}
