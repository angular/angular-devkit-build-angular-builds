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
        const { scripts, styles, hidden } = wco.buildOptions.sourceMap;
        extraPlugins.push(utils_1.getSourceMapDevTool(scripts || false, styles || false, hidden || false));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLG1DQUE4QztBQUc5Qzs7O0dBR0c7QUFDSCxTQUFnQixlQUFlLENBQUMsR0FBeUI7SUFFdkQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUU7UUFDOUIsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7UUFFL0QsWUFBWSxDQUFDLElBQUksQ0FBQywyQkFBbUIsQ0FDbkMsT0FBTyxJQUFJLEtBQUssRUFDaEIsTUFBTSxJQUFJLEtBQUssRUFDZixNQUFNLElBQUksS0FBSyxDQUNoQixDQUFDLENBQUM7S0FDSjtJQUVELE1BQU0sTUFBTSxHQUFrQjtRQUM1QixPQUFPLEVBQUU7WUFDUCxVQUFVLEVBQUU7Z0JBQ1YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDeEMsTUFBTSxFQUFFLFFBQVE7YUFDakI7U0FDRjtRQUNELE1BQU0sRUFBRSxNQUFNO1FBQ2QsTUFBTSxFQUFFO1lBQ04sYUFBYSxFQUFFLFVBQVU7U0FDMUI7UUFDRCxPQUFPLEVBQUUsWUFBWTtRQUNyQixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7SUFFRixJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsa0JBQWtCLElBQUksTUFBTSxFQUFFO1FBQ2pELE1BQU0sQ0FBQyxTQUFTLEdBQUc7WUFDakIsV0FBVztZQUNYLGtDQUFrQztZQUNsQyxDQUFDLENBQU0sRUFBRSxPQUFZLEVBQUUsUUFBNkMsRUFBRSxFQUFFO2dCQUN0RSw4Q0FBOEM7Z0JBQzlDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDL0IsT0FBTyxRQUFRLEVBQUUsQ0FBQztpQkFDbkI7Z0JBRUQsSUFBSTtvQkFDRix5Q0FBeUM7b0JBQ3pDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ25DLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTt3QkFDMUIscUJBQXFCO3dCQUNyQixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUN6Qjt5QkFBTTt3QkFDTCx3Q0FBd0M7d0JBQ3hDLFFBQVEsRUFBRSxDQUFDO3FCQUNaO2lCQUNGO2dCQUFDLFdBQU07b0JBQ04sb0RBQW9EO29CQUNwRCxRQUFRLEVBQUUsQ0FBQztpQkFDWjtZQUNILENBQUM7U0FDRixDQUFDO0tBQ0g7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBekRELDBDQXlEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBnZXRTb3VyY2VNYXBEZXZUb29sIH0gZnJvbSAnLi91dGlscyc7XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgcGFydGlhbCBzcGVjaWZpYyB0byBjcmVhdGluZyBhIGJ1bmRsZSBmb3Igbm9kZVxuICogQHBhcmFtIHdjbyBPcHRpb25zIHdoaWNoIGFyZSBpbmNsdWRlIHRoZSBidWlsZCBvcHRpb25zIGFuZCBhcHAgY29uZmlnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJ2ZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuXG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25zdCB7IHNjcmlwdHMsIHN0eWxlcywgaGlkZGVuIH0gPSB3Y28uYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGdldFNvdXJjZU1hcERldlRvb2woXG4gICAgICBzY3JpcHRzIHx8IGZhbHNlLFxuICAgICAgc3R5bGVzIHx8IGZhbHNlLFxuICAgICAgaGlkZGVuIHx8IGZhbHNlLFxuICAgICkpO1xuICB9XG5cbiAgY29uc3QgY29uZmlnOiBDb25maWd1cmF0aW9uID0ge1xuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFtcbiAgICAgICAgLi4uKHdjby5zdXBwb3J0RVMyMDE1ID8gWydlczIwMTUnXSA6IFtdKSxcbiAgICAgICAgJ21haW4nLCAnbW9kdWxlJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB0YXJnZXQ6ICdub2RlJyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGxpYnJhcnlUYXJnZXQ6ICdjb21tb25qcycsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzID09ICdub25lJykge1xuICAgIGNvbmZpZy5leHRlcm5hbHMgPSBbXG4gICAgICAvXkBhbmd1bGFyLyxcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIChfOiBhbnksIHJlcXVlc3Q6IGFueSwgY2FsbGJhY2s6IChlcnJvcj86IGFueSwgcmVzdWx0PzogYW55KSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIC8vIEFic29sdXRlICYgUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBleHRlcm5hbHNcbiAgICAgICAgaWYgKHJlcXVlc3QubWF0Y2goL15cXC57MCwyfVxcLy8pKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgbW9kdWxlIHZpYSBOb2RlXG4gICAgICAgICAgY29uc3QgZSA9IHJlcXVpcmUucmVzb2x2ZShyZXF1ZXN0KTtcbiAgICAgICAgICBpZiAoL25vZGVfbW9kdWxlcy8udGVzdChlKSkge1xuICAgICAgICAgICAgLy8gSXQncyBhIG5vZGVfbW9kdWxlXG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXF1ZXN0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSXQncyBhIHN5c3RlbSB0aGluZyAoLmllIHV0aWwsIGZzLi4uKVxuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gY29uZmlnO1xufVxuIl19