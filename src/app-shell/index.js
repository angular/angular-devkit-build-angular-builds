"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const Observable_1 = require("rxjs/Observable");
const forkJoin_1 = require("rxjs/observable/forkJoin");
const fromPromise_1 = require("rxjs/observable/fromPromise");
const merge_1 = require("rxjs/observable/merge");
const of_1 = require("rxjs/observable/of");
const throw_1 = require("rxjs/observable/throw");
const operators_1 = require("rxjs/operators");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
class AppShellBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        return new Observable_1.Observable(obs => {
            let success = true;
            const subscription = merge_1.merge(this.build(options.serverTarget, {}), this.build(options.browserTarget, { watch: false })).subscribe((event) => {
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
                return of_1.of(event);
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
        return new Observable_1.Observable(obs => {
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
                            return throw_1._throw(new Error('Could not find the main bundle.'));
                        }
                        else {
                            return of_1.of(core_1.join(outputPath, maybeMain));
                        }
                    }));
                })).subscribe(obs);
            }
        });
    }
    getBrowserIndexOutputPath(options) {
        const architect = this.context.architect;
        const [project, target, configuration] = options.browserTarget.split(':');
        const builderConfig = architect.getBuilderConfiguration({
            project,
            target,
            configuration,
        });
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(description => architect.validateBuilderOptions(builderConfig, description)), operators_1.map(config => core_1.join(core_1.normalize(config.options.outputPath), 'index.html')));
    }
    renderUniversal(options) {
        return forkJoin_1.forkJoin(this.getBrowserIndexOutputPath(options).pipe(operators_1.switchMap(browserIndexOutputPath => {
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
            const outputPath = core_1.join(root, options.outputIndexPath || browserIndexOutputPath);
            // Render to HTML and overwrite the client index file.
            return fromPromise_1.fromPromise(renderModuleFactory(AppServerModuleNgFactory, {
                document: indexHtml,
                url: options.route,
            })
                .then((html) => {
                return this.context.host
                    .write(outputPath, core_1.virtualFs.stringToFileBuffer(html))
                    .toPromise();
            })
                .then(() => ({ success: true })));
        }));
    }
}
exports.AppShellBuilder = AppShellBuilder;
exports.default = AppShellBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2FwcC1zaGVsbC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLCtDQUF1RjtBQUN2RixnREFBNkM7QUFDN0MsdURBQW9EO0FBQ3BELDZEQUEwRDtBQUMxRCxpREFBOEM7QUFDOUMsMkNBQXdDO0FBQ3hDLGlEQUErQztBQUMvQyw4Q0FBMkQ7QUFDM0Qsa0dBQTZGO0FBSzdGO0lBRUUsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUErRDtRQUNqRSxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBRXRDLE1BQU0sQ0FBQyxJQUFJLHVCQUFVLENBQWEsR0FBRyxDQUFDLEVBQUU7WUFDdEMsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ25CLE1BQU0sWUFBWSxHQUFHLGFBQUssQ0FDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxFQUNwQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FDcEQsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFpQixFQUFFLEVBQUU7Z0JBQ2hDLHdGQUF3RjtnQkFDeEYsWUFBWTtnQkFDWixPQUFPLEdBQUcsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFDckMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUNULEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkIsQ0FBQyxFQUFFLEdBQUcsRUFBRTtnQkFDTixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDdEIsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2pCLENBQUMsQ0FBQyxDQUFDO1lBRUgsOEVBQThFO1lBQzlFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUNMLHFCQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDaEIsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxDQUFDLE9BQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNuQixDQUFDO1lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsWUFBb0IsRUFBRSxTQUFhO1FBQ3ZDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3pDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFakUsd0NBQXdDO1FBQ3hDLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBSztZQUMxRCxPQUFPO1lBQ1AsTUFBTTtZQUNOLGFBQWE7WUFDYixTQUFTO1NBQ1YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQseUJBQXlCLENBQUMsT0FBbUM7UUFDM0QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFFekMsTUFBTSxDQUFDLElBQUksdUJBQVUsQ0FBTyxHQUFHLENBQUMsRUFBRTtZQUNoQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDNUIsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUVyRSxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3hCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxhQUFhLENBQUMsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDekUsTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLHVCQUF1QixDQUEyQjtvQkFDaEYsT0FBTztvQkFDUCxNQUFNO29CQUNOLGFBQWE7aUJBQ2QsQ0FBQyxDQUFDO2dCQUVILE1BQU0sQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUN4RCxxQkFBUyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUN0RixxQkFBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUNqQixNQUFNLFVBQVUsR0FBRyxXQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBRWhGLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUM1QyxxQkFBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUNoQixNQUFNLEVBQUUsR0FBRywrQ0FBK0MsQ0FBQzt3QkFDM0QsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFFbkQsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDOzRCQUNmLE1BQU0sQ0FBQyxjQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQyxDQUFDO3dCQUM5RCxDQUFDO3dCQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNOLE1BQU0sQ0FBQyxPQUFFLENBQUMsV0FBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO3dCQUN6QyxDQUFDO29CQUNILENBQUMsQ0FBQyxDQUNILENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHlCQUF5QixDQUFDLE9BQW1DO1FBQzNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3pDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFFLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBMkI7WUFDaEYsT0FBTztZQUNQLE1BQU07WUFDTixhQUFhO1NBQ2QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQ3hELHFCQUFTLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQ3RGLGVBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQUksQ0FBQyxnQkFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FDeEUsQ0FBQztJQUNKLENBQUM7SUFFRCxlQUFlLENBQUMsT0FBbUM7UUFDakQsTUFBTSxDQUFDLG1CQUFRLENBQ2IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FDMUMscUJBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLFdBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztZQUV2RSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDdEMsZUFBRyxDQUFxRCxDQUFDLENBQUMsRUFBRTtnQkFDMUQsTUFBTSxDQUFDLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUNILEVBQ0QsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxDQUN4QyxDQUFDLElBQUksQ0FDSixxQkFBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLFlBQVksQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEVBQUUsRUFBRTtZQUN2RSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDekMsNkNBQW9CLENBQUMsb0JBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1lBRXBFLE1BQU0sbUJBQW1CLEdBQUcsNkNBQW9CLENBQzlDLG9CQUFhLENBQUMsSUFBSSxDQUFDLEVBQ25CLDBCQUEwQixDQUMzQixDQUFDLG1CQUFtQixDQUFDO1lBQ3RCLE1BQU0sd0JBQXdCLEdBQUcsT0FBTyxDQUN0QyxvQkFBYSxDQUFDLGdCQUFnQixDQUFDLENBQ2hDLENBQUMsd0JBQXdCLENBQUM7WUFDM0IsTUFBTSxTQUFTLEdBQUcsZ0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUM3RCxNQUFNLFVBQVUsR0FBRyxXQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxlQUFlLElBQUksc0JBQXNCLENBQUMsQ0FBQztZQUVqRixzREFBc0Q7WUFDdEQsTUFBTSxDQUFDLHlCQUFXLENBQ2hCLG1CQUFtQixDQUFDLHdCQUF3QixFQUFFO2dCQUM1QyxRQUFRLEVBQUUsU0FBUztnQkFDbkIsR0FBRyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2FBQ25CLENBQUM7aUJBQ0QsSUFBSSxDQUFDLENBQUMsSUFBWSxFQUFFLEVBQUU7Z0JBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUk7cUJBQ3JCLEtBQUssQ0FBQyxVQUFVLEVBQUUsZ0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDckQsU0FBUyxFQUFFLENBQUM7WUFDakIsQ0FBQyxDQUFDO2lCQUNELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FDakMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF0SkQsMENBc0pDO0FBRUQsa0JBQWUsZUFBZSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBmb3JrSm9pbiB9IGZyb20gJ3J4anMvb2JzZXJ2YWJsZS9mb3JrSm9pbic7XG5pbXBvcnQgeyBmcm9tUHJvbWlzZSB9IGZyb20gJ3J4anMvb2JzZXJ2YWJsZS9mcm9tUHJvbWlzZSc7XG5pbXBvcnQgeyBtZXJnZSB9IGZyb20gJ3J4anMvb2JzZXJ2YWJsZS9tZXJnZSc7XG5pbXBvcnQgeyBvZiB9IGZyb20gJ3J4anMvb2JzZXJ2YWJsZS9vZic7XG5pbXBvcnQgeyBfdGhyb3cgfSBmcm9tICdyeGpzL29ic2VydmFibGUvdGhyb3cnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgQnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hIH0gZnJvbSAnLi4vc2VydmVyL3NjaGVtYSc7XG5pbXBvcnQgeyBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuXG5leHBvcnQgY2xhc3MgQXBwU2hlbGxCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYT4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8QnVpbGRFdmVudD4ob2JzID0+IHtcbiAgICAgIGxldCBzdWNjZXNzID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHN1YnNjcmlwdGlvbiA9IG1lcmdlKFxuICAgICAgICB0aGlzLmJ1aWxkKG9wdGlvbnMuc2VydmVyVGFyZ2V0LCB7fSksXG4gICAgICAgIHRoaXMuYnVpbGQob3B0aW9ucy5icm93c2VyVGFyZ2V0LCB7IHdhdGNoOiBmYWxzZSB9KSxcbiAgICAgICkuc3Vic2NyaWJlKChldmVudDogQnVpbGRFdmVudCkgPT4ge1xuICAgICAgICAvLyBUT0RPOiBvbmNlIHdlIHN1cHBvcnQgYSBiZXR0ZXIgYnVpbGQgZXZlbnQsIGFkZCBzdXBwb3J0IGZvciBtZXJnaW5nIHR3byBldmVudCBzdHJlYW1zXG4gICAgICAgIC8vIHRvZ2V0aGVyLlxuICAgICAgICBzdWNjZXNzID0gc3VjY2VzcyAmJiBldmVudC5zdWNjZXNzO1xuICAgICAgfSwgZXJyb3IgPT4ge1xuICAgICAgICBvYnMuZXJyb3IoZXJyb3IpO1xuICAgICAgfSwgKCkgPT4ge1xuICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3MgfSk7XG4gICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFsbG93IHN1YnNjcmlwdGlvbnMgdG8gdXMgdG8gdW5zdWJzY3JpYmUgZnJvbSBlYWNoIGJ1aWxkcyBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgcmV0dXJuICgpID0+IHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgIH0pLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAoZXZlbnQgPT4ge1xuICAgICAgICBpZiAoIWV2ZW50LnN1Y2Nlc3MpIHtcbiAgICAgICAgICByZXR1cm4gb2YoZXZlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVW5pdmVyc2FsKG9wdGlvbnMpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGJ1aWxkKHRhcmdldFN0cmluZzogc3RyaW5nLCBvdmVycmlkZXM6IHt9KSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IHRhcmdldFN0cmluZy5zcGxpdCgnOicpO1xuXG4gICAgLy8gT3ZlcnJpZGUgYnJvd3NlciBidWlsZCB3YXRjaCBzZXR0aW5nLlxuICAgIGNvbnN0IGJ1aWxkZXJDb25maWcgPSBhcmNoaXRlY3QuZ2V0QnVpbGRlckNvbmZpZ3VyYXRpb248e30+KHtcbiAgICAgIHByb2plY3QsXG4gICAgICB0YXJnZXQsXG4gICAgICBjb25maWd1cmF0aW9uLFxuICAgICAgb3ZlcnJpZGVzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGFyY2hpdGVjdC5ydW4oYnVpbGRlckNvbmZpZywgdGhpcy5jb250ZXh0KTtcbiAgfVxuXG4gIGdldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgob3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPFBhdGg+KG9icyA9PiB7XG4gICAgICBpZiAob3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpIHtcbiAgICAgICAgb2JzLm5leHQoam9pbih0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKSk7XG5cbiAgICAgICAgcmV0dXJuIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSBvcHRpb25zLnNlcnZlclRhcmdldC5zcGxpdCgnOicpO1xuICAgICAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJ1aWxkV2VicGFja1NlcnZlclNjaGVtYT4oe1xuICAgICAgICAgIHByb2plY3QsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb24sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBhcmNoaXRlY3QuZ2V0QnVpbGRlckRlc2NyaXB0aW9uKGJ1aWxkZXJDb25maWcpLnBpcGUoXG4gICAgICAgICAgY29uY2F0TWFwKGRlc2NyaXB0aW9uID0+IGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKGJ1aWxkZXJDb25maWcsIGRlc2NyaXB0aW9uKSksXG4gICAgICAgICAgc3dpdGNoTWFwKGNvbmZpZyA9PiB7XG4gICAgICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gam9pbih0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGNvbmZpZy5vcHRpb25zLm91dHB1dFBhdGgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb250ZXh0Lmhvc3QubGlzdChvdXRwdXRQYXRoKS5waXBlKFxuICAgICAgICAgICAgICBzd2l0Y2hNYXAoZmlsZXMgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlID0gL15tYWluXFwuKD86W2EtekEtWjAtOV17MjB9XFwuKT8oPzpidW5kbGVcXC4pP2pzJC87XG4gICAgICAgICAgICAgICAgY29uc3QgbWF5YmVNYWluID0gZmlsZXMuZmlsdGVyKHggPT4gcmUudGVzdCh4KSlbMF07XG5cbiAgICAgICAgICAgICAgICBpZiAoIW1heWJlTWFpbikge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIF90aHJvdyhuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZS4nKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBvZihqb2luKG91dHB1dFBhdGgsIG1heWJlTWFpbikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApLnN1YnNjcmliZShvYnMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0QnJvd3NlckluZGV4T3V0cHV0UGF0aChvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSkge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSBvcHRpb25zLmJyb3dzZXJUYXJnZXQuc3BsaXQoJzonKTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJ1aWxkV2VicGFja1NlcnZlclNjaGVtYT4oe1xuICAgICAgcHJvamVjdCxcbiAgICAgIHRhcmdldCxcbiAgICAgIGNvbmZpZ3VyYXRpb24sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGRlc2NyaXB0aW9uID0+IGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKGJ1aWxkZXJDb25maWcsIGRlc2NyaXB0aW9uKSksXG4gICAgICBtYXAoY29uZmlnID0+IGpvaW4obm9ybWFsaXplKGNvbmZpZy5vcHRpb25zLm91dHB1dFBhdGgpLCAnaW5kZXguaHRtbCcpKSxcbiAgICApO1xuICB9XG5cbiAgcmVuZGVyVW5pdmVyc2FsKG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hKTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgcmV0dXJuIGZvcmtKb2luKFxuICAgICAgdGhpcy5nZXRCcm93c2VySW5kZXhPdXRwdXRQYXRoKG9wdGlvbnMpLnBpcGUoXG4gICAgICAgIHN3aXRjaE1hcChicm93c2VySW5kZXhPdXRwdXRQYXRoID0+IHtcbiAgICAgICAgICBjb25zdCBwYXRoID0gam9pbih0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGJyb3dzZXJJbmRleE91dHB1dFBhdGgpO1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5ob3N0LnJlYWQocGF0aCkucGlwZShcbiAgICAgICAgICAgIG1hcDx2aXJ0dWFsRnMuRmlsZUJ1ZmZlciwgW1BhdGgsIHZpcnR1YWxGcy5GaWxlQnVmZmVyXT4oeCA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbYnJvd3NlckluZGV4T3V0cHV0UGF0aCwgeF07XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgICB0aGlzLmdldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgob3B0aW9ucyksXG4gICAgKS5waXBlKFxuICAgICAgc3dpdGNoTWFwKChbW2Jyb3dzZXJJbmRleE91dHB1dFBhdGgsIGluZGV4Q29udGVudF0sIHNlcnZlckJ1bmRsZVBhdGhdKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgICAgIHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocm9vdCksICd6b25lLmpzL2Rpc3Qvem9uZS1ub2RlJyk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyTW9kdWxlRmFjdG9yeSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKFxuICAgICAgICAgIGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICAgICAgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcicsXG4gICAgICAgICkucmVuZGVyTW9kdWxlRmFjdG9yeTtcbiAgICAgICAgY29uc3QgQXBwU2VydmVyTW9kdWxlTmdGYWN0b3J5ID0gcmVxdWlyZShcbiAgICAgICAgICBnZXRTeXN0ZW1QYXRoKHNlcnZlckJ1bmRsZVBhdGgpLFxuICAgICAgICApLkFwcFNlcnZlck1vZHVsZU5nRmFjdG9yeTtcbiAgICAgICAgY29uc3QgaW5kZXhIdG1sID0gdmlydHVhbEZzLmZpbGVCdWZmZXJUb1N0cmluZyhpbmRleENvbnRlbnQpO1xuICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gam9pbihyb290LCBvcHRpb25zLm91dHB1dEluZGV4UGF0aCB8fCBicm93c2VySW5kZXhPdXRwdXRQYXRoKTtcblxuICAgICAgICAvLyBSZW5kZXIgdG8gSFRNTCBhbmQgb3ZlcndyaXRlIHRoZSBjbGllbnQgaW5kZXggZmlsZS5cbiAgICAgICAgcmV0dXJuIGZyb21Qcm9taXNlKFxuICAgICAgICAgIHJlbmRlck1vZHVsZUZhY3RvcnkoQXBwU2VydmVyTW9kdWxlTmdGYWN0b3J5LCB7XG4gICAgICAgICAgICBkb2N1bWVudDogaW5kZXhIdG1sLFxuICAgICAgICAgICAgdXJsOiBvcHRpb25zLnJvdXRlLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4oKGh0bWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5ob3N0XG4gICAgICAgICAgICAgIC53cml0ZShvdXRwdXRQYXRoLCB2aXJ0dWFsRnMuc3RyaW5nVG9GaWxlQnVmZmVyKGh0bWwpKVxuICAgICAgICAgICAgICAudG9Qcm9taXNlKCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiAoeyBzdWNjZXNzOiB0cnVlIH0pKSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXBwU2hlbGxCdWlsZGVyO1xuIl19