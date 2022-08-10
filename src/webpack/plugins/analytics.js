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
            if (!chunk.rendered || chunk.files.size === 0) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL2FuYWx5dGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBaUQ7QUFDakQscUNBQTZFO0FBRTdFLE1BQU0sd0JBQXdCLEdBQUcsNkJBQTZCLENBQUM7QUFDL0QsTUFBTSx1QkFBdUIsR0FBRyxrQ0FBa0MsQ0FBQztBQUVuRTs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBYyxFQUFFLEtBQWEsRUFBRSxTQUFTLEdBQUcsS0FBSztJQUMvRSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7S0FDMUI7SUFFRCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDZCw2RUFBNkU7SUFDN0UsSUFBSSxTQUFTLEVBQUU7UUFDYixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEIsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ3hGLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2xGLEtBQUssRUFBRSxDQUFDLENBQUMsOENBQThD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dEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUM1Qix3QkFBd0IsRUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUN2QyxDQUFDO1FBQ0YsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDM0UsQ0FBQztDQUNGO0FBL0xELHdEQStMQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBhbmFseXRpY3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIE1vZHVsZSwgTm9ybWFsTW9kdWxlLCBTdGF0cyB9IGZyb20gJ3dlYnBhY2snO1xuXG5jb25zdCB3ZWJwYWNrQWxsRXJyb3JNZXNzYWdlUmUgPSAvXihbXihdKylcXChcXGQrLFxcZFxcKTogKC4qKSQvZ207XG5jb25zdCB3ZWJwYWNrVHNFcnJvck1lc3NhZ2VSZSA9IC9eW14oXStcXChcXGQrLFxcZFxcKTogZXJyb3IgKFRTXFxkKyk6LztcblxuLyoqXG4gKiBGYXN0ZXIgdGhhbiB1c2luZyBhIFJlZ0V4cCwgc28gd2UgdXNlIHRoaXMgdG8gY291bnQgb2NjdXJlbmNlcyBpbiBzb3VyY2UgY29kZS5cbiAqIEBwYXJhbSBzb3VyY2UgVGhlIHNvdXJjZSB0byBsb29rIGludG8uXG4gKiBAcGFyYW0gbWF0Y2ggVGhlIG1hdGNoIHN0cmluZyB0byBsb29rIGZvci5cbiAqIEBwYXJhbSB3b3JkQnJlYWsgV2hldGhlciB0byBjaGVjayBmb3Igd29yZCBicmVhayBiZWZvcmUgYW5kIGFmdGVyIGEgbWF0Y2ggd2FzIGZvdW5kLlxuICogQHJldHVybiBUaGUgbnVtYmVyIG9mIG1hdGNoZXMgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRPY2N1cnJlbmNlcyhzb3VyY2U6IHN0cmluZywgbWF0Y2g6IHN0cmluZywgd29yZEJyZWFrID0gZmFsc2UpOiBudW1iZXIge1xuICBpZiAobWF0Y2gubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gc291cmNlLmxlbmd0aCArIDE7XG4gIH1cblxuICBsZXQgY291bnQgPSAwO1xuICAvLyBXZSBjb25kaXRpb24gaGVyZSBzbyBicmFuY2ggcHJlZGljdGlvbiBoYXBwZW5zIG91dCBvZiB0aGUgbG9vcCwgbm90IGluIGl0LlxuICBpZiAod29yZEJyZWFrKSB7XG4gICAgY29uc3QgcmUgPSAvXFx3LztcbiAgICBmb3IgKGxldCBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gpOyBwb3MgPj0gMDsgcG9zID0gc291cmNlLmxhc3RJbmRleE9mKG1hdGNoLCBwb3MpKSB7XG4gICAgICBpZiAoIShyZS50ZXN0KHNvdXJjZVtwb3MgLSAxXSB8fCAnJykgfHwgcmUudGVzdChzb3VyY2VbcG9zICsgbWF0Y2gubGVuZ3RoXSB8fCAnJykpKSB7XG4gICAgICAgIGNvdW50Kys7IC8vIDEgbWF0Y2gsIEFIISBBSCEgQUghIDIgbWF0Y2hlcywgQUghIEFIISBBSCFcbiAgICAgIH1cblxuICAgICAgcG9zIC09IG1hdGNoLmxlbmd0aDtcbiAgICAgIGlmIChwb3MgPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGxldCBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gpOyBwb3MgPj0gMDsgcG9zID0gc291cmNlLmxhc3RJbmRleE9mKG1hdGNoLCBwb3MpKSB7XG4gICAgICBjb3VudCsrOyAvLyAxIG1hdGNoLCBBSCEgQUghIEFIISAyIG1hdGNoZXMsIEFIISBBSCEgQUghXG4gICAgICBwb3MgLT0gbWF0Y2gubGVuZ3RoO1xuICAgICAgaWYgKHBvcyA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvdW50O1xufVxuXG4vKipcbiAqIEhvbGRlciBvZiBzdGF0aXN0aWNzIHJlbGF0ZWQgdG8gdGhlIGJ1aWxkLlxuICovXG5jbGFzcyBBbmFseXRpY3NCdWlsZFN0YXRzIHtcbiAgcHVibGljIGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgcHVibGljIG51bWJlck9mTmdPbkluaXQgPSAwO1xuICBwdWJsaWMgbnVtYmVyT2ZDb21wb25lbnRzID0gMDtcbiAgcHVibGljIGluaXRpYWxDaHVua1NpemUgPSAwO1xuICBwdWJsaWMgdG90YWxDaHVua0NvdW50ID0gMDtcbiAgcHVibGljIHRvdGFsQ2h1bmtTaXplID0gMDtcbiAgcHVibGljIGxhenlDaHVua0NvdW50ID0gMDtcbiAgcHVibGljIGxhenlDaHVua1NpemUgPSAwO1xuICBwdWJsaWMgYXNzZXRDb3VudCA9IDA7XG4gIHB1YmxpYyBhc3NldFNpemUgPSAwO1xuICBwdWJsaWMgcG9seWZpbGxTaXplID0gMDtcbiAgcHVibGljIGNzc1NpemUgPSAwO1xufVxuXG4vKipcbiAqIEFuYWx5dGljcyBwbHVnaW4gdGhhdCByZXBvcnRzIHRoZSBhbmFseXRpY3Mgd2Ugd2FudCBmcm9tIHRoZSBDTEkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luIHtcbiAgcHJvdGVjdGVkIF9idWlsdCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgX3N0YXRzID0gbmV3IEFuYWx5dGljc0J1aWxkU3RhdHMoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgX3Byb2plY3RSb290OiBzdHJpbmcsXG4gICAgcHJvdGVjdGVkIF9hbmFseXRpY3M6IGFuYWx5dGljcy5BbmFseXRpY3MsXG4gICAgcHJvdGVjdGVkIF9jYXRlZ29yeTogc3RyaW5nLFxuICApIHt9XG5cbiAgcHJvdGVjdGVkIF9yZXNldCgpIHtcbiAgICB0aGlzLl9zdGF0cyA9IG5ldyBBbmFseXRpY3NCdWlsZFN0YXRzKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2dldE1ldHJpY3Moc3RhdHM6IFN0YXRzKSB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gKyhzdGF0cy5zdGFydFRpbWUgfHwgMCk7XG4gICAgY29uc3QgZW5kVGltZSA9ICsoc3RhdHMuZW5kVGltZSB8fCAwKTtcbiAgICBjb25zdCBtZXRyaWNzOiAoc3RyaW5nIHwgbnVtYmVyKVtdID0gW107XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkJ1aWxkVGltZV0gPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5OZ09uSW5pdENvdW50XSA9IHRoaXMuX3N0YXRzLm51bWJlck9mTmdPbkluaXQ7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLk5nQ29tcG9uZW50Q291bnRdID0gdGhpcy5fc3RhdHMubnVtYmVyT2ZDb21wb25lbnRzO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Jbml0aWFsQ2h1bmtTaXplXSA9IHRoaXMuX3N0YXRzLmluaXRpYWxDaHVua1NpemU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLlRvdGFsQ2h1bmtDb3VudF0gPSB0aGlzLl9zdGF0cy50b3RhbENodW5rQ291bnQ7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLlRvdGFsQ2h1bmtTaXplXSA9IHRoaXMuX3N0YXRzLnRvdGFsQ2h1bmtTaXplO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5MYXp5Q2h1bmtDb3VudF0gPSB0aGlzLl9zdGF0cy5sYXp5Q2h1bmtDb3VudDtcbiAgICBtZXRyaWNzW2FuYWx5dGljcy5OZ0NsaUFuYWx5dGljc01ldHJpY3MuTGF6eUNodW5rU2l6ZV0gPSB0aGlzLl9zdGF0cy5sYXp5Q2h1bmtTaXplO1xuICAgIG1ldHJpY3NbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzTWV0cmljcy5Bc3NldENvdW50XSA9IHRoaXMuX3N0YXRzLmFzc2V0Q291bnQ7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkFzc2V0U2l6ZV0gPSB0aGlzLl9zdGF0cy5hc3NldFNpemU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLlBvbHlmaWxsU2l6ZV0gPSB0aGlzLl9zdGF0cy5wb2x5ZmlsbFNpemU7XG4gICAgbWV0cmljc1thbmFseXRpY3MuTmdDbGlBbmFseXRpY3NNZXRyaWNzLkNzc1NpemVdID0gdGhpcy5fc3RhdHMuY3NzU2l6ZTtcblxuICAgIHJldHVybiBtZXRyaWNzO1xuICB9XG4gIHByb3RlY3RlZCBfZ2V0RGltZW5zaW9ucygpIHtcbiAgICBjb25zdCBkaW1lbnNpb25zOiAoc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbilbXSA9IFtdO1xuXG4gICAgaWYgKHRoaXMuX3N0YXRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIC8vIEFkZGluZyBjb21tYXMgYmVmb3JlIGFuZCBhZnRlciBzbyB0aGUgcmVnZXggYXJlIGVhc2llciB0byBkZWZpbmUgZmlsdGVycy5cbiAgICAgIGRpbWVuc2lvbnNbYW5hbHl0aWNzLk5nQ2xpQW5hbHl0aWNzRGltZW5zaW9ucy5CdWlsZEVycm9yc10gPSBgLCR7dGhpcy5fc3RhdHMuZXJyb3JzLmpvaW4oKX0sYDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGltZW5zaW9ucztcbiAgfVxuXG4gIHByb3RlY3RlZCBfcmVwb3J0QnVpbGRNZXRyaWNzKHN0YXRzOiBTdGF0cykge1xuICAgIGNvbnN0IGRpbWVuc2lvbnMgPSB0aGlzLl9nZXREaW1lbnNpb25zKCk7XG4gICAgY29uc3QgbWV0cmljcyA9IHRoaXMuX2dldE1ldHJpY3Moc3RhdHMpO1xuICAgIHRoaXMuX2FuYWx5dGljcy5ldmVudCh0aGlzLl9jYXRlZ29yeSwgJ2J1aWxkJywgeyBkaW1lbnNpb25zLCBtZXRyaWNzIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9yZXBvcnRSZWJ1aWxkTWV0cmljcyhzdGF0czogU3RhdHMpIHtcbiAgICBjb25zdCBkaW1lbnNpb25zID0gdGhpcy5fZ2V0RGltZW5zaW9ucygpO1xuICAgIGNvbnN0IG1ldHJpY3MgPSB0aGlzLl9nZXRNZXRyaWNzKHN0YXRzKTtcbiAgICB0aGlzLl9hbmFseXRpY3MuZXZlbnQodGhpcy5fY2F0ZWdvcnksICdyZWJ1aWxkJywgeyBkaW1lbnNpb25zLCBtZXRyaWNzIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9jaGVja1RzTm9ybWFsTW9kdWxlKG1vZHVsZTogTm9ybWFsTW9kdWxlKSB7XG4gICAgY29uc3Qgb3JpZ2luYWxTb3VyY2UgPSBtb2R1bGUub3JpZ2luYWxTb3VyY2UoKTtcbiAgICBpZiAoIW9yaWdpbmFsU291cmNlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxDb250ZW50ID0gb3JpZ2luYWxTb3VyY2Uuc291cmNlKCkudG9TdHJpbmcoKTtcblxuICAgIC8vIFBMRUFTRSBSRU1FTUJFUjpcbiAgICAvLyBXZSdyZSBkZWFsaW5nIHdpdGggRVM1IF9vcl8gRVMyMDE1IEphdmFTY3JpcHQgYXQgdGhpcyBwb2ludCAod2UgZG9uJ3Qga25vdyBmb3Igc3VyZSkuXG5cbiAgICAvLyBKdXN0IGNvdW50IHRoZSBuZ09uSW5pdCBvY2N1cmVuY2VzLiBDb21tZW50cy9TdHJpbmdzL2NhbGxzIG9jY3VyZW5jZXMgc2hvdWxkIGJlIHNwYXJzZVxuICAgIC8vIHNvIHdlIGp1c3QgY29uc2lkZXIgdGhlbSB3aXRoaW4gdGhlIG1hcmdpbiBvZiBlcnJvci4gV2UgZG8gYnJlYWsgb24gd29yZCBicmVhayB0aG91Z2guXG4gICAgdGhpcy5fc3RhdHMubnVtYmVyT2ZOZ09uSW5pdCArPSBjb3VudE9jY3VycmVuY2VzKG9yaWdpbmFsQ29udGVudCwgJ25nT25Jbml0JywgdHJ1ZSk7XG5cbiAgICAvLyBDb3VudCB0aGUgbnVtYmVyIG9mIGBDb21wb25lbnQoe2Agc3RyaW5ncyAoY2FzZSBzZW5zaXRpdmUpLCB3aGljaCBoYXBwZW5zIGluIF9fZGVjb3JhdGUoKS5cbiAgICB0aGlzLl9zdGF0cy5udW1iZXJPZkNvbXBvbmVudHMgKz0gY291bnRPY2N1cnJlbmNlcyhvcmlnaW5hbENvbnRlbnQsICdDb21wb25lbnQoeycpO1xuICAgIC8vIEZvciBJdnkgd2UganVzdCBjb3VudCDJtWNtcC5cbiAgICB0aGlzLl9zdGF0cy5udW1iZXJPZkNvbXBvbmVudHMgKz0gY291bnRPY2N1cnJlbmNlcyhvcmlnaW5hbENvbnRlbnQsICcuybVjbXAnLCB0cnVlKTtcbiAgICAvLyBmb3IgYXNjaWlfb25seSB0cnVlXG4gICAgdGhpcy5fc3RhdHMubnVtYmVyT2ZDb21wb25lbnRzICs9IGNvdW50T2NjdXJyZW5jZXMob3JpZ2luYWxDb250ZW50LCAnLlxcdTAyNzVjbXAnLCB0cnVlKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY29sbGVjdEVycm9ycyhzdGF0czogU3RhdHMpIHtcbiAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgIGZvciAoY29uc3QgZXJyT2JqZWN0IG9mIHN0YXRzLmNvbXBpbGF0aW9uLmVycm9ycykge1xuICAgICAgICBpZiAoZXJyT2JqZWN0IGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBhbGxFcnJvcnMgPSBlcnJPYmplY3QubWVzc2FnZS5tYXRjaCh3ZWJwYWNrQWxsRXJyb3JNZXNzYWdlUmUpO1xuICAgICAgICAgIGZvciAoY29uc3QgZXJyIG9mIFsuLi4oYWxsRXJyb3JzIHx8IFtdKV0uc2xpY2UoMSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSAoZXJyLm1hdGNoKHdlYnBhY2tUc0Vycm9yTWVzc2FnZVJlKSB8fCBbXSlbMV07XG4gICAgICAgICAgICBpZiAobWVzc2FnZSkge1xuICAgICAgICAgICAgICAvLyBBdCB0aGlzIHBvaW50IHRoaXMgc2hvdWxkIGJlIGEgVFMxMjM0LlxuICAgICAgICAgICAgICB0aGlzLl9zdGF0cy5lcnJvcnMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NvbGxlY3RCdW5kbGVTdGF0cyhjb21waWxhdGlvbjogQ29tcGlsYXRpb24pIHtcbiAgICBjb25zdCBjaHVua0Fzc2V0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY29tcGlsYXRpb24uY2h1bmtzKSB7XG4gICAgICBpZiAoIWNodW5rLnJlbmRlcmVkIHx8IGNodW5rLmZpbGVzLnNpemUgPT09IDApIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpcnN0RmlsZSA9IEFycmF5LmZyb20oY2h1bmsuZmlsZXMpWzBdO1xuICAgICAgY29uc3Qgc2l6ZSA9IGNvbXBpbGF0aW9uLmdldEFzc2V0KGZpcnN0RmlsZSk/LnNvdXJjZS5zaXplKCkgPz8gMDtcbiAgICAgIGNodW5rQXNzZXRzLmFkZChmaXJzdEZpbGUpO1xuXG4gICAgICBpZiAoY2h1bmsuY2FuQmVJbml0aWFsKCkpIHtcbiAgICAgICAgdGhpcy5fc3RhdHMuaW5pdGlhbENodW5rU2l6ZSArPSBzaXplO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc3RhdHMubGF6eUNodW5rQ291bnQrKztcbiAgICAgICAgdGhpcy5fc3RhdHMubGF6eUNodW5rU2l6ZSArPSBzaXplO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zdGF0cy50b3RhbENodW5rQ291bnQrKztcbiAgICAgIHRoaXMuX3N0YXRzLnRvdGFsQ2h1bmtTaXplICs9IHNpemU7XG5cbiAgICAgIGlmIChmaXJzdEZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICB0aGlzLl9zdGF0cy5jc3NTaXplICs9IHNpemU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBhc3NldCBvZiBjb21waWxhdGlvbi5nZXRBc3NldHMoKSkge1xuICAgICAgLy8gT25seSBjb3VudCBub24tSmF2YVNjcmlwdCByZWxhdGVkIGZpbGVzXG4gICAgICBpZiAoY2h1bmtBc3NldHMuaGFzKGFzc2V0Lm5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zdGF0cy5hc3NldFNpemUgKz0gYXNzZXQuc291cmNlLnNpemUoKTtcbiAgICAgIHRoaXMuX3N0YXRzLmFzc2V0Q291bnQrKztcblxuICAgICAgaWYgKGFzc2V0Lm5hbWUgPT0gJ3BvbHlmaWxsJykge1xuICAgICAgICB0aGlzLl9zdGF0cy5wb2x5ZmlsbFNpemUgKz0gYXNzZXQuc291cmNlLnNpemUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgKiBUaGUgbmV4dCBzZWN0aW9uIGlzIGFsbCB0aGUgZGlmZmVyZW50IFdlYnBhY2sgaG9va3MgZm9yIHRoaXMgcGx1Z2luLlxuICAgKi9cblxuICAvKipcbiAgICogUmVwb3J0cyBhIHN1Y2NlZWQgbW9kdWxlLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJvdGVjdGVkIF9zdWNjZWVkTW9kdWxlKG1vZHVsZTogTW9kdWxlKSB7XG4gICAgLy8gT25seSByZXBvcnQgTm9ybWFsTW9kdWxlIGluc3RhbmNlcy5cbiAgICBpZiAoIShtb2R1bGUgaW5zdGFuY2VvZiBOb3JtYWxNb2R1bGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT25seSByZXBvcnRzIG1vZHVsZXMgdGhhdCBhcmUgcGFydCBvZiB0aGUgdXNlcidzIHByb2plY3QuIFdlIGFsc28gZG9uJ3QgZG8gbm9kZV9tb2R1bGVzLlxuICAgIC8vIFRoZXJlIGlzIGEgY2hhbmNlIHRoYXQgc29tZW9uZSBuYW1lIGEgZmlsZSBwYXRoIGBoZWxsb19ub2RlX21vZHVsZXNgIG9yIHNvbWV0aGluZyBhbmQgd2VcbiAgICAvLyB3aWxsIGlnbm9yZSB0aGF0IGZpbGUgZm9yIHRoZSBwdXJwb3NlIG9mIGdhdGhlcmluZywgYnV0IHdlJ3JlIHdpbGxpbmcgdG8gdGFrZSB0aGUgcmlzay5cbiAgICBpZiAoXG4gICAgICAhbW9kdWxlLnJlc291cmNlIHx8XG4gICAgICAhbW9kdWxlLnJlc291cmNlLnN0YXJ0c1dpdGgodGhpcy5fcHJvamVjdFJvb3QpIHx8XG4gICAgICBtb2R1bGUucmVzb3VyY2UuaW5kZXhPZignbm9kZV9tb2R1bGVzJykgPj0gMFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENoZWNrIHRoYXQgaXQncyBhIHNvdXJjZSBmaWxlIGZyb20gdGhlIHByb2plY3QuXG4gICAgaWYgKG1vZHVsZS5yZXNvdXJjZS5lbmRzV2l0aCgnLnRzJykpIHtcbiAgICAgIHRoaXMuX2NoZWNrVHNOb3JtYWxNb2R1bGUobW9kdWxlKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NvbXBpbGF0aW9uKGNvbXBpbGVyOiBDb21waWxlciwgY29tcGlsYXRpb246IENvbXBpbGF0aW9uKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICBjb21waWxhdGlvbi5ob29rcy5zdWNjZWVkTW9kdWxlLnRhcCgnTmdCdWlsZEFuYWx5dGljc1BsdWdpbicsIHRoaXMuX3N1Y2NlZWRNb2R1bGUuYmluZCh0aGlzKSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2RvbmUoc3RhdHM6IFN0YXRzKSB7XG4gICAgdGhpcy5fY29sbGVjdEVycm9ycyhzdGF0cyk7XG4gICAgdGhpcy5fY29sbGVjdEJ1bmRsZVN0YXRzKHN0YXRzLmNvbXBpbGF0aW9uKTtcbiAgICBpZiAodGhpcy5fYnVpbHQpIHtcbiAgICAgIHRoaXMuX3JlcG9ydFJlYnVpbGRNZXRyaWNzKHN0YXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVwb3J0QnVpbGRNZXRyaWNzKHN0YXRzKTtcbiAgICAgIHRoaXMuX2J1aWx0ID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoXG4gICAgICAnTmdCdWlsZEFuYWx5dGljc1BsdWdpbicsXG4gICAgICB0aGlzLl9jb21waWxhdGlvbi5iaW5kKHRoaXMsIGNvbXBpbGVyKSxcbiAgICApO1xuICAgIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwKCdOZ0J1aWxkQW5hbHl0aWNzUGx1Z2luJywgdGhpcy5fZG9uZS5iaW5kKHRoaXMpKTtcbiAgfVxufVxuIl19