"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildBrowserFeatures = void 0;
const browserslist_1 = __importDefault(require("browserslist"));
const caniuse_lite_1 = require("caniuse-lite");
class BuildBrowserFeatures {
    constructor(projectRoot) {
        // By default, browserslist defaults are too inclusive
        // https://github.com/browserslist/browserslist/blob/83764ea81ffaa39111c204b02c371afa44a4ff07/index.js#L516-L522
        this.projectRoot = projectRoot;
        // We change the default query to browsers that Angular support.
        // https://angular.io/guide/browser-support
        browserslist_1.default.defaults = [
            'last 1 Chrome version',
            'last 1 Firefox version',
            'last 2 Edge major versions',
            'last 2 Safari major versions',
            'last 2 iOS major versions',
            'Firefox ESR',
        ];
        this.supportedBrowsers = (0, browserslist_1.default)(undefined, { path: this.projectRoot });
    }
    /**
     * True, when a browser feature is supported partially or fully.
     */
    isFeatureSupported(featureId) {
        // y: feature is fully available
        // n: feature is unavailable
        // a: feature is partially supported
        // x: feature is prefixed
        const criteria = ['y', 'a'];
        const data = (0, caniuse_lite_1.feature)(caniuse_lite_1.features[featureId]);
        return !this.supportedBrowsers.some((browser) => {
            const [agentId, version] = browser.split(' ');
            const browserData = data.stats[agentId];
            const featureStatus = (browserData && browserData[version]);
            // We are only interested in the first character
            // Ex: when 'a #4 #5', we only need to check for 'a'
            // as for such cases we should polyfill these features as needed
            return !featureStatus || !criteria.includes(featureStatus.charAt(0));
        });
    }
}
exports.BuildBrowserFeatures = BuildBrowserFeatures;
