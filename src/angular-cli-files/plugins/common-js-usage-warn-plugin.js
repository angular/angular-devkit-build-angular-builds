"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonJsUsageWarnPlugin = void 0;
const path_1 = require("path");
// Webpack doesn't export these so the deep imports can potentially break.
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
const AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');
class CommonJsUsageWarnPlugin {
    constructor(options = {}) {
        this.options = options;
        this.shownWarnings = new Set();
        // Allow the below depedency for HMR
        // tslint:disable-next-line: max-line-length
        // https://github.com/angular/angular-cli/blob/1e258317b1f6ec1e957ee3559cc3b28ba602f3ba/packages/angular_devkit/build_angular/src/dev-server/index.ts#L605-L638
        this.allowedDepedencies = [
            'webpack/hot/dev-server',
        ];
        if (this.options.allowedDepedencies) {
            this.allowedDepedencies.push(...this.options.allowedDepedencies);
        }
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('CommonJsUsageWarnPlugin', compilation => {
            compilation.hooks.finishModules.tap('CommonJsUsageWarnPlugin', modules => {
                var _a, _b, _c, _d;
                for (const { dependencies, rawRequest, issuer } of modules) {
                    if (!rawRequest ||
                        rawRequest.startsWith('.') ||
                        path_1.isAbsolute(rawRequest)) {
                        // Skip if module is absolute or relative.
                        continue;
                    }
                    if ((_a = this.allowedDepedencies) === null || _a === void 0 ? void 0 : _a.includes(rawRequest)) {
                        // Skip as this module is allowed even if it's a CommonJS.
                        continue;
                    }
                    if (this.hasCommonJsDependencies(dependencies)) {
                        // Dependency is CommonsJS or AMD.
                        // Check if it's parent issuer is also a CommonJS dependency.
                        // In case it is skip as an warning will be show for the parent CommonJS dependency.
                        if (this.hasCommonJsDependencies((_c = (_b = issuer === null || issuer === void 0 ? void 0 : issuer.issuer) === null || _b === void 0 ? void 0 : _b.dependencies) !== null && _c !== void 0 ? _c : [])) {
                            continue;
                        }
                        // Find the main issuer (entry-point).
                        let mainIssuer = issuer;
                        while (mainIssuer === null || mainIssuer === void 0 ? void 0 : mainIssuer.issuer) {
                            mainIssuer = mainIssuer.issuer;
                        }
                        // Only show warnings for modules from main entrypoint.
                        // And if the issuer request is not from 'webpack-dev-server', as 'webpack-dev-server'
                        // will require CommonJS libraries for live reloading such as 'sockjs-node'.
                        if ((mainIssuer === null || mainIssuer === void 0 ? void 0 : mainIssuer.name) === 'main' && !((_d = issuer === null || issuer === void 0 ? void 0 : issuer.userRequest) === null || _d === void 0 ? void 0 : _d.includes('webpack-dev-server'))) {
                            const warning = `${issuer === null || issuer === void 0 ? void 0 : issuer.userRequest} depends on ${rawRequest}. CommonJS or AMD dependencies can cause optimization bailouts.\n` +
                                'For more info see: https://angular.io/guide/build#configuring-commonjs-dependencies';
                            // Avoid showing the same warning multiple times when in 'watch' mode.
                            if (!this.shownWarnings.has(warning)) {
                                compilation.warnings.push(warning);
                                this.shownWarnings.add(warning);
                            }
                        }
                    }
                }
            });
        });
    }
    hasCommonJsDependencies(dependencies) {
        return dependencies.some(d => d instanceof CommonJsRequireDependency || d instanceof AMDDefineDependency);
    }
}
exports.CommonJsUsageWarnPlugin = CommonJsUsageWarnPlugin;
