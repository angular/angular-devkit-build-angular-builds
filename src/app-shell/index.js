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
