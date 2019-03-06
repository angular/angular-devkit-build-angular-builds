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
            mainFields: [...(wco.supportES2015 ? ['es2015'] : []), 'main', 'module'],
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
            (context, request, callback) => {
                // Absolute & Relative paths are not externals
                if (request.match(/^\.{0,2}\//)) {
                    return callback();
                }
                try {
                    require.resolve(request);
                    callback(null, request);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVNBLG1DQUE4QztBQUU5Qzs7O0dBR0c7QUFDSCxTQUFnQixlQUFlLENBQUMsR0FBeUI7SUFDdkQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUU7UUFDOUIsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7UUFFL0QsWUFBWSxDQUFDLElBQUksQ0FBQywyQkFBbUIsQ0FBQyxPQUFPLElBQUksS0FBSyxFQUFFLE1BQU0sSUFBSSxLQUFLLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDNUY7SUFFRCxNQUFNLE1BQU0sR0FBa0I7UUFDNUIsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUM7U0FDekU7UUFDRCxNQUFNLEVBQUUsTUFBTTtRQUNkLE1BQU0sRUFBRTtZQUNOLGFBQWEsRUFBRSxVQUFVO1NBQzFCO1FBQ0QsT0FBTyxFQUFFLFlBQVk7UUFDckIsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0lBRUYsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLGtCQUFrQixJQUFJLE1BQU0sRUFBRTtRQUNqRCxNQUFNLENBQUMsU0FBUyxHQUFHO1lBQ2pCLFdBQVc7WUFDWCxDQUFDLE9BQWUsRUFBRSxPQUFlLEVBQUUsUUFBaUQsRUFBRSxFQUFFO2dCQUN0Riw4Q0FBOEM7Z0JBQzlDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDL0IsT0FBTyxRQUFRLEVBQUUsQ0FBQztpQkFDbkI7Z0JBRUQsSUFBSTtvQkFDRixPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN6QixRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2lCQUN6QjtnQkFBQyxXQUFNO29CQUNOLG9EQUFvRDtvQkFDcEQsUUFBUSxFQUFFLENBQUM7aUJBQ1o7WUFDSCxDQUFDO1NBQ0YsQ0FBQztLQUNIO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQXpDRCwwQ0F5Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0U291cmNlTWFwRGV2VG9vbCB9IGZyb20gJy4vdXRpbHMnO1xuXG4vKipcbiAqIFJldHVybnMgYSBwYXJ0aWFsIHNwZWNpZmljIHRvIGNyZWF0aW5nIGEgYnVuZGxlIGZvciBub2RlXG4gKiBAcGFyYW0gd2NvIE9wdGlvbnMgd2hpY2ggYXJlIGluY2x1ZGUgdGhlIGJ1aWxkIG9wdGlvbnMgYW5kIGFwcCBjb25maWdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcnZlckNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICBjb25zdCB7IHNjcmlwdHMsIHN0eWxlcywgaGlkZGVuIH0gPSB3Y28uYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGdldFNvdXJjZU1hcERldlRvb2woc2NyaXB0cyB8fCBmYWxzZSwgc3R5bGVzIHx8IGZhbHNlLCBoaWRkZW4gfHwgZmFsc2UpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbmZpZzogQ29uZmlndXJhdGlvbiA9IHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbLi4uKHdjby5zdXBwb3J0RVMyMDE1ID8gWydlczIwMTUnXSA6IFtdKSwgJ21haW4nLCAnbW9kdWxlJ10sXG4gICAgfSxcbiAgICB0YXJnZXQ6ICdub2RlJyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGxpYnJhcnlUYXJnZXQ6ICdjb21tb25qcycsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzID09ICdub25lJykge1xuICAgIGNvbmZpZy5leHRlcm5hbHMgPSBbXG4gICAgICAvXkBhbmd1bGFyLyxcbiAgICAgIChjb250ZXh0OiBzdHJpbmcsIHJlcXVlc3Q6IHN0cmluZywgY2FsbGJhY2s6IChlcnJvcj86IG51bGwsIHJlc3VsdD86IHN0cmluZykgPT4gdm9pZCkgPT4ge1xuICAgICAgICAvLyBBYnNvbHV0ZSAmIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgZXh0ZXJuYWxzXG4gICAgICAgIGlmIChyZXF1ZXN0Lm1hdGNoKC9eXFwuezAsMn1cXC8vKSkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXF1aXJlLnJlc29sdmUocmVxdWVzdCk7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVxdWVzdCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gY29uZmlnO1xufVxuIl19