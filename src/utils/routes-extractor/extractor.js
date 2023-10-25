/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ApplicationRef, Compiler, createPlatformFactory, platformCore, ɵwhenStable as whenStable, ɵConsole, } from '@angular/core';
import { INITIAL_CONFIG, ɵINTERNAL_SERVER_PLATFORM_PROVIDERS as INTERNAL_SERVER_PLATFORM_PROVIDERS, } from '@angular/platform-server';
import { Router, ɵloadChildren as loadChildrenHelper } from '@angular/router';
async function* getRoutesFromRouterConfig(routes, compiler, parentInjector, parentRoute = '') {
    for (const route of routes) {
        const { path, redirectTo, loadChildren, children } = route;
        if (path === undefined) {
            continue;
        }
        const currentRoutePath = buildRoutePath(parentRoute, path);
        if (redirectTo !== undefined) {
            // TODO: handle `redirectTo`.
            yield { route: currentRoutePath, success: false, redirect: true };
            continue;
        }
        if (/[:*]/.test(path)) {
            // TODO: handle parameterized routes population.
            yield { route: currentRoutePath, success: false, redirect: false };
            continue;
        }
        yield { route: currentRoutePath, success: true, redirect: false };
        if (children?.length) {
            yield* getRoutesFromRouterConfig(children, compiler, parentInjector, currentRoutePath);
        }
        if (loadChildren) {
            const loadedChildRoutes = await loadChildrenHelper(route, compiler, parentInjector).toPromise();
            if (loadedChildRoutes) {
                const { routes: childRoutes, injector = parentInjector } = loadedChildRoutes;
                yield* getRoutesFromRouterConfig(childRoutes, compiler, injector, currentRoutePath);
            }
        }
    }
}
export async function* extractRoutes(bootstrapAppFnOrModule, document, url) {
    const platformRef = createPlatformFactory(platformCore, 'server', [
        {
            provide: INITIAL_CONFIG,
            useValue: { document, url },
        },
        {
            provide: ɵConsole,
            /** An Angular Console Provider that does not print a set of predefined logs. */
            useFactory: () => {
                class Console extends ɵConsole {
                    ignoredLogs = new Set(['Angular is running in development mode.']);
                    log(message) {
                        if (!this.ignoredLogs.has(message)) {
                            super.log(message);
                        }
                    }
                }
                return new Console();
            },
        },
        ...INTERNAL_SERVER_PLATFORM_PROVIDERS,
    ])();
    try {
        let applicationRef;
        if (isBootstrapFn(bootstrapAppFnOrModule)) {
            applicationRef = await bootstrapAppFnOrModule();
        }
        else {
            const moduleRef = await platformRef.bootstrapModule(bootstrapAppFnOrModule);
            applicationRef = moduleRef.injector.get(ApplicationRef);
        }
        // Wait until the application is stable.
        await whenStable(applicationRef);
        const injector = applicationRef.injector;
        const router = injector.get(Router);
        const compiler = injector.get(Compiler);
        // Extract all the routes from the config.
        yield* getRoutesFromRouterConfig(router.config, compiler, injector);
    }
    finally {
        platformRef.destroy();
    }
}
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading compiler-generated `ɵmod` static property:
    return typeof value === 'function' && !('ɵmod' in value);
}
function buildRoutePath(...routeParts) {
    return routeParts.filter(Boolean).join('/');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0cmFjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvcm91dGVzLWV4dHJhY3Rvci9leHRyYWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLGNBQWMsRUFDZCxRQUFRLEVBR1IscUJBQXFCLEVBQ3JCLFlBQVksRUFDWixXQUFXLElBQUksVUFBVSxFQUN6QixRQUFRLEdBQ1QsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUNMLGNBQWMsRUFDZCxtQ0FBbUMsSUFBSSxrQ0FBa0MsR0FDMUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNsQyxPQUFPLEVBQVMsTUFBTSxFQUFFLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBUXJGLEtBQUssU0FBUyxDQUFDLENBQUMseUJBQXlCLENBQ3ZDLE1BQWUsRUFDZixRQUFrQixFQUNsQixjQUF3QixFQUN4QixXQUFXLEdBQUcsRUFBRTtJQUVoQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtRQUMxQixNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQzNELElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtZQUN0QixTQUFTO1NBQ1Y7UUFFRCxNQUFNLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFM0QsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQzVCLDZCQUE2QjtZQUM3QixNQUFNLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1lBQ2xFLFNBQVM7U0FDVjtRQUVELElBQUksTUFB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LENBQUMsT0FBTyxFQUFFLENBQUM7S0FDdkI7QUFDSCxDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsS0FBYztJQUNuQyx1SEFBdUg7SUFDdkgsT0FBTyxPQUFPLEtBQUssS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsR0FBRyxVQUFvQjtJQUM3QyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzlDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQXBwbGljYXRpb25SZWYsXG4gIENvbXBpbGVyLFxuICBJbmplY3RvcixcbiAgVHlwZSxcbiAgY3JlYXRlUGxhdGZvcm1GYWN0b3J5LFxuICBwbGF0Zm9ybUNvcmUsXG4gIMm1d2hlblN0YWJsZSBhcyB3aGVuU3RhYmxlLFxuICDJtUNvbnNvbGUsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHtcbiAgSU5JVElBTF9DT05GSUcsXG4gIMm1SU5URVJOQUxfU0VSVkVSX1BMQVRGT1JNX1BST1ZJREVSUyBhcyBJTlRFUk5BTF9TRVJWRVJfUExBVEZPUk1fUFJPVklERVJTLFxufSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInO1xuaW1wb3J0IHsgUm91dGUsIFJvdXRlciwgybVsb2FkQ2hpbGRyZW4gYXMgbG9hZENoaWxkcmVuSGVscGVyIH0gZnJvbSAnQGFuZ3VsYXIvcm91dGVyJztcblxuaW50ZXJmYWNlIFJvdXRlclJlc3VsdCB7XG4gIHJvdXRlOiBzdHJpbmc7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHJlZGlyZWN0OiBib29sZWFuO1xufVxuXG5hc3luYyBmdW5jdGlvbiogZ2V0Um91dGVzRnJvbVJvdXRlckNvbmZpZyhcbiAgcm91dGVzOiBSb3V0ZVtdLFxuICBjb21waWxlcjogQ29tcGlsZXIsXG4gIHBhcmVudEluamVjdG9yOiBJbmplY3RvcixcbiAgcGFyZW50Um91dGUgPSAnJyxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxSb3V0ZXJSZXN1bHQ+IHtcbiAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXMpIHtcbiAgICBjb25zdCB7IHBhdGgsIHJlZGlyZWN0VG8sIGxvYWRDaGlsZHJlbiwgY2hpbGRyZW4gfSA9IHJvdXRlO1xuICAgIGlmIChwYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRSb3V0ZVBhdGggPSBidWlsZFJvdXRlUGF0aChwYXJlbnRSb3V0ZSwgcGF0aCk7XG5cbiAgICBpZiAocmVkaXJlY3RUbyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBUT0RPOiBoYW5kbGUgYHJlZGlyZWN0VG9gLlxuICAgICAgeWllbGQgeyByb3V0ZTogY3VycmVudFJvdXRlUGF0aCwgc3VjY2VzczogZmFsc2UsIHJlZGlyZWN0OiB0cnVlIH07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoL1s6Kl0vLnRlc3QocGF0aCkpIHtcbiAgICAgIC8vIFRPRE86IGhhbmRsZSBwYXJhbWV0ZXJpemVkIHJvdXRlcyBwb3B1bGF0aW9uLlxuICAgICAgeWllbGQgeyByb3V0ZTogY3VycmVudFJvdXRlUGF0aCwgc3VjY2VzczogZmFsc2UsIHJlZGlyZWN0OiBmYWxzZSB9O1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgeWllbGQgeyByb3V0ZTogY3VycmVudFJvdXRlUGF0aCwgc3VjY2VzczogdHJ1ZSwgcmVkaXJlY3Q6IGZhbHNlIH07XG5cbiAgICBpZiAoY2hpbGRyZW4/Lmxlbmd0aCkge1xuICAgICAgeWllbGQqIGdldFJvdXRlc0Zyb21Sb3V0ZXJDb25maWcoY2hpbGRyZW4sIGNvbXBpbGVyLCBwYXJlbnRJbmplY3RvciwgY3VycmVudFJvdXRlUGF0aCk7XG4gICAgfVxuXG4gICAgaWYgKGxvYWRDaGlsZHJlbikge1xuICAgICAgY29uc3QgbG9hZGVkQ2hpbGRSb3V0ZXMgPSBhd2FpdCBsb2FkQ2hpbGRyZW5IZWxwZXIoXG4gICAgICAgIHJvdXRlLFxuICAgICAgICBjb21waWxlcixcbiAgICAgICAgcGFyZW50SW5qZWN0b3IsXG4gICAgICApLnRvUHJvbWlzZSgpO1xuXG4gICAgICBpZiAobG9hZGVkQ2hpbGRSb3V0ZXMpIHtcbiAgICAgICAgY29uc3QgeyByb3V0ZXM6IGNoaWxkUm91dGVzLCBpbmplY3RvciA9IHBhcmVudEluamVjdG9yIH0gPSBsb2FkZWRDaGlsZFJvdXRlcztcbiAgICAgICAgeWllbGQqIGdldFJvdXRlc0Zyb21Sb3V0ZXJDb25maWcoY2hpbGRSb3V0ZXMsIGNvbXBpbGVyLCBpbmplY3RvciwgY3VycmVudFJvdXRlUGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogZXh0cmFjdFJvdXRlcyhcbiAgYm9vdHN0cmFwQXBwRm5Pck1vZHVsZTogKCgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+KSB8IFR5cGU8dW5rbm93bj4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIHVybDogc3RyaW5nLFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFJvdXRlclJlc3VsdD4ge1xuICBjb25zdCBwbGF0Zm9ybVJlZiA9IGNyZWF0ZVBsYXRmb3JtRmFjdG9yeShwbGF0Zm9ybUNvcmUsICdzZXJ2ZXInLCBbXG4gICAge1xuICAgICAgcHJvdmlkZTogSU5JVElBTF9DT05GSUcsXG4gICAgICB1c2VWYWx1ZTogeyBkb2N1bWVudCwgdXJsIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBwcm92aWRlOiDJtUNvbnNvbGUsXG4gICAgICAvKiogQW4gQW5ndWxhciBDb25zb2xlIFByb3ZpZGVyIHRoYXQgZG9lcyBub3QgcHJpbnQgYSBzZXQgb2YgcHJlZGVmaW5lZCBsb2dzLiAqL1xuICAgICAgdXNlRmFjdG9yeTogKCkgPT4ge1xuICAgICAgICBjbGFzcyBDb25zb2xlIGV4dGVuZHMgybVDb25zb2xlIHtcbiAgICAgICAgICBwcml2YXRlIHJlYWRvbmx5IGlnbm9yZWRMb2dzID0gbmV3IFNldChbJ0FuZ3VsYXIgaXMgcnVubmluZyBpbiBkZXZlbG9wbWVudCBtb2RlLiddKTtcbiAgICAgICAgICBvdmVycmlkZSBsb2cobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaWdub3JlZExvZ3MuaGFzKG1lc3NhZ2UpKSB7XG4gICAgICAgICAgICAgIHN1cGVyLmxvZyhtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IENvbnNvbGUoKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICAuLi5JTlRFUk5BTF9TRVJWRVJfUExBVEZPUk1fUFJPVklERVJTLFxuICBdKSgpO1xuXG4gIHRyeSB7XG4gICAgbGV0IGFwcGxpY2F0aW9uUmVmOiBBcHBsaWNhdGlvblJlZjtcbiAgICBpZiAoaXNCb290c3RyYXBGbihib290c3RyYXBBcHBGbk9yTW9kdWxlKSkge1xuICAgICAgYXBwbGljYXRpb25SZWYgPSBhd2FpdCBib290c3RyYXBBcHBGbk9yTW9kdWxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG1vZHVsZVJlZiA9IGF3YWl0IHBsYXRmb3JtUmVmLmJvb3RzdHJhcE1vZHVsZShib290c3RyYXBBcHBGbk9yTW9kdWxlKTtcbiAgICAgIGFwcGxpY2F0aW9uUmVmID0gbW9kdWxlUmVmLmluamVjdG9yLmdldChBcHBsaWNhdGlvblJlZik7XG4gICAgfVxuXG4gICAgLy8gV2FpdCB1bnRpbCB0aGUgYXBwbGljYXRpb24gaXMgc3RhYmxlLlxuICAgIGF3YWl0IHdoZW5TdGFibGUoYXBwbGljYXRpb25SZWYpO1xuXG4gICAgY29uc3QgaW5qZWN0b3IgPSBhcHBsaWNhdGlvblJlZi5pbmplY3RvcjtcbiAgICBjb25zdCByb3V0ZXIgPSBpbmplY3Rvci5nZXQoUm91dGVyKTtcbiAgICBjb25zdCBjb21waWxlciA9IGluamVjdG9yLmdldChDb21waWxlcik7XG5cbiAgICAvLyBFeHRyYWN0IGFsbCB0aGUgcm91dGVzIGZyb20gdGhlIGNvbmZpZy5cbiAgICB5aWVsZCogZ2V0Um91dGVzRnJvbVJvdXRlckNvbmZpZyhyb3V0ZXIuY29uZmlnLCBjb21waWxlciwgaW5qZWN0b3IpO1xuICB9IGZpbmFsbHkge1xuICAgIHBsYXRmb3JtUmVmLmRlc3Ryb3koKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGNvbXBpbGVyLWdlbmVyYXRlZCBgybVtb2RgIHN0YXRpYyBwcm9wZXJ0eTpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBidWlsZFJvdXRlUGF0aCguLi5yb3V0ZVBhcnRzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiByb3V0ZVBhcnRzLmZpbHRlcihCb29sZWFuKS5qb2luKCcvJyk7XG59XG4iXX0=