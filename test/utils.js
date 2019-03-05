"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index2_1 = require("@angular-devkit/architect/src/index2");
const testing_1 = require("@angular-devkit/architect/testing");
const core_1 = require("@angular-devkit/core");
const node_1 = require("../../architect/node");
const testing_architect_host_1 = require("../../architect/testing/testing-architect-host");
const devkitRoot = core_1.normalize(global._DevKitRoot); // tslint:disable-line:no-any
exports.workspaceRoot = core_1.join(devkitRoot, 'tests/angular_devkit/build_angular/hello-world-app/');
exports.host = new testing_1.TestProjectHost(exports.workspaceRoot);
exports.outputPath = core_1.normalize('dist');
exports.browserTargetSpec = { project: 'app', target: 'build' };
exports.devServerTargetSpec = { project: 'app', target: 'serve' };
exports.extractI18nTargetSpec = { project: 'app', target: 'extract-i18n' };
exports.karmaTargetSpec = { project: 'app', target: 'test' };
exports.tslintTargetSpec = { project: 'app', target: 'lint' };
exports.protractorTargetSpec = { project: 'app-e2e', target: 'e2e' };
async function createArchitect(workspaceRoot) {
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    const workspace = await core_1.experimental.workspace.Workspace.fromPath(exports.host, exports.host.root(), registry);
    const architectHost = new testing_architect_host_1.TestingArchitectHost(workspaceRoot, workspaceRoot, new node_1.WorkspaceNodeModulesArchitectHost(workspace, workspaceRoot));
    const architect = new index2_1.Architect(architectHost, registry);
    return {
        workspace,
        architectHost,
        architect,
    };
}
exports.createArchitect = createArchitect;
async function browserBuild(architect, host, target, overrides, scheduleOptions) {
    const run = await architect.scheduleTarget(target, overrides, scheduleOptions);
    const output = (await run.result);
    expect(output.success).toBe(true);
    expect(output.outputPath).not.toBeUndefined();
    const outputPath = core_1.normalize(output.outputPath);
    const fileNames = await host.list(outputPath).toPromise();
    const files = fileNames.reduce((acc, path) => {
        let cache = null;
        Object.defineProperty(acc, path, {
            enumerable: true,
            get() {
                if (cache) {
                    return cache;
                }
                if (!fileNames.includes(path)) {
                    return Promise.reject('No file named ' + path);
                }
                cache = host
                    .read(core_1.join(outputPath, path))
                    .toPromise()
                    .then(content => core_1.virtualFs.fileBufferToString(content));
                return cache;
            },
        });
        return acc;
    }, {});
    await run.stop();
    return {
        output,
        files,
    };
}
exports.browserBuild = browserBuild;
exports.lazyModuleFiles = {
    'src/app/lazy/lazy-routing.module.ts': `
    import { NgModule } from '@angular/core';
    import { Routes, RouterModule } from '@angular/router';

    const routes: Routes = [];

    @NgModule({
      imports: [RouterModule.forChild(routes)],
      exports: [RouterModule]
    })
    export class LazyRoutingModule { }
  `,
    'src/app/lazy/lazy.module.ts': `
    import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';

    import { LazyRoutingModule } from './lazy-routing.module';

    @NgModule({
      imports: [
        CommonModule,
        LazyRoutingModule
      ],
      declarations: []
    })
    export class LazyModule { }
  `,
};
exports.lazyModuleImport = {
    'src/app/app.module.ts': `
    import { BrowserModule } from '@angular/platform-browser';
    import { NgModule } from '@angular/core';
    import { HttpModule } from '@angular/http';

    import { AppComponent } from './app.component';
    import { RouterModule } from '@angular/router';

    @NgModule({
      declarations: [
        AppComponent
      ],
      imports: [
        BrowserModule,
        HttpModule,
        RouterModule.forRoot([
          { path: 'lazy', loadChildren: './lazy/lazy.module#LazyModule' }
        ])
      ],
      providers: [],
      bootstrap: [AppComponent]
    })
    export class AppModule { }
  `,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvdGVzdC91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILGlFQUs4QztBQUM5QywrREFBb0U7QUFDcEUsK0NBUzhCO0FBQzlCLCtDQUF5RTtBQUN6RSwyRkFBc0Y7QUFJdEYsTUFBTSxVQUFVLEdBQUcsZ0JBQVMsQ0FBRSxNQUFjLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyw2QkFBNkI7QUFDM0UsUUFBQSxhQUFhLEdBQUcsV0FBSSxDQUMvQixVQUFVLEVBQ1YscURBQXFELENBQ3RELENBQUM7QUFDVyxRQUFBLElBQUksR0FBRyxJQUFJLHlCQUFlLENBQUMscUJBQWEsQ0FBQyxDQUFDO0FBQzFDLFFBQUEsVUFBVSxHQUFTLGdCQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFckMsUUFBQSxpQkFBaUIsR0FBRyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDO0FBQ3hELFFBQUEsbUJBQW1CLEdBQUcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUMxRCxRQUFBLHFCQUFxQixHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLENBQUM7QUFDbkUsUUFBQSxlQUFlLEdBQUcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUNyRCxRQUFBLGdCQUFnQixHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUM7QUFDdEQsUUFBQSxvQkFBb0IsR0FBRyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDO0FBR25FLEtBQUssVUFBVSxl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QixHQUErQjtJQUMxRCx1QkFBdUIsRUFBRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F1QnhCO0NBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQXJjaGl0ZWN0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBTY2hlZHVsZU9wdGlvbnMsXG4gIFRhcmdldCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7IFRlc3RQcm9qZWN0SG9zdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QvdGVzdGluZyc7XG5pbXBvcnQge1xuICBQYXRoLFxuICBleHBlcmltZW50YWwsXG4gIGpvaW4sXG4gIGpzb24sXG4gIGxvZ2dpbmcsXG4gIG5vcm1hbGl6ZSxcbiAgc2NoZW1hLFxuICB2aXJ0dWFsRnMsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCB9IGZyb20gJy4uLy4uL2FyY2hpdGVjdC9ub2RlJztcbmltcG9ydCB7IFRlc3RpbmdBcmNoaXRlY3RIb3N0IH0gZnJvbSAnLi4vLi4vYXJjaGl0ZWN0L3Rlc3RpbmcvdGVzdGluZy1hcmNoaXRlY3QtaG9zdCc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL3NyYy9icm93c2VyL2luZGV4Mic7XG5cblxuY29uc3QgZGV2a2l0Um9vdCA9IG5vcm1hbGl6ZSgoZ2xvYmFsIGFzIGFueSkuX0RldktpdFJvb3QpOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuZXhwb3J0IGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBqb2luKFxuICBkZXZraXRSb290LFxuICAndGVzdHMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9oZWxsby13b3JsZC1hcHAvJyxcbik7XG5leHBvcnQgY29uc3QgaG9zdCA9IG5ldyBUZXN0UHJvamVjdEhvc3Qod29ya3NwYWNlUm9vdCk7XG5leHBvcnQgY29uc3Qgb3V0cHV0UGF0aDogUGF0aCA9IG5vcm1hbGl6ZSgnZGlzdCcpO1xuXG5leHBvcnQgY29uc3QgYnJvd3NlclRhcmdldFNwZWMgPSB7IHByb2plY3Q6ICdhcHAnLCB0YXJnZXQ6ICdidWlsZCcgfTtcbmV4cG9ydCBjb25zdCBkZXZTZXJ2ZXJUYXJnZXRTcGVjID0geyBwcm9qZWN0OiAnYXBwJywgdGFyZ2V0OiAnc2VydmUnIH07XG5leHBvcnQgY29uc3QgZXh0cmFjdEkxOG5UYXJnZXRTcGVjID0geyBwcm9qZWN0OiAnYXBwJywgdGFyZ2V0OiAnZXh0cmFjdC1pMThuJyB9O1xuZXhwb3J0IGNvbnN0IGthcm1hVGFyZ2V0U3BlYyA9IHsgcHJvamVjdDogJ2FwcCcsIHRhcmdldDogJ3Rlc3QnIH07XG5leHBvcnQgY29uc3QgdHNsaW50VGFyZ2V0U3BlYyA9IHsgcHJvamVjdDogJ2FwcCcsIHRhcmdldDogJ2xpbnQnIH07XG5leHBvcnQgY29uc3QgcHJvdHJhY3RvclRhcmdldFNwZWMgPSB7IHByb2plY3Q6ICdhcHAtZTJlJywgdGFyZ2V0OiAnZTJlJyB9O1xuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVBcmNoaXRlY3Qod29ya3NwYWNlUm9vdDogc3RyaW5nKSB7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgcmVnaXN0cnkuYWRkUG9zdFRyYW5zZm9ybShzY2hlbWEudHJhbnNmb3Jtcy5hZGRVbmRlZmluZWREZWZhdWx0cyk7XG5cbiAgY29uc3Qgd29ya3NwYWNlID0gYXdhaXQgZXhwZXJpbWVudGFsLndvcmtzcGFjZS5Xb3Jrc3BhY2UuZnJvbVBhdGgoaG9zdCwgaG9zdC5yb290KCksIHJlZ2lzdHJ5KTtcbiAgY29uc3QgYXJjaGl0ZWN0SG9zdCA9IG5ldyBUZXN0aW5nQXJjaGl0ZWN0SG9zdChcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgbmV3IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCh3b3Jrc3BhY2UsIHdvcmtzcGFjZVJvb3QpLFxuICApO1xuICBjb25zdCBhcmNoaXRlY3QgPSBuZXcgQXJjaGl0ZWN0KGFyY2hpdGVjdEhvc3QsIHJlZ2lzdHJ5KTtcblxuICByZXR1cm4ge1xuICAgIHdvcmtzcGFjZSxcbiAgICBhcmNoaXRlY3RIb3N0LFxuICAgIGFyY2hpdGVjdCxcbiAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJyb3dzZXJCdWlsZChcbiAgYXJjaGl0ZWN0OiBBcmNoaXRlY3QsXG4gIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0LFxuICB0YXJnZXQ6IFRhcmdldCxcbiAgb3ZlcnJpZGVzPzoganNvbi5Kc29uT2JqZWN0LFxuICBzY2hlZHVsZU9wdGlvbnM/OiBTY2hlZHVsZU9wdGlvbnMsXG4pOiBQcm9taXNlPHsgb3V0cHV0OiBCdWlsZGVyT3V0cHV0OyBmaWxlczogeyBbZmlsZTogc3RyaW5nXTogc3RyaW5nIH0gfT4ge1xuICBjb25zdCBydW4gPSBhd2FpdCBhcmNoaXRlY3Quc2NoZWR1bGVUYXJnZXQodGFyZ2V0LCBvdmVycmlkZXMsIHNjaGVkdWxlT3B0aW9ucyk7XG4gIGNvbnN0IG91dHB1dCA9IChhd2FpdCBydW4ucmVzdWx0KSBhcyBCcm93c2VyQnVpbGRlck91dHB1dDtcbiAgZXhwZWN0KG91dHB1dC5zdWNjZXNzKS50b0JlKHRydWUpO1xuXG4gIGV4cGVjdChvdXRwdXQub3V0cHV0UGF0aCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IG5vcm1hbGl6ZShvdXRwdXQub3V0cHV0UGF0aCk7XG5cbiAgY29uc3QgZmlsZU5hbWVzID0gYXdhaXQgaG9zdC5saXN0KG91dHB1dFBhdGgpLnRvUHJvbWlzZSgpO1xuICBjb25zdCBmaWxlcyA9IGZpbGVOYW1lcy5yZWR1Y2UoKGFjYzogeyBbbmFtZTogc3RyaW5nXTogUHJvbWlzZTxzdHJpbmc+IH0sIHBhdGgpID0+IHtcbiAgICBsZXQgY2FjaGU6IFByb21pc2U8c3RyaW5nPiB8IG51bGwgPSBudWxsO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShhY2MsIHBhdGgsIHtcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQoKSB7XG4gICAgICAgIGlmIChjYWNoZSkge1xuICAgICAgICAgIHJldHVybiBjYWNoZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZpbGVOYW1lcy5pbmNsdWRlcyhwYXRoKSkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgnTm8gZmlsZSBuYW1lZCAnICsgcGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWNoZSA9IGhvc3RcbiAgICAgICAgICAucmVhZChqb2luKG91dHB1dFBhdGgsIHBhdGgpKVxuICAgICAgICAgIC50b1Byb21pc2UoKVxuICAgICAgICAgIC50aGVuKGNvbnRlbnQgPT4gdmlydHVhbEZzLmZpbGVCdWZmZXJUb1N0cmluZyhjb250ZW50KSk7XG5cbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiBhY2M7XG4gIH0sIHt9KTtcblxuICBhd2FpdCBydW4uc3RvcCgpO1xuXG4gIHJldHVybiB7XG4gICAgb3V0cHV0LFxuICAgIGZpbGVzLFxuICB9O1xufVxuXG5leHBvcnQgY29uc3QgbGF6eU1vZHVsZUZpbGVzOiB7IFtwYXRoOiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgJ3NyYy9hcHAvbGF6eS9sYXp5LXJvdXRpbmcubW9kdWxlLnRzJzogYFxuICAgIGltcG9ydCB7IE5nTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gICAgaW1wb3J0IHsgUm91dGVzLCBSb3V0ZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9yb3V0ZXInO1xuXG4gICAgY29uc3Qgcm91dGVzOiBSb3V0ZXMgPSBbXTtcblxuICAgIEBOZ01vZHVsZSh7XG4gICAgICBpbXBvcnRzOiBbUm91dGVyTW9kdWxlLmZvckNoaWxkKHJvdXRlcyldLFxuICAgICAgZXhwb3J0czogW1JvdXRlck1vZHVsZV1cbiAgICB9KVxuICAgIGV4cG9ydCBjbGFzcyBMYXp5Um91dGluZ01vZHVsZSB7IH1cbiAgYCxcbiAgJ3NyYy9hcHAvbGF6eS9sYXp5Lm1vZHVsZS50cyc6IGBcbiAgICBpbXBvcnQgeyBOZ01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICAgIGltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5cbiAgICBpbXBvcnQgeyBMYXp5Um91dGluZ01vZHVsZSB9IGZyb20gJy4vbGF6eS1yb3V0aW5nLm1vZHVsZSc7XG5cbiAgICBATmdNb2R1bGUoe1xuICAgICAgaW1wb3J0czogW1xuICAgICAgICBDb21tb25Nb2R1bGUsXG4gICAgICAgIExhenlSb3V0aW5nTW9kdWxlXG4gICAgICBdLFxuICAgICAgZGVjbGFyYXRpb25zOiBbXVxuICAgIH0pXG4gICAgZXhwb3J0IGNsYXNzIExhenlNb2R1bGUgeyB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgbGF6eU1vZHVsZUltcG9ydDogeyBbcGF0aDogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICdzcmMvYXBwL2FwcC5tb2R1bGUudHMnOiBgXG4gICAgaW1wb3J0IHsgQnJvd3Nlck1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXInO1xuICAgIGltcG9ydCB7IE5nTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gICAgaW1wb3J0IHsgSHR0cE1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2h0dHAnO1xuXG4gICAgaW1wb3J0IHsgQXBwQ29tcG9uZW50IH0gZnJvbSAnLi9hcHAuY29tcG9uZW50JztcbiAgICBpbXBvcnQgeyBSb3V0ZXJNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9yb3V0ZXInO1xuXG4gICAgQE5nTW9kdWxlKHtcbiAgICAgIGRlY2xhcmF0aW9uczogW1xuICAgICAgICBBcHBDb21wb25lbnRcbiAgICAgIF0sXG4gICAgICBpbXBvcnRzOiBbXG4gICAgICAgIEJyb3dzZXJNb2R1bGUsXG4gICAgICAgIEh0dHBNb2R1bGUsXG4gICAgICAgIFJvdXRlck1vZHVsZS5mb3JSb290KFtcbiAgICAgICAgICB7IHBhdGg6ICdsYXp5JywgbG9hZENoaWxkcmVuOiAnLi9sYXp5L2xhenkubW9kdWxlI0xhenlNb2R1bGUnIH1cbiAgICAgICAgXSlcbiAgICAgIF0sXG4gICAgICBwcm92aWRlcnM6IFtdLFxuICAgICAgYm9vdHN0cmFwOiBbQXBwQ29tcG9uZW50XVxuICAgIH0pXG4gICAgZXhwb3J0IGNsYXNzIEFwcE1vZHVsZSB7IH1cbiAgYCxcbn07XG5cblxuIl19