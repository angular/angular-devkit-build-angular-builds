"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourcemapIngorelistPlugin = void 0;
/**
 * The field identifier for the sourcemap Chrome Devtools ignore list extension.
 *
 * Following the naming conventions from https://sourcemaps.info/spec.html#h.ghqpj1ytqjbm
 */
const IGNORE_LIST_ID = 'x_google_ignoreList';
/**
 * The UTF-8 bytes for the node modules check text used to avoid unnecessary parsing
 * of a full source map if not present in the source map data.
 */
const NODE_MODULE_BYTES = Buffer.from('node_modules/', 'utf-8');
/**
 * Creates an esbuild plugin that updates generated sourcemaps to include the Chrome
 * DevTools ignore list extension. All source files that originate from a node modules
 * directory are added to the ignore list by this plugin.
 *
 * For more information, see https://developer.chrome.com/articles/x-google-ignore-list/
 * @returns An esbuild plugin.
 */
function createSourcemapIngorelistPlugin() {
    return {
        name: 'angular-sourcemap-ignorelist',
        setup(build) {
            if (!build.initialOptions.sourcemap) {
                return;
            }
            build.onEnd((result) => {
                if (!result.outputFiles) {
                    return;
                }
                for (const file of result.outputFiles) {
                    // Only process sourcemap files
                    if (!file.path.endsWith('.map')) {
                        continue;
                    }
                    // Create a Buffer object that shares the memory of the output file contents
                    const contents = Buffer.from(file.contents.buffer, file.contents.byteOffset, file.contents.byteLength);
                    // Avoid parsing sourcemaps that have no node modules references
                    if (!contents.includes(NODE_MODULE_BYTES)) {
                        continue;
                    }
                    const map = JSON.parse(contents.toString('utf-8'));
                    const ignoreList = [];
                    // Check and store the index of each source originating from a node modules directory
                    for (let index = 0; index < map.sources.length; ++index) {
                        const location = map.sources[index].indexOf('node_modules/');
                        if (location === 0 || (location > 0 && map.sources[index][location - 1] === '/')) {
                            ignoreList.push(index);
                        }
                    }
                    // Avoid regenerating the source map if nothing changed
                    if (ignoreList.length === 0) {
                        continue;
                    }
                    // Update the sourcemap in the output file
                    map[IGNORE_LIST_ID] = ignoreList;
                    file.contents = Buffer.from(JSON.stringify(map), 'utf-8');
                }
            });
        },
    };
}
exports.createSourcemapIngorelistPlugin = createSourcemapIngorelistPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFJSDs7OztHQUlHO0FBQ0gsTUFBTSxjQUFjLEdBQUcscUJBQXFCLENBQUM7QUFFN0M7OztHQUdHO0FBQ0gsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztBQVVoRTs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsK0JBQStCO0lBQzdDLE9BQU87UUFDTCxJQUFJLEVBQUUsOEJBQThCO1FBQ3BDLEtBQUssQ0FBQyxLQUFLO1lBQ1QsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFO2dCQUNuQyxPQUFPO2FBQ1I7WUFFRCxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ3JCLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFO29CQUN2QixPQUFPO2lCQUNSO2dCQUVELEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRTtvQkFDckMsK0JBQStCO29CQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQy9CLFNBQVM7cUJBQ1Y7b0JBRUQsNEVBQTRFO29CQUM1RSxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUMxQixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFDcEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUN6QixDQUFDO29CQUVGLGdFQUFnRTtvQkFDaEUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTt3QkFDekMsU0FBUztxQkFDVjtvQkFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQWMsQ0FBQztvQkFDaEUsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO29CQUV0QixxRkFBcUY7b0JBQ3JGLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRTt3QkFDdkQsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQzdELElBQUksUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUU7NEJBQ2hGLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7eUJBQ3hCO3FCQUNGO29CQUVELHVEQUF1RDtvQkFDdkQsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTt3QkFDM0IsU0FBUztxQkFDVjtvQkFFRCwwQ0FBMEM7b0JBQzFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsR0FBRyxVQUFVLENBQUM7b0JBQ2pDLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2lCQUMzRDtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBdERELDBFQXNEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ2VzYnVpbGQnO1xuXG4vKipcbiAqIFRoZSBmaWVsZCBpZGVudGlmaWVyIGZvciB0aGUgc291cmNlbWFwIENocm9tZSBEZXZ0b29scyBpZ25vcmUgbGlzdCBleHRlbnNpb24uXG4gKlxuICogRm9sbG93aW5nIHRoZSBuYW1pbmcgY29udmVudGlvbnMgZnJvbSBodHRwczovL3NvdXJjZW1hcHMuaW5mby9zcGVjLmh0bWwjaC5naHFwajF5dHFqYm1cbiAqL1xuY29uc3QgSUdOT1JFX0xJU1RfSUQgPSAneF9nb29nbGVfaWdub3JlTGlzdCc7XG5cbi8qKlxuICogVGhlIFVURi04IGJ5dGVzIGZvciB0aGUgbm9kZSBtb2R1bGVzIGNoZWNrIHRleHQgdXNlZCB0byBhdm9pZCB1bm5lY2Vzc2FyeSBwYXJzaW5nXG4gKiBvZiBhIGZ1bGwgc291cmNlIG1hcCBpZiBub3QgcHJlc2VudCBpbiB0aGUgc291cmNlIG1hcCBkYXRhLlxuICovXG5jb25zdCBOT0RFX01PRFVMRV9CWVRFUyA9IEJ1ZmZlci5mcm9tKCdub2RlX21vZHVsZXMvJywgJ3V0Zi04Jyk7XG5cbi8qKlxuICogTWluaW1hbCBzb3VyY2VtYXAgb2JqZWN0IHJlcXVpcmVkIHRvIGNyZWF0ZSB0aGUgaWdub3JlIGxpc3QuXG4gKi9cbmludGVyZmFjZSBTb3VyY2VNYXAge1xuICBzb3VyY2VzOiBzdHJpbmdbXTtcbiAgW0lHTk9SRV9MSVNUX0lEXT86IG51bWJlcltdO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBwbHVnaW4gdGhhdCB1cGRhdGVzIGdlbmVyYXRlZCBzb3VyY2VtYXBzIHRvIGluY2x1ZGUgdGhlIENocm9tZVxuICogRGV2VG9vbHMgaWdub3JlIGxpc3QgZXh0ZW5zaW9uLiBBbGwgc291cmNlIGZpbGVzIHRoYXQgb3JpZ2luYXRlIGZyb20gYSBub2RlIG1vZHVsZXNcbiAqIGRpcmVjdG9yeSBhcmUgYWRkZWQgdG8gdGhlIGlnbm9yZSBsaXN0IGJ5IHRoaXMgcGx1Z2luLlxuICpcbiAqIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuY2hyb21lLmNvbS9hcnRpY2xlcy94LWdvb2dsZS1pZ25vcmUtbGlzdC9cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgcGx1Z2luLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbigpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNvdXJjZW1hcC1pZ25vcmVsaXN0JyxcbiAgICBzZXR1cChidWlsZCk6IHZvaWQge1xuICAgICAgaWYgKCFidWlsZC5pbml0aWFsT3B0aW9ucy5zb3VyY2VtYXApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGlmICghcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBzb3VyY2VtYXAgZmlsZXNcbiAgICAgICAgICBpZiAoIWZpbGUucGF0aC5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDcmVhdGUgYSBCdWZmZXIgb2JqZWN0IHRoYXQgc2hhcmVzIHRoZSBtZW1vcnkgb2YgdGhlIG91dHB1dCBmaWxlIGNvbnRlbnRzXG4gICAgICAgICAgY29uc3QgY29udGVudHMgPSBCdWZmZXIuZnJvbShcbiAgICAgICAgICAgIGZpbGUuY29udGVudHMuYnVmZmVyLFxuICAgICAgICAgICAgZmlsZS5jb250ZW50cy5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBBdm9pZCBwYXJzaW5nIHNvdXJjZW1hcHMgdGhhdCBoYXZlIG5vIG5vZGUgbW9kdWxlcyByZWZlcmVuY2VzXG4gICAgICAgICAgaWYgKCFjb250ZW50cy5pbmNsdWRlcyhOT0RFX01PRFVMRV9CWVRFUykpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG1hcCA9IEpTT04ucGFyc2UoY29udGVudHMudG9TdHJpbmcoJ3V0Zi04JykpIGFzIFNvdXJjZU1hcDtcbiAgICAgICAgICBjb25zdCBpZ25vcmVMaXN0ID0gW107XG5cbiAgICAgICAgICAvLyBDaGVjayBhbmQgc3RvcmUgdGhlIGluZGV4IG9mIGVhY2ggc291cmNlIG9yaWdpbmF0aW5nIGZyb20gYSBub2RlIG1vZHVsZXMgZGlyZWN0b3J5XG4gICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG1hcC5zb3VyY2VzLmxlbmd0aDsgKytpbmRleCkge1xuICAgICAgICAgICAgY29uc3QgbG9jYXRpb24gPSBtYXAuc291cmNlc1tpbmRleF0uaW5kZXhPZignbm9kZV9tb2R1bGVzLycpO1xuICAgICAgICAgICAgaWYgKGxvY2F0aW9uID09PSAwIHx8IChsb2NhdGlvbiA+IDAgJiYgbWFwLnNvdXJjZXNbaW5kZXhdW2xvY2F0aW9uIC0gMV0gPT09ICcvJykpIHtcbiAgICAgICAgICAgICAgaWdub3JlTGlzdC5wdXNoKGluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBdm9pZCByZWdlbmVyYXRpbmcgdGhlIHNvdXJjZSBtYXAgaWYgbm90aGluZyBjaGFuZ2VkXG4gICAgICAgICAgaWYgKGlnbm9yZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBVcGRhdGUgdGhlIHNvdXJjZW1hcCBpbiB0aGUgb3V0cHV0IGZpbGVcbiAgICAgICAgICBtYXBbSUdOT1JFX0xJU1RfSURdID0gaWdub3JlTGlzdDtcbiAgICAgICAgICBmaWxlLmNvbnRlbnRzID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkobWFwKSwgJ3V0Zi04Jyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iXX0=