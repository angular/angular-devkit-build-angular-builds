"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const index2_1 = require("@angular-devkit/architect/src/index2");
const node_1 = require("@angular-devkit/core/node");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
async function initialize(options, context) {
    const host = new node_1.NodeJsSyncHost();
    const { config } = await webpack_browser_config_1.generateBrowserWebpackConfigFromContext(Object.assign({}, options, { outputPath: '' }), context, wco => [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getNonAotConfig(wco),
        webpack_configs_1.getTestConfig(wco),
    ], host);
    // tslint:disable-next-line:no-implicit-dependencies
    const karma = await Promise.resolve().then(() => require('karma'));
    return [karma, config];
}
function runKarma(options, context) {
    const root = context.workspaceRoot;
    return rxjs_1.from(initialize(options, context)).pipe(operators_1.switchMap(([karma, webpackConfig]) => new rxjs_1.Observable(subscriber => {
        const karmaOptions = {};
        if (options.watch !== undefined) {
            karmaOptions.singleRun = !options.watch;
        }
        // Convert browsers from a string to an array
        if (options.browsers) {
            karmaOptions.browsers = options.browsers.split(',');
        }
        if (options.reporters) {
            // Split along commas to make it more natural, and remove empty strings.
            const reporters = options.reporters
                .reduce((acc, curr) => acc.concat(curr.split(/,/)), [])
                .filter(x => !!x);
            if (reporters.length > 0) {
                karmaOptions.reporters = reporters;
            }
        }
        // Assign additional karmaConfig options to the local ngapp config
        karmaOptions.configFile = path_1.resolve(root, options.karmaConfig);
        karmaOptions.buildWebpack = {
            options,
            webpackConfig,
            // Pass onto Karma to emit BuildEvents.
            successCb: () => subscriber.next({ success: true }),
            failureCb: () => subscriber.next({ success: false }),
            // Workaround for https://github.com/karma-runner/karma/issues/3154
            // When this workaround is removed, user projects need to be updated to use a Karma
            // version that has a fix for this issue.
            toJSON: () => { },
            logger: context.logger,
        };
        // Complete the observable once the Karma server returns.
        const karmaServer = new karma.Server(karmaOptions, () => subscriber.complete());
        // karma typings incorrectly define start's return value as void
        // tslint:disable-next-line:no-use-of-empty-return-value
        const karmaStart = karmaServer.start();
        // Cleanup, signal Karma to exit.
        return () => {
            // Karma only has the `stop` method start with 3.1.1, so we must defensively check.
            const karmaServerWithStop = karmaServer;
            if (typeof karmaServerWithStop.stop === 'function') {
                return karmaStart.then(() => karmaServerWithStop.stop());
            }
        };
    })));
}
exports.runKarma = runKarma;
exports.default = index2_1.createBuilder(runKarma);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9rYXJtYS9pbmRleDIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCxpRUFBb0c7QUFDcEcsb0RBQTJEO0FBQzNELCtCQUErQjtBQUMvQiwrQkFBd0M7QUFDeEMsOENBQTJDO0FBRTNDLGlGQUtxRDtBQUVyRCw0RUFBMEY7QUFTMUYsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNEIsRUFDNUIsT0FBdUI7SUFHdkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxxQkFBYyxFQUFFLENBQUM7SUFDbEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sZ0VBQXVDLG1CQUl6RCxPQUEyQyxJQUFFLFVBQVUsRUFBRSxFQUFFLEtBQ2hFLE9BQU8sRUFDUCxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ0wsaUNBQWUsQ0FBQyxHQUFHLENBQUM7UUFDcEIsaUNBQWUsQ0FBQyxHQUFHLENBQUM7UUFDcEIsaUNBQWUsQ0FBQyxHQUFHLENBQUM7UUFDcEIsK0JBQWEsQ0FBQyxHQUFHLENBQUM7S0FDbkIsRUFDRCxJQUFJLENBQ0wsQ0FBQztJQUVGLG9EQUFvRDtJQUNwRCxNQUFNLEtBQUssR0FBRywyQ0FBYSxPQUFPLEVBQUMsQ0FBQztJQUVwQyxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRCxTQUFnQixRQUFRLENBQ3RCLE9BQTRCLEVBQzVCLE9BQXVCO0lBRXZCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFFbkMsT0FBTyxXQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDNUMscUJBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLGlCQUFVLENBQWdCLFVBQVUsQ0FBQyxFQUFFO1FBQy9FLE1BQU0sWUFBWSxHQUF1QixFQUFFLENBQUM7UUFFNUMsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUMvQixZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztTQUN6QztRQUVELDZDQUE2QztRQUM3QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyRDtRQUVELElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtZQUNyQix3RUFBd0U7WUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVM7aUJBQ2hDLE1BQU0sQ0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztpQkFDaEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXBCLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ3hCLFlBQVksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO2FBQ3BDO1NBQ0Y7UUFFRCxrRUFBa0U7UUFDbEUsWUFBWSxDQUFDLFVBQVUsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU3RCxZQUFZLENBQUMsWUFBWSxHQUFHO1lBQzFCLE9BQU87WUFDUCxhQUFhO1lBQ2IsdUNBQXVDO1lBQ3ZDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO1lBQ25ELFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3BELG1FQUFtRTtZQUNuRSxtRkFBbUY7WUFDbkYseUNBQXlDO1lBQ3pDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1lBQ2pCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtTQUN2QixDQUFDO1FBRUYseURBQXlEO1FBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDaEYsZ0VBQWdFO1FBQ2hFLHdEQUF3RDtRQUN4RCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUE4QixDQUFDO1FBRW5FLGlDQUFpQztRQUNqQyxPQUFPLEdBQUcsRUFBRTtZQUNWLG1GQUFtRjtZQUNuRixNQUFNLG1CQUFtQixHQUFHLFdBQXVELENBQUM7WUFDcEYsSUFBSSxPQUFPLG1CQUFtQixDQUFDLElBQUksS0FBSyxVQUFVLEVBQUU7Z0JBQ2xELE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQzFEO1FBQ0gsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FDSixDQUFDO0FBQ0osQ0FBQztBQTlERCw0QkE4REM7QUFFRCxrQkFBZSxzQkFBYSxDQUErQyxRQUFRLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbiAgZ2V0VGVzdENvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgS2FybWFCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xudHlwZSBLYXJtYUNvbmZpZ09wdGlvbnMgPSBpbXBvcnQgKCdrYXJtYScpLkNvbmZpZ09wdGlvbnMgJiB7XG4gIGJ1aWxkV2VicGFjaz86IHVua25vd247XG4gIGNvbmZpZ0ZpbGU/OiBzdHJpbmc7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuKTogUHJvbWlzZTxbdHlwZW9mIGltcG9ydCAoJ2thcm1hJyksIHdlYnBhY2suQ29uZmlndXJhdGlvbl0+IHtcbiAgY29uc3QgaG9zdCA9IG5ldyBOb2RlSnNTeW5jSG9zdCgpO1xuICBjb25zdCB7IGNvbmZpZyB9ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIC8vIG9ubHkgdHdvIHByb3BlcnRpZXMgYXJlIG1pc3Npbmc6XG4gICAgLy8gKiBgb3V0cHV0UGF0aGAgd2hpY2ggaXMgZml4ZWQgZm9yIHRlc3RzXG4gICAgLy8gKiBgaW5kZXhgIHdoaWNoIGlzIG5vdCB1c2VkIGZvciB0ZXN0c1xuICAgIHsgLi4ub3B0aW9ucyBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgb3V0cHV0UGF0aDogJycgfSxcbiAgICBjb250ZXh0LFxuICAgIHdjbyA9PiBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0Tm9uQW90Q29uZmlnKHdjbyksXG4gICAgICBnZXRUZXN0Q29uZmlnKHdjbyksXG4gICAgXSxcbiAgICBob3N0LFxuICApO1xuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgY29uc3Qga2FybWEgPSBhd2FpdCBpbXBvcnQoJ2thcm1hJyk7XG5cbiAgcmV0dXJuIFtrYXJtYSwgY29uZmlnXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkthcm1hKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKChba2FybWEsIHdlYnBhY2tDb25maWddKSA9PiBuZXcgT2JzZXJ2YWJsZTxCdWlsZGVyT3V0cHV0PihzdWJzY3JpYmVyID0+IHtcbiAgICAgIGNvbnN0IGthcm1hT3B0aW9uczogS2FybWFDb25maWdPcHRpb25zID0ge307XG5cbiAgICAgIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAga2FybWFPcHRpb25zLnNpbmdsZVJ1biA9ICFvcHRpb25zLndhdGNoO1xuICAgICAgfVxuXG4gICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgIGlmIChvcHRpb25zLmJyb3dzZXJzKSB7XG4gICAgICAgIGthcm1hT3B0aW9ucy5icm93c2VycyA9IG9wdGlvbnMuYnJvd3NlcnMuc3BsaXQoJywnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMucmVwb3J0ZXJzKSB7XG4gICAgICAgIC8vIFNwbGl0IGFsb25nIGNvbW1hcyB0byBtYWtlIGl0IG1vcmUgbmF0dXJhbCwgYW5kIHJlbW92ZSBlbXB0eSBzdHJpbmdzLlxuICAgICAgICBjb25zdCByZXBvcnRlcnMgPSBvcHRpb25zLnJlcG9ydGVyc1xuICAgICAgICAgIC5yZWR1Y2U8c3RyaW5nW10+KChhY2MsIGN1cnIpID0+IGFjYy5jb25jYXQoY3Vyci5zcGxpdCgvLC8pKSwgW10pXG4gICAgICAgICAgLmZpbHRlcih4ID0+ICEheCk7XG5cbiAgICAgICAgaWYgKHJlcG9ydGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAga2FybWFPcHRpb25zLnJlcG9ydGVycyA9IHJlcG9ydGVycztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBc3NpZ24gYWRkaXRpb25hbCBrYXJtYUNvbmZpZyBvcHRpb25zIHRvIHRoZSBsb2NhbCBuZ2FwcCBjb25maWdcbiAgICAgIGthcm1hT3B0aW9ucy5jb25maWdGaWxlID0gcmVzb2x2ZShyb290LCBvcHRpb25zLmthcm1hQ29uZmlnKTtcblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgLy8gUGFzcyBvbnRvIEthcm1hIHRvIGVtaXQgQnVpbGRFdmVudHMuXG4gICAgICAgIHN1Y2Nlc3NDYjogKCkgPT4gc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KSxcbiAgICAgICAgZmFpbHVyZUNiOiAoKSA9PiBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBmYWxzZSB9KSxcbiAgICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2thcm1hLXJ1bm5lci9rYXJtYS9pc3N1ZXMvMzE1NFxuICAgICAgICAvLyBXaGVuIHRoaXMgd29ya2Fyb3VuZCBpcyByZW1vdmVkLCB1c2VyIHByb2plY3RzIG5lZWQgdG8gYmUgdXBkYXRlZCB0byB1c2UgYSBLYXJtYVxuICAgICAgICAvLyB2ZXJzaW9uIHRoYXQgaGFzIGEgZml4IGZvciB0aGlzIGlzc3VlLlxuICAgICAgICB0b0pTT046ICgpID0+IHsgfSxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIC8vIENvbXBsZXRlIHRoZSBvYnNlcnZhYmxlIG9uY2UgdGhlIEthcm1hIHNlcnZlciByZXR1cm5zLlxuICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hT3B0aW9ucywgKCkgPT4gc3Vic2NyaWJlci5jb21wbGV0ZSgpKTtcbiAgICAgIC8vIGthcm1hIHR5cGluZ3MgaW5jb3JyZWN0bHkgZGVmaW5lIHN0YXJ0J3MgcmV0dXJuIHZhbHVlIGFzIHZvaWRcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11c2Utb2YtZW1wdHktcmV0dXJuLXZhbHVlXG4gICAgICBjb25zdCBrYXJtYVN0YXJ0ID0ga2FybWFTZXJ2ZXIuc3RhcnQoKSBhcyB1bmtub3duIGFzIFByb21pc2U8dm9pZD47XG5cbiAgICAgIC8vIENsZWFudXAsIHNpZ25hbCBLYXJtYSB0byBleGl0LlxuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgLy8gS2FybWEgb25seSBoYXMgdGhlIGBzdG9wYCBtZXRob2Qgc3RhcnQgd2l0aCAzLjEuMSwgc28gd2UgbXVzdCBkZWZlbnNpdmVseSBjaGVjay5cbiAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXJXaXRoU3RvcCA9IGthcm1hU2VydmVyIGFzIHVua25vd24gYXMgeyBzdG9wOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH07XG4gICAgICAgIGlmICh0eXBlb2Yga2FybWFTZXJ2ZXJXaXRoU3RvcC5zdG9wID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgcmV0dXJuIGthcm1hU3RhcnQudGhlbigoKSA9PiBrYXJtYVNlcnZlcldpdGhTdG9wLnN0b3AoKSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSkpLFxuICApO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFJlY29yZDxzdHJpbmcsIHN0cmluZz4gJiBLYXJtYUJ1aWxkZXJPcHRpb25zPihydW5LYXJtYSk7XG4iXX0=