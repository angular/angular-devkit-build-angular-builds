"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
class AppShellBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        return new rxjs_1.Observable(obs => {
            let success = true;
            const subscription = rxjs_1.merge(this.build(options.serverTarget, {}), 
            // Never run the browser target in watch mode.
            // If service worker is needed, it will be added in this.renderUniversal();
            this.build(options.browserTarget, { watch: false, serviceWorker: false })).subscribe((event) => {
                // TODO: once we support a better build event, add support for merging two event streams
                // together.
                success = success && event.success;
            }, error => {
                obs.error(error);
            }, () => {
                obs.next({ success });
                obs.complete();
            });
            // Allow subscriptions to us to unsubscribe from each builds at the same time.
            return () => subscription.unsubscribe();
        }).pipe(operators_1.switchMap(event => {
            if (!event.success) {
                return rxjs_1.of(event);
            }
            return this.renderUniversal(options);
        }));
    }
    build(targetString, overrides) {
        const architect = this.context.architect;
        const [project, target, configuration] = targetString.split(':');
        // Override browser build watch setting.
        const builderConfig = architect.getBuilderConfiguration({
            project,
            target,
            configuration,
            overrides,
        });
        return architect.run(builderConfig, this.context);
    }
    getServerModuleBundlePath(options) {
        const architect = this.context.architect;
        return new rxjs_1.Observable(obs => {
            if (options.appModuleBundle) {
                obs.next(core_1.join(this.context.workspace.root, options.appModuleBundle));
                return obs.complete();
            }
            else {
                const [project, target, configuration] = options.serverTarget.split(':');
                const builderConfig = architect.getBuilderConfiguration({
                    project,
                    target,
                    configuration,
                });
                return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(description => architect.validateBuilderOptions(builderConfig, description)), operators_1.switchMap(config => {
                    const outputPath = core_1.join(this.context.workspace.root, config.options.outputPath);
                    return this.context.host.list(outputPath).pipe(operators_1.switchMap(files => {
                        const re = /^main\.(?:[a-zA-Z0-9]{20}\.)?(?:bundle\.)?js$/;
                        const maybeMain = files.filter(x => re.test(x))[0];
                        if (!maybeMain) {
                            return rxjs_1.throwError(new Error('Could not find the main bundle.'));
                        }
                        else {
                            return rxjs_1.of(core_1.join(outputPath, maybeMain));
                        }
                    }));
                })).subscribe(obs);
            }
        });
    }
    getBrowserBuilderConfig(options) {
        const architect = this.context.architect;
        const [project, target, configuration] = options.browserTarget.split(':');
        const builderConfig = architect.getBuilderConfiguration({
            project,
            target,
            configuration,
        });
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(description => architect.validateBuilderOptions(builderConfig, description)));
    }
    renderUniversal(options) {
        let browserOptions;
        let projectRoot;
        return rxjs_1.forkJoin(this.getBrowserBuilderConfig(options).pipe(operators_1.switchMap(config => {
            browserOptions = config.options;
            projectRoot = core_1.resolve(this.context.workspace.root, config.root);
            const browserIndexOutputPath = core_1.join(core_1.normalize(browserOptions.outputPath), 'index.html');
            const path = core_1.join(this.context.workspace.root, browserIndexOutputPath);
            return this.context.host.read(path).pipe(operators_1.map(x => {
                return [browserIndexOutputPath, x];
            }));
        })), this.getServerModuleBundlePath(options)).pipe(operators_1.switchMap(([[browserIndexOutputPath, indexContent], serverBundlePath]) => {
            const root = this.context.workspace.root;
            require_project_module_1.requireProjectModule(core_1.getSystemPath(root), 'zone.js/dist/zone-node');
            const renderModuleFactory = require_project_module_1.requireProjectModule(core_1.getSystemPath(root), '@angular/platform-server').renderModuleFactory;
            const AppServerModuleNgFactory = require(core_1.getSystemPath(serverBundlePath)).AppServerModuleNgFactory;
            const indexHtml = core_1.virtualFs.fileBufferToString(indexContent);
            const outputIndexPath = core_1.join(root, options.outputIndexPath || browserIndexOutputPath);
            // Render to HTML and overwrite the client index file.
            return rxjs_1.from(renderModuleFactory(AppServerModuleNgFactory, {
                document: indexHtml,
                url: options.route,
            })
                .then((html) => {
                return this.context.host
                    .write(outputIndexPath, core_1.virtualFs.stringToFileBuffer(html))
                    .toPromise();
            })
                .then(() => {
                if (browserOptions.serviceWorker) {
                    return service_worker_1.augmentAppWithServiceWorker(this.context.host, root, projectRoot, core_1.join(root, browserOptions.outputPath), browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
                }
            })
                .then(() => ({ success: true })));
        }));
    }
}
exports.AppShellBuilder = AppShellBuilder;
exports.default = AppShellBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FwcC1zaGVsbC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLCtDQUFnRztBQUNoRywrQkFBeUU7QUFDekUsOENBQTJEO0FBQzNELGtHQUE2RjtBQUM3RixrRkFBNEY7QUFNNUYsTUFBYSxlQUFlO0lBRTFCLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBK0Q7UUFDakUsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUV0QyxPQUFPLElBQUksaUJBQVUsQ0FBYSxHQUFHLENBQUMsRUFBRTtZQUN0QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDbkIsTUFBTSxZQUFZLEdBQUcsWUFBSyxDQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDO1lBQ3BDLDhDQUE4QztZQUM5QywyRUFBMkU7WUFDM0UsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FDMUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFpQixFQUFFLEVBQUU7Z0JBQ2hDLHdGQUF3RjtnQkFDeEYsWUFBWTtnQkFDWixPQUFPLEdBQUcsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFDckMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUNULEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkIsQ0FBQyxFQUFFLEdBQUcsRUFBRTtnQkFDTixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDdEIsR0FBRyxD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QUFzQixDQUFDLENBQUM7WUFFdEYsc0RBQXNEO1lBQ3RELE9BQU8sV0FBSSxDQUNULG1CQUFtQixDQUFDLHdCQUF3QixFQUFFO2dCQUM1QyxRQUFRLEVBQUUsU0FBUztnQkFDbkIsR0FBRyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2FBQ25CLENBQUM7aUJBQ0QsSUFBSSxDQUFDLENBQUMsSUFBWSxFQUFFLEVBQUU7Z0JBQ3JCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJO3FCQUNyQixLQUFLLENBQUMsZUFBZSxFQUFFLGdCQUFTLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQzFELFNBQVMsRUFBRSxDQUFDO1lBQ2pCLENBQUMsQ0FBQztpQkFDRCxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUNULElBQUksY0FBYyxDQUFDLGFBQWEsRUFBRTtvQkFDaEMsT0FBTyw0Q0FBMkIsQ0FDaEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQ2pCLElBQUksRUFDSixXQUFXLEVBQ1gsV0FBSSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ3JDLGNBQWMsQ0FBQyxRQUFRLElBQUksR0FBRyxFQUM5QixjQUFjLENBQUMsY0FBYyxDQUM5QixDQUFDO2lCQUNIO1lBQ0gsQ0FBQyxDQUFDO2lCQUNELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FDakMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF6S0QsMENBeUtDO0FBRUQsa0JBQWUsZUFBZSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZm9ya0pvaW4sIGZyb20sIG1lcmdlLCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hIH0gZnJvbSAnLi4vc2VydmVyL3NjaGVtYSc7XG5pbXBvcnQgeyBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuXG5leHBvcnQgY2xhc3MgQXBwU2hlbGxCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYT4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8QnVpbGRFdmVudD4ob2JzID0+IHtcbiAgICAgIGxldCBzdWNjZXNzID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHN1YnNjcmlwdGlvbiA9IG1lcmdlKFxuICAgICAgICB0aGlzLmJ1aWxkKG9wdGlvbnMuc2VydmVyVGFyZ2V0LCB7fSksXG4gICAgICAgIC8vIE5ldmVyIHJ1biB0aGUgYnJvd3NlciB0YXJnZXQgaW4gd2F0Y2ggbW9kZS5cbiAgICAgICAgLy8gSWYgc2VydmljZSB3b3JrZXIgaXMgbmVlZGVkLCBpdCB3aWxsIGJlIGFkZGVkIGluIHRoaXMucmVuZGVyVW5pdmVyc2FsKCk7XG4gICAgICAgIHRoaXMuYnVpbGQob3B0aW9ucy5icm93c2VyVGFyZ2V0LCB7IHdhdGNoOiBmYWxzZSwgc2VydmljZVdvcmtlcjogZmFsc2UgfSksXG4gICAgICApLnN1YnNjcmliZSgoZXZlbnQ6IEJ1aWxkRXZlbnQpID0+IHtcbiAgICAgICAgLy8gVE9ETzogb25jZSB3ZSBzdXBwb3J0IGEgYmV0dGVyIGJ1aWxkIGV2ZW50LCBhZGQgc3VwcG9ydCBmb3IgbWVyZ2luZyB0d28gZXZlbnQgc3RyZWFtc1xuICAgICAgICAvLyB0b2dldGhlci5cbiAgICAgICAgc3VjY2VzcyA9IHN1Y2Nlc3MgJiYgZXZlbnQuc3VjY2VzcztcbiAgICAgIH0sIGVycm9yID0+IHtcbiAgICAgICAgb2JzLmVycm9yKGVycm9yKTtcbiAgICAgIH0sICgpID0+IHtcbiAgICAgICAgb2JzLm5leHQoeyBzdWNjZXNzIH0pO1xuICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBbGxvdyBzdWJzY3JpcHRpb25zIHRvIHVzIHRvIHVuc3Vic2NyaWJlIGZyb20gZWFjaCBidWlsZHMgYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgIHJldHVybiAoKSA9PiBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICB9KS5waXBlKFxuICAgICAgc3dpdGNoTWFwKGV2ZW50ID0+IHtcbiAgICAgICAgaWYgKCFldmVudC5zdWNjZXNzKSB7XG4gICAgICAgICAgcmV0dXJuIG9mKGV2ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnJlbmRlclVuaXZlcnNhbChvcHRpb25zKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBidWlsZCh0YXJnZXRTdHJpbmc6IHN0cmluZywgb3ZlcnJpZGVzOiB7fSkge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSB0YXJnZXRTdHJpbmcuc3BsaXQoJzonKTtcblxuICAgIC8vIE92ZXJyaWRlIGJyb3dzZXIgYnVpbGQgd2F0Y2ggc2V0dGluZy5cbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPHt9Pih7XG4gICAgICBwcm9qZWN0LFxuICAgICAgdGFyZ2V0LFxuICAgICAgY29uZmlndXJhdGlvbixcbiAgICAgIG92ZXJyaWRlcyxcbiAgICB9KTtcblxuICAgIHJldHVybiBhcmNoaXRlY3QucnVuKGJ1aWxkZXJDb25maWcsIHRoaXMuY29udGV4dCk7XG4gIH1cblxuICBnZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcblxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTxQYXRoPihvYnMgPT4ge1xuICAgICAgaWYgKG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKSB7XG4gICAgICAgIG9icy5uZXh0KGpvaW4odGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290LCBvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSkpO1xuXG4gICAgICAgIHJldHVybiBvYnMuY29tcGxldGUoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5zZXJ2ZXJUYXJnZXQuc3BsaXQoJzonKTtcbiAgICAgICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCdWlsZFdlYnBhY2tTZXJ2ZXJTY2hlbWE+KHtcbiAgICAgICAgICBwcm9qZWN0LFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBjb25maWd1cmF0aW9uLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgICAgIGNvbmNhdE1hcChkZXNjcmlwdGlvbiA9PiBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBkZXNjcmlwdGlvbikpLFxuICAgICAgICAgIHN3aXRjaE1hcChjb25maWcgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3V0cHV0UGF0aCA9IGpvaW4odGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290LCBjb25maWcub3B0aW9ucy5vdXRwdXRQYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5ob3N0Lmxpc3Qob3V0cHV0UGF0aCkucGlwZShcbiAgICAgICAgICAgICAgc3dpdGNoTWFwKGZpbGVzID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZSA9IC9ebWFpblxcLig/OlthLXpBLVowLTldezIwfVxcLik/KD86YnVuZGxlXFwuKT9qcyQvO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heWJlTWFpbiA9IGZpbGVzLmZpbHRlcih4ID0+IHJlLnRlc3QoeCkpWzBdO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFtYXliZU1haW4pIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgdGhlIG1haW4gYnVuZGxlLicpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIG9mKGpvaW4ob3V0cHV0UGF0aCwgbWF5YmVNYWluKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSksXG4gICAgICAgICkuc3Vic2NyaWJlKG9icyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXRCcm93c2VyQnVpbGRlckNvbmZpZyhvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSkge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSBvcHRpb25zLmJyb3dzZXJUYXJnZXQuc3BsaXQoJzonKTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJyb3dzZXJCdWlsZGVyU2NoZW1hPih7XG4gICAgICBwcm9qZWN0LFxuICAgICAgdGFyZ2V0LFxuICAgICAgY29uZmlndXJhdGlvbixcbiAgICB9KTtcblxuICAgIHJldHVybiBhcmNoaXRlY3QuZ2V0QnVpbGRlckRlc2NyaXB0aW9uKGJ1aWxkZXJDb25maWcpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoZGVzY3JpcHRpb24gPT4gYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnVpbGRlckNvbmZpZywgZGVzY3JpcHRpb24pKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyVW5pdmVyc2FsKG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hKTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgbGV0IGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICBsZXQgcHJvamVjdFJvb3Q6IFBhdGg7XG5cbiAgICByZXR1cm4gZm9ya0pvaW4oXG4gICAgICB0aGlzLmdldEJyb3dzZXJCdWlsZGVyQ29uZmlnKG9wdGlvbnMpLnBpcGUoXG4gICAgICAgIHN3aXRjaE1hcChjb25maWcgPT4ge1xuICAgICAgICAgIGJyb3dzZXJPcHRpb25zID0gY29uZmlnLm9wdGlvbnM7XG4gICAgICAgICAgcHJvamVjdFJvb3QgPSByZXNvbHZlKHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdCwgY29uZmlnLnJvb3QpO1xuICAgICAgICAgIGNvbnN0IGJyb3dzZXJJbmRleE91dHB1dFBhdGggPSBqb2luKG5vcm1hbGl6ZShicm93c2VyT3B0aW9ucy5vdXRwdXRQYXRoKSwgJ2luZGV4Lmh0bWwnKTtcbiAgICAgICAgICBjb25zdCBwYXRoID0gam9pbih0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGJyb3dzZXJJbmRleE91dHB1dFBhdGgpO1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5ob3N0LnJlYWQocGF0aCkucGlwZShcbiAgICAgICAgICAgIG1hcDx2aXJ0dWFsRnMuRmlsZUJ1ZmZlciwgW1BhdGgsIHZpcnR1YWxGcy5GaWxlQnVmZmVyXT4oeCA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbYnJvd3NlckluZGV4T3V0cHV0UGF0aCwgeF07XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgICB0aGlzLmdldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgob3B0aW9ucyksXG4gICAgKS5waXBlKFxuICAgICAgc3dpdGNoTWFwKChbW2Jyb3dzZXJJbmRleE91dHB1dFBhdGgsIGluZGV4Q29udGVudF0sIHNlcnZlckJ1bmRsZVBhdGhdKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgICAgIHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocm9vdCksICd6b25lLmpzL2Rpc3Qvem9uZS1ub2RlJyk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyTW9kdWxlRmFjdG9yeSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKFxuICAgICAgICAgIGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICAgICAgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcicsXG4gICAgICAgICkucmVuZGVyTW9kdWxlRmFjdG9yeTtcbiAgICAgICAgY29uc3QgQXBwU2VydmVyTW9kdWxlTmdGYWN0b3J5ID0gcmVxdWlyZShcbiAgICAgICAgICBnZXRTeXN0ZW1QYXRoKHNlcnZlckJ1bmRsZVBhdGgpLFxuICAgICAgICApLkFwcFNlcnZlck1vZHVsZU5nRmFjdG9yeTtcbiAgICAgICAgY29uc3QgaW5kZXhIdG1sID0gdmlydHVhbEZzLmZpbGVCdWZmZXJUb1N0cmluZyhpbmRleENvbnRlbnQpO1xuICAgICAgICBjb25zdCBvdXRwdXRJbmRleFBhdGggPSBqb2luKHJvb3QsIG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoIHx8IGJyb3dzZXJJbmRleE91dHB1dFBhdGgpO1xuXG4gICAgICAgIC8vIFJlbmRlciB0byBIVE1MIGFuZCBvdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICAgICAgICByZXR1cm4gZnJvbShcbiAgICAgICAgICByZW5kZXJNb2R1bGVGYWN0b3J5KEFwcFNlcnZlck1vZHVsZU5nRmFjdG9yeSwge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGluZGV4SHRtbCxcbiAgICAgICAgICAgIHVybDogb3B0aW9ucy5yb3V0ZSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKChodG1sOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuaG9zdFxuICAgICAgICAgICAgICAud3JpdGUob3V0cHV0SW5kZXhQYXRoLCB2aXJ0dWFsRnMuc3RyaW5nVG9GaWxlQnVmZmVyKGh0bWwpKVxuICAgICAgICAgICAgICAudG9Qcm9taXNlKCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICAgICAgICByZXR1cm4gYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5ob3N0LFxuICAgICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgam9pbihyb290LCBicm93c2VyT3B0aW9ucy5vdXRwdXRQYXRoKSxcbiAgICAgICAgICAgICAgICBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICAgICAgYnJvd3Nlck9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiAoeyBzdWNjZXNzOiB0cnVlIH0pKSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXBwU2hlbGxCdWlsZGVyO1xuIl19