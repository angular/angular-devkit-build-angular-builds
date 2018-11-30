"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
/**
 * Returns a partial specific to creating a bundle for node
 * @param wco Options which are include the build options and app config
 */
function getServerConfig(wco) {
    const extraPlugins = [];
    if (wco.buildOptions.sourceMap) {
        const { scriptsSourceMap = false, stylesSourceMap = false, hiddenSourceMap = false, } = wco.buildOptions;
        extraPlugins.push(utils_1.getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, hiddenSourceMap));
    }
    const config = {
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'main', 'module',
            ],
        },
        target: 'node',
        output: {
            libraryTarget: 'commonjs',
        },
        plugins: extraPlugins,
        node: false,
    };
    if (wco.buildOptions.bundleDependencies == 'none') {
        config.externals = [
            /^@angular/,
            // tslint:disable-next-line:no-any
            (_, request, callback) => {
                // Absolute & Relative paths are not externals
                if (request.match(/^\.{0,2}\//)) {
                    return callback();
                }
                try {
                    // Attempt to resolve the module via Node
                    const e = require.resolve(request);
                    if (/node_modules/.test(e)) {
                        // It's a node_module
                        callback(null, request);
                    }
                    else {
                        // It's a system thing (.ie util, fs...)
                        callback();
                    }
                }
                catch (_a) {
                    // Node couldn't find it, so it must be user-aliased
                    callback();
                }
            },
        ];
    }
    return config;
}
exports.getServerConfig = getServerConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLG1DQUE4QztBQUc5Qzs7O0dBR0c7QUFDSCxTQUFnQixlQUFlLENBQUMsR0FBeUI7SUFFdkQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUU7UUFDOUIsTUFBTSxFQUNKLGdCQUFnQixHQUFHLEtBQUssRUFDeEIsZUFBZSxHQUFHLEtBQUssRUFDdkIsZUFBZSxHQUFHLEtBQUssR0FDeEIsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDO1FBRXJCLFlBQVksQ0FBQyxJQUFJLENBQUMsMkJBQW1CLENBQ25DLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YsZUFBZSxDQUNoQixDQUFDLENBQUM7S0FDSjtJQUVELE1BQU0sTUFBTSxHQUFrQjtRQUM1QixPQUFPLEVBQUU7WUFDUCxVQUFVLEVBQUU7Z0JBQ1YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDeEMsTUFBTSxFQUFFLFFBQVE7YUFDakI7U0FDRjtRQUNELE1BQU0sRUFBRSxNQUFNO1FBQ2QsTUFBTSxFQUFFO1lBQ04sYUFBYSxFQUFFLFVBQVU7U0FDMUI7UUFDRCxPQUFPLEVBQUUsWUFBWTtRQUNyQixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7SUFFRixJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsa0JBQWtCLElBQUksTUFBTSxFQUFFO1FBQ2pELE1BQU0sQ0FBQyxTQUFTLEdBQUc7WUFDakIsV0FBVztZQUNYLGtDQUFrQztZQUNsQyxDQUFDLENBQU0sRUFBRSxPQUFZLEVBQUUsUUFBNkMsRUFBRSxFQUFFO2dCQUN0RSw4Q0FBOEM7Z0JBQzlDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDL0IsT0FBTyxRQUFRLEVBQUUsQ0FBQztpQkFDbkI7Z0JBRUQsSUFBSTtvQkFDRix5Q0FBeUM7b0JBQ3pDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ25DLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTt3QkFDMUIscUJBQXFCO3dCQUNyQixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUN6Qjt5QkFBTTt3QkFDTCx3Q0FBd0M7d0JBQ3hDLFFBQVEsRUFBRSxDQUFDO3FCQUNaO2lCQUNGO2dCQUFDLFdBQU07b0JBQ04sb0RBQW9EO29CQUNwRCxRQUFRLEVBQUUsQ0FBQztpQkFDWjtZQUNILENBQUM7U0FDRixDQUFDO0tBQ0g7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBN0RELDBDQTZEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBnZXRTb3VyY2VNYXBEZXZUb29sIH0gZnJvbSAnLi91dGlscyc7XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgcGFydGlhbCBzcGVjaWZpYyB0byBjcmVhdGluZyBhIGJ1bmRsZSBmb3Igbm9kZVxuICogQHBhcmFtIHdjbyBPcHRpb25zIHdoaWNoIGFyZSBpbmNsdWRlIHRoZSBidWlsZCBvcHRpb25zIGFuZCBhcHAgY29uZmlnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJ2ZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuXG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25zdCB7XG4gICAgICBzY3JpcHRzU291cmNlTWFwID0gZmFsc2UsXG4gICAgICBzdHlsZXNTb3VyY2VNYXAgPSBmYWxzZSxcbiAgICAgIGhpZGRlblNvdXJjZU1hcCA9IGZhbHNlLFxuICAgIH0gPSB3Y28uYnVpbGRPcHRpb25zO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goZ2V0U291cmNlTWFwRGV2VG9vbChcbiAgICAgIHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgKSk7XG4gIH1cblxuICBjb25zdCBjb25maWc6IENvbmZpZ3VyYXRpb24gPSB7XG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnbWFpbicsICdtb2R1bGUnLFxuICAgICAgXSxcbiAgICB9LFxuICAgIHRhcmdldDogJ25vZGUnLFxuICAgIG91dHB1dDoge1xuICAgICAgbGlicmFyeVRhcmdldDogJ2NvbW1vbmpzJyxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcblxuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMgPT0gJ25vbmUnKSB7XG4gICAgY29uZmlnLmV4dGVybmFscyA9IFtcbiAgICAgIC9eQGFuZ3VsYXIvLFxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgKF86IGFueSwgcmVxdWVzdDogYW55LCBjYWxsYmFjazogKGVycm9yPzogYW55LCByZXN1bHQ/OiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICAgICAgLy8gQWJzb2x1dGUgJiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IGV4dGVybmFsc1xuICAgICAgICBpZiAocmVxdWVzdC5tYXRjaCgvXlxcLnswLDJ9XFwvLykpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQXR0ZW1wdCB0byByZXNvbHZlIHRoZSBtb2R1bGUgdmlhIE5vZGVcbiAgICAgICAgICBjb25zdCBlID0gcmVxdWlyZS5yZXNvbHZlKHJlcXVlc3QpO1xuICAgICAgICAgIGlmICgvbm9kZV9tb2R1bGVzLy50ZXN0KGUpKSB7XG4gICAgICAgICAgICAvLyBJdCdzIGEgbm9kZV9tb2R1bGVcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcXVlc3QpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJdCdzIGEgc3lzdGVtIHRoaW5nICguaWUgdXRpbCwgZnMuLi4pXG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gTm9kZSBjb3VsZG4ndCBmaW5kIGl0LCBzbyBpdCBtdXN0IGJlIHVzZXItYWxpYXNlZFxuICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBjb25maWc7XG59XG4iXX0=