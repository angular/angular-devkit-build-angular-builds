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
exports.requiresLinking = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const load_esm_1 = require("../../../utils/load-esm");
/**
 * Cached instance of the compiler-cli linker's needsLinking function.
 */
let needsLinking;
/**
 * List of browsers which are affected by a WebKit bug where class field
 * initializers might have incorrect variable scopes.
 *
 * See: https://github.com/angular/angular-cli/issues/24355#issuecomment-1333477033
 * See: https://github.com/WebKit/WebKit/commit/e8788a34b3d5f5b4edd7ff6450b80936bff396f2
 */
let safariClassFieldScopeBugBrowsers;
function createI18nDiagnostics(reporter) {
    const diagnostics = new (class {
        messages = [];
        hasErrors = false;
        add(type, message) {
            if (type === 'ignore') {
                return;
            }
            this.messages.push({ type, message });
            this.hasErrors ||= type === 'error';
            reporter?.(type, message);
        }
        error(message) {
            this.add('error', message);
        }
        warn(message) {
            this.add('warning', message);
        }
        merge(other) {
            for (const diagnostic of other.messages) {
                this.add(diagnostic.type, diagnostic.message);
            }
        }
        formatDiagnostics() {
            node_assert_1.default.fail('@angular/localize Diagnostics formatDiagnostics should not be called from within babel.');
        }
    })();
    return diagnostics;
}
function createI18nPlugins(locale, translation, missingTranslationBehavior, diagnosticReporter, pluginCreators) {
    const diagnostics = createI18nDiagnostics(diagnosticReporter);
    const plugins = [];
    const { makeEs2015TranslatePlugin, makeLocalePlugin } = pluginCreators;
    if (translation) {
        plugins.push(makeEs2015TranslatePlugin(diagnostics, translation, {
            missingTranslation: missingTranslationBehavior,
        }));
    }
    plugins.push(makeLocalePlugin(locale));
    return plugins;
}
function createNgtscLogger(reporter) {
    return {
        level: 1,
        debug(...args) { },
        info(...args) {
            reporter?.('info', args.join());
        },
        warn(...args) {
            reporter?.('warning', args.join());
        },
        error(...args) {
            reporter?.('error', args.join());
        },
    };
}
function default_1(api, options) {
    const presets = [];
    const plugins = [];
    let needRuntimeTransform = false;
    if (options.angularLinker?.shouldLink) {
        plugins.push(options.angularLinker.linkerPluginCreator({
            linkerJitMode: options.angularLinker.jitMode,
            // This is a workaround until https://github.com/angular/angular/issues/42769 is fixed.
            sourceMapping: false,
            logger: createNgtscLogger(options.diagnosticReporter),
            fileSystem: {
                resolve: node_path_1.default.resolve,
                exists: node_fs_1.default.existsSync,
                dirname: node_path_1.default.dirname,
                relative: node_path_1.default.relative,
                readFile: node_fs_1.default.readFileSync,
                // Node.JS types don't overlap the Compiler types.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            },
        }));
    }
    // Applications code ES version can be controlled using TypeScript's `target` option.
    // However, this doesn't effect libraries and hence we use preset-env to downlevel ES features
    // based on the supported browsers in browserslist.
    if (options.supportedBrowsers) {
        const includePlugins = [];
        if (safariClassFieldScopeBugBrowsers === undefined) {
            const browserslist = require('browserslist');
            safariClassFieldScopeBugBrowsers = new Set(browserslist([
                // Safari <15 is technically not supported via https://angular.io/guide/browser-support,
                // but we apply the workaround if forcibly selected.
                'Safari <=15',
                'iOS <=15',
            ]));
        }
        // If a Safari browser affected by the class field scope bug is selected, we
        // downlevel class properties by ensuring the class properties Babel plugin
        // is always included- regardless of the preset-env targets.
        if (options.supportedBrowsers.some((b) => safariClassFieldScopeBugBrowsers.has(b))) {
            includePlugins.push('@babel/plugin-proposal-class-properties', '@babel/plugin-proposal-private-methods');
        }
        presets.push([
            require('@babel/preset-env').default,
            {
                bugfixes: true,
                modules: false,
                targets: options.supportedBrowsers,
                include: includePlugins,
                exclude: ['transform-typeof-symbol'],
            },
        ]);
        needRuntimeTransform = true;
    }
    if (options.i18n) {
        const { locale, missingTranslationBehavior, pluginCreators, translation } = options.i18n;
        const i18nPlugins = createI18nPlugins(locale, translation, missingTranslationBehavior || 'ignore', options.diagnosticReporter, pluginCreators);
        plugins.push(...i18nPlugins);
    }
    if (options.forceAsyncTransformation) {
        // Always transform async/await to support Zone.js
        plugins.push(require('@babel/plugin-transform-async-to-generator').default, require('@babel/plugin-proposal-async-generator-functions').default);
        needRuntimeTransform = true;
    }
    if (options.optimize) {
        if (options.optimize.pureTopLevel) {
            plugins.push(require('../plugins/pure-toplevel-functions').default);
        }
        plugins.push(require('../plugins/elide-angular-metadata').default, [require('../plugins/adjust-typescript-enums').default, { loose: true }], [
            require('../plugins/adjust-static-class-members').default,
            { wrapDecorators: options.optimize.wrapDecorators },
        ]);
    }
    if (options.instrumentCode) {
        plugins.push([
            require('babel-plugin-istanbul').default,
            {
                inputSourceMap: options.instrumentCode.inputSourceMap ?? false,
                cwd: options.instrumentCode.includedBasePath,
            },
        ]);
    }
    if (needRuntimeTransform) {
        // Babel equivalent to TypeScript's `importHelpers` option
        plugins.push([
            require('@babel/plugin-transform-runtime').default,
            {
                useESModules: true,
                version: require('@babel/runtime/package.json').version,
                absoluteRuntime: node_path_1.default.dirname(require.resolve('@babel/runtime/package.json')),
            },
        ]);
    }
    return { presets, plugins };
}
exports.default = default_1;
async function requiresLinking(path, source) {
    // @angular/core and @angular/compiler will cause false positives
    // Also, TypeScript files do not require linking
    if (/[\\/]@angular[\\/](?:compiler|core)|\.tsx?$/.test(path)) {
        return false;
    }
    if (!needsLinking) {
        // Load ESM `@angular/compiler-cli/linker` using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        const linkerModule = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker');
        needsLinking = linkerModule.needsLinking;
    }
    return needsLinking(path, source);
}
exports.requiresLinking = requiresLinking;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQVNILDhEQUFpQztBQUNqQyxzREFBeUI7QUFDekIsMERBQTZCO0FBQzdCLHNEQUF3RDtBQUV4RDs7R0FFRztBQUNILElBQUksWUFBb0YsQ0FBQztBQUV6Rjs7Ozs7O0dBTUc7QUFDSCxJQUFJLGdDQUFxRCxDQUFDO0FBaUQxRCxTQUFTLHFCQUFxQixDQUFDLFFBQXdDO0lBQ3JFLE1BQU0sV0FBVyxHQUFnQixJQUFJLENBQUM7UUFDM0IsUUFBUSxHQUE0QixFQUFFLENBQUM7UUFDaEQsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUVsQixHQUFHLENBQUMsSUFBZ0MsRUFBRSxPQUFlO1lBQ25ELElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDckIsT0FBTzthQUNSO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksS0FBSyxPQUFPLENBQUM7WUFDcEMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxLQUFLLENBQUMsT0FBZTtZQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQWU7WUFDbEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFrQjtZQUN0QixL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QUMsT0FBTztZQUNsRDtnQkFDRSxZQUFZLEVBQUUsSUFBSTtnQkFDbEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLE9BQU87Z0JBQ3ZELGVBQWUsRUFBRSxtQkFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDOUU7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQTlIRCw0QkE4SEM7QUFFTSxLQUFLLFVBQVUsZUFBZSxDQUFDLElBQVksRUFBRSxNQUFjO0lBQ2hFLGlFQUFpRTtJQUNqRSxnREFBZ0Q7SUFDaEQsSUFBSSw2Q0FBNkMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsMEZBQTBGO1FBQzFGLHlGQUF5RjtRQUN6RixzQ0FBc0M7UUFDdEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLHdCQUFhLEVBQ3RDLDhCQUE4QixDQUMvQixDQUFDO1FBQ0YsWUFBWSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUM7S0FDMUM7SUFFRCxPQUFPLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQWxCRCwwQ0FrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZFRyYW5zbGF0aW9uIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUnO1xuaW1wb3J0IHR5cGUge1xuICBEaWFnbm9zdGljSGFuZGxpbmdTdHJhdGVneSxcbiAgRGlhZ25vc3RpY3MsXG4gIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sXG4gIG1ha2VMb2NhbGVQbHVnaW4sXG59IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi8uLi91dGlscy9sb2FkLWVzbSc7XG5cbi8qKlxuICogQ2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjb21waWxlci1jbGkgbGlua2VyJ3MgbmVlZHNMaW5raW5nIGZ1bmN0aW9uLlxuICovXG5sZXQgbmVlZHNMaW5raW5nOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyJykubmVlZHNMaW5raW5nIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIExpc3Qgb2YgYnJvd3NlcnMgd2hpY2ggYXJlIGFmZmVjdGVkIGJ5IGEgV2ViS2l0IGJ1ZyB3aGVyZSBjbGFzcyBmaWVsZFxuICogaW5pdGlhbGl6ZXJzIG1pZ2h0IGhhdmUgaW5jb3JyZWN0IHZhcmlhYmxlIHNjb3Blcy5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vV2ViS2l0L1dlYktpdC9jb21taXQvZTg3ODhhMzRiM2Q1ZjViNGVkZDdmZjY0NTBiODA5MzZiZmYzOTZmMlxuICovXG5sZXQgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnQnJvd3NlcnM6IFJlYWRvbmx5U2V0PHN0cmluZz47XG5cbmV4cG9ydCB0eXBlIERpYWdub3N0aWNSZXBvcnRlciA9ICh0eXBlOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nLCBtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHJlcHJlc2VudGluZyB0aGUgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIEJhYmVsIHBsdWdpbnMuXG4gKiBUaGlzIG11c3QgYmUgcHJvdmlkZWQgZm9yIHRoZSBFU00gaW1wb3J0cyBzaW5jZSBkeW5hbWljIGltcG9ydHMgYXJlIHJlcXVpcmVkIHRvIGJlIGFzeW5jaHJvbm91cyBhbmRcbiAqIEJhYmVsIHByZXNldHMgY3VycmVudGx5IGNhbiBvbmx5IGJlIHN5bmNocm9ub3VzLlxuICpcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuUGx1Z2luQ3JlYXRvcnMge1xuICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luOiB0eXBlb2YgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjtcbiAgbWFrZUxvY2FsZVBsdWdpbjogdHlwZW9mIG1ha2VMb2NhbGVQbHVnaW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zIHtcbiAgaTE4bj86IHtcbiAgICBsb2NhbGU6IHN0cmluZztcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbj86IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+O1xuICAgIHRyYW5zbGF0aW9uRmlsZXM/OiBzdHJpbmdbXTtcbiAgICBwbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzO1xuICB9O1xuXG4gIGFuZ3VsYXJMaW5rZXI/OiB7XG4gICAgc2hvdWxkTGluazogYm9vbGVhbjtcbiAgICBqaXRNb2RlOiBib29sZWFuO1xuICAgIGxpbmtlclBsdWdpbkNyZWF0b3I6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG4gIH07XG5cbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgaW5jbHVkZWRCYXNlUGF0aDogc3RyaW5nO1xuICAgIGlucHV0U291cmNlTWFwOiB1bmtub3duO1xuICB9O1xuICBvcHRpbWl6ZT86IHtcbiAgICBwdXJlVG9wTGV2ZWw6IGJvb2xlYW47XG4gICAgd3JhcERlY29yYXRvcnM6IGJvb2xlYW47XG4gIH07XG5cbiAgc3VwcG9ydGVkQnJvd3NlcnM/OiBzdHJpbmdbXTtcbiAgZGlhZ25vc3RpY1JlcG9ydGVyPzogRGlhZ25vc3RpY1JlcG9ydGVyO1xufVxuXG4vLyBFeHRyYWN0IExvZ2dlciB0eXBlIGZyb20gdGhlIGxpbmtlciBmdW5jdGlvbiB0byBhdm9pZCBkZWVwIGltcG9ydGluZyB0byBhY2Nlc3MgdGhlIHR5cGVcbnR5cGUgTmd0c2NMb2dnZXIgPSBQYXJhbWV0ZXJzPFxuICB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4+WzBdWydsb2dnZXInXTtcblxuZnVuY3Rpb24gY3JlYXRlSTE4bkRpYWdub3N0aWNzKHJlcG9ydGVyOiBEaWFnbm9zdGljUmVwb3J0ZXIgfCB1bmRlZmluZWQpOiBEaWFnbm9zdGljcyB7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiBEaWFnbm9zdGljcyA9IG5ldyAoY2xhc3Mge1xuICAgIHJlYWRvbmx5IG1lc3NhZ2VzOiBEaWFnbm9zdGljc1snbWVzc2FnZXMnXSA9IFtdO1xuICAgIGhhc0Vycm9ycyA9IGZhbHNlO1xuXG4gICAgYWRkKHR5cGU6IERpYWdub3N0aWNIYW5kbGluZ1N0cmF0ZWd5LCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlID09PSAnaWdub3JlJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7IHR5cGUsIG1lc3NhZ2UgfSk7XG4gICAgICB0aGlzLmhhc0Vycm9ycyB8fD0gdHlwZSA9PT0gJ2Vycm9yJztcbiAgICAgIHJlcG9ydGVyPy4odHlwZSwgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgZXJyb3IobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnZXJyb3InLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgdGhpcy5hZGQoJ3dhcm5pbmcnLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBtZXJnZShvdGhlcjogRGlhZ25vc3RpY3MpOiB2b2lkIHtcbiAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBvdGhlci5tZXNzYWdlcykge1xuICAgICAgICB0aGlzLmFkZChkaWFnbm9zdGljLnR5cGUsIGRpYWdub3N0aWMubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9ybWF0RGlhZ25vc3RpY3MoKTogbmV2ZXIge1xuICAgICAgYXNzZXJ0LmZhaWwoXG4gICAgICAgICdAYW5ndWxhci9sb2NhbGl6ZSBEaWFnbm9zdGljcyBmb3JtYXREaWFnbm9zdGljcyBzaG91bGQgbm90IGJlIGNhbGxlZCBmcm9tIHdpdGhpbiBiYWJlbC4nLFxuICAgICAgKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJMThuUGx1Z2lucyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHRyYW5zbGF0aW9uOiBSZWNvcmQ8c3RyaW5nLCDJtVBhcnNlZFRyYW5zbGF0aW9uPiB8IHVuZGVmaW5lZCxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3I6ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyxcbiAgZGlhZ25vc3RpY1JlcG9ydGVyOiBEaWFnbm9zdGljUmVwb3J0ZXIgfCB1bmRlZmluZWQsXG4gIHBsdWdpbkNyZWF0b3JzOiBJMThuUGx1Z2luQ3JlYXRvcnMsXG4pIHtcbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBjcmVhdGVJMThuRGlhZ25vc3RpY3MoZGlhZ25vc3RpY1JlcG9ydGVyKTtcbiAgY29uc3QgcGx1Z2lucyA9IFtdO1xuXG4gIGNvbnN0IHsgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUxvY2FsZVBsdWdpbiB9ID0gcGx1Z2luQ3JlYXRvcnM7XG5cbiAgaWYgKHRyYW5zbGF0aW9uKSB7XG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgdHJhbnNsYXRpb24sIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwbHVnaW5zLnB1c2gobWFrZUxvY2FsZVBsdWdpbihsb2NhbGUpKTtcblxuICByZXR1cm4gcGx1Z2lucztcbn1cblxuZnVuY3Rpb24gY3JlYXRlTmd0c2NMb2dnZXIocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IE5ndHNjTG9nZ2VyIHtcbiAgcmV0dXJuIHtcbiAgICBsZXZlbDogMSwgLy8gSW5mbyBsZXZlbFxuICAgIGRlYnVnKC4uLmFyZ3M6IHN0cmluZ1tdKSB7fSxcbiAgICBpbmZvKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCdpbmZvJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgd2FybiguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgICAgcmVwb3J0ZXI/Lignd2FybmluZycsIGFyZ3Muam9pbigpKTtcbiAgICB9LFxuICAgIGVycm9yKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCdlcnJvcicsIGFyZ3Muam9pbigpKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoYXBpOiB1bmtub3duLCBvcHRpb25zOiBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMpIHtcbiAgY29uc3QgcHJlc2V0cyA9IFtdO1xuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGxldCBuZWVkUnVudGltZVRyYW5zZm9ybSA9IGZhbHNlO1xuXG4gIGlmIChvcHRpb25zLmFuZ3VsYXJMaW5rZXI/LnNob3VsZExpbmspIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBvcHRpb25zLmFuZ3VsYXJMaW5rZXIubGlua2VyUGx1Z2luQ3JlYXRvcih7XG4gICAgICAgIGxpbmtlckppdE1vZGU6IG9wdGlvbnMuYW5ndWxhckxpbmtlci5qaXRNb2RlLFxuICAgICAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCB1bnRpbCBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy80Mjc2OSBpcyBmaXhlZC5cbiAgICAgICAgc291cmNlTWFwcGluZzogZmFsc2UsXG4gICAgICAgIGxvZ2dlcjogY3JlYXRlTmd0c2NMb2dnZXIob3B0aW9ucy5kaWFnbm9zdGljUmVwb3J0ZXIpLFxuICAgICAgICBmaWxlU3lzdGVtOiB7XG4gICAgICAgICAgcmVzb2x2ZTogcGF0aC5yZXNvbHZlLFxuICAgICAgICAgIGV4aXN0czogZnMuZXhpc3RzU3luYyxcbiAgICAgICAgICBkaXJuYW1lOiBwYXRoLmRpcm5hbWUsXG4gICAgICAgICAgcmVsYXRpdmU6IHBhdGgucmVsYXRpdmUsXG4gICAgICAgICAgcmVhZEZpbGU6IGZzLnJlYWRGaWxlU3luYyxcbiAgICAgICAgICAvLyBOb2RlLkpTIHR5cGVzIGRvbid0IG92ZXJsYXAgdGhlIENvbXBpbGVyIHR5cGVzLlxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIH0gYXMgYW55LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEFwcGxpY2F0aW9ucyBjb2RlIEVTIHZlcnNpb24gY2FuIGJlIGNvbnRyb2xsZWQgdXNpbmcgVHlwZVNjcmlwdCdzIGB0YXJnZXRgIG9wdGlvbi5cbiAgLy8gSG93ZXZlciwgdGhpcyBkb2Vzbid0IGVmZmVjdCBsaWJyYXJpZXMgYW5kIGhlbmNlIHdlIHVzZSBwcmVzZXQtZW52IHRvIGRvd25sZXZlbCBFUyBmZWF0dXJlc1xuICAvLyBiYXNlZCBvbiB0aGUgc3VwcG9ydGVkIGJyb3dzZXJzIGluIGJyb3dzZXJzbGlzdC5cbiAgaWYgKG9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMpIHtcbiAgICBjb25zdCBpbmNsdWRlUGx1Z2luczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWdCcm93c2VycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBicm93c2Vyc2xpc3QgPSByZXF1aXJlKCdicm93c2Vyc2xpc3QnKTtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Z0Jyb3dzZXJzID0gbmV3IFNldChcbiAgICAgICAgYnJvd3NlcnNsaXN0KFtcbiAgICAgICAgICAvLyBTYWZhcmkgPDE1IGlzIHRlY2huaWNhbGx5IG5vdCBzdXBwb3J0ZWQgdmlhIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9icm93c2VyLXN1cHBvcnQsXG4gICAgICAgICAgLy8gYnV0IHdlIGFwcGx5IHRoZSB3b3JrYXJvdW5kIGlmIGZvcmNpYmx5IHNlbGVjdGVkLlxuICAgICAgICAgICdTYWZhcmkgPD0xNScsXG4gICAgICAgICAgJ2lPUyA8PTE1JyxcbiAgICAgICAgXSksXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIElmIGEgU2FmYXJpIGJyb3dzZXIgYWZmZWN0ZWQgYnkgdGhlIGNsYXNzIGZpZWxkIHNjb3BlIGJ1ZyBpcyBzZWxlY3RlZCwgd2VcbiAgICAvLyBkb3dubGV2ZWwgY2xhc3MgcHJvcGVydGllcyBieSBlbnN1cmluZyB0aGUgY2xhc3MgcHJvcGVydGllcyBCYWJlbCBwbHVnaW5cbiAgICAvLyBpcyBhbHdheXMgaW5jbHVkZWQtIHJlZ2FyZGxlc3Mgb2YgdGhlIHByZXNldC1lbnYgdGFyZ2V0cy5cbiAgICBpZiAob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycy5zb21lKChiKSA9PiBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWdCcm93c2Vycy5oYXMoYikpKSB7XG4gICAgICBpbmNsdWRlUGx1Z2lucy5wdXNoKFxuICAgICAgICAnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1jbGFzcy1wcm9wZXJ0aWVzJyxcbiAgICAgICAgJ0BiYWJlbC9wbHVnaW4tcHJvcG9zYWwtcHJpdmF0ZS1tZXRob2RzJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcHJlc2V0cy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wcmVzZXQtZW52JykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgYnVnZml4ZXM6IHRydWUsXG4gICAgICAgIG1vZHVsZXM6IGZhbHNlLFxuICAgICAgICB0YXJnZXRzOiBvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICBpbmNsdWRlOiBpbmNsdWRlUGx1Z2lucyxcbiAgICAgICAgZXhjbHVkZTogWyd0cmFuc2Zvcm0tdHlwZW9mLXN5bWJvbCddLFxuICAgICAgfSxcbiAgICBdKTtcbiAgICBuZWVkUnVudGltZVRyYW5zZm9ybSA9IHRydWU7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pMThuKSB7XG4gICAgY29uc3QgeyBsb2NhbGUsIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLCBwbHVnaW5DcmVhdG9ycywgdHJhbnNsYXRpb24gfSA9IG9wdGlvbnMuaTE4bjtcbiAgICBjb25zdCBpMThuUGx1Z2lucyA9IGNyZWF0ZUkxOG5QbHVnaW5zKFxuICAgICAgbG9jYWxlLFxuICAgICAgdHJhbnNsYXRpb24sXG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciB8fCAnaWdub3JlJyxcbiAgICAgIG9wdGlvbnMuZGlhZ25vc3RpY1JlcG9ydGVyLFxuICAgICAgcGx1Z2luQ3JlYXRvcnMsXG4gICAgKTtcblxuICAgIHBsdWdpbnMucHVzaCguLi5pMThuUGx1Z2lucyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24pIHtcbiAgICAvLyBBbHdheXMgdHJhbnNmb3JtIGFzeW5jL2F3YWl0IHRvIHN1cHBvcnQgWm9uZS5qc1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tdHJhbnNmb3JtLWFzeW5jLXRvLWdlbmVyYXRvcicpLmRlZmF1bHQsXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXByb3Bvc2FsLWFzeW5jLWdlbmVyYXRvci1mdW5jdGlvbnMnKS5kZWZhdWx0LFxuICAgICk7XG4gICAgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMub3B0aW1pemUpIHtcbiAgICBpZiAob3B0aW9ucy5vcHRpbWl6ZS5wdXJlVG9wTGV2ZWwpIHtcbiAgICAgIHBsdWdpbnMucHVzaChyZXF1aXJlKCcuLi9wbHVnaW5zL3B1cmUtdG9wbGV2ZWwtZnVuY3Rpb25zJykuZGVmYXVsdCk7XG4gICAgfVxuXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgcmVxdWlyZSgnLi4vcGx1Z2lucy9lbGlkZS1hbmd1bGFyLW1ldGFkYXRhJykuZGVmYXVsdCxcbiAgICAgIFtyZXF1aXJlKCcuLi9wbHVnaW5zL2FkanVzdC10eXBlc2NyaXB0LWVudW1zJykuZGVmYXVsdCwgeyBsb29zZTogdHJ1ZSB9XSxcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZSgnLi4vcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMnKS5kZWZhdWx0LFxuICAgICAgICB7IHdyYXBEZWNvcmF0b3JzOiBvcHRpb25zLm9wdGltaXplLndyYXBEZWNvcmF0b3JzIH0sXG4gICAgICBdLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pbnN0cnVtZW50Q29kZSkge1xuICAgIHBsdWdpbnMucHVzaChbXG4gICAgICByZXF1aXJlKCdiYWJlbC1wbHVnaW4taXN0YW5idWwnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICBpbnB1dFNvdXJjZU1hcDogb3B0aW9ucy5pbnN0cnVtZW50Q29kZS5pbnB1dFNvdXJjZU1hcCA/PyBmYWxzZSxcbiAgICAgICAgY3dkOiBvcHRpb25zLmluc3RydW1lbnRDb2RlLmluY2x1ZGVkQmFzZVBhdGgsXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG5cbiAgaWYgKG5lZWRSdW50aW1lVHJhbnNmb3JtKSB7XG4gICAgLy8gQmFiZWwgZXF1aXZhbGVudCB0byBUeXBlU2NyaXB0J3MgYGltcG9ydEhlbHBlcnNgIG9wdGlvblxuICAgIHBsdWdpbnMucHVzaChbXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS1ydW50aW1lJykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgdXNlRVNNb2R1bGVzOiB0cnVlLFxuICAgICAgICB2ZXJzaW9uOiByZXF1aXJlKCdAYmFiZWwvcnVudGltZS9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgICAgICBhYnNvbHV0ZVJ1bnRpbWU6IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ0BiYWJlbC9ydW50aW1lL3BhY2thZ2UuanNvbicpKSxcbiAgICAgIH0sXG4gICAgXSk7XG4gIH1cblxuICByZXR1cm4geyBwcmVzZXRzLCBwbHVnaW5zIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXF1aXJlc0xpbmtpbmcocGF0aDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAvLyBAYW5ndWxhci9jb3JlIGFuZCBAYW5ndWxhci9jb21waWxlciB3aWxsIGNhdXNlIGZhbHNlIHBvc2l0aXZlc1xuICAvLyBBbHNvLCBUeXBlU2NyaXB0IGZpbGVzIGRvIG5vdCByZXF1aXJlIGxpbmtpbmdcbiAgaWYgKC9bXFxcXC9dQGFuZ3VsYXJbXFxcXC9dKD86Y29tcGlsZXJ8Y29yZSl8XFwudHN4PyQvLnRlc3QocGF0aCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoIW5lZWRzTGlua2luZykge1xuICAgIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICBjb25zdCBsaW5rZXJNb2R1bGUgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXInKT4oXG4gICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlcicsXG4gICAgKTtcbiAgICBuZWVkc0xpbmtpbmcgPSBsaW5rZXJNb2R1bGUubmVlZHNMaW5raW5nO1xuICB9XG5cbiAgcmV0dXJuIG5lZWRzTGlua2luZyhwYXRoLCBzb3VyY2UpO1xufVxuIl19