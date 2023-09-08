"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OccurrencesPlugin = void 0;
const PLUGIN_NAME = 'angular-occurrences-plugin';
class OccurrencesPlugin {
    options;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
            }, async (compilationAssets) => {
                for (const assetName of Object.keys(compilationAssets)) {
                    if (!assetName.endsWith('.js')) {
                        continue;
                    }
                    const scriptAsset = compilation.getAsset(assetName);
                    if (!scriptAsset || scriptAsset.source.size() <= 0) {
                        continue;
                    }
                    const src = scriptAsset.source.source().toString('utf-8');
                    let ngComponentCount = 0;
                    if (!this.options.aot) {
                        // Count the number of `Component({` strings (case sensitive), which happens in __decorate().
                        ngComponentCount += this.countOccurrences(src, 'Component({');
                    }
                    if (this.options.scriptsOptimization) {
                        // for ascii_only true
                        ngComponentCount += this.countOccurrences(src, '.\\u0275cmp', false);
                    }
                    else {
                        // For Ivy we just count ɵcmp.src
                        ngComponentCount += this.countOccurrences(src, '.ɵcmp', true);
                    }
                    compilation.updateAsset(assetName, (s) => s, (assetInfo) => ({
                        ...assetInfo,
                        ngComponentCount,
                    }));
                }
            });
        });
    }
    countOccurrences(source, match, wordBreak = false) {
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
}
exports.OccurrencesPlugin = OccurrencesPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2NjdXJyZW5jZXMtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL29jY3VycmVuY2VzLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFJSCxNQUFNLFdBQVcsR0FBRyw0QkFBNEIsQ0FBQztBQU9qRCxNQUFhLGlCQUFpQjtJQUNSO0lBQXBCLFlBQW9CLE9BQWlDO1FBQWpDLFlBQU8sR0FBUCxPQUFPLENBQTBCO0lBQUcsQ0FBQztJQUV6RCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzlELFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDeEM7Z0JBQ0UsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyw0QkFBNEI7YUFDakUsRUFDRCxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRTtnQkFDMUIsS0FBSyxNQUFNLFNBQVMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7b0JBQ3RELElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUM5QixTQUFTO3FCQUNWO29CQUVELE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3BELElBQUksQ0FBQyxXQUFXLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7d0JBQ2xELFNBQVM7cUJBQ1Y7b0JBRUQsTUFBTSxHQUFHLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBRTFELElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO29CQUV6QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7d0JBQ3JCLDZGQUE2Rjt3QkFDN0YsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxhQUFhLENBQUMsQ0FBQztxQkFDL0Q7b0JBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUFFO3dCQUNwQyxzQkFBc0I7d0JBQ3RCLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUN0RTt5QkFBTTt3QkFDTCxpQ0FBaUM7d0JBQ2pDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO3FCQUMvRDtvQkFFRCxXQUFXLENBQUMsV0FBVyxDQUNyQixTQUFTLEVBQ1QsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFDUixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFDZCxHQUFHLFNBQVM7d0JBQ1osZ0JBQWdCO3FCQUNqQixDQUFDLENBQ0gsQ0FBQztpQkFDSDtZQUNILENBQUMsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsTUFBYyxFQUFFLEtBQWEsRUFBRSxTQUFTLEdBQUcsS0FBSztRQUN2RSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFFZCw2RUFBNkU7UUFDN0UsSUFBSSxTQUFTLEVBQUU7WUFDYixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUM7WUFDaEIsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO2dCQUN4RixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFO29CQUNsRixLQUFLLEVBQUUsQ0FBQyxDQUFDLDhDQUE4QztpQkFDeEQ7Z0JBRUQsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQ3BCLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRTtvQkFDWCxNQUFNO2lCQUNQO2FBQ0Y7U0FDRjthQUFNO1lBQ0wsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO2dCQUN4RixLQUFLLEVBQUUsQ0FBQyxDQUFDLDhDQUE4QztnQkFDdkQsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQ3BCLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRTtvQkFDWCxNQUFNO2lCQUNQO2FBQ0Y7U0FDRjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBaEZELDhDQWdGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdhbmd1bGFyLW9jY3VycmVuY2VzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2NjdXJyZW5jZXNQbHVnaW5PcHRpb25zIHtcbiAgYW90PzogYm9vbGVhbjtcbiAgc2NyaXB0c09wdGltaXphdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBPY2N1cnJlbmNlc1BsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogT2NjdXJyZW5jZXNQbHVnaW5PcHRpb25zKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IGNvbXBpbGVyLndlYnBhY2suQ29tcGlsYXRpb24uUFJPQ0VTU19BU1NFVFNfU1RBR0VfQU5BTFlTRSxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKGNvbXBpbGF0aW9uQXNzZXRzKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIWFzc2V0TmFtZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdEFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0QXNzZXQgfHwgc2NyaXB0QXNzZXQuc291cmNlLnNpemUoKSA8PSAwKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzcmMgPSBzY3JpcHRBc3NldC5zb3VyY2Uuc291cmNlKCkudG9TdHJpbmcoJ3V0Zi04Jyk7XG5cbiAgICAgICAgICAgIGxldCBuZ0NvbXBvbmVudENvdW50ID0gMDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYW90KSB7XG4gICAgICAgICAgICAgIC8vIENvdW50IHRoZSBudW1iZXIgb2YgYENvbXBvbmVudCh7YCBzdHJpbmdzIChjYXNlIHNlbnNpdGl2ZSksIHdoaWNoIGhhcHBlbnMgaW4gX19kZWNvcmF0ZSgpLlxuICAgICAgICAgICAgICBuZ0NvbXBvbmVudENvdW50ICs9IHRoaXMuY291bnRPY2N1cnJlbmNlcyhzcmMsICdDb21wb25lbnQoeycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICAgICAgICAgICAgLy8gZm9yIGFzY2lpX29ubHkgdHJ1ZVxuICAgICAgICAgICAgICBuZ0NvbXBvbmVudENvdW50ICs9IHRoaXMuY291bnRPY2N1cnJlbmNlcyhzcmMsICcuXFxcXHUwMjc1Y21wJywgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gRm9yIEl2eSB3ZSBqdXN0IGNvdW50IMm1Y21wLnNyY1xuICAgICAgICAgICAgICBuZ0NvbXBvbmVudENvdW50ICs9IHRoaXMuY291bnRPY2N1cnJlbmNlcyhzcmMsICcuybVjbXAnLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQoXG4gICAgICAgICAgICAgIGFzc2V0TmFtZSxcbiAgICAgICAgICAgICAgKHMpID0+IHMsXG4gICAgICAgICAgICAgIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgIG5nQ29tcG9uZW50Q291bnQsXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb3VudE9jY3VycmVuY2VzKHNvdXJjZTogc3RyaW5nLCBtYXRjaDogc3RyaW5nLCB3b3JkQnJlYWsgPSBmYWxzZSk6IG51bWJlciB7XG4gICAgbGV0IGNvdW50ID0gMDtcblxuICAgIC8vIFdlIGNvbmRpdGlvbiBoZXJlIHNvIGJyYW5jaCBwcmVkaWN0aW9uIGhhcHBlbnMgb3V0IG9mIHRoZSBsb29wLCBub3QgaW4gaXQuXG4gICAgaWYgKHdvcmRCcmVhaykge1xuICAgICAgY29uc3QgcmUgPSAvXFx3LztcbiAgICAgIGZvciAobGV0IHBvcyA9IHNvdXJjZS5sYXN0SW5kZXhPZihtYXRjaCk7IHBvcyA+PSAwOyBwb3MgPSBzb3VyY2UubGFzdEluZGV4T2YobWF0Y2gsIHBvcykpIHtcbiAgICAgICAgaWYgKCEocmUudGVzdChzb3VyY2VbcG9zIC0gMV0gfHwgJycpIHx8IHJlLnRlc3Qoc291cmNlW3BvcyArIG1hdGNoLmxlbmd0aF0gfHwgJycpKSkge1xuICAgICAgICAgIGNvdW50Kys7IC8vIDEgbWF0Y2gsIEFIISBBSCEgQUghIDIgbWF0Y2hlcywgQUghIEFIISBBSCFcbiAgICAgICAgfVxuXG4gICAgICAgIHBvcyAtPSBtYXRjaC5sZW5ndGg7XG4gICAgICAgIGlmIChwb3MgPCAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQgcG9zID0gc291cmNlLmxhc3RJbmRleE9mKG1hdGNoKTsgcG9zID49IDA7IHBvcyA9IHNvdXJjZS5sYXN0SW5kZXhPZihtYXRjaCwgcG9zKSkge1xuICAgICAgICBjb3VudCsrOyAvLyAxIG1hdGNoLCBBSCEgQUghIEFIISAyIG1hdGNoZXMsIEFIISBBSCEgQUghXG4gICAgICAgIHBvcyAtPSBtYXRjaC5sZW5ndGg7XG4gICAgICAgIGlmIChwb3MgPCAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY291bnQ7XG4gIH1cbn1cbiJdfQ==