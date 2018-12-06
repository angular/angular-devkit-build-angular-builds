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
        extraPlugins.push(utils_1.getSourceMapDevTool(scripts, styles, hidden));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLG1DQUE4QztBQUc5Qzs7O0dBR0c7QUFDSCxTQUFnQixlQUFlLENBQUMsR0FBeUI7SUFFdkQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUU7UUFDOUIsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7UUFFL0QsWUFBWSxDQUFDLElBQUksQ0FBQywyQkFBbUIsQ0FDbkMsT0FBTyxFQUNQLE1BQU0sRUFDTixNQUFNLENBQ1AsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxNQUFNLE1BQU0sR0FBa0I7UUFDNUIsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFO2dCQUNWLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLE1BQU0sRUFBRSxRQUFRO2FBQ2pCO1NBQ0Y7UUFDRCxNQUFNLEVBQUUsTUFBTTtRQUNkLE1BQU0sRUFBRTtZQUNOLGFBQWEsRUFBRSxVQUFVO1NBQzFCO1FBQ0QsT0FBTyxFQUFFLFlBQVk7UUFDckIsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0lBRUYsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLGtCQUFrQixJQUFJLE1BQU0sRUFBRTtRQUNqRCxNQUFNLENBQUMsU0FBUyxHQUFHO1lBQ2pCLFdBQVc7WUFDWCxrQ0FBa0M7WUFDbEMsQ0FBQyxDQUFNLEVBQUUsT0FBWSxFQUFFLFFBQTZDLEVBQUUsRUFBRTtnQkFDdEUsOENBQThDO2dCQUM5QyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQy9CLE9BQU8sUUFBUSxFQUFFLENBQUM7aUJBQ25CO2dCQUVELElBQUk7b0JBQ0YseUNBQXlDO29CQUN6QyxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNuQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQzFCLHFCQUFxQjt3QkFDckIsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztxQkFDekI7eUJBQU07d0JBQ0wsd0NBQXdDO3dCQUN4QyxRQUFRLEVBQUUsQ0FBQztxQkFDWjtpQkFDRjtnQkFBQyxXQUFNO29CQUNOLG9EQUFvRDtvQkFDcEQsUUFBUSxFQUFFLENBQUM7aUJBQ1o7WUFDSCxDQUFDO1NBQ0YsQ0FBQztLQUNIO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQXpERCwwQ0F5REMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0U291cmNlTWFwRGV2VG9vbCB9IGZyb20gJy4vdXRpbHMnO1xuXG5cbi8qKlxuICogUmV0dXJucyBhIHBhcnRpYWwgc3BlY2lmaWMgdG8gY3JlYXRpbmcgYSBidW5kbGUgZm9yIG5vZGVcbiAqIEBwYXJhbSB3Y28gT3B0aW9ucyB3aGljaCBhcmUgaW5jbHVkZSB0aGUgYnVpbGQgb3B0aW9ucyBhbmQgYXBwIGNvbmZpZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2VydmVyQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcblxuICBjb25zdCBleHRyYVBsdWdpbnMgPSBbXTtcbiAgaWYgKHdjby5idWlsZE9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgY29uc3QgeyBzY3JpcHRzLCBzdHlsZXMsIGhpZGRlbiB9ID0gd2NvLmJ1aWxkT3B0aW9ucy5zb3VyY2VNYXA7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChnZXRTb3VyY2VNYXBEZXZUb29sKFxuICAgICAgc2NyaXB0cyxcbiAgICAgIHN0eWxlcyxcbiAgICAgIGhpZGRlbixcbiAgICApKTtcbiAgfVxuXG4gIGNvbnN0IGNvbmZpZzogQ29uZmlndXJhdGlvbiA9IHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdtYWluJywgJ21vZHVsZScsXG4gICAgICBdLFxuICAgIH0sXG4gICAgdGFyZ2V0OiAnbm9kZScsXG4gICAgb3V0cHV0OiB7XG4gICAgICBsaWJyYXJ5VGFyZ2V0OiAnY29tbW9uanMnLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xuXG4gIGlmICh3Y28uYnVpbGRPcHRpb25zLmJ1bmRsZURlcGVuZGVuY2llcyA9PSAnbm9uZScpIHtcbiAgICBjb25maWcuZXh0ZXJuYWxzID0gW1xuICAgICAgL15AYW5ndWxhci8sXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICAoXzogYW55LCByZXF1ZXN0OiBhbnksIGNhbGxiYWNrOiAoZXJyb3I/OiBhbnksIHJlc3VsdD86IGFueSkgPT4gdm9pZCkgPT4ge1xuICAgICAgICAvLyBBYnNvbHV0ZSAmIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgZXh0ZXJuYWxzXG4gICAgICAgIGlmIChyZXF1ZXN0Lm1hdGNoKC9eXFwuezAsMn1cXC8vKSkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlc29sdmUgdGhlIG1vZHVsZSB2aWEgTm9kZVxuICAgICAgICAgIGNvbnN0IGUgPSByZXF1aXJlLnJlc29sdmUocmVxdWVzdCk7XG4gICAgICAgICAgaWYgKC9ub2RlX21vZHVsZXMvLnRlc3QoZSkpIHtcbiAgICAgICAgICAgIC8vIEl0J3MgYSBub2RlX21vZHVsZVxuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVxdWVzdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEl0J3MgYSBzeXN0ZW0gdGhpbmcgKC5pZSB1dGlsLCBmcy4uLilcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBOb2RlIGNvdWxkbid0IGZpbmQgaXQsIHNvIGl0IG11c3QgYmUgdXNlci1hbGlhc2VkXG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIGNvbmZpZztcbn1cbiJdfQ==