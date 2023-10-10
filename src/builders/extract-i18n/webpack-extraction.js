"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMessages = void 0;
const build_webpack_1 = require("@angular-devkit/build-webpack");
const rxjs_1 = require("rxjs");
const webpack_1 = __importDefault(require("webpack"));
const configs_1 = require("../../tools/webpack/configs");
const stats_1 = require("../../tools/webpack/utils/stats");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const schema_1 = require("../browser/schema");
class NoEmitPlugin {
    apply(compiler) {
        compiler.hooks.shouldEmit.tap('angular-no-emit', () => false);
    }
}
async function extractMessages(options, builderName, context, transforms = {}) {
    const messages = [];
    let useLegacyIds = true;
    const browserOptions = await context.validateOptions(await context.getTargetOptions(options.buildTarget), builderName);
    const builderOptions = {
        ...browserOptions,
        optimization: false,
        sourceMap: {
            scripts: true,
            styles: false,
            vendor: true,
        },
        buildOptimizer: false,
        aot: true,
        progress: options.progress,
        budgets: [],
        assets: [],
        scripts: [],
        styles: [],
        deleteOutputPath: false,
        extractLicenses: false,
        subresourceIntegrity: false,
        outputHashing: schema_1.OutputHashing.None,
        namedChunks: true,
        allowedCommonJsDependencies: undefined,
    };
    const { config } = await (0, webpack_browser_config_1.generateBrowserWebpackConfigFromContext)(builderOptions, context, (wco) => {
        // Default value for legacy message ids is currently true
        useLegacyIds = wco.tsConfig.options.enableI18nLegacyMessageIdFormat ?? true;
        const partials = [
            { plugins: [new NoEmitPlugin()] },
            (0, configs_1.getCommonConfig)(wco),
        ];
        // Add Ivy application file extractor support
        partials.unshift({
            module: {
                rules: [
                    {
                        test: /\.[cm]?[tj]sx?$/,
                        loader: require.resolve('./ivy-extract-loader'),
                        options: {
                            messageHandler: (fileMessages) => messages.push(...fileMessages),
                        },
                    },
                ],
            },
        });
        // Replace all stylesheets with empty content
        partials.push({
            module: {
                rules: [
                    {
                        test: /\.(css|scss|sass|less)$/,
                        loader: require.resolve('./empty-loader'),
                    },
                ],
            },
        });
        return partials;
    }, 
    // During extraction we don't need specific browser support.
    { supportedBrowsers: undefined });
    const builderResult = await (0, rxjs_1.lastValueFrom)((0, build_webpack_1.runWebpack)((await transforms?.webpackConfiguration?.(config)) || config, context, {
        logging: (0, stats_1.createWebpackLoggingCallback)(builderOptions, context.logger),
        webpackFactory: webpack_1.default,
    }));
    return {
        builderResult,
        basePath: config.context || options.projectRoot,
        messages,
        useLegacyIds,
    };
}
exports.extractMessages = extractMessages;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1leHRyYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvZXh0cmFjdC1pMThuL3dlYnBhY2stZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFJSCxpRUFBd0U7QUFDeEUsK0JBQXFDO0FBQ3JDLHNEQUFzRDtBQUN0RCx5REFBOEQ7QUFDOUQsMkRBQStFO0FBRS9FLCtFQUE2RjtBQUM3Riw4Q0FBMEQ7QUFHMUQsTUFBTSxZQUFZO0lBQ2hCLEtBQUssQ0FBQyxRQUEwQjtRQUM5QixRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEUsQ0FBQztDQUNGO0FBRU0sS0FBSyxVQUFVLGVBQWUsQ0FDbkMsT0FBcUMsRUFDckMsV0FBbUIsRUFDbkIsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBT04sTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7SUFFeEIsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQ25ELFdBQVcsQ0FDWixDQUFDO0lBRUYsTUFBTSxjQUFjLEdBQUc7UUFDckIsR0FBRyxjQUFjO1FBQ2pCLFlBQVksRUFBRSxLQUFLO1FBQ25CLFNBQVMsRUFBRTtZQUNULE9BQU8sRUFBRSxJQUFJO1lBQ2IsTUFBTSxFQUFFLEtBQUs7WUFDYixNQUFNLEVBQUUsSUFBSTtTQUNiO1FBQ0QsY0FBYyxFQUFFLEtBQUs7UUFDckIsR0FBRyxFQUFFLElBQUk7UUFDVCxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7UUFDMUIsT0FBTyxFQUFFLEVBQUU7UUFDWCxNQUFNLEVBQUUsRUFBRTtRQUNWLE9BQU8sRUFBRSxFQUFFO1FBQ1gsTUFBTSxFQUFFLEVBQUU7UUFDVixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLG9CQUFvQixFQUFFLEtBQUs7UUFDM0IsYUFBYSxFQUFFLHNCQUFhLENBQUMsSUFBSTtRQUNqQyxXQUFXLEVBQUUsSUFBSTtRQUNqQiwyQkFBMkIsRUFBRSxTQUFTO0tBQ2xCLENBQUM7SUFDdkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxnRUFBdUMsRUFDOUQsY0FBYyxFQUNkLE9BQU8sRUFDUCxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQ04seURBQXlEO1FBQ3pELFlBQVksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsSUFBSSxJQUFJLENBQUM7UUFFNUUsTUFBTSxRQUFRLEdBQStDO1lBQzNELEVBQUUsT0FBTyxFQUFFLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQyxFQUFFO1lBQ2pDLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUM7U0FDckIsQ0FBQztRQUVGLDZDQUE2QztRQUM3QyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQ2YsTUFBTSxFQUFFO2dCQUNOLEtBQUssRUFBRTtvQkFDTDt3QkFDRSxJQUFJLEVBQUUsaUJBQWlCO3dCQUN2QixNQUFNLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQzt3QkFDL0MsT0FBTyxFQUFFOzRCQUNQLGNBQWMsRUFBRSxDQUFDLFlBQStCLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUM7eUJBQ3BGO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCw2Q0FBNkM7UUFDN0MsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNaLE1BQU0sRUFBRTtnQkFDTixLQUFLLEVBQUU7b0JBQ0w7d0JBQ0UsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7cUJBQzFDO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBQ0QsNERBQTREO0lBQzVELEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLENBQ2pDLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsb0JBQWEsRUFDdkMsSUFBQSwwQkFBVSxFQUFDLENBQUMsTUFBTSxVQUFVLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUU7UUFDaEYsT0FBTyxFQUFFLElBQUEsb0NBQTRCLEVBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDckUsY0FBYyxFQUFFLGlCQUFPO0tBQ3hCLENBQUMsQ0FDSCxDQUFDO0lBRUYsT0FBTztRQUNMLGFBQWE7UUFDYixRQUFRLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsV0FBVztRQUMvQyxRQUFRO1FBQ1IsWUFBWTtLQUNiLENBQUM7QUFDSixDQUFDO0FBckdELDBDQXFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkTWVzc2FnZSBhcyBMb2NhbGl6ZU1lc3NhZ2UgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgQnVpbGRSZXN1bHQsIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsYXN0VmFsdWVGcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgd2VicGFjaywgeyB0eXBlIENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZyB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBPdXRwdXRIYXNoaW5nLCBTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBOb3JtYWxpemVkRXh0cmFjdEkxOG5PcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuY2xhc3MgTm9FbWl0UGx1Z2luIHtcbiAgYXBwbHkoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5zaG91bGRFbWl0LnRhcCgnYW5ndWxhci1uby1lbWl0JywgKCkgPT4gZmFsc2UpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleHRyYWN0TWVzc2FnZXMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRFeHRyYWN0STE4bk9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9ID0ge30sXG4pOiBQcm9taXNlPHtcbiAgYnVpbGRlclJlc3VsdDogQnVpbGRSZXN1bHQ7XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG4gIG1lc3NhZ2VzOiBMb2NhbGl6ZU1lc3NhZ2VbXTtcbiAgdXNlTGVnYWN5SWRzOiBib29sZWFuO1xufT4ge1xuICBjb25zdCBtZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW10gPSBbXTtcbiAgbGV0IHVzZUxlZ2FjeUlkcyA9IHRydWU7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICBhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMob3B0aW9ucy5idWlsZFRhcmdldCksXG4gICAgYnVpbGRlck5hbWUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRlck9wdGlvbnMgPSB7XG4gICAgLi4uYnJvd3Nlck9wdGlvbnMsXG4gICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHNjcmlwdHM6IHRydWUsXG4gICAgICBzdHlsZXM6IGZhbHNlLFxuICAgICAgdmVuZG9yOiB0cnVlLFxuICAgIH0sXG4gICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgIGFvdDogdHJ1ZSxcbiAgICBwcm9ncmVzczogb3B0aW9ucy5wcm9ncmVzcyxcbiAgICBidWRnZXRzOiBbXSxcbiAgICBhc3NldHM6IFtdLFxuICAgIHNjcmlwdHM6IFtdLFxuICAgIHN0eWxlczogW10sXG4gICAgZGVsZXRlT3V0cHV0UGF0aDogZmFsc2UsXG4gICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eTogZmFsc2UsXG4gICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llczogdW5kZWZpbmVkLFxuICB9IGFzIHVua25vd24gYXMgU2NoZW1hO1xuICBjb25zdCB7IGNvbmZpZyB9ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIGJ1aWxkZXJPcHRpb25zLFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4ge1xuICAgICAgLy8gRGVmYXVsdCB2YWx1ZSBmb3IgbGVnYWN5IG1lc3NhZ2UgaWRzIGlzIGN1cnJlbnRseSB0cnVlXG4gICAgICB1c2VMZWdhY3lJZHMgPSB3Y28udHNDb25maWcub3B0aW9ucy5lbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0ID8/IHRydWU7XG5cbiAgICAgIGNvbnN0IHBhcnRpYWxzOiAoUHJvbWlzZTxDb25maWd1cmF0aW9uPiB8IENvbmZpZ3VyYXRpb24pW10gPSBbXG4gICAgICAgIHsgcGx1Z2luczogW25ldyBOb0VtaXRQbHVnaW4oKV0gfSxcbiAgICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBdO1xuXG4gICAgICAvLyBBZGQgSXZ5IGFwcGxpY2F0aW9uIGZpbGUgZXh0cmFjdG9yIHN1cHBvcnRcbiAgICAgIHBhcnRpYWxzLnVuc2hpZnQoe1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuL2l2eS1leHRyYWN0LWxvYWRlcicpLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZUhhbmRsZXI6IChmaWxlTWVzc2FnZXM6IExvY2FsaXplTWVzc2FnZVtdKSA9PiBtZXNzYWdlcy5wdXNoKC4uLmZpbGVNZXNzYWdlcyksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gUmVwbGFjZSBhbGwgc3R5bGVzaGVldHMgd2l0aCBlbXB0eSBjb250ZW50XG4gICAgICBwYXJ0aWFscy5wdXNoKHtcbiAgICAgICAgbW9kdWxlOiB7XG4gICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGVzdDogL1xcLihjc3N8c2Nzc3xzYXNzfGxlc3MpJC8sXG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuL2VtcHR5LWxvYWRlcicpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBwYXJ0aWFscztcbiAgICB9LFxuICAgIC8vIER1cmluZyBleHRyYWN0aW9uIHdlIGRvbid0IG5lZWQgc3BlY2lmaWMgYnJvd3NlciBzdXBwb3J0LlxuICAgIHsgc3VwcG9ydGVkQnJvd3NlcnM6IHVuZGVmaW5lZCB9LFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkZXJSZXN1bHQgPSBhd2FpdCBsYXN0VmFsdWVGcm9tKFxuICAgIHJ1bldlYnBhY2soKGF3YWl0IHRyYW5zZm9ybXM/LndlYnBhY2tDb25maWd1cmF0aW9uPy4oY29uZmlnKSkgfHwgY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICBsb2dnaW5nOiBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrKGJ1aWxkZXJPcHRpb25zLCBjb250ZXh0LmxvZ2dlciksXG4gICAgICB3ZWJwYWNrRmFjdG9yeTogd2VicGFjayxcbiAgICB9KSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGJ1aWxkZXJSZXN1bHQsXG4gICAgYmFzZVBhdGg6IGNvbmZpZy5jb250ZXh0IHx8IG9wdGlvbnMucHJvamVjdFJvb3QsXG4gICAgbWVzc2FnZXMsXG4gICAgdXNlTGVnYWN5SWRzLFxuICB9O1xufVxuIl19