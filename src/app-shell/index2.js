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
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const fs = require("fs");
const path = require("path");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
async function _renderUniversal(options, context, browserResult, serverResult) {
    const browserIndexOutputPath = path.join(browserResult.outputPath || '', 'index.html');
    const indexHtml = fs.readFileSync(browserIndexOutputPath, 'utf8');
    const serverBundlePath = await _getServerModuleBundlePath(options, context, serverResult);
    const root = context.workspaceRoot;
    require_project_module_1.requireProjectModule(root, 'zone.js/dist/zone-node');
    const renderModuleFactory = require_project_module_1.requireProjectModule(root, '@angular/platform-server').renderModuleFactory;
    const AppServerModuleNgFactory = require(serverBundlePath).AppServerModuleNgFactory;
    const outputIndexPath = options.outputIndexPath
        ? path.join(root, options.outputIndexPath)
        : browserIndexOutputPath;
    // Render to HTML and overwrite the client index file.
    const html = await renderModuleFactory(AppServerModuleNgFactory, {
        document: indexHtml,
        url: options.route,
    });
    fs.writeFileSync(outputIndexPath, html);
    const browserTarget = index2_1.targetFromTargetString(options.browserTarget);
    const rawBrowserOptions = await context.getTargetOptions(browserTarget);
    const browserBuilderName = await context.getBuilderNameForTarget(browserTarget);
    const browserOptions = await context.validateOptions(rawBrowserOptions, browserBuilderName);
    if (browserOptions.serviceWorker) {
        const host = new node_1.NodeJsSyncHost();
        // Create workspace.
        const registry = new core_1.schema.CoreSchemaRegistry();
        registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
        const workspace = await core_1.experimental.workspace.Workspace.fromPath(host, core_1.normalize(context.workspaceRoot), registry);
        const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();
        if (!projectName) {
            throw new Error('Must either have a target from the context or a default project.');
        }
        const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
        await service_worker_1.augmentAppWithServiceWorker(host, core_1.normalize(root), projectRoot, core_1.join(core_1.normalize(root), browserOptions.outputPath), browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
    }
    return browserResult;
}
async function _getServerModuleBundlePath(options, context, serverResult) {
    if (options.appModuleBundle) {
        return path.join(context.workspaceRoot, options.appModuleBundle);
    }
    else {
        const outputPath = serverResult.outputPath || '/';
        const files = fs.readdirSync(outputPath, 'utf8');
        const re = /^main\.(?:[a-zA-Z0-9]{20}\.)?(?:bundle\.)?js$/;
        const maybeMain = files.filter(x => re.test(x))[0];
        if (!maybeMain) {
            throw new Error('Could not find the main bundle.');
        }
        else {
            return path.join(outputPath, maybeMain);
        }
    }
}
async function _appShellBuilder(options, context) {
    const browserTarget = index2_1.targetFromTargetString(options.browserTarget);
    const serverTarget = index2_1.targetFromTargetString(options.serverTarget);
    // Never run the browser target in watch mode.
    // If service worker is needed, it will be added in _renderUniversal();
    const browserTargetRun = await context.scheduleTarget(browserTarget, {
        watch: false,
        serviceWorker: false,
    });
    const serverTargetRun = await context.scheduleTarget(serverTarget, {});
    try {
        const [browserResult, serverResult] = await Promise.all([
            browserTargetRun.result,
            serverTargetRun.result,
        ]);
        if (browserResult.success === false || browserResult.outputPath === undefined) {
            return browserResult;
        }
        else if (serverResult.success === false) {
            return serverResult;
        }
        return await _renderUniversal(options, context, browserResult, serverResult);
    }
    catch (err) {
        return { success: false, error: err.message };
    }
    finally {
        // Just be good citizens and stop those jobs.
        await Promise.all([
            browserTargetRun.stop(),
            serverTargetRun.stop(),
        ]);
    }
}
exports.default = index2_1.createBuilder(_appShellBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hcHAtc2hlbGwvaW5kZXgyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUVBSzhDO0FBQzlDLCtDQUFrRztBQUNsRyxvREFBMkQ7QUFDM0QseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QixrR0FBNkY7QUFDN0Ysa0ZBQTRGO0FBTzVGLEtBQUssVUFBVSxnQkFBZ0IsQ0FDN0IsT0FBbUMsRUFDbkMsT0FBdUIsRUFDdkIsYUFBbUMsRUFDbkMsWUFBaUM7SUFFakMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLElBQUksRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3ZGLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEUsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLDBCQUEwQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFFMUYsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyw2Q0FBb0IsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztJQUVyRCxNQUFNLG1CQUFtQixHQUFHLDZDQUFvQixDQUM5QyxJQUFJLEVBQ0osMEJBQTBCLENBQzNCLENBQUMsbUJBQW1CLENBQUM7SUFDdEIsTUFBTSx3QkFBd0IsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQztJQUNwRixNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZTtRQUM3QyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQztRQUMxQyxDQUFDLENBQUMs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QUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQy9DO1lBQVM7UUFDUiw2Q0FBNkM7UUFDN0MsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2hCLGdCQUFnQixDQUFDLElBQUksRUFBRTtZQUN2QixlQUFlLENBQUMsSUFBSSxFQUFFO1NBQ3ZCLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUdELGtCQUFlLHNCQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0L3NyYy9pbmRleDInO1xuaW1wb3J0IHsgSnNvbk9iamVjdCwgZXhwZXJpbWVudGFsLCBqb2luLCBub3JtYWxpemUsIHJlc29sdmUsIHNjaGVtYSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9icm93c2VyL2luZGV4Mic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vc2VydmVyL2luZGV4Mic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuYXN5bmMgZnVuY3Rpb24gX3JlbmRlclVuaXZlcnNhbChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuKTogUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VySW5kZXhPdXRwdXRQYXRoID0gcGF0aC5qb2luKGJyb3dzZXJSZXN1bHQub3V0cHV0UGF0aCB8fCAnJywgJ2luZGV4Lmh0bWwnKTtcbiAgY29uc3QgaW5kZXhIdG1sID0gZnMucmVhZEZpbGVTeW5jKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsICd1dGY4Jyk7XG4gIGNvbnN0IHNlcnZlckJ1bmRsZVBhdGggPSBhd2FpdCBfZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChvcHRpb25zLCBjb250ZXh0LCBzZXJ2ZXJSZXN1bHQpO1xuXG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIHJlcXVpcmVQcm9qZWN0TW9kdWxlKHJvb3QsICd6b25lLmpzL2Rpc3Qvem9uZS1ub2RlJyk7XG5cbiAgY29uc3QgcmVuZGVyTW9kdWxlRmFjdG9yeSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKFxuICAgIHJvb3QsXG4gICAgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcicsXG4gICkucmVuZGVyTW9kdWxlRmFjdG9yeTtcbiAgY29uc3QgQXBwU2VydmVyTW9kdWxlTmdGYWN0b3J5ID0gcmVxdWlyZShzZXJ2ZXJCdW5kbGVQYXRoKS5BcHBTZXJ2ZXJNb2R1bGVOZ0ZhY3Rvcnk7XG4gIGNvbnN0IG91dHB1dEluZGV4UGF0aCA9IG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoXG4gICAgPyBwYXRoLmpvaW4ocm9vdCwgb3B0aW9ucy5vdXRwdXRJbmRleFBhdGgpXG4gICAgOiBicm93c2VySW5kZXhPdXRwdXRQYXRoO1xuXG4gIC8vIFJlbmRlciB0byBIVE1MIGFuZCBvdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICBjb25zdCBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlRmFjdG9yeShBcHBTZXJ2ZXJNb2R1bGVOZ0ZhY3RvcnksIHtcbiAgICBkb2N1bWVudDogaW5kZXhIdG1sLFxuICAgIHVybDogb3B0aW9ucy5yb3V0ZSxcbiAgfSk7XG5cbiAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRJbmRleFBhdGgsIGh0bWwpO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyQnVpbGRlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zPEpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgcmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgYnJvd3NlckJ1aWxkZXJOYW1lLFxuICApO1xuXG4gIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgY29uc3QgaG9zdCA9IG5ldyBOb2RlSnNTeW5jSG9zdCgpO1xuICAgIC8vIENyZWF0ZSB3b3Jrc3BhY2UuXG4gICAgY29uc3QgcmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpO1xuICAgIHJlZ2lzdHJ5LmFkZFBvc3RUcmFuc2Zvcm0oc2NoZW1hLnRyYW5zZm9ybXMuYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuXG4gICAgY29uc3Qgd29ya3NwYWNlID0gYXdhaXQgZXhwZXJpbWVudGFsLndvcmtzcGFjZS5Xb3Jrc3BhY2UuZnJvbVBhdGgoXG4gICAgICBob3N0LFxuICAgICAgbm9ybWFsaXplKGNvbnRleHQud29ya3NwYWNlUm9vdCksXG4gICAgICByZWdpc3RyeSxcbiAgICApO1xuICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgPyBjb250ZXh0LnRhcmdldC5wcm9qZWN0IDogd29ya3NwYWNlLmdldERlZmF1bHRQcm9qZWN0TmFtZSgpO1xuXG4gICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IGVpdGhlciBoYXZlIGEgdGFyZ2V0IGZyb20gdGhlIGNvbnRleHQgb3IgYSBkZWZhdWx0IHByb2plY3QuJyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShcbiAgICAgIHdvcmtzcGFjZS5yb290LFxuICAgICAgbm9ybWFsaXplKHdvcmtzcGFjZS5nZXRQcm9qZWN0KHByb2plY3ROYW1lKS5yb290KSxcbiAgICApO1xuXG4gICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgaG9zdCxcbiAgICAgIG5vcm1hbGl6ZShyb290KSxcbiAgICAgIHByb2plY3RSb290LFxuICAgICAgam9pbihub3JtYWxpemUocm9vdCksIGJyb3dzZXJPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgYnJvd3Nlck9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbikge1xuICBpZiAob3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG91dHB1dFBhdGggPSBzZXJ2ZXJSZXN1bHQub3V0cHV0UGF0aCB8fCAnLyc7XG4gICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhvdXRwdXRQYXRoLCAndXRmOCcpO1xuICAgIGNvbnN0IHJlID0gL15tYWluXFwuKD86W2EtekEtWjAtOV17MjB9XFwuKT8oPzpidW5kbGVcXC4pP2pzJC87XG4gICAgY29uc3QgbWF5YmVNYWluID0gZmlsZXMuZmlsdGVyKHggPT4gcmUudGVzdCh4KSlbMF07XG5cbiAgICBpZiAoIW1heWJlTWFpbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB0aGUgbWFpbiBidW5kbGUuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgbWF5YmVNYWluKTtcbiAgICB9XG4gIH1cbn1cblxuXG5hc3luYyBmdW5jdGlvbiBfYXBwU2hlbGxCdWlsZGVyKFxuICBvcHRpb25zOiBKc29uT2JqZWN0ICYgQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHNlcnZlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5zZXJ2ZXJUYXJnZXQpO1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgYnJvd3NlciB0YXJnZXQgaW4gd2F0Y2ggbW9kZS5cbiAgLy8gSWYgc2VydmljZSB3b3JrZXIgaXMgbmVlZGVkLCBpdCB3aWxsIGJlIGFkZGVkIGluIF9yZW5kZXJVbml2ZXJzYWwoKTtcbiAgY29uc3QgYnJvd3NlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoYnJvd3NlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgICBzZXJ2aWNlV29ya2VyOiBmYWxzZSxcbiAgfSk7XG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7fSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBbYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGJyb3dzZXJUYXJnZXRSdW4ucmVzdWx0IGFzIHt9IGFzIEJyb3dzZXJCdWlsZGVyT3V0cHV0LFxuICAgICAgc2VydmVyVGFyZ2V0UnVuLnJlc3VsdCxcbiAgICBdKTtcblxuICAgIGlmIChicm93c2VyUmVzdWx0LnN1Y2Nlc3MgPT09IGZhbHNlIHx8IGJyb3dzZXJSZXN1bHQub3V0cHV0UGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbiAgICB9IGVsc2UgaWYgKHNlcnZlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIHNlcnZlclJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gYXdhaXQgX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gIH0gZmluYWxseSB7XG4gICAgLy8gSnVzdCBiZSBnb29kIGNpdGl6ZW5zIGFuZCBzdG9wIHRob3NlIGpvYnMuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYnJvd3NlclRhcmdldFJ1bi5zdG9wKCksXG4gICAgICBzZXJ2ZXJUYXJnZXRSdW4uc3RvcCgpLFxuICAgIF0pO1xuICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihfYXBwU2hlbGxCdWlsZGVyKTtcbiJdfQ==