"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NgBuildAnalyticsPlugin = exports.countOccurrences = void 0;
const core_1 = require("@angular-devkit/core");
const webpack_1 = require("webpack");
const webpackAllErrorMessageRe = /^([^(]+)\(\d+,\d\): (.*)$/gm;
const webpackTsErrorMessageRe = /^[^(]+\(\d+,\d\): error (TS\d+):/;
/**
 * Faster than using a RegExp, so we use this to count occurences in source code.
 * @param source The source to look into.
 * @param match The match string to look for.
 * @param wordBreak Whether to check for word break before and after a match was found.
 * @return The number of matches found.
 * @private
 */
function countOccurrences(source, match, wordBreak = false) {
    if (match.length == 0) {
        return source.length + 1;
    }
    let count = 0;
    // We condition here so branch prediction happens out of the loop, not in it.
    if (wordBreak) {
        const re = /\w/;
        for (let pos = source.lastIndexOf(match); pos >= 0; pos = source.lastIndexOf(match, pos)) {
            if (!(re.test(source[pos - 1] || '') || re.test(source[pos + match.length] || ''))) {
                count++; // 1 match, AH! AH! AH! 2 matches, AH! AH! AH!
            }
            pos -= match.length;
            if (pos < 0) {
                break;
            }
        }
    }
    else {
        for (let pos = source.lastIndexOf(match); pos >= 0; pos = source.lastIndexOf(match, pos)) {
            count++; // 1 match, AH! AH! AH! 2 matches, AH! AH! AH!
            pos -= match.length;
            if (pos < 0) {
                break;
            }
        }
    }
    return count;
}
exports.countOccurrences = countOccurrences;
/**
 * Holder of statistics related to the build.
 */
class AnalyticsBuildStats {
    constructor() {
        this.errors = [];
        this.numberOfNgOnInit = 0;
        this.numberOfComponents = 0;
        this.initialChunkSize = 0;
        this.totalChunkCount = 0;
        this.totalChunkSize = 0;
        this.lazyChunkCount = 0;
        this.lazyChunkSize = 0;
        this.assetCount = 0;
        this.assetSize = 0;
        this.polyfillSize = 0;
        this.cssSize = 0;
    }
}
/**
 * Analytics plugin that reports the analytics we want from the CLI.
 */
class NgBuildAnalyticsPlugin {
    constructor(_projectRoot, _analytics, _category) {
        this._projectRoot = _projectRoot;
        this._analytics = _analytics;
        this._category = _category;
        this._built = false;
        this._stats = new AnalyticsBuildStats();
    }
    _reset() {
        this._stats = new AnalyticsBuildStats();
    }
    _getMetrics(stats) {
        const startTime = +(stats.startTime || 0);
        const endTime = +(stats.endTime || 0);
        const metrics = [];
        metrics[core_1.analytics.NgCliAnalyticsMetrics.BuildTime] = endTime - startTime;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.NgOnInitCount] = this._stats.numberOfNgOnInit;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.NgComponentCount] = this._stats.numberOfComponents;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.InitialChunkSize] = this._stats.initialChunkSize;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.TotalChunkCount] = this._stats.totalChunkCount;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.TotalChunkSize] = this._stats.totalChunkSize;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.LazyChunkCount] = this._stats.lazyChunkCount;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.LazyChunkSize] = this._stats.lazyChunkSize;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.AssetCount] = this._stats.assetCount;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.AssetSize] = this._stats.assetSize;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.PolyfillSize] = this._stats.polyfillSize;
        metrics[core_1.analytics.NgCliAnalyticsMetrics.CssSize] = this._stats.cssSize;
        return metrics;
    }
    _getDimensions() {
        const dimensions = [];
        if (this._stats.errors.length) {
            // Adding commas before and after so the regex are easier to define filters.
            dimensions[core_1.analytics.NgCliAnalyticsDimensions.BuildErrors] = `,${this._stats.errors.join()},`;
        }
        return dimensions;
    }
    _reportBuildMetrics(stats) {
        const dimensions = this._getDimensions();
        const metrics = this._getMetrics(stats);
        this._analytics.event(this._category, 'build', { dimensions, metrics });
    }
    _reportRebuildMetrics(stats) {
        const dimensions = this._getDimensions();
        const metrics = this._getMetrics(stats);
        this._analytics.event(this._category, 'rebuild', { dimensions, metrics });
    }
    _checkTsNormalModule(module) {
        const originalSource = module.originalSource();
        if (!originalSource) {
            return;
        }
        const originalContent = originalSource.source().toString();
        // PLEASE REMEMBER:
        // We're dealing with ES5 _or_ ES2015 JavaScript at this point (we don't know for sure).
        // Just count the ngOnInit occurences. Comments/Strings/calls occurences should be sparse
        // so we just consider them within the margin of error. We do break on word break though.
        this._stats.numberOfNgOnInit += countOccurrences(originalContent, 'ngOnInit', true);
        // Count the number of `Component({` strings (case sensitive), which happens in __decorate().
        this._stats.numberOfComponents += countOccurrences(originalContent, 'Component({');
        // For Ivy we just count ɵcmp.
        this._stats.numberOfComponents += countOccurrences(originalContent, '.ɵcmp', true);
        // for ascii_only true
        this._stats.numberOfComponents += countOccurrences(originalContent, '.\u0275cmp', true);
    }
    _collectErrors(stats) {
        if (stats.hasErrors()) {
            for (const errObject of stats.compilation.errors) {
                if (errObject instanceof Error) {
                    const allErrors = errObject.message.match(webpackAllErrorMessageRe);
                    for (const err of [...(allErrors || [])].slice(1)) {
                        const message = (err.match(webpackTsErrorMessageRe) || [])[1];
                        if (message) {
                            // At this point this should be a TS1234.
                            this._stats.errors.push(message);
                        }
                    }
                }
            }
        }
    }
    _collectBundleStats(compilation) {
        var _a, _b;
        const chunkAssets = new Set();
        for (const chunk of compilation.chunks) {
            if (!chunk.rendered) {
                continue;
            }
            const firstFile = Array.from(chunk.files)[0];
            const size = (_b = (_a = compilation.getAsset(firstFile)) === null || _a === void 0 ? void 0 : _a.source.size()) !== null && _b !== void 0 ? _b : 0;
            chunkAssets.add(firstFile);
            if (chunk.canBeInitial()) {
                this._stats.initialChunkSize += size;
            }
            else {
                this._stats.lazyChunkCount++;
                this._stats.lazyChunkSize += size;
            }
            this._stats.totalChunkCount++;
            this._stats.totalChunkSize += size;
            if (firstFile.endsWith('.css')) {
                this._stats.cssSize += size;
            }
        }
        for (const asset of compilation.getAssets()) {
            // Only count non-JavaScript related files
            if (chunkAssets.has(asset.name)) {
                continue;
            }
            this._stats.assetSize += asset.source.size();
            this._stats.assetCount++;
            if (asset.name == 'polyfill') {
                this._stats.polyfillSize += asset.source.size();
            }
        }
    }
    /** **********************************************************************************************
     * The next section is all the different Webpack hooks for this plugin.
     */
    /**
     * Reports a succeed module.
     * @private
     */
    _succeedModule(module) {
        // Only report NormalModule instances.
        if (!(module instanceof webpack_1.NormalModule)) {
            return;
        }
        // Only reports modules that are part of the user's project. We also don't do node_modules.
        // There is a chance that someone name a file path `hello_node_modules` or something and we
        // will ignore that file for the purpose of gathering, but we're willing to take the risk.
        if (!module.resource ||
            !module.resource.startsWith(this._projectRoot) ||
            module.resource.indexOf('node_modules') >= 0) {
            return;
        }
        // Check that it's a source file from the project.
        if (module.resource.endsWith('.ts')) {
            this._checkTsNormalModule(module);
        }
    }
    _compilation(compiler, compilation) {
        this._reset();
        compilation.hooks.succeedModule.tap('NgBuildAnalyticsPlugin', this._succeedModule.bind(this));
    }
    _done(stats) {
        this._collectErrors(stats);
        this._collectBundleStats(stats.compilation);
        if (this._built) {
            this._reportRebuildMetrics(stats);
        }
        else {
            this._reportBuildMetrics(stats);
            this._built = true;
        }
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('NgBuildAnalyticsPlugin', this._compilation.bind(this, compiler));
        compiler.hooks.done.tap('NgBuildAnalyticsPlugin', this._done.bind(this));
    }
}
exports.NgBuildAnalyticsPlugin = NgBuildAnalyticsPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2FuYWx5dGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBaUQ7QUFDakQscUNBQTZFO0FBRTdFLE1BQU0sd0JBQXdCLEdBQUcsNkJBQTZCLENBQUM7QUFDL0QsTUFBTSx1QkFBdUIsR0FBRyxrQ0FBa0MsQ0FBQztBQUVuRTs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBYyxFQUFFLEtBQWEsRUFBRSxTQUFTLEdBQUcsS0FBSztJQUMvRSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7S0FDMUI7SUFFRCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDZCw2RUFBNkU7SUFDN0UsSUFBSSxTQUFTLEVBQUU7UUFDYixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEIsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ3hGLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2xGLEtBQUssRUFBRSxDQUFDLENBQUMsOENBQThD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QzVCLHdCQUF3QixFQUN4QixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQ3ZDLENBQUM7UUFDRixRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDO0NBQ0Y7QUEvTEQsd0RBK0xDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGFuYWx5dGljcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IENvbXBpbGF0aW9uLCBDb21waWxlciwgTW9kdWxlLCBOb3JtYWxNb2R1bGUsIFN0YXRzIH0gZnJvbSAnd2VicGFjayc7XG5cbmNvbnN0IHdlYnBhY2tBbGxFcnJvck1lc3NhZ2VSZSA9IC9eKFteKF0rKVxcKFxcZCssXFxkXFwpOiAoLiopJC9nbTtcbmNvbnN0IHdlYnBhY2tUc0Vycm9yTWVzc2FnZVJlID0gL15bXihdK1xcKFxcZCssXFxkXFwpOiBlcnJvciAoVFNcXGQrKTovO1xuXG4vKipcbiAqIEZhc3RlciB0aGFuIHVzaW5nIGEgUmVnRXhwLCBzbyB3ZSB1c2UgdGhpcyB0byBjb3VudCBvY2N1cmVuY2VzIGluIHNvdXJjZSBjb2RlLlxuICogQHBhcmFtIHNvdXJjZSBUaGUgc291cmNlIHRvIGxvb2sgaW50by5cbiAqIEBwYXJhbSBtYXRjaCBUaGUgbWF0Y2ggc3RyaW5nIHRvIGxvb2sgZm9yLlxuICogQHBhcmFtIHdvcmRCcmVhayBXaGV0aGVyIHRvIGNoZWNrIGZvciB3b3JkIGJyZWFrIGJlZm9yZSBhbmQgYWZ0ZXIgYSBtYXRjaCB3YXMgZm91bmQuXG4gKiBAcmV0dXJuIFRoZSBudW1iZXIgb2YgbWF0Y2hlcyBmb3VuZC5cbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb3VudE9jY3VycmVuY2VzKHNvdXJjZTogc3RyaW5nLCBtYXRjaDogc3RyaW5nLCB3b3JkQnJlYWsgPSBmYWxzZSk6IG51bWJlciB7XG4gIGlmIChtYXRjaC5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBzb3VyY2UubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGxldCBjb3VudCA9IDA7XG4gIC8vIFdlIGNvbmRpdGlvbiBoZXJlIHNvIGJyYW5jaCBwcmVkaWN0aW9uIGhhcHBlbnMgb3V0IG9mIHRoZSBsb29wLCBub3QgaW4gaXQuXG4gIGlmICh3b3JkQnJlYWspIHtcbiAgICBjb25zdCByZSA9IC9cXHcvO1xuICAgIGZvciAobGV0IHBvcyA9IHNvdXJjZS5sYXN0SW5kZXhPZihtYXRjaCk7IHBvcyA+PSAwOyBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gsIHBvcykpIHtcbiAgICAgIGlmICghKHJlLnRlc3Qoc291cmNlW3BvcyAtIDFdIHx8ICcnKSB8fCByZS50ZXN0KHNvdXJjZVtwb3MgKyBtYXRjaC5sZW5ndGhdIHx8ICcnKSkpIHtcbiAgICAgICAgY291bnQrKzsgLy8gMSBtYXRjaCwgQUghIEFIISBBSCEgMiBtYXRjaGVzLCBBSCEgQUghIEFIIVxuICAgICAgfVxuXG4gICAgICBwb3MgLT0gbWF0Y2gubGVuZ3RoO1xuICAgICAgaWYgKHBvcyA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGZvciAobGV0IHBvcyA9IHNvdXJjZS5sYXN0SW5kZXhPZihtYXRjaCk7IHBvcyA+PSAwOyBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gsIHBvcykpIHtcbiAgICAgIGNvdW50Kys7IC8vIDEgbWF0Y2gsIEFIISBBSCEgQUghIDIgbWF0Y2hlcywgQUghIEFIISBBSCFcbiAgICAgIHBvcyAtPSBtYXRjaC5sZW5ndGg7XG4gICAgICBpZiAocG9zIDwgMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gY291bnQ7XG59XG5cbi8qKlxuICogSG9sZGVyIG9mIHN0YXRpc3RpY3MgcmVsYXRlZCB0byB0aGUgYnVpbGQuXG4gKi9cbmNsYXNzIEFuYWx5dGljc0J1aWxkU3RhdHMge1xuICBwdWJsaWMgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwdWJsaWMgbnVtYmVyT2ZOZ09uSW5pdCA9IDA7XG4gIHB1YmxpYyBudW1iZXJPZkNvbXBvbmVudHMgPSAwO1xuICBwdWJsaWMgaW5pdGlhbENodW5rU2l6ZSA9IDA7XG4gIHB1YmxpYyB0b3RhbENodW5rQ291bnQgPSAwO1xuICBwdWJsaWMgdG90YWxDaHVua1NpemUgPSAwO1xuICBwdWJsaWMgbGF6eUNodW5rQ291bnQgPSAwO1xuICBwdWJsaWMgbGF6eUNodW5rU2l6ZSA9IDA7XG4gIHB1YmxpYyBhc3NldENvdW50ID0gMDtcbiAgcHVibGljIGFzc2V0U2l6ZSA9IDA7XG4gIHB1YmxpYyBwb2x5ZmlsbFNpemUgPSAwO1xuICBwdWJsaWMgY3NzU2l6ZSA9IDA7XG59XG5cbi8qKlxuICogQW5hbHl0aWNzIHBsdWdpbiB0aGF0IHJlcG9ydHMgdGhlIGFuYWx5dGljcyB3ZSB3YW50IGZyb20gdGhlIENMSS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5nQnVpbGRBbmFseXRpY3NQbHVnaW4ge1xuICBwcm90ZWN0ZWQgX2J1aWx0ID0gZmFsc2U7XG4gIHByb3RlY3RlZCBfc3RhdHMgPSBuZXcgQW5hbHl0aWNzQnVpbGRTdGF0cygpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBfcHJvamVjdFJvb3Q6IHN0cmluZyxcbiAgICBwcm90ZWN0ZWQgX2FuYWx5dGljczogYW5hbHl0aWNzLkFuYWx5dGljcyxcbiAgICBwcm90ZWN0ZWQgX2NhdGVnb3J5OiBzdHJpbmcsXG4gICkge31cblxuICBwcm90ZWN0ZWQgX3Jlc2V0KCkge1xuICAgIHRoaXMuX3N0YXRzID0gbmV3IEFuYWx5dGljc0J1aWxkU3RhdHMoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfZ2V0TWV0cmljcyhzdGF0czogU3RhdHMpIHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSArKHN0YXRzLnN0YXJ0VGltZSB8fCAwKTtcbiAgICBjb25zdCBlbmRUaW1lID0gKyhzdGF0cy5lbmRUaW1lIHx8IDApO1xuICAgIGNvbnN0IG1ldHJpY3M6IChzdHJpbmcgfCBudW1iZXIpW10gPSBbXTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuQnVpbGRUaW1lXSA9IGVuZFRpbWUgLSBzdGFydFRpbWU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLk5nT25Jbml0Q291bnRdID0gdGhpcy5fc3RhdHMubnVtYmVyT2ZOZ09uSW5pdDtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuTmdDb21wb25lbnRDb3VudF0gPSB0aGlzLl9zdGF0cy5udW1iZXJPZkNvbXBvbmVudHM7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkluaXRpYWxDaHVua1NpemVdID0gdGhpcy5fc3RhdHMuaW5pdGlhbENodW5rU2l6ZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuVG90YWxDaHVua0NvdW50XSA9IHRoaXMuX3N0YXRzLnRvdGFsQ2h1bmtDb3VudDtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuVG90YWxDaHVua1NpemVdID0gdGhpcy5fc3RhdHMudG90YWxDaHVua1NpemU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkxhenlDaHVua0NvdW50XSA9IHRoaXMuX3N0YXRzLmxhenlDaHVua0NvdW50O1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5MYXp5Q2h1bmtTaXplXSA9IHRoaXMuX3N0YXRzLmxhenlDaHVua1NpemU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkFzc2V0Q291bnRdID0gdGhpcy5fc3RhdHMuYXNzZXRDb3VudDtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuQXNzZXRTaXplXSA9IHRoaXMuX3N0YXRzLmFzc2V0U2l6ZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuUG9seWZpbGxTaXplXSA9IHRoaXMuX3N0YXRzLnBvbHlmaWxsU2l6ZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuQ3NzU2l6ZV0gPSB0aGlzLl9zdGF0cy5jc3NTaXplO1xuXG4gICAgcmV0dXJuIG1ldHJpY3M7XG4gIH1cbiAgcHJvdGVjdGVkIF9nZXREaW1lbnNpb25zKCkge1xuICAgIGNvbnN0IGRpbWVuc2lvbnM6IChzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuKVtdID0gW107XG5cbiAgICBpZiAodGhpcy5fc3RhdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgLy8gQWRkaW5nIGNvbW1hcyBiZWZvcmUgYW5kIGFmdGVyIHNvIHRoZSByZWdleCBhcmUgZWFzaWVyIHRvIGRlZmluZSBmaWx0ZXJzLlxuICAgICAgZGltZW5zaW9uc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NEaW1lbnNpb25zLkJ1aWxkRXJyb3JzXSA9IGAsJHt0aGlzLl9zdGF0cy5lcnJvcnMuam9pbigpfSxgO1xuICAgIH1cblxuICAgIHJldHVybiBkaW1lbnNpb25zO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9yZXBvcnRCdWlsZE1ldHJpY3Moc3RhdHM6IFN0YXRzKSB7XG4gICAgY29uc3QgZGltZW5zaW9ucyA9IHRoaXMuX2dldERpbWVuc2lvbnMoKTtcbiAgICBjb25zdCBtZXRyaWNzID0gdGhpcy5fZ2V0TWV0cmljcyhzdGF0cyk7XG4gICAgdGhpcy5fYW5hbHl0aWNzLmV2ZW50KHRoaXMuX2NhdGVnb3J5LCAnYnVpbGQnLCB7IGRpbWVuc2lvbnMsIG1ldHJpY3MgfSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3JlcG9ydFJlYnVpbGRNZXRyaWNzKHN0YXRzOiBTdGF0cykge1xuICAgIGNvbnN0IGRpbWVuc2lvbnMgPSB0aGlzLl9nZXREaW1lbnNpb25zKCk7XG4gICAgY29uc3QgbWV0cmljcyA9IHRoaXMuX2dldE1ldHJpY3Moc3RhdHMpO1xuICAgIHRoaXMuX2FuYWx5dGljcy5ldmVudCh0aGlzLl9jYXRlZ29yeSwgJ3JlYnVpbGQnLCB7IGRpbWVuc2lvbnMsIG1ldHJpY3MgfSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NoZWNrVHNOb3JtYWxNb2R1bGUobW9kdWxlOiBOb3JtYWxNb2R1bGUpIHtcbiAgICBjb25zdCBvcmlnaW5hbFNvdXJjZSA9IG1vZHVsZS5vcmlnaW5hbFNvdXJjZSgpO1xuICAgIGlmICghb3JpZ2luYWxTb3VyY2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW5hbENvbnRlbnQgPSBvcmlnaW5hbFNvdXJjZS5zb3VyY2UoKS50b1N0cmluZygpO1xuXG4gICAgLy8gUExFQVNFIFJFTUVNQkVSOlxuICAgIC8vIFdlJ3JlIGRlYWxpbmcgd2l0aCBFUzUgX29yXyBFUzIwMTUgSmF2YVNjcmlwdCBhdCB0aGlzIHBvaW50ICh3ZSBkb24ndCBrbm93IGZvciBzdXJlKS5cblxuICAgIC8vIEp1c3QgY291bnQgdGhlIG5nT25Jbml0IG9jY3VyZW5jZXMuIENvbW1lbnRzL1N0cmluZ3MvY2FsbHMgb2NjdXJlbmNlcyBzaG91bGQgYmUgc3BhcnNlXG4gICAgLy8gc28gd2UganVzdCBjb25zaWRlciB0aGVtIHdpdGhpbiB0aGUgbWFyZ2luIG9mIGVycm9yLiBXZSBkbyBicmVhayBvbiB3b3JkIGJyZWFrIHRob3VnaC5cbiAgICB0aGlzLl9zdGF0cy5udW1iZXJPZk5nT25Jbml0ICs9IGNvdW50T2NjdXJyZW5jZXMob3JpZ2luYWxDb250ZW50LCAnbmdPbkluaXQnLCB0cnVlKTtcblxuICAgIC8vIENvdW50IHRoZSBudW1iZXIgb2YgYENvbXBvbmVudCh7YCBzdHJpbmdzIChjYXNlIHNlbnNpdGl2ZSksIHdoaWNoIGhhcHBlbnMgaW4gX19kZWNvcmF0ZSgpLlxuICAgIHRoaXMuX3N0YXRzLm51bWJlck9mQ29tcG9uZW50cyArPSBjb3VudE9jY3VycmVuY2VzKG9yaWdpbmFsQ29udGVudCwgJ0NvbXBvbmVudCh7Jyk7XG4gICAgLy8gRm9yIEl2eSB3ZSBqdXN0IGNvdW50IMm1Y21wLlxuICAgIHRoaXMuX3N0YXRzLm51bWJlck9mQ29tcG9uZW50cyArPSBjb3VudE9jY3VycmVuY2VzKG9yaWdpbmFsQ29udGVudCwgJy7JtWNtcCcsIHRydWUpO1xuICAgIC8vIGZvciBhc2NpaV9vbmx5IHRydWVcbiAgICB0aGlzLl9zdGF0cy5udW1iZXJPZkNvbXBvbmVudHMgKz0gY291bnRPY2N1cnJlbmNlcyhvcmlnaW5hbENvbnRlbnQsICcuXFx1MDI3NWNtcCcsIHRydWUpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9jb2xsZWN0RXJyb3JzKHN0YXRzOiBTdGF0cykge1xuICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgZm9yIChjb25zdCBlcnJPYmplY3Qgb2Ygc3RhdHMuY29tcGlsYXRpb24uZXJyb3JzKSB7XG4gICAgICAgIGlmIChlcnJPYmplY3QgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIGNvbnN0IGFsbEVycm9ycyA9IGVyck9iamVjdC5tZXNzYWdlLm1hdGNoKHdlYnBhY2tBbGxFcnJvck1lc3NhZ2VSZSk7XG4gICAgICAgICAgZm9yIChjb25zdCBlcnIgb2YgWy4uLihhbGxFcnJvcnMgfHwgW10pXS5zbGljZSgxKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IChlcnIubWF0Y2god2VicGFja1RzRXJyb3JNZXNzYWdlUmUpIHx8IFtdKVsxXTtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgIC8vIEF0IHRoaXMgcG9pbnQgdGhpcyBzaG91bGQgYmUgYSBUUzEyMzQuXG4gICAgICAgICAgICAgIHRoaXMuX3N0YXRzLmVycm9ycy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBfY29sbGVjdEJ1bmRsZVN0YXRzKGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbikge1xuICAgIGNvbnN0IGNodW5rQXNzZXRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBjaHVuayBvZiBjb21waWxhdGlvbi5jaHVua3MpIHtcbiAgICAgIGlmICghY2h1bmsucmVuZGVyZWQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpcnN0RmlsZSA9IEFycmF5LmZyb20oY2h1bmsuZmlsZXMpWzBdO1xuICAgICAgY29uc3Qgc2l6ZSA9IGNvbXBpbGF0aW9uLmdldEFzc2V0KGZpcnN0RmlsZSk/LnNvdXJjZS5zaXplKCkgPz8gMDtcbiAgICAgIGNodW5rQXNzZXRzLmFkZChmaXJzdEZpbGUpO1xuXG4gICAgICBpZiAoY2h1bmsuY2FuQmVJbml0aWFsKCkpIHtcbiAgICAgICAgdGhpcy5fc3RhdHMuaW5pdGlhbENodW5rU2l6ZSArPSBzaXplO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc3RhdHMubGF6eUNodW5rQ291bnQrKztcbiAgICAgICAgdGhpcy5fc3RhdHMubGF6eUNodW5rU2l6ZSArPSBzaXplO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zdGF0cy50b3RhbENodW5rQ291bnQrKztcbiAgICAgIHRoaXMuX3N0YXRzLnRvdGFsQ2h1bmtTaXplICs9IHNpemU7XG5cbiAgICAgIGlmIChmaXJzdEZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICB0aGlzLl9zdGF0cy5jc3NTaXplICs9IHNpemU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBhc3NldCBvZiBjb21waWxhdGlvbi5nZXRBc3NldHMoKSkge1xuICAgICAgLy8gT25seSBjb3VudCBub24tSmF2YVNjcmlwdCByZWxhdGVkIGZpbGVzXG4gICAgICBpZiAoY2h1bmtBc3NldHMuaGFzKGFzc2V0Lm5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zdGF0cy5hc3NldFNpemUgKz0gYXNzZXQuc291cmNlLnNpemUoKTtcbiAgICAgIHRoaXMuX3N0YXRzLmFzc2V0Q291bnQrKztcblxuICAgICAgaWYgKGFzc2V0Lm5hbWUgPT0gJ3BvbHlmaWxsJykge1xuICAgICAgICB0aGlzLl9zdGF0cy5wb2x5ZmlsbFNpemUgKz0gYXNzZXQuc291cmNlLnNpemUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgKiBUaGUgbmV4dCBzZWN0aW9uIGlzIGFsbCB0aGUgZGlmZmVyZW50IFdlYnBhY2sgaG9va3MgZm9yIHRoaXMgcGx1Z2luLlxuICAgKi9cblxuICAvKipcbiAgICogUmVwb3J0cyBhIHN1Y2NlZWQgbW9kdWxlLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJvdGVjdGVkIF9zdWNjZWVkTW9kdWxlKG1vZHVsZTogTW9kdWxlKSB7XG4gICAgLy8gT25seSByZXBvcnQgTm9ybWFsTW9kdWxlIGluc3RhbmNlcy5cbiAgICBpZiAoIShtb2R1bGUgaW5zdGFuY2VvZiBOb3JtYWxNb2R1bGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT25seSByZXBvcnRzIG1vZHVsZXMgdGhhdCBhcmUgcGFydCBvZiB0aGUgdXNlcidzIHByb2plY3QuIFdlIGFsc28gZG9uJ3QgZG8gbm9kZV9tb2R1bGVzLlxuICAgIC8vIFRoZXJlIGlzIGEgY2hhbmNlIHRoYXQgc29tZW9uZSBuYW1lIGEgZmlsZSBwYXRoIGBoZWxsb19ub2RlX21vZHVsZXNgIG9yIHNvbWV0aGluZyBhbmQgd2VcbiAgICAvLyB3aWxsIGlnbm9yZSB0aGF0IGZpbGUgZm9yIHRoZSBwdXJwb3NlIG9mIGdhdGhlcmluZywgYnV0IHdlJ3JlIHdpbGxpbmcgdG8gdGFrZSB0aGUgcmlzay5cbiAgICBpZiAoXG4gICAgICAhbW9kdWxlLnJlc291cmNlIHx8XG4gICAgICAhbW9kdWxlLnJlc291cmNlLnN0YXJ0c1dpdGgodGhpcy5fcHJvamVjdFJvb3QpIHx8XG4gICAgICBtb2R1bGUucmVzb3VyY2UuaW5kZXhPZignbm9kZV9tb2R1bGVzJykgPj0gMFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENoZWNrIHRoYXQgaXQncyBhIHNvdXJjZSBmaWxlIGZyb20gdGhlIHByb2plY3QuXG4gICAgaWYgKG1vZHVsZS5yZXNvdXJjZS5lbmRzV2l0aCgnLnRzJykpIHtcbiAgICAgIHRoaXMuX2NoZWNrVHNOb3JtYWxNb2R1bGUobW9kdWxlKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NvbXBpbGF0aW9uKGNvbXBpbGVyOiBDb21waWxlciwgY29tcGlsYXRpb246IENvbXBpbGF0aW9uKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICBjb21waWxhdGlvbi5ob29rcy5zdWNjZWVkTW9kdWxlLnRhcCgnTmdCdWlsZEFuYWx5dGljc1BsdWdpbicsIHRoaXMuX3N1Y2NlZWRNb2R1bGUuYmluZCh0aGlzKSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2RvbmUoc3RhdHM6IFN0YXRzKSB7XG4gICAgdGhpcy5fY29sbGVjdEVycm9ycyhzdGF0cyk7XG4gICAgdGhpcy5fY29sbGVjdEJ1bmRsZVN0YXRzKHN0YXRzLmNvbXBpbGF0aW9uKTtcbiAgICBpZiAodGhpcy5fYnVpbHQpIHtcbiAgICAgIHRoaXMuX3JlcG9ydFJlYnVpbGRNZXRyaWNzKHN0YXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVwb3J0QnVpbGRNZXRyaWNzKHN0YXRzKTtcbiAgICAgIHRoaXMuX2J1aWx0ID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoXG4gICAgICAnTmdCdWlsZEFuYWx5dGljc1BsdWdpbicsXG4gICAgICB0aGlzLl9jb21waWxhdGlvbi5iaW5kKHRoaXMsIGNvbXBpbGVyKSxcbiAgICApO1xuICAgIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwKCdOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luJywgdGhpcy5fZG9uZS5iaW5kKHRoaXMpKTtcbiAgfVxufVxuIl19