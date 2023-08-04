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
    const browserOptions = await context.validateOptions(await context.getTargetOptions(options.browserTarget), builderName);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1leHRyYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvZXh0cmFjdC1pMThuL3dlYnBhY2stZXh0cmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFJSCxpRUFBd0U7QUFDeEUsK0JBQXFDO0FBQ3JDLHNEQUFzRDtBQUN0RCx5REFBOEQ7QUFDOUQsMkRBQStFO0FBRS9FLCtFQUE2RjtBQUM3Riw4Q0FBMEQ7QUFHMUQsTUFBTSxZQUFZO0lBQ2hCLEtBQUssQ0FBQyxRQUEwQjtRQUM5QixRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEUsQ0FBQztDQUNGO0FBRU0sS0FBSyxVQUFVLGVBQWUsQ0FDbkMsT0FBcUMsRUFDckMsV0FBbUIsRUFDbkIsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBT04sTUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7SUFFeEIsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQ3JELFdBQVcsQ0FDWixDQUFDO0lBRUYsTUFBTSxjQUFjLEdBQUc7UUFDckIsR0FBRyxjQUFjO1FBQ2pCLFlBQVksRUFBRSxLQUFLO1FBQ25CLFNBQVMsRUFBRTtZQUNULE9BQU8sRUFBRSxJQUFJO1lBQ2IsTUFBTSxFQUFFLEtBQUs7WUFDYixNQUFNLEVBQUUsSUFBSTtTQUNiO1FBQ0QsY0FBYyxFQUFFLEtBQUs7UUFDckIsR0FBRyxFQUFFLElBQUk7UUFDVCxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7UUFDMUIsT0FBTyxFQUFFLEVBQUU7UUFDWCxNQUFNLEVBQUUsRUFBRTtRQUNWLE9BQU8sRUFBRSxFQUFFO1FBQ1gsTUFBTSxFQUFFLEVBQUU7UUFDVixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLG9CQUFvQixFQUFFLEtBQUs7UUFDM0IsYUFBYSxFQUFFLHNCQUFhLENBQUMsSUFBSTtRQUNqQyxXQUFXLEVBQUUsSUFBSTtRQUNqQiwyQkFBMkIsRUFBRSxTQUFTO0tBQ2xCLENBQUM7SUFDdkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxnRUFBdUMsRUFDOUQsY0FBYyxFQUNkLE9BQU8sRUFDUCxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQ04seURBQXlEO1FBQ3pELFlBQVksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsSUFBSSxJQUFJLENBQUM7UUFFNUUsTUFBTSxRQUFRLEdBQStDO1lBQzNELEVBQUUsT0FBTyxFQUFFLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQyxFQUFFO1lBQ2pDLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUM7U0FDckIsQ0FBQztRQUVGLDZDQUE2QztRQUM3QyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQ2YsTUFBTSxFQUFFO2dCQUNOLEtBQUssRUFBRTtvQkFDTDt3QkFDRSxJQUFJLEVBQUUsaUJBQWlCO3dCQUN2QixNQUFNLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQzt3QkFDL0MsT0FBTyxFQUFFOzRCQUNQLGNBQWMsRUFBRSxDQUFDLFlBQStCLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUM7eUJBQ3BGO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCw2Q0FBNkM7UUFDN0MsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNaLE1BQU0sRUFBRTtnQkFDTixLQUFLLEVBQUU7b0JBQ0w7d0JBQ0UsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7cUJBQzFDO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBQ0QsNERBQTREO0lBQzVELEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLENBQ2pDLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUEsb0JBQWEsRUFDdkMsSUFBQSwwQkFBVSxFQUFDLENBQUMsTUFBTSxVQUFVLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUU7UUFDaEYsT0FBTyxFQUFFLElBQUEsb0NBQTRCLEVBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDckUsY0FBYyxFQUFFLGlCQUFPO0tBQ3hCLENBQUMsQ0FDSCxDQUFDO0lBRUYsT0FBTztRQUNMLGFBQWE7UUFDYixRQUFRLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsV0FBVztRQUMvQyxRQUFRO1FBQ1IsWUFBWTtLQUNiLENBQUM7QUFDSixDQUFDO0FBckdELDBDQXFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkTWVzc2FnZSBhcyBMb2NhbGl6ZU1lc3NhZ2UgfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgQnVpbGRSZXN1bHQsIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsYXN0VmFsdWVGcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgd2VicGFjaywgeyB0eXBlIENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZyB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBPdXRwdXRIYXNoaW5nLCBTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBOb3JtYWxpemVkRXh0cmFjdEkxOG5PcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuY2xhc3MgTm9FbWl0UGx1Z2luIHtcbiAgYXBwbHkoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpOiB2b2lkIHtcbiAgICBjb21waWxlci5ob29rcy5zaG91bGRFbWl0LnRhcCgnYW5ndWxhci1uby1lbWl0JywgKCkgPT4gZmFsc2UpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleHRyYWN0TWVzc2FnZXMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRFeHRyYWN0STE4bk9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9ID0ge30sXG4pOiBQcm9taXNlPHtcbiAgYnVpbGRlclJlc3VsdDogQnVpbGRSZXN1bHQ7XG4gIGJhc2VQYXRoOiBzdHJpbmc7XG4gIG1lc3NhZ2VzOiBMb2NhbGl6ZU1lc3NhZ2VbXTtcbiAgdXNlTGVnYWN5SWRzOiBib29sZWFuO1xufT4ge1xuICBjb25zdCBtZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW10gPSBbXTtcbiAgbGV0IHVzZUxlZ2FjeUlkcyA9IHRydWU7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICBhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMob3B0aW9ucy5icm93c2VyVGFyZ2V0KSxcbiAgICBidWlsZGVyTmFtZSxcbiAgKTtcblxuICBjb25zdCBidWlsZGVyT3B0aW9ucyA9IHtcbiAgICAuLi5icm93c2VyT3B0aW9ucyxcbiAgICBvcHRpbWl6YXRpb246IGZhbHNlLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc2NyaXB0czogdHJ1ZSxcbiAgICAgIHN0eWxlczogZmFsc2UsXG4gICAgICB2ZW5kb3I6IHRydWUsXG4gICAgfSxcbiAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgYW90OiB0cnVlLFxuICAgIHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzLFxuICAgIGJ1ZGdldHM6IFtdLFxuICAgIGFzc2V0czogW10sXG4gICAgc2NyaXB0czogW10sXG4gICAgc3R5bGVzOiBbXSxcbiAgICBkZWxldGVPdXRwdXRQYXRoOiBmYWxzZSxcbiAgICBleHRyYWN0TGljZW5zZXM6IGZhbHNlLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5OiBmYWxzZSxcbiAgICBvdXRwdXRIYXNoaW5nOiBPdXRwdXRIYXNoaW5nLk5vbmUsXG4gICAgbmFtZWRDaHVua3M6IHRydWUsXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzOiB1bmRlZmluZWQsXG4gIH0gYXMgdW5rbm93biBhcyBTY2hlbWE7XG4gIGNvbnN0IHsgY29uZmlnIH0gPSBhd2FpdCBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgYnVpbGRlck9wdGlvbnMsXG4gICAgY29udGV4dCxcbiAgICAod2NvKSA9PiB7XG4gICAgICAvLyBEZWZhdWx0IHZhbHVlIGZvciBsZWdhY3kgbWVzc2FnZSBpZHMgaXMgY3VycmVudGx5IHRydWVcbiAgICAgIHVzZUxlZ2FjeUlkcyA9IHdjby50c0NvbmZpZy5vcHRpb25zLmVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQgPz8gdHJ1ZTtcblxuICAgICAgY29uc3QgcGFydGlhbHM6IChQcm9taXNlPENvbmZpZ3VyYXRpb24+IHwgQ29uZmlndXJhdGlvbilbXSA9IFtcbiAgICAgICAgeyBwbHVnaW5zOiBbbmV3IE5vRW1pdFBsdWdpbigpXSB9LFxuICAgICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIF07XG5cbiAgICAgIC8vIEFkZCBJdnkgYXBwbGljYXRpb24gZmlsZSBleHRyYWN0b3Igc3VwcG9ydFxuICAgICAgcGFydGlhbHMudW5zaGlmdCh7XG4gICAgICAgIG1vZHVsZToge1xuICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4vaXZ5LWV4dHJhY3QtbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlSGFuZGxlcjogKGZpbGVNZXNzYWdlczogTG9jYWxpemVNZXNzYWdlW10pID0+IG1lc3NhZ2VzLnB1c2goLi4uZmlsZU1lc3NhZ2VzKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBSZXBsYWNlIGFsbCBzdHlsZXNoZWV0cyB3aXRoIGVtcHR5IGNvbnRlbnRcbiAgICAgIHBhcnRpYWxzLnB1c2goe1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0ZXN0OiAvXFwuKGNzc3xzY3NzfHNhc3N8bGVzcykkLyxcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4vZW1wdHktbG9hZGVyJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHBhcnRpYWxzO1xuICAgIH0sXG4gICAgLy8gRHVyaW5nIGV4dHJhY3Rpb24gd2UgZG9uJ3QgbmVlZCBzcGVjaWZpYyBicm93c2VyIHN1cHBvcnQuXG4gICAgeyBzdXBwb3J0ZWRCcm93c2VyczogdW5kZWZpbmVkIH0sXG4gICk7XG5cbiAgY29uc3QgYnVpbGRlclJlc3VsdCA9IGF3YWl0IGxhc3RWYWx1ZUZyb20oXG4gICAgcnVuV2VicGFjaygoYXdhaXQgdHJhbnNmb3Jtcz8ud2VicGFja0NvbmZpZ3VyYXRpb24/Lihjb25maWcpKSB8fCBjb25maWcsIGNvbnRleHQsIHtcbiAgICAgIGxvZ2dpbmc6IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2soYnVpbGRlck9wdGlvbnMsIGNvbnRleHQubG9nZ2VyKSxcbiAgICAgIHdlYnBhY2tGYWN0b3J5OiB3ZWJwYWNrLFxuICAgIH0pLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgYnVpbGRlclJlc3VsdCxcbiAgICBiYXNlUGF0aDogY29uZmlnLmNvbnRleHQgfHwgb3B0aW9ucy5wcm9qZWN0Um9vdCxcbiAgICBtZXNzYWdlcyxcbiAgICB1c2VMZWdhY3lJZHMsXG4gIH07XG59XG4iXX0=