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
const utils_1 = require("./utils");
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
    if (wco.buildOptions.sourceMap) {
        const { scriptsSourceMap = false, stylesSourceMap = false, } = wco.buildOptions;
        extraPlugins.push(utils_1.getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, false, true));
    }
    return {
        mode: 'development',
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'browser', 'module', 'main',
            ],
        },
        devtool: buildOptions.sourceMap ? false : 'eval',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBRUgsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUc3QixtQ0FBOEM7QUFHOUM7Ozs7OztHQU1HO0FBRUgsU0FBZ0IsYUFBYSxDQUMzQixHQUE2QztJQUU3QyxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRXhELE1BQU0sVUFBVSxHQUFtQixFQUFFLENBQUM7SUFDdEMsTUFBTSxZQUFZLEdBQXFCLEVBQUUsQ0FBQztJQUUxQyw4REFBOEQ7SUFDOUQsSUFBSSxZQUFZLENBQUMsWUFBWSxFQUFFO1FBQzdCLE1BQU0sbUJBQW1CLEdBQUcsWUFBWSxDQUFDLG1CQUFtQixDQUFDO1FBQzdELE1BQU0sT0FBTyxHQUF3QjtZQUNuQyxtQkFBbUI7WUFDbkIsY0FBYztTQUNmLENBQUM7UUFFRixJQUFJLG1CQUFtQixFQUFFO1lBQ3ZCLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQW1CLEVBQUUsRUFBRTtnQkFDbEQsTUFBTSxZQUFZLEdBQUcsSUFBSTtxQkFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO3FCQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztZQUNoQyxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLElBQUksRUFBRSxZQUFZO1lBQ2xCLE1BQU0sRUFBRSw4QkFBOEI7WUFDdEMsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRTtZQUM1QixPQUFPLEVBQUUsTUFBTTtZQUNmLE9BQU87WUFDUCxPQUFPO1NBQ1IsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFO1FBQzlCLE1BQU0sRUFDSixnQkFBZ0IsR0FBRyxLQUFLLEVBQ3hCLGVBQWUsR0FBRyxLQUFLLEdBQ3hCLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQztRQUVyQixZQUFZLENBQUMsSUFBSSxDQUFDLDJCQUFtQixDQUNuQyxnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLEtBQUssRUFDTCxJQUFJLENBQ0wsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLGFBQWE7UUFDbkIsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFO2dCQUNWLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTTthQUM1QjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTTtRQUNoRCxLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLElBQUksQ0FBQztTQUM1QztRQUNELE1BQU0sRUFBRTtZQUNOLEtBQUssRUFBRSxVQUFVO1NBQ2xCO1FBQ0QsT0FBTyxFQUFFLFlBQVk7UUFDckIsWUFBWSxFQUFFO1lBQ1osV0FBVyxFQUFFO2dCQUNYLE1BQU0sRUFBRSxDQUFDLENBQUMsS0FBdUIsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUM7Z0JBQ2pFLFdBQVcsRUFBRTtvQkFDWCxPQUFPLEVBQUUsS0FBSztvQkFDZCxNQUFNLEVBQUU7d0JBQ04sSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLFNBQVM7d0JBQ2pCLElBQUksRUFBRSxDQUFDLE1BQTJDLEVBQUUsTUFBMEIsRUFBRSxFQUFFOzRCQUNoRixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBRTVFLE9BQU8sd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzttQ0FDM0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDO3dCQUN4RCxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtLQUc2QixDQUFDO0FBQ25DLENBQUM7QUF0RkQsc0NBc0ZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucywgV2VicGFja1Rlc3RPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBnZXRTb3VyY2VNYXBEZXZUb29sIH0gZnJvbSAnLi91dGlscyc7XG5cblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdpc3RhbmJ1bC1pbnN0cnVtZW50ZXItbG9hZGVyJylcbiAqXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRlc3RDb25maWcoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM8V2VicGFja1Rlc3RPcHRpb25zPixcbik6IHdlYnBhY2suQ29uZmlndXJhdGlvbiB7XG4gIGNvbnN0IHsgcm9vdCwgYnVpbGRPcHRpb25zLCBzb3VyY2VSb290OiBpbmNsdWRlIH0gPSB3Y287XG5cbiAgY29uc3QgZXh0cmFSdWxlczogd2VicGFjay5SdWxlW10gPSBbXTtcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB3ZWJwYWNrLlBsdWdpbltdID0gW107XG5cbiAgLy8gaWYgKGJ1aWxkT3B0aW9ucy5jb2RlQ292ZXJhZ2UgJiYgQ2xpQ29uZmlnLmZyb21Qcm9qZWN0KCkpIHtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5jb2RlQ292ZXJhZ2UpIHtcbiAgICBjb25zdCBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gYnVpbGRPcHRpb25zLmNvZGVDb3ZlcmFnZUV4Y2x1ZGU7XG4gICAgY29uc3QgZXhjbHVkZTogKHN0cmluZyB8IFJlZ0V4cClbXSA9IFtcbiAgICAgIC9cXC4oZTJlfHNwZWMpXFwudHMkLyxcbiAgICAgIC9ub2RlX21vZHVsZXMvLFxuICAgIF07XG5cbiAgICBpZiAoY29kZUNvdmVyYWdlRXhjbHVkZSkge1xuICAgICAgY29kZUNvdmVyYWdlRXhjbHVkZS5mb3JFYWNoKChleGNsdWRlR2xvYjogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGV4Y2x1ZGVGaWxlcyA9IGdsb2JcbiAgICAgICAgICAuc3luYyhwYXRoLmpvaW4ocm9vdCwgZXhjbHVkZUdsb2IpLCB7IG5vZGlyOiB0cnVlIH0pXG4gICAgICAgICAgLm1hcChmaWxlID0+IHBhdGgubm9ybWFsaXplKGZpbGUpKTtcbiAgICAgICAgZXhjbHVkZS5wdXNoKC4uLmV4Y2x1ZGVGaWxlcyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLihqc3x0cykkLyxcbiAgICAgIGxvYWRlcjogJ2lzdGFuYnVsLWluc3RydW1lbnRlci1sb2FkZXInLFxuICAgICAgb3B0aW9uczogeyBlc01vZHVsZXM6IHRydWUgfSxcbiAgICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICAgIGV4Y2x1ZGUsXG4gICAgICBpbmNsdWRlLFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHdjby5idWlsZE9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgY29uc3Qge1xuICAgICAgc2NyaXB0c1NvdXJjZU1hcCA9IGZhbHNlLFxuICAgICAgc3R5bGVzU291cmNlTWFwID0gZmFsc2UsXG4gICAgfSA9IHdjby5idWlsZE9wdGlvbnM7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChnZXRTb3VyY2VNYXBEZXZUb29sKFxuICAgICAgc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgIHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIGZhbHNlLFxuICAgICAgdHJ1ZSxcbiAgICApKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBkZXZ0b29sOiBidWlsZE9wdGlvbnMuc291cmNlTWFwID8gZmFsc2UgOiAnZXZhbCcsXG4gICAgZW50cnk6IHtcbiAgICAgIG1haW46IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbiksXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBleHRyYVJ1bGVzLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgY2h1bmtzOiAoKGNodW5rOiB7IG5hbWU6IHN0cmluZyB9KSA9PiBjaHVuay5uYW1lICE9PSAncG9seWZpbGxzJyksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgdmVuZG9yOiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogJ2luaXRpYWwnLFxuICAgICAgICAgICAgdGVzdDogKG1vZHVsZTogeyBuYW1lRm9yQ29uZGl0aW9uPzogKCkgPT4gc3RyaW5nIH0sIGNodW5rczogeyBuYW1lOiBzdHJpbmcgfVtdKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZUZvckNvbmRpdGlvbiA/IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uKCkgOiAnJztcblxuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscycpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIFdlYnBhY2sgdHlwaW5ncyBkb24ndCB5ZXQgaW5jbHVkZSB0aGUgZnVuY3Rpb24gZm9ybSBmb3IgJ2NodW5rcycsXG4gICAgLy8gb3IgdGhlIGJ1aWx0LWluIHZlbmRvcnMgY2FjaGUgZ3JvdXAuXG4gIH0gYXMge30gYXMgd2VicGFjay5Db25maWd1cmF0aW9uO1xufVxuIl19