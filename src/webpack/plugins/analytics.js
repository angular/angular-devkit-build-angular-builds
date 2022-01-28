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
    constructor(_projectRoot, _analytics, _category, aotEnabled) {
        this._projectRoot = _projectRoot;
        this._analytics = _analytics;
        this._category = _category;
        this.aotEnabled = aotEnabled;
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
        dimensions[core_1.analytics.NgCliAnalyticsDimensions.AotEnabled] = this.aotEnabled;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2FuYWx5dGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBaUQ7QUFDakQscUNBQTZFO0FBRTdFLE1BQU0sd0JBQXdCLEdBQUcsNkJBQTZCLENBQUM7QUFDL0QsTUFBTSx1QkFBdUIsR0FBRyxrQ0FBa0MsQ0FBQztBQUVuRTs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBYyxFQUFFLEtBQWEsRUFBRSxTQUFTLEdBQUcsS0FBSztJQUMvRSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7S0FDMUI7SUFFRCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDZCw2RUFBNkU7SUFDN0UsSUFBSSxTQUFTLEVBQUU7UUFDYixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEIsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ3hGLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2xGLEtBQUssRUFBRSxDQUFDLENBQUMsOENBQThD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QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztTQUNwQjtJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUM1Qix3QkFBd0IsRUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUN2QyxDQUFDO1FBQ0YsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDM0UsQ0FBQztDQUNGO0FBbE1ELHdEQWtNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBhbmFseXRpY3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIE1vZHVsZSwgTm9ybWFsTW9kdWxlLCBTdGF0cyB9IGZyb20gJ3dlYnBhY2snO1xuXG5jb25zdCB3ZWJwYWNrQWxsRXJyb3JNZXNzYWdlUmUgPSAvXihbXihdKylcXChcXGQrLFxcZFxcKTogKC4qKSQvZ207XG5jb25zdCB3ZWJwYWNrVHNFcnJvck1lc3NhZ2VSZSA9IC9eW14oXStcXChcXGQrLFxcZFxcKTogZXJyb3IgKFRTXFxkKyk6LztcblxuLyoqXG4gKiBGYXN0ZXIgdGhhbiB1c2luZyBhIFJlZ0V4cCwgc28gd2UgdXNlIHRoaXMgdG8gY291bnQgb2NjdXJlbmNlcyBpbiBzb3VyY2UgY29kZS5cbiAqIEBwYXJhbSBzb3VyY2UgVGhlIHNvdXJjZSB0byBsb29rIGludG8uXG4gKiBAcGFyYW0gbWF0Y2ggVGhlIG1hdGNoIHN0cmluZyB0byBsb29rIGZvci5cbiAqIEBwYXJhbSB3b3JkQnJlYWsgV2hldGhlciB0byBjaGVjayBmb3Igd29yZCBicmVhayBiZWZvcmUgYW5kIGFmdGVyIGEgbWF0Y2ggd2FzIGZvdW5kLlxuICogQHJldHVybiBUaGUgbnVtYmVyIG9mIG1hdGNoZXMgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRPY2N1cnJlbmNlcyhzb3VyY2U6IHN0cmluZywgbWF0Y2g6IHN0cmluZywgd29yZEJyZWFrID0gZmFsc2UpOiBudW1iZXIge1xuICBpZiAobWF0Y2gubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gc291cmNlLmxlbmd0aCArIDE7XG4gIH1cblxuICBsZXQgY291bnQgPSAwO1xuICAvLyBXZSBjb25kaXRpb24gaGVyZSBzbyBicmFuY2ggcHJlZGljdGlvbiBoYXBwZW5zIG91dCBvZiB0aGUgbG9vcCwgbm90IGluIGl0LlxuICBpZiAod29yZEJyZWFrKSB7XG4gICAgY29uc3QgcmUgPSAvXFx3LztcbiAgICBmb3IgKGxldCBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gpOyBwb3MgPj0gMDsgcG9zID0gc291cmNlLmxhc3RJbmRleE9mKG1hdGNoLCBwb3MpKSB7XG4gICAgICBpZiAoIShyZS50ZXN0KHNvdXJjZVtwb3MgLSAxXSB8fCAnJykgfHwgcmUudGVzdChzb3VyY2VbcG9zICsgbWF0Y2gubGVuZ3RoXSB8fCAnJykpKSB7XG4gICAgICAgIGNvdW50Kys7IC8vIDEgbWF0Y2gsIEFIISBBSCEgQUghIDIgbWF0Y2hlcywgQUghIEFIISBBSCFcbiAgICAgIH1cblxuICAgICAgcG9zIC09IG1hdGNoLmxlbmd0aDtcbiAgICAgIGlmIChwb3MgPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGxldCBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gpOyBwb3MgPj0gMDsgcG9zID0gc291cmNlLmxhc3RJbmRleE9mKG1hdGNoLCBwb3MpKSB7XG4gICAgICBjb3VudCsrOyAvLyAxIG1hdGNoLCBBSCEgQUghIEFIISAyIG1hdGNoZXMsIEFIISBBSCEgQUghXG4gICAgICBwb3MgLT0gbWF0Y2gubGVuZ3RoO1xuICAgICAgaWYgKHBvcyA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvdW50O1xufVxuXG4vKipcbiAqIEhvbGRlciBvZiBzdGF0aXN0aWNzIHJlbGF0ZWQgdG8gdGhlIGJ1aWxkLlxuICovXG5jbGFzcyBBbmFseXRpY3NCdWlsZFN0YXRzIHtcbiAgcHVibGljIGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgcHVibGljIG51bWJlck9mTmdPbkluaXQgPSAwO1xuICBwdWJsaWMgbnVtYmVyT2ZDb21wb25lbnRzID0gMDtcbiAgcHVibGljIGluaXRpYWxDaHVua1NpemUgPSAwO1xuICBwdWJsaWMgdG90YWxDaHVua0NvdW50ID0gMDtcbiAgcHVibGljIHRvdGFsQ2h1bmtTaXplID0gMDtcbiAgcHVibGljIGxhenlDaHVua0NvdW50ID0gMDtcbiAgcHVibGljIGxhenlDaHVua1NpemUgPSAwO1xuICBwdWJsaWMgYXNzZXRDb3VudCA9IDA7XG4gIHB1YmxpYyBhc3NldFNpemUgPSAwO1xuICBwdWJsaWMgcG9seWZpbGxTaXplID0gMDtcbiAgcHVibGljIGNzc1NpemUgPSAwO1xufVxuXG4vKipcbiAqIEFuYWx5dGljcyBwbHVnaW4gdGhhdCByZXBvcnRzIHRoZSBhbmFseXRpY3Mgd2Ugd2FudCBmcm9tIHRoZSBDTEkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luIHtcbiAgcHJvdGVjdGVkIF9idWlsdCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgX3N0YXRzID0gbmV3IEFuYWx5dGljc0J1aWxkU3RhdHMoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgX3Byb2plY3RSb290OiBzdHJpbmcsXG4gICAgcHJvdGVjdGVkIF9hbmFseXRpY3M6IGFuYWx5dGljcy5BbmFseXRpY3MsXG4gICAgcHJvdGVjdGVkIF9jYXRlZ29yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgYW90RW5hYmxlZDogYm9vbGVhbixcbiAgKSB7fVxuXG4gIHByb3RlY3RlZCBfcmVzZXQoKSB7XG4gICAgdGhpcy5fc3RhdHMgPSBuZXcgQW5hbHl0aWNzQnVpbGRTdGF0cygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9nZXRNZXRyaWNzKHN0YXRzOiBTdGF0cykge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9ICsoc3RhdHMuc3RhcnRUaW1lIHx8IDApO1xuICAgIGNvbnN0IGVuZFRpbWUgPSArKHN0YXRzLmVuZFRpbWUgfHwgMCk7XG4gICAgY29uc3QgbWV0cmljczogKHN0cmluZyB8IG51bWJlcilbXSA9IFtdO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5CdWlsZFRpbWVdID0gZW5kVGltZSAtIHN0YXJ0VGltZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuTmdPbkluaXRDb3VudF0gPSB0aGlzLl9zdGF0cy5udW1iZXJPZk5nT25Jbml0O1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5OZ0NvbXBvbmVudENvdW50XSA9IHRoaXMuX3N0YXRzLm51bWJlck9mQ29tcG9uZW50cztcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuSW5pdGlhbENodW5rU2l6ZV0gPSB0aGlzLl9zdGF0cy5pbml0aWFsQ2h1bmtTaXplO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Ub3RhbENodW5rQ291bnRdID0gdGhpcy5fc3RhdHMudG90YWxDaHVua0NvdW50O1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Ub3RhbENodW5rU2l6ZV0gPSB0aGlzLl9zdGF0cy50b3RhbENodW5rU2l6ZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuTGF6eUNodW5rQ291bnRdID0gdGhpcy5fc3RhdHMubGF6eUNodW5rQ291bnQ7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkxhenlDaHVua1NpemVdID0gdGhpcy5fc3RhdHMubGF6eUNodW5rU2l6ZTtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuQXNzZXRDb3VudF0gPSB0aGlzLl9zdGF0cy5hc3NldENvdW50O1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Bc3NldFNpemVdID0gdGhpcy5fc3RhdHMuYXNzZXRTaXplO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Qb2x5ZmlsbFNpemVdID0gdGhpcy5fc3RhdHMucG9seWZpbGxTaXplO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Dc3NTaXplXSA9IHRoaXMuX3N0YXRzLmNzc1NpemU7XG5cbiAgICByZXR1cm4gbWV0cmljcztcbiAgfVxuICBwcm90ZWN0ZWQgX2dldERpbWVuc2lvbnMoKSB7XG4gICAgY29uc3QgZGltZW5zaW9uczogKHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4pW10gPSBbXTtcblxuICAgIGlmICh0aGlzLl9zdGF0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAvLyBBZGRpbmcgY29tbWFzIGJlZm9yZSBhbmQgYWZ0ZXIgc28gdGhlIHJlZ2V4IGFyZSBlYXNpZXIgdG8gZGVmaW5lIGZpbHRlcnMuXG4gICAgICBkaW1lbnNpb25zW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc0RpbWVuc2lvbnMuQnVpbGRFcnJvcnNdID0gYCwke3RoaXMuX3N0YXRzLmVycm9ycy5qb2luKCl9LGA7XG4gICAgfVxuXG4gICAgZGltZW5zaW9uc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NEaW1lbnNpb25zLkFvdEVuYWJsZWRdID0gdGhpcy5hb3RFbmFibGVkO1xuXG4gICAgcmV0dXJuIGRpbWVuc2lvbnM7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3JlcG9ydEJ1aWxkTWV0cmljcyhzdGF0czogU3RhdHMpIHtcbiAgICBjb25zdCBkaW1lbnNpb25zID0gdGhpcy5fZ2V0RGltZW5zaW9ucygpO1xuICAgIGNvbnN0IG1ldHJpY3MgPSB0aGlzLl9nZXRNZXRyaWNzKHN0YXRzKTtcbiAgICB0aGlzLl9hbmFseXRpY3MuZXZlbnQodGhpcy5fY2F0ZWdvcnksICdidWlsZCcsIHsgZGltZW5zaW9ucywgbWV0cmljcyB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfcmVwb3J0UmVidWlsZE1ldHJpY3Moc3RhdHM6IFN0YXRzKSB7XG4gICAgY29uc3QgZGltZW5zaW9ucyA9IHRoaXMuX2dldERpbWVuc2lvbnMoKTtcbiAgICBjb25zdCBtZXRyaWNzID0gdGhpcy5fZ2V0TWV0cmljcyhzdGF0cyk7XG4gICAgdGhpcy5fYW5hbHl0aWNzLmV2ZW50KHRoaXMuX2NhdGVnb3J5LCAncmVidWlsZCcsIHsgZGltZW5zaW9ucywgbWV0cmljcyB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY2hlY2tUc05vcm1hbE1vZHVsZShtb2R1bGU6IE5vcm1hbE1vZHVsZSkge1xuICAgIGNvbnN0IG9yaWdpbmFsU291cmNlID0gbW9kdWxlLm9yaWdpbmFsU291cmNlKCk7XG4gICAgaWYgKCFvcmlnaW5hbFNvdXJjZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9yaWdpbmFsQ29udGVudCA9IG9yaWdpbmFsU291cmNlLnNvdXJjZSgpLnRvU3RyaW5nKCk7XG5cbiAgICAvLyBQTEVBU0UgUkVNRU1CRVI6XG4gICAgLy8gV2UncmUgZGVhbGluZyB3aXRoIEVTNSBfb3JfIEVTMjAxNSBKYXZhU2NyaXB0IGF0IHRoaXMgcG9pbnQgKHdlIGRvbid0IGtub3cgZm9yIHN1cmUpLlxuXG4gICAgLy8gSnVzdCBjb3VudCB0aGUgbmdPbkluaXQgb2NjdXJlbmNlcy4gQ29tbWVudHMvU3RyaW5ncy9jYWxscyBvY2N1cmVuY2VzIHNob3VsZCBiZSBzcGFyc2VcbiAgICAvLyBzbyB3ZSBqdXN0IGNvbnNpZGVyIHRoZW0gd2l0aGluIHRoZSBtYXJnaW4gb2YgZXJyb3IuIFdlIGRvIGJyZWFrIG9uIHdvcmQgYnJlYWsgdGhvdWdoLlxuICAgIHRoaXMuX3N0YXRzLm51bWJlck9mTmdPbkluaXQgKz0gY291bnRPY2N1cnJlbmNlcyhvcmlnaW5hbENvbnRlbnQsICduZ09uSW5pdCcsIHRydWUpO1xuXG4gICAgLy8gQ291bnQgdGhlIG51bWJlciBvZiBgQ29tcG9uZW50KHtgIHN0cmluZ3MgKGNhc2Ugc2Vuc2l0aXZlKSwgd2hpY2ggaGFwcGVucyBpbiBfX2RlY29yYXRlKCkuXG4gICAgdGhpcy5fc3RhdHMubnVtYmVyT2ZDb21wb25lbnRzICs9IGNvdW50T2NjdXJyZW5jZXMob3JpZ2luYWxDb250ZW50LCAnQ29tcG9uZW50KHsnKTtcbiAgICAvLyBGb3IgSXZ5IHdlIGp1c3QgY291bnQgybVjbXAuXG4gICAgdGhpcy5fc3RhdHMubnVtYmVyT2ZDb21wb25lbnRzICs9IGNvdW50T2NjdXJyZW5jZXMob3JpZ2luYWxDb250ZW50LCAnLsm1Y21wJywgdHJ1ZSk7XG4gICAgLy8gZm9yIGFzY2lpX29ubHkgdHJ1ZVxuICAgIHRoaXMuX3N0YXRzLm51bWJlck9mQ29tcG9uZW50cyArPSBjb3VudE9jY3VycmVuY2VzKG9yaWdpbmFsQ29udGVudCwgJy5cXHUwMjc1Y21wJywgdHJ1ZSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NvbGxlY3RFcnJvcnMoc3RhdHM6IFN0YXRzKSB7XG4gICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICBmb3IgKGNvbnN0IGVyck9iamVjdCBvZiBzdGF0cy5jb21waWxhdGlvbi5lcnJvcnMpIHtcbiAgICAgICAgaWYgKGVyck9iamVjdCBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgY29uc3QgYWxsRXJyb3JzID0gZXJyT2JqZWN0Lm1lc3NhZ2UubWF0Y2god2VicGFja0FsbEVycm9yTWVzc2FnZVJlKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGVyciBvZiBbLi4uKGFsbEVycm9ycyB8fCBbXSldLnNsaWNlKDEpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gKGVyci5tYXRjaCh3ZWJwYWNrVHNFcnJvck1lc3NhZ2VSZSkgfHwgW10pWzFdO1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgLy8gQXQgdGhpcyBwb2ludCB0aGlzIHNob3VsZCBiZSBhIFRTMTIzNC5cbiAgICAgICAgICAgICAgdGhpcy5fc3RhdHMuZXJyb3JzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIF9jb2xsZWN0QnVuZGxlU3RhdHMoY29tcGlsYXRpb246IENvbXBpbGF0aW9uKSB7XG4gICAgY29uc3QgY2h1bmtBc3NldHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGNvbXBpbGF0aW9uLmNodW5rcykge1xuICAgICAgaWYgKCFjaHVuay5yZW5kZXJlZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlyc3RGaWxlID0gQXJyYXkuZnJvbShjaHVuay5maWxlcylbMF07XG4gICAgICBjb25zdCBzaXplID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoZmlyc3RGaWxlKT8uc291cmNlLnNpemUoKSA/PyAwO1xuICAgICAgY2h1bmtBc3NldHMuYWRkKGZpcnN0RmlsZSk7XG5cbiAgICAgIGlmIChjaHVuay5jYW5CZUluaXRpYWwoKSkge1xuICAgICAgICB0aGlzLl9zdGF0cy5pbml0aWFsQ2h1bmtTaXplICs9IHNpemU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9zdGF0cy5sYXp5Q2h1bmtDb3VudCsrO1xuICAgICAgICB0aGlzLl9zdGF0cy5sYXp5Q2h1bmtTaXplICs9IHNpemU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3N0YXRzLnRvdGFsQ2h1bmtDb3VudCsrO1xuICAgICAgdGhpcy5fc3RhdHMudG90YWxDaHVua1NpemUgKz0gc2l6ZTtcblxuICAgICAgaWYgKGZpcnN0RmlsZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIHRoaXMuX3N0YXRzLmNzc1NpemUgKz0gc2l6ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGNvbXBpbGF0aW9uLmdldEFzc2V0cygpKSB7XG4gICAgICAvLyBPbmx5IGNvdW50IG5vbi1KYXZhU2NyaXB0IHJlbGF0ZWQgZmlsZXNcbiAgICAgIGlmIChjaHVua0Fzc2V0cy5oYXMoYXNzZXQubmFtZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3N0YXRzLmFzc2V0U2l6ZSArPSBhc3NldC5zb3VyY2Uuc2l6ZSgpO1xuICAgICAgdGhpcy5fc3RhdHMuYXNzZXRDb3VudCsrO1xuXG4gICAgICBpZiAoYXNzZXQubmFtZSA9PSAncG9seWZpbGwnKSB7XG4gICAgICAgIHRoaXMuX3N0YXRzLnBvbHlmaWxsU2l6ZSArPSBhc3NldC5zb3VyY2Uuc2l6ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAqIFRoZSBuZXh0IHNlY3Rpb24gaXMgYWxsIHRoZSBkaWZmZXJlbnQgV2VicGFjayBob29rcyBmb3IgdGhpcyBwbHVnaW4uXG4gICAqL1xuXG4gIC8qKlxuICAgKiBSZXBvcnRzIGEgc3VjY2VlZCBtb2R1bGUuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcm90ZWN0ZWQgX3N1Y2NlZWRNb2R1bGUobW9kdWxlOiBNb2R1bGUpIHtcbiAgICAvLyBPbmx5IHJlcG9ydCBOb3JtYWxNb2R1bGUgaW5zdGFuY2VzLlxuICAgIGlmICghKG1vZHVsZSBpbnN0YW5jZW9mIE5vcm1hbE1vZHVsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBPbmx5IHJlcG9ydHMgbW9kdWxlcyB0aGF0IGFyZSBwYXJ0IG9mIHRoZSB1c2VyJ3MgcHJvamVjdC4gV2UgYWxzbyBkb24ndCBkbyBub2RlX21vZHVsZXMuXG4gICAgLy8gVGhlcmUgaXMgYSBjaGFuY2UgdGhhdCBzb21lb25lIG5hbWUgYSBmaWxlIHBhdGggYGhlbGxvX25vZGVfbW9kdWxlc2Agb3Igc29tZXRoaW5nIGFuZCB3ZVxuICAgIC8vIHdpbGwgaWdub3JlIHRoYXQgZmlsZSBmb3IgdGhlIHB1cnBvc2Ugb2YgZ2F0aGVyaW5nLCBidXQgd2UncmUgd2lsbGluZyB0byB0YWtlIHRoZSByaXNrLlxuICAgIGlmIChcbiAgICAgICFtb2R1bGUucmVzb3VyY2UgfHxcbiAgICAgICFtb2R1bGUucmVzb3VyY2Uuc3RhcnRzV2l0aCh0aGlzLl9wcm9qZWN0Um9vdCkgfHxcbiAgICAgIG1vZHVsZS5yZXNvdXJjZS5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdGhhdCBpdCdzIGEgc291cmNlIGZpbGUgZnJvbSB0aGUgcHJvamVjdC5cbiAgICBpZiAobW9kdWxlLnJlc291cmNlLmVuZHNXaXRoKCcudHMnKSkge1xuICAgICAgdGhpcy5fY2hlY2tUc05vcm1hbE1vZHVsZShtb2R1bGUpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBfY29tcGlsYXRpb24oY29tcGlsZXI6IENvbXBpbGVyLCBjb21waWxhdGlvbjogQ29tcGlsYXRpb24pIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIGNvbXBpbGF0aW9uLmhvb2tzLnN1Y2NlZWRNb2R1bGUudGFwKCdOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luJywgdGhpcy5fc3VjY2VlZE1vZHVsZS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfZG9uZShzdGF0czogU3RhdHMpIHtcbiAgICB0aGlzLl9jb2xsZWN0RXJyb3JzKHN0YXRzKTtcbiAgICB0aGlzLl9jb2xsZWN0QnVuZGxlU3RhdHMoc3RhdHMuY29tcGlsYXRpb24pO1xuICAgIGlmICh0aGlzLl9idWlsdCkge1xuICAgICAgdGhpcy5fcmVwb3J0UmVidWlsZE1ldHJpY3Moc3RhdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZXBvcnRCdWlsZE1ldHJpY3Moc3RhdHMpO1xuICAgICAgdGhpcy5fYnVpbHQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcChcbiAgICAgICdOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luJyxcbiAgICAgIHRoaXMuX2NvbXBpbGF0aW9uLmJpbmQodGhpcywgY29tcGlsZXIpLFxuICAgICk7XG4gICAgY29tcGlsZXIuaG9va3MuZG9uZS50YXAoJ05nQnVpbGRBbmFseXRpY3NQbHVnaW4nLCB0aGlzLl9kb25lLmJpbmQodGhpcykpO1xuICB9XG59XG4iXX0=