"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const path = require("path");
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('istanbul-instrumenter-loader')
 *
 */
function getTestConfig(wco) {
    const { root, buildOptions, sourceRoot: include } = wco;
    const extraRules = [];
    const extraPlugins = [];
    // if (buildOptions.codeCoverage && CliConfig.fromProject()) {
    if (buildOptions.codeCoverage) {
        const codeCoverageExclude = buildOptions.codeCoverageExclude;
        const exclude = [
            /\.(e2e|spec)\.ts$/,
            /node_modules/,
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
            test: /\.(js|ts)$/,
            loader: 'istanbul-instrumenter-loader',
            options: { esModules: true },
            enforce: 'post',
            exclude,
            include,
        });
    }
    return {
        mode: 'development',
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'browser', 'module', 'main',
            ],
        },
        devtool: buildOptions.sourceMap ? 'inline-source-map' : 'eval',
        entry: {
            main: path.resolve(root, buildOptions.main),
        },
        module: {
            rules: extraRules,
        },
        plugins: extraPlugins,
        optimization: {
            splitChunks: {
                chunks: ((chunk) => chunk.name !== 'polyfills'),
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
                },
            },
        },
    };
}
exports.getTestConfig = getTestConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBRUgsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUs3Qjs7Ozs7O0dBTUc7QUFFSCx1QkFDRSxHQUE2QztJQUU3QyxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRXhELE1BQU0sVUFBVSxHQUFtQixFQUFFLENBQUM7SUFDdEMsTUFBTSxZQUFZLEdBQXFCLEVBQUUsQ0FBQztJQUUxQyw4REFBOEQ7SUFDOUQsSUFBSSxZQUFZLENBQUMsWUFBWSxFQUFFO1FBQzdCLE1BQU0sbUJBQW1CLEdBQUcsWUFBWSxDQUFDLG1CQUFtQixDQUFDO1FBQzdELE1BQU0sT0FBTyxHQUF3QjtZQUNuQyxtQkFBbUI7WUFDbkIsY0FBYztTQUNmLENBQUM7UUFFRixJQUFJLG1CQUFtQixFQUFFO1lBQ3ZCLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQW1CLEVBQUUsRUFBRTtnQkFDbEQsTUFBTSxZQUFZLEdBQUcsSUFBSTtxQkFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO3FCQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztZQUNoQyxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLElBQUksRUFBRSxZQUFZO1lBQ2xCLE1BQU0sRUFBRSw4QkFBOEI7WUFDdEMsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRTtZQUM1QixPQUFPLEVBQUUsTUFBTTtZQUNmLE9BQU87WUFDUCxPQUFPO1NBQ1IsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLGFBQWE7UUFDbkIsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFO2dCQUNWLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTTthQUM1QjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxNQUFNO1FBQzlELEtBQUssRUFBRTtZQUNMLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDO1NBQzVDO1FBQ0QsTUFBTSxFQUFFO1lBQ04sS0FBSyxFQUFFLFVBQVU7U0FDbEI7UUFDRCxPQUFPLEVBQUUsWUFBWTtRQUNyQixZQUFZLEVBQUU7WUFDWixXQUFXLEVBQUU7Z0JBQ1gsTUFBTSxFQUFFLENBQUMsQ0FBQyxLQUF1QixFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQztnQkFDakUsV0FBVyxFQUFFO29CQUNYLE9BQU8sRUFBRSxLQUFLO29CQUNkLE1BQU0sRUFBRTt3QkFDTixJQUFJLEVBQUUsUUFBUTt3QkFDZCxNQUFNLEVBQUUsU0FBUzt3QkFDakIsSUFBSSxFQUFFLENBQUMsTUFBMkMsRUFBRSxNQUEwQixFQUFFLEVBQUU7NEJBQ2hGLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs0QkFFNUUsT0FBTyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO21DQUMzQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7d0JBQ3hELENBQUM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO0tBRzZCLENBQUM7QUFDbkMsQ0FBQztBQXhFRCxzQ0F3RUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zLCBXZWJwYWNrVGVzdE9wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcblxuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ2lzdGFuYnVsLWluc3RydW1lbnRlci1sb2FkZXInKVxuICpcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGVzdENvbmZpZyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxXZWJwYWNrVGVzdE9wdGlvbnM+LFxuKTogd2VicGFjay5Db25maWd1cmF0aW9uIHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMsIHNvdXJjZVJvb3Q6IGluY2x1ZGUgfSA9IHdjbztcblxuICBjb25zdCBleHRyYVJ1bGVzOiB3ZWJwYWNrLlJ1bGVbXSA9IFtdO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHdlYnBhY2suUGx1Z2luW10gPSBbXTtcblxuICAvLyBpZiAoYnVpbGRPcHRpb25zLmNvZGVDb3ZlcmFnZSAmJiBDbGlDb25maWcuZnJvbVByb2plY3QoKSkge1xuICBpZiAoYnVpbGRPcHRpb25zLmNvZGVDb3ZlcmFnZSkge1xuICAgIGNvbnN0IGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBidWlsZE9wdGlvbnMuY29kZUNvdmVyYWdlRXhjbHVkZTtcbiAgICBjb25zdCBleGNsdWRlOiAoc3RyaW5nIHwgUmVnRXhwKVtdID0gW1xuICAgICAgL1xcLihlMmV8c3BlYylcXC50cyQvLFxuICAgICAgL25vZGVfbW9kdWxlcy8sXG4gICAgXTtcblxuICAgIGlmIChjb2RlQ292ZXJhZ2VFeGNsdWRlKSB7XG4gICAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlLmZvckVhY2goKGV4Y2x1ZGVHbG9iOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgZXhjbHVkZUZpbGVzID0gZ2xvYlxuICAgICAgICAgIC5zeW5jKHBhdGguam9pbihyb290LCBleGNsdWRlR2xvYiksIHsgbm9kaXI6IHRydWUgfSlcbiAgICAgICAgICAubWFwKGZpbGUgPT4gcGF0aC5ub3JtYWxpemUoZmlsZSkpO1xuICAgICAgICBleGNsdWRlLnB1c2goLi4uZXhjbHVkZUZpbGVzKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuKGpzfHRzKSQvLFxuICAgICAgbG9hZGVyOiAnaXN0YW5idWwtaW5zdHJ1bWVudGVyLWxvYWRlcicsXG4gICAgICBvcHRpb25zOiB7IGVzTW9kdWxlczogdHJ1ZSB9LFxuICAgICAgZW5mb3JjZTogJ3Bvc3QnLFxuICAgICAgZXhjbHVkZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6ICdkZXZlbG9wbWVudCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbicsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZGV2dG9vbDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCA/ICdpbmxpbmUtc291cmNlLW1hcCcgOiAnZXZhbCcsXG4gICAgZW50cnk6IHtcbiAgICAgIG1haW46IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbiksXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBleHRyYVJ1bGVzLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgY2h1bmtzOiAoKGNodW5rOiB7IG5hbWU6IHN0cmluZyB9KSA9PiBjaHVuay5uYW1lICE9PSAncG9seWZpbGxzJyksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgdmVuZG9yOiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogJ2luaXRpYWwnLFxuICAgICAgICAgICAgdGVzdDogKG1vZHVsZTogeyBuYW1lRm9yQ29uZGl0aW9uPzogKCkgPT4gc3RyaW5nIH0sIGNodW5rczogeyBuYW1lOiBzdHJpbmcgfVtdKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZUZvckNvbmRpdGlvbiA/IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uKCkgOiAnJztcblxuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscycpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIFdlYnBhY2sgdHlwaW5ncyBkb24ndCB5ZXQgaW5jbHVkZSB0aGUgZnVuY3Rpb24gZm9ybSBmb3IgJ2NodW5rcycsXG4gICAgLy8gb3IgdGhlIGJ1aWx0LWluIHZlbmRvcnMgY2FjaGUgZ3JvdXAuXG4gIH0gYXMge30gYXMgd2VicGFjay5Db25maWd1cmF0aW9uO1xufVxuIl19