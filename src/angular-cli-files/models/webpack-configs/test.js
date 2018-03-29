"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const glob = require("glob");
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('istanbul-instrumenter-loader')
 *
 */
function getTestConfig(wco) {
    const { root, buildOptions, appConfig } = wco;
    const extraRules = [];
    const extraPlugins = [];
    // if (buildOptions.codeCoverage && CliConfig.fromProject()) {
    if (buildOptions.codeCoverage) {
        const codeCoverageExclude = buildOptions.codeCoverageExclude;
        let exclude = [
            /\.(e2e|spec)\.ts$/,
            /node_modules/
        ];
        if (codeCoverageExclude) {
            codeCoverageExclude.forEach((excludeGlob) => {
                const excludeFiles = glob
                    .sync(path.join(root, excludeGlob), { nodir: true })
                    .map(file => path.normalize(file));
                exclude.push(...excludeFiles);
            });
        }
        extraRules.push({
            test: /\.(js|ts)$/, loader: 'istanbul-instrumenter-loader',
            options: { esModules: true },
            enforce: 'post',
            exclude
        });
    }
    return {
        mode: 'development',
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'browser', 'module', 'main'
            ]
        },
        devtool: buildOptions.sourceMap ? 'inline-source-map' : 'eval',
        entry: {
            main: path.resolve(root, appConfig.main)
        },
        module: {
            rules: [].concat(extraRules)
        },
        plugins: extraPlugins,
        optimization: {
            // runtimeChunk: 'single',
            splitChunks: {
                chunks: buildOptions.commonChunk ? 'all' : 'initial',
                cacheGroups: {
                    vendors: false,
                    vendor: {
                        name: 'vendor',
                        chunks: 'initial',
                        test: (module, chunks) => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';
                            return /[\\/]node_modules[\\/]/.test(moduleName)
                                && !chunks.some(({ name }) => name === 'polyfills');
                        },
                    },
                }
            }
        },
    };
}
exports.getTestConfig = getTestConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBTTdCOzs7Ozs7R0FNRztBQUdILHVCQUE4QixHQUE2QztJQUN6RSxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFOUMsTUFBTSxVQUFVLEdBQVUsRUFBRSxDQUFDO0lBQzdCLE1BQU0sWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUUvQiw4REFBOEQ7SUFDOUQsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDOUIsTUFBTSxtQkFBbUIsR0FBRyxZQUFZLENBQUMsbUJBQW1CLENBQUM7UUFDN0QsSUFBSSxPQUFPLEdBQXdCO1lBQ2pDLG1CQUFtQjtZQUNuQixjQUFjO1NBQ2YsQ0FBQztRQUVGLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztZQUN4QixtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxXQUFtQixFQUFFLEVBQUU7Z0JBQ2xELE1BQU0sWUFBWSxHQUFHLElBQUk7cUJBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztxQkFDbkQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7WUFDaEMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLDhCQUE4QjtZQUMxRCxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFO1lBQzVCLE9BQU8sRUFBRSxNQUFNO1lBQ2YsT0FBTztTQUNSLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxNQUFNLENBQUM7UUFDTCxJQUFJLEVBQUUsYUFBYTtRQUNuQixPQUFPLEVBQUU7WUFDUCxVQUFVLEVBQUU7Z0JBQ1YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDeEMsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNO2FBQzVCO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLE1BQU07UUFDOUQsS0FBSyxFQUFFO1lBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUM7U0FDekM7UUFDRCxNQUFNLEVBQUU7WUFDTixLQUFLLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFpQixDQUFDO1NBQ3BDO1FBQ0QsT0FBTyxFQUFFLFlBQVk7UUFDckIsWUFBWSxFQUFFO1lBQ1osMEJBQTBCO1lBQzFCLFdBQVcsRUFBRTtnQkFDWCxNQUFNLEVBQUUsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTO2dCQUNwRCxXQUFXLEVBQUU7b0JBQ1gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsTUFBTSxFQUFFO3dCQUNOLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxTQUFTO3dCQUNqQixJQUFJLEVBQUUsQ0FBQyxNQUFXLEVBQUUsTUFBK0IsRUFBRSxFQUFFOzRCQUNyRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBQzVFLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO21DQUMzQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7d0JBQ3hELENBQUM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFsRUQsc0NBa0VDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcblxuLy8gaW1wb3J0IHsgQ2xpQ29uZmlnIH0gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zLCBXZWJwYWNrVGVzdE9wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcblxuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ2lzdGFuYnVsLWluc3RydW1lbnRlci1sb2FkZXInKVxuICpcbiAqL1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUZXN0Q29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM8V2VicGFja1Rlc3RPcHRpb25zPikge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucywgYXBwQ29uZmlnIH0gPSB3Y287XG5cbiAgY29uc3QgZXh0cmFSdWxlczogYW55W10gPSBbXTtcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuXG4gIC8vIGlmIChidWlsZE9wdGlvbnMuY29kZUNvdmVyYWdlICYmIENsaUNvbmZpZy5mcm9tUHJvamVjdCgpKSB7XG4gIGlmIChidWlsZE9wdGlvbnMuY29kZUNvdmVyYWdlKSB7XG4gICAgY29uc3QgY29kZUNvdmVyYWdlRXhjbHVkZSA9IGJ1aWxkT3B0aW9ucy5jb2RlQ292ZXJhZ2VFeGNsdWRlO1xuICAgIGxldCBleGNsdWRlOiAoc3RyaW5nIHwgUmVnRXhwKVtdID0gW1xuICAgICAgL1xcLihlMmV8c3BlYylcXC50cyQvLFxuICAgICAgL25vZGVfbW9kdWxlcy9cbiAgICBdO1xuXG4gICAgaWYgKGNvZGVDb3ZlcmFnZUV4Y2x1ZGUpIHtcbiAgICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUuZm9yRWFjaCgoZXhjbHVkZUdsb2I6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCBleGNsdWRlRmlsZXMgPSBnbG9iXG4gICAgICAgICAgLnN5bmMocGF0aC5qb2luKHJvb3QsIGV4Y2x1ZGVHbG9iKSwgeyBub2RpcjogdHJ1ZSB9KVxuICAgICAgICAgIC5tYXAoZmlsZSA9PiBwYXRoLm5vcm1hbGl6ZShmaWxlKSk7XG4gICAgICAgIGV4Y2x1ZGUucHVzaCguLi5leGNsdWRlRmlsZXMpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IC9cXC4oanN8dHMpJC8sIGxvYWRlcjogJ2lzdGFuYnVsLWluc3RydW1lbnRlci1sb2FkZXInLFxuICAgICAgb3B0aW9uczogeyBlc01vZHVsZXM6IHRydWUgfSxcbiAgICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICAgIGV4Y2x1ZGVcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ1xuICAgICAgXVxuICAgIH0sXG4gICAgZGV2dG9vbDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCA/ICdpbmxpbmUtc291cmNlLW1hcCcgOiAnZXZhbCcsXG4gICAgZW50cnk6IHtcbiAgICAgIG1haW46IHBhdGgucmVzb2x2ZShyb290LCBhcHBDb25maWcubWFpbilcbiAgICB9LFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IFtdLmNvbmNhdChleHRyYVJ1bGVzIGFzIGFueSlcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIC8vIHJ1bnRpbWVDaHVuazogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBjaHVua3M6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayA/ICdhbGwnIDogJ2luaXRpYWwnLFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjoge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6ICdpbml0aWFsJyxcbiAgICAgICAgICAgIHRlc3Q6IChtb2R1bGU6IGFueSwgY2h1bmtzOiBBcnJheTx7IG5hbWU6IHN0cmluZyB9PikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24gPyBtb2R1bGUubmFtZUZvckNvbmRpdGlvbigpIDogJyc7XG4gICAgICAgICAgICAgIHJldHVybiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QobW9kdWxlTmFtZSlcbiAgICAgICAgICAgICAgICAmJiAhY2h1bmtzLnNvbWUoKHsgbmFtZSB9KSA9PiBuYW1lID09PSAncG9seWZpbGxzJyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuIl19