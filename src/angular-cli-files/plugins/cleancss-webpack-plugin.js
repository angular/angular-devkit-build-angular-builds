"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_sources_1 = require("webpack-sources");
const CleanCSS = require('clean-css');
function hook(compiler, action) {
    compiler.hooks.compilation.tap('cleancss-webpack-plugin', (compilation) => {
        compilation.hooks.optimizeChunkAssets.tapPromise('cleancss-webpack-plugin', (chunks) => action(compilation, chunks));
    });
}
class CleanCssWebpackPlugin {
    constructor(options) {
        this._options = Object.assign({ sourceMap: false, test: (file) => file.endsWith('.css') }, options);
    }
    apply(compiler) {
        hook(compiler, (compilation, chunks) => {
            const cleancss = new CleanCSS({
                compatibility: 'ie9',
                level: {
                    2: {
                        skipProperties: [
                            'transition',
                            'font',
                        ]
                    }
                },
                inline: false,
                returnPromise: true,
                sourceMap: this._options.sourceMap,
            });
            const files = [...compilation.additionalChunkAssets];
            chunks.forEach(chunk => {
                if (chunk.files && chunk.files.length > 0) {
                    files.push(...chunk.files);
                }
            });
            const actions = files
                .filter(file => this._options.test(file))
                .map(file => {
                const asset = compilation.assets[file];
                if (!asset) {
                    return Promise.resolve();
                }
                let content;
                let map;
                if (this._options.sourceMap && asset.sourceAndMap) {
                    const sourceAndMap = asset.sourceAndMap();
                    content = sourceAndMap.source;
                    map = sourceAndMap.map;
                }
                else {
                    content = asset.source();
                }
                if (content.length === 0) {
                    return Promise.resolve();
                }
                return Promise.resolve()
                    .then(() => map ? cleancss.minify(content, map) : cleancss.minify(content))
                    .then((output) => {
                    let hasWarnings = false;
                    if (output.warnings && output.warnings.length > 0) {
                        compilation.warnings.push(...output.warnings);
                        hasWarnings = true;
                    }
                    if (output.errors && output.errors.length > 0) {
                        output.errors
                            .forEach((error) => compilation.errors.push(new Error(error)));
                        return;
                    }
                    // generally means invalid syntax so bail
                    if (hasWarnings && output.stats.minifiedSize === 0) {
                        return;
                    }
                    let newSource;
                    if (output.sourceMap) {
                        newSource = new webpack_sources_1.SourceMapSource(output.styles, file, output.sourceMap.toString(), content, map);
                    }
                    else {
                        newSource = new webpack_sources_1.RawSource(output.styles);
                    }
                    compilation.assets[file] = newSource;
                });
            });
            return Promise.all(actions);
        });
    }
}
exports.CleanCssWebpackPlugin = CleanCssWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FuZ3VsYXItY2xpLWZpbGVzL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlCQUFpQjtBQUNqQiwrREFBK0Q7O0FBVy9ELHFEQUFxRTtBQUVyRSxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFXdEMsU0FBUyxJQUFJLENBQ1gsUUFBYSxFQUNiLE1BQTBFO0lBRTFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLFdBQWdCLEVBQUUsRUFBRTtRQUM3RSxXQUFXLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FDOUMseUJBQXlCLEVBQ3pCLENBQUMsTUFBb0IsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FDdEQsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQWEscUJBQXFCO0lBR2hDLFlBQVksT0FBOEM7UUFDeEQsSUFBSSxDQUFDLFFBQVEsbUJBQ1gsU0FBUyxFQUFFLEtBQUssRUFDaEIsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUNsQyxPQUFPLENBQ1gsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFdBQW9DLEVBQUUsTUFBb0IsRUFBRSxFQUFFO1lBQzVFLE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDO2dCQUM1QixhQUFhLEVBQUUsS0FBSztnQkFDcEIsS0FBSyxFQUFFO29CQUNMLENB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Q0FBQztvQkFDZCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUU7d0JBQ3BCLFNBQVMsR0FBRyxJQUFJLGlDQUFlLENBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQ2IsSUFBSSxFQUNKLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEVBQzNCLE9BQU8sRUFDUCxHQUFHLENBQ0osQ0FBQztxQkFDSDt5QkFBTTt3QkFDTCxTQUFTLEdBQUcsSUFBSSwyQkFBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztxQkFDMUM7b0JBRUQsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUM7Z0JBQ3ZDLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7WUFFTCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFsR0Qsc0RBa0dDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IENvbXBpbGVyLCBjb21waWxhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgUmF3U291cmNlLCBTb3VyY2UsIFNvdXJjZU1hcFNvdXJjZSB9IGZyb20gJ3dlYnBhY2stc291cmNlcyc7XG5cbmNvbnN0IENsZWFuQ1NTID0gcmVxdWlyZSgnY2xlYW4tY3NzJyk7XG5cbmludGVyZmFjZSBDaHVuayB7XG4gIGZpbGVzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDbGVhbkNzc1dlYnBhY2tQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlTWFwOiBib29sZWFuO1xuICB0ZXN0OiAoZmlsZTogc3RyaW5nKSA9PiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBob29rKFxuICBjb21waWxlcjogYW55LFxuICBhY3Rpb246IChjb21waWxhdGlvbjogYW55LCBjaHVua3M6IEFycmF5PENodW5rPikgPT4gUHJvbWlzZTx2b2lkIHwgdm9pZFtdPixcbikge1xuICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoJ2NsZWFuY3NzLXdlYnBhY2stcGx1Z2luJywgKGNvbXBpbGF0aW9uOiBhbnkpID0+IHtcbiAgICBjb21waWxhdGlvbi5ob29rcy5vcHRpbWl6ZUNodW5rQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAnY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nLFxuICAgICAgKGNodW5rczogQXJyYXk8Q2h1bms+KSA9PiBhY3Rpb24oY29tcGlsYXRpb24sIGNodW5rcyksXG4gICAgKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBjbGFzcyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4ge1xuICBwcml2YXRlIHJlYWRvbmx5IF9vcHRpb25zOiBDbGVhbkNzc1dlYnBhY2tQbHVnaW5PcHRpb25zO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFBhcnRpYWw8Q2xlYW5Dc3NXZWJwYWNrUGx1Z2luT3B0aW9ucz4pIHtcbiAgICB0aGlzLl9vcHRpb25zID0ge1xuICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgIHRlc3Q6IChmaWxlKSA9PiBmaWxlLmVuZHNXaXRoKCcuY3NzJyksXG4gICAgICAuLi5vcHRpb25zLFxuICAgIH07XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBob29rKGNvbXBpbGVyLCAoY29tcGlsYXRpb246IGNvbXBpbGF0aW9uLkNvbXBpbGF0aW9uLCBjaHVua3M6IEFycmF5PENodW5rPikgPT4ge1xuICAgICAgY29uc3QgY2xlYW5jc3MgPSBuZXcgQ2xlYW5DU1Moe1xuICAgICAgICBjb21wYXRpYmlsaXR5OiAnaWU5JyxcbiAgICAgICAgbGV2ZWw6IHtcbiAgICAgICAgICAyOiB7XG4gICAgICAgICAgICBza2lwUHJvcGVydGllczogW1xuICAgICAgICAgICAgICAndHJhbnNpdGlvbicsIC8vIEZpeGVzICMxMjQwOFxuICAgICAgICAgICAgICAnZm9udCcsIC8vIEZpeGVzICM5NjQ4XG4gICAgICAgICAgICBdIFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5saW5lOiBmYWxzZSxcbiAgICAgICAgcmV0dXJuUHJvbWlzZTogdHJ1ZSxcbiAgICAgICAgc291cmNlTWFwOiB0aGlzLl9vcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBmaWxlczogc3RyaW5nW10gPSBbLi4uY29tcGlsYXRpb24uYWRkaXRpb25hbENodW5rQXNzZXRzXTtcblxuICAgICAgY2h1bmtzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgICBpZiAoY2h1bmsuZmlsZXMgJiYgY2h1bmsuZmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGZpbGVzLnB1c2goLi4uY2h1bmsuZmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYWN0aW9ucyA9IGZpbGVzXG4gICAgICAgIC5maWx0ZXIoZmlsZSA9PiB0aGlzLl9vcHRpb25zLnRlc3QoZmlsZSkpXG4gICAgICAgIC5tYXAoZmlsZSA9PiB7XG4gICAgICAgICAgY29uc3QgYXNzZXQgPSBjb21waWxhdGlvbi5hc3NldHNbZmlsZV0gYXMgU291cmNlO1xuICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgY29udGVudDogc3RyaW5nO1xuICAgICAgICAgIGxldCBtYXA6IGFueTtcbiAgICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5zb3VyY2VNYXAgJiYgYXNzZXQuc291cmNlQW5kTWFwKSB7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VBbmRNYXAgPSBhc3NldC5zb3VyY2VBbmRNYXAoKTtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBzb3VyY2VBbmRNYXAuc291cmNlO1xuICAgICAgICAgICAgbWFwID0gc291cmNlQW5kTWFwLm1hcDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGVudCA9IGFzc2V0LnNvdXJjZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb250ZW50Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gbWFwID8gY2xlYW5jc3MubWluaWZ5KGNvbnRlbnQsIG1hcCkgOiBjbGVhbmNzcy5taW5pZnkoY29udGVudCkpXG4gICAgICAgICAgICAudGhlbigob3V0cHV0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgbGV0IGhhc1dhcm5pbmdzID0gZmFsc2U7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXQud2FybmluZ3MgJiYgb3V0cHV0Lndhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb21waWxhdGlvbi53YXJuaW5ncy5wdXNoKC4uLm91dHB1dC53YXJuaW5ncyk7XG4gICAgICAgICAgICAgICAgaGFzV2FybmluZ3MgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKG91dHB1dC5lcnJvcnMgJiYgb3V0cHV0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LmVycm9yc1xuICAgICAgICAgICAgICAgICAgLmZvckVhY2goKGVycm9yOiBzdHJpbmcpID0+IGNvbXBpbGF0aW9uLmVycm9ycy5wdXNoKG5ldyBFcnJvcihlcnJvcikpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBnZW5lcmFsbHkgbWVhbnMgaW52YWxpZCBzeW50YXggc28gYmFpbFxuICAgICAgICAgICAgICBpZiAoaGFzV2FybmluZ3MgJiYgb3V0cHV0LnN0YXRzLm1pbmlmaWVkU2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxldCBuZXdTb3VyY2U7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXQuc291cmNlTWFwKSB7XG4gICAgICAgICAgICAgICAgbmV3U291cmNlID0gbmV3IFNvdXJjZU1hcFNvdXJjZShcbiAgICAgICAgICAgICAgICAgIG91dHB1dC5zdHlsZXMsXG4gICAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICAgICAgb3V0cHV0LnNvdXJjZU1hcC50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICAgIG1hcCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld1NvdXJjZSA9IG5ldyBSYXdTb3VyY2Uob3V0cHV0LnN0eWxlcyk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb21waWxhdGlvbi5hc3NldHNbZmlsZV0gPSBuZXdTb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChhY3Rpb25zKTtcbiAgICB9KTtcbiAgfVxufVxuIl19