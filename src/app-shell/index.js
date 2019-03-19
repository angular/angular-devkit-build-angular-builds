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
                .then(async (html) => {
                await this.context.host
                    .write(outputIndexPath, core_1.virtualFs.stringToFileBuffer(html))
                    .toPromise();
                if (browserOptions.serviceWorker) {
                    await service_worker_1.augmentAppWithServiceWorker(this.context.host, root, projectRoot, core_1.join(root, browserOptions.outputPath), browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
                }
                return { success: true };
            }));
        }));
    }
}
exports.AppShellBuilder = AppShellBuilder;
exports.default = AppShellBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FwcC1zaGVsbC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLCtDQUFnRztBQUNoRywrQkFBeUU7QUFDekUsOENBQTJEO0FBQzNELGtHQUE2RjtBQUM3RixrRkFBNEY7QUFNNUYsTUFBYSxlQUFlO0lBRTFCLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBK0Q7UUFDakUsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUV0QyxPQUFPLElBQUksaUJBQVUsQ0FBYSxHQUFHLENBQUMsRUFBRTtZQUN0QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDbkIsTUFBTSxZQUFZLEdBQUcsWUFBSyxDQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDO1lBQ3BDLDhDQUE4QztZQUM5QywyRUFBMkU7WUFDM0UsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FDMUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFpQixFQUFFLEVBQUU7Z0JBQ2hDLHdGQUF3RjtnQkFDeEYsWUFBWTtnQkFDWixPQUFPLEdBQUcsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFDckMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUNULEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkIsQ0FBQyxFQUFFLEdBQUcsRUFBRTtnQkFDTixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDdEIsR0FBRyxD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QUFzQixDQUFDLENBQUM7WUFFdEYsc0RBQXNEO1lBQ3RELE9BQU8sV0FBSSxDQUNULG1CQUFtQixDQUFDLHdCQUF3QixFQUFFO2dCQUM1QyxRQUFRLEVBQUUsU0FBUztnQkFDbkIsR0FBRyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2FBQ25CLENBQUM7aUJBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFZLEVBQUUsRUFBRTtnQkFDM0IsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUk7cUJBQ3BCLEtBQUssQ0FBQyxlQUFlLEVBQUUsZ0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDMUQsU0FBUyxFQUFFLENBQUM7Z0JBRWYsSUFBSSxjQUFjLENBQUMsYUFBYSxFQUFFO29CQUNoQyxNQUFNLDRDQUEyQixDQUMvQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFDakIsSUFBSSxFQUNKLFdBQVcsRUFDWCxXQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDckMsY0FBYyxDQUFDLFFBQVEsSUFBSSxHQUFHLEVBQzlCLGNBQWMsQ0FBQyxjQUFjLENBQzlCLENBQUM7aUJBQ0g7Z0JBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUMzQixDQUFDLENBQUMsQ0FDSCxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXpLRCwwQ0F5S0M7QUFFRCxrQkFBZSxlQUFlLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgam9pbiwgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmb3JrSm9pbiwgZnJvbSwgbWVyZ2UsIG9mLCB0aHJvd0Vycm9yIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJ1aWxkV2VicGFja1NlcnZlclNjaGVtYSB9IGZyb20gJy4uL3NlcnZlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuZXhwb3J0IGNsYXNzIEFwcFNoZWxsQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8QnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWE+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYT4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+KG9icyA9PiB7XG4gICAgICBsZXQgc3VjY2VzcyA9IHRydWU7XG4gICAgICBjb25zdCBzdWJzY3JpcHRpb24gPSBtZXJnZShcbiAgICAgICAgdGhpcy5idWlsZChvcHRpb25zLnNlcnZlclRhcmdldCwge30pLFxuICAgICAgICAvLyBOZXZlciBydW4gdGhlIGJyb3dzZXIgdGFyZ2V0IGluIHdhdGNoIG1vZGUuXG4gICAgICAgIC8vIElmIHNlcnZpY2Ugd29ya2VyIGlzIG5lZWRlZCwgaXQgd2lsbCBiZSBhZGRlZCBpbiB0aGlzLnJlbmRlclVuaXZlcnNhbCgpO1xuICAgICAgICB0aGlzLmJ1aWxkKG9wdGlvbnMuYnJvd3NlclRhcmdldCwgeyB3YXRjaDogZmFsc2UsIHNlcnZpY2VXb3JrZXI6IGZhbHNlIH0pLFxuICAgICAgKS5zdWJzY3JpYmUoKGV2ZW50OiBCdWlsZEV2ZW50KSA9PiB7XG4gICAgICAgIC8vIFRPRE86IG9uY2Ugd2Ugc3VwcG9ydCBhIGJldHRlciBidWlsZCBldmVudCwgYWRkIHN1cHBvcnQgZm9yIG1lcmdpbmcgdHdvIGV2ZW50IHN0cmVhbXNcbiAgICAgICAgLy8gdG9nZXRoZXIuXG4gICAgICAgIHN1Y2Nlc3MgPSBzdWNjZXNzICYmIGV2ZW50LnN1Y2Nlc3M7XG4gICAgICB9LCBlcnJvciA9PiB7XG4gICAgICAgIG9icy5lcnJvcihlcnJvcik7XG4gICAgICB9LCAoKSA9PiB7XG4gICAgICAgIG9icy5uZXh0KHsgc3VjY2VzcyB9KTtcbiAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gQWxsb3cgc3Vic2NyaXB0aW9ucyB0byB1cyB0byB1bnN1YnNjcmliZSBmcm9tIGVhY2ggYnVpbGRzIGF0IHRoZSBzYW1lIHRpbWUuXG4gICAgICByZXR1cm4gKCkgPT4gc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XG4gICAgfSkucGlwZShcbiAgICAgIHN3aXRjaE1hcChldmVudCA9PiB7XG4gICAgICAgIGlmICghZXZlbnQuc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybiBvZihldmVudCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5yZW5kZXJVbml2ZXJzYWwob3B0aW9ucyk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGQodGFyZ2V0U3RyaW5nOiBzdHJpbmcsIG92ZXJyaWRlczoge30pIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gdGFyZ2V0U3RyaW5nLnNwbGl0KCc6Jyk7XG5cbiAgICAvLyBPdmVycmlkZSBicm93c2VyIGJ1aWxkIHdhdGNoIHNldHRpbmcuXG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjx7fT4oe1xuICAgICAgcHJvamVjdCxcbiAgICAgIHRhcmdldCxcbiAgICAgIGNvbmZpZ3VyYXRpb24sXG4gICAgICBvdmVycmlkZXMsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LnJ1bihidWlsZGVyQ29uZmlnLCB0aGlzLmNvbnRleHQpO1xuICB9XG5cbiAgZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSkge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8UGF0aD4ob2JzID0+IHtcbiAgICAgIGlmIChvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSkge1xuICAgICAgICBvYnMubmV4dChqb2luKHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdCwgb3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpKTtcblxuICAgICAgICByZXR1cm4gb2JzLmNvbXBsZXRlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IG9wdGlvbnMuc2VydmVyVGFyZ2V0LnNwbGl0KCc6Jyk7XG4gICAgICAgIGNvbnN0IGJ1aWxkZXJDb25maWcgPSBhcmNoaXRlY3QuZ2V0QnVpbGRlckNvbmZpZ3VyYXRpb248QnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hPih7XG4gICAgICAgICAgcHJvamVjdCxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgY29uZmlndXJhdGlvbixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGFyY2hpdGVjdC5nZXRCdWlsZGVyRGVzY3JpcHRpb24oYnVpbGRlckNvbmZpZykucGlwZShcbiAgICAgICAgICBjb25jYXRNYXAoZGVzY3JpcHRpb24gPT4gYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnVpbGRlckNvbmZpZywgZGVzY3JpcHRpb24pKSxcbiAgICAgICAgICBzd2l0Y2hNYXAoY29uZmlnID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dFBhdGggPSBqb2luKHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdCwgY29uZmlnLm9wdGlvbnMub3V0cHV0UGF0aCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuaG9zdC5saXN0KG91dHB1dFBhdGgpLnBpcGUoXG4gICAgICAgICAgICAgIHN3aXRjaE1hcChmaWxlcyA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmUgPSAvXm1haW5cXC4oPzpbYS16QS1aMC05XXsyMH1cXC4pPyg/OmJ1bmRsZVxcLik/anMkLztcbiAgICAgICAgICAgICAgICBjb25zdCBtYXliZU1haW4gPSBmaWxlcy5maWx0ZXIoeCA9PiByZS50ZXN0KHgpKVswXTtcblxuICAgICAgICAgICAgICAgIGlmICghbWF5YmVNYWluKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZS4nKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBvZihqb2luKG91dHB1dFBhdGgsIG1heWJlTWFpbikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApLnN1YnNjcmliZShvYnMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0QnJvd3NlckJ1aWxkZXJDb25maWcob3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5icm93c2VyVGFyZ2V0LnNwbGl0KCc6Jyk7XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oe1xuICAgICAgcHJvamVjdCxcbiAgICAgIHRhcmdldCxcbiAgICAgIGNvbmZpZ3VyYXRpb24sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGRlc2NyaXB0aW9uID0+IGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKGJ1aWxkZXJDb25maWcsIGRlc2NyaXB0aW9uKSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmRlclVuaXZlcnNhbChvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSk6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGxldCBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gICAgbGV0IHByb2plY3RSb290OiBQYXRoO1xuXG4gICAgcmV0dXJuIGZvcmtKb2luKFxuICAgICAgdGhpcy5nZXRCcm93c2VyQnVpbGRlckNvbmZpZyhvcHRpb25zKS5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoY29uZmlnID0+IHtcbiAgICAgICAgICBicm93c2VyT3B0aW9ucyA9IGNvbmZpZy5vcHRpb25zO1xuICAgICAgICAgIHByb2plY3RSb290ID0gcmVzb2x2ZSh0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGNvbmZpZy5yb290KTtcbiAgICAgICAgICBjb25zdCBicm93c2VySW5kZXhPdXRwdXRQYXRoID0gam9pbihub3JtYWxpemUoYnJvd3Nlck9wdGlvbnMub3V0cHV0UGF0aCksICdpbmRleC5odG1sJyk7XG4gICAgICAgICAgY29uc3QgcGF0aCA9IGpvaW4odGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290LCBicm93c2VySW5kZXhPdXRwdXRQYXRoKTtcblxuICAgICAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuaG9zdC5yZWFkKHBhdGgpLnBpcGUoXG4gICAgICAgICAgICBtYXA8dmlydHVhbEZzLkZpbGVCdWZmZXIsIFtQYXRoLCB2aXJ0dWFsRnMuRmlsZUJ1ZmZlcl0+KHggPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gW2Jyb3dzZXJJbmRleE91dHB1dFBhdGgsIHhdO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICAgdGhpcy5nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKG9wdGlvbnMpLFxuICAgICkucGlwZShcbiAgICAgIHN3aXRjaE1hcCgoW1ticm93c2VySW5kZXhPdXRwdXRQYXRoLCBpbmRleENvbnRlbnRdLCBzZXJ2ZXJCdW5kbGVQYXRoXSkgPT4ge1xuICAgICAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgICAgICByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHJvb3QpLCAnem9uZS5qcy9kaXN0L3pvbmUtbm9kZScpO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlck1vZHVsZUZhY3RvcnkgPSByZXF1aXJlUHJvamVjdE1vZHVsZShcbiAgICAgICAgICBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgICAgICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInLFxuICAgICAgICApLnJlbmRlck1vZHVsZUZhY3Rvcnk7XG4gICAgICAgIGNvbnN0IEFwcFNlcnZlck1vZHVsZU5nRmFjdG9yeSA9IHJlcXVpcmUoXG4gICAgICAgICAgZ2V0U3lzdGVtUGF0aChzZXJ2ZXJCdW5kbGVQYXRoKSxcbiAgICAgICAgKS5BcHBTZXJ2ZXJNb2R1bGVOZ0ZhY3Rvcnk7XG4gICAgICAgIGNvbnN0IGluZGV4SHRtbCA9IHZpcnR1YWxGcy5maWxlQnVmZmVyVG9TdHJpbmcoaW5kZXhDb250ZW50KTtcbiAgICAgICAgY29uc3Qgb3V0cHV0SW5kZXhQYXRoID0gam9pbihyb290LCBvcHRpb25zLm91dHB1dEluZGV4UGF0aCB8fCBicm93c2VySW5kZXhPdXRwdXRQYXRoKTtcblxuICAgICAgICAvLyBSZW5kZXIgdG8gSFRNTCBhbmQgb3ZlcndyaXRlIHRoZSBjbGllbnQgaW5kZXggZmlsZS5cbiAgICAgICAgcmV0dXJuIGZyb208UHJvbWlzZTxCdWlsZEV2ZW50Pj4oXG4gICAgICAgICAgcmVuZGVyTW9kdWxlRmFjdG9yeShBcHBTZXJ2ZXJNb2R1bGVOZ0ZhY3RvcnksIHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBpbmRleEh0bWwsXG4gICAgICAgICAgICB1cmw6IG9wdGlvbnMucm91dGUsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbihhc3luYyAoaHRtbDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQuaG9zdFxuICAgICAgICAgICAgICAud3JpdGUob3V0cHV0SW5kZXhQYXRoLCB2aXJ0dWFsRnMuc3RyaW5nVG9GaWxlQnVmZmVyKGh0bWwpKVxuICAgICAgICAgICAgICAudG9Qcm9taXNlKCk7XG5cbiAgICAgICAgICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaG9zdCxcbiAgICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgIGpvaW4ocm9vdCwgYnJvd3Nlck9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICAgICAgICAgICAgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFwcFNoZWxsQnVpbGRlcjtcbiJdfQ==