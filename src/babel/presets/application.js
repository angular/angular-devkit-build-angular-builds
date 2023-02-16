"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const browserslist_1 = __importDefault(require("browserslist"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * List of browsers which are affected by a WebKit bug where class field
 * initializers might have incorrect variable scopes.
 *
 * See: https://github.com/angular/angular-cli/issues/24355#issuecomment-1333477033
 * See: https://github.com/WebKit/WebKit/commit/e8788a34b3d5f5b4edd7ff6450b80936bff396f2
 */
const safariClassFieldScopeBugBrowsers = new Set((0, browserslist_1.default)([
    // Safari <15 is technically not supported via https://angular.io/guide/browser-support,
    // but we apply the workaround if forcibly selected.
    'Safari <=15',
    'iOS <=15',
]));
function createI18nDiagnostics(reporter) {
    const diagnostics = new (class {
        constructor() {
            this.messages = [];
            this.hasErrors = false;
        }
        add(type, message) {
            if (type === 'ignore') {
                return;
            }
            this.messages.push({ type, message });
            this.hasErrors || (this.hasErrors = type === 'error');
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
            assert_1.strict.fail('@angular/localize Diagnostics formatDiagnostics should not be called from within babel.');
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
                resolve: path.resolve,
                exists: fs.existsSync,
                dirname: path.dirname,
                relative: path.relative,
                readFile: fs.readFileSync,
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
        plugins.push(require('../plugins/elide-angular-metadata').default, [
            require('../plugins/adjust-typescript-enums').default,
            { loose: options.optimize.looseEnums },
        ], [
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
                absoluteRuntime: path.dirname(require.resolve('@babel/runtime/package.json')),
            },
        ]);
    }
    return { presets, plugins };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFTSCxtQ0FBMEM7QUFDMUMsZ0VBQXdDO0FBQ3hDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7Ozs7OztHQU1HO0FBQ0gsTUFBTSxnQ0FBZ0MsR0FBRyxJQUFJLEdBQUcsQ0FDOUMsSUFBQSxzQkFBWSxFQUFDO0lBQ1gsd0ZBQXdGO0lBQ3hGLG9EQUFvRDtJQUNwRCxhQUFhO0lBQ2IsVUFBVTtDQUNYLENBQUMsQ0FDSCxDQUFDO0FBa0RGLFNBQVMscUJBQXFCLENBQUMsUUFBd0M7SUFDckUsTUFBTSxXQUFXLEdBQWdCLElBQUksQ0FBQztRQUFBO1lBQzNCLGFBQVEsR0FBNEIsRUFBRSxDQUFDO1lBQ2hELGNBQVMsR0FBRyxLQUFLLENBQUM7UUErQnBCLENBQUM7UUE3QkMsR0FBRyxDQUFDLElBQWdDLEVBQUUsT0FBZTtZQUNuRCxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQ3JCLE9BQU87YUFDUjtZQUVELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDLFNBQVMsS0FBZCxJQUFJLENBQUMsU0FBUyxHQUFLLElBQUksS0FBSyxPQUFPLEVBQUM7WUFDcEMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxLQUFLLENBQUMsT0FBZTtZQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixD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LENBQUMsQ0FBQyxPQUFPO2dCQUN2RCxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDOUU7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQXJIRCw0QkFxSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZFRyYW5zbGF0aW9uIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUnO1xuaW1wb3J0IHR5cGUge1xuICBEaWFnbm9zdGljSGFuZGxpbmdTdHJhdGVneSxcbiAgRGlhZ25vc3RpY3MsXG4gIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sXG4gIG1ha2VMb2NhbGVQbHVnaW4sXG59IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCB7IHN0cmljdCBhcyBhc3NlcnQgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IGJyb3dzZXJzbGlzdCBmcm9tICdicm93c2Vyc2xpc3QnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBMaXN0IG9mIGJyb3dzZXJzIHdoaWNoIGFyZSBhZmZlY3RlZCBieSBhIFdlYktpdCBidWcgd2hlcmUgY2xhc3MgZmllbGRcbiAqIGluaXRpYWxpemVycyBtaWdodCBoYXZlIGluY29ycmVjdCB2YXJpYWJsZSBzY29wZXMuXG4gKlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1dlYktpdC9XZWJLaXQvY29tbWl0L2U4Nzg4YTM0YjNkNWY1YjRlZGQ3ZmY2NDUwYjgwOTM2YmZmMzk2ZjJcbiAqL1xuY29uc3Qgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnQnJvd3NlcnMgPSBuZXcgU2V0KFxuICBicm93c2Vyc2xpc3QoW1xuICAgIC8vIFNhZmFyaSA8MTUgaXMgdGVjaG5pY2FsbHkgbm90IHN1cHBvcnRlZCB2aWEgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2Jyb3dzZXItc3VwcG9ydCxcbiAgICAvLyBidXQgd2UgYXBwbHkgdGhlIHdvcmthcm91bmQgaWYgZm9yY2libHkgc2VsZWN0ZWQuXG4gICAgJ1NhZmFyaSA8PTE1JyxcbiAgICAnaU9TIDw9MTUnLFxuICBdKSxcbik7XG5cbmV4cG9ydCB0eXBlIERpYWdub3N0aWNSZXBvcnRlciA9ICh0eXBlOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nLCBtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHJlcHJlc2VudGluZyB0aGUgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIEJhYmVsIHBsdWdpbnMuXG4gKiBUaGlzIG11c3QgYmUgcHJvdmlkZWQgZm9yIHRoZSBFU00gaW1wb3J0cyBzaW5jZSBkeW5hbWljIGltcG9ydHMgYXJlIHJlcXVpcmVkIHRvIGJlIGFzeW5jaHJvbm91cyBhbmRcbiAqIEJhYmVsIHByZXNldHMgY3VycmVudGx5IGNhbiBvbmx5IGJlIHN5bmNocm9ub3VzLlxuICpcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuUGx1Z2luQ3JlYXRvcnMge1xuICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luOiB0eXBlb2YgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjtcbiAgbWFrZUxvY2FsZVBsdWdpbjogdHlwZW9mIG1ha2VMb2NhbGVQbHVnaW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zIHtcbiAgaTE4bj86IHtcbiAgICBsb2NhbGU6IHN0cmluZztcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbj86IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+O1xuICAgIHRyYW5zbGF0aW9uRmlsZXM/OiBzdHJpbmdbXTtcbiAgICBwbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzO1xuICB9O1xuXG4gIGFuZ3VsYXJMaW5rZXI/OiB7XG4gICAgc2hvdWxkTGluazogYm9vbGVhbjtcbiAgICBqaXRNb2RlOiBib29sZWFuO1xuICAgIGxpbmtlclBsdWdpbkNyZWF0b3I6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG4gIH07XG5cbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgaW5jbHVkZWRCYXNlUGF0aDogc3RyaW5nO1xuICAgIGlucHV0U291cmNlTWFwOiB1bmtub3duO1xuICB9O1xuICBvcHRpbWl6ZT86IHtcbiAgICBsb29zZUVudW1zOiBib29sZWFuO1xuICAgIHB1cmVUb3BMZXZlbDogYm9vbGVhbjtcbiAgICB3cmFwRGVjb3JhdG9yczogYm9vbGVhbjtcbiAgfTtcblxuICBzdXBwb3J0ZWRCcm93c2Vycz86IHN0cmluZ1tdO1xuICBkaWFnbm9zdGljUmVwb3J0ZXI/OiBEaWFnbm9zdGljUmVwb3J0ZXI7XG59XG5cbi8vIEV4dHJhY3QgTG9nZ2VyIHR5cGUgZnJvbSB0aGUgbGlua2VyIGZ1bmN0aW9uIHRvIGF2b2lkIGRlZXAgaW1wb3J0aW5nIHRvIGFjY2VzcyB0aGUgdHlwZVxudHlwZSBOZ3RzY0xvZ2dlciA9IFBhcmFtZXRlcnM8XG4gIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbj5bMF1bJ2xvZ2dlciddO1xuXG5mdW5jdGlvbiBjcmVhdGVJMThuRGlhZ25vc3RpY3MocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IERpYWdub3N0aWNzIHtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzID0gbmV3IChjbGFzcyB7XG4gICAgcmVhZG9ubHkgbWVzc2FnZXM6IERpYWdub3N0aWNzWydtZXNzYWdlcyddID0gW107XG4gICAgaGFzRXJyb3JzID0gZmFsc2U7XG5cbiAgICBhZGQodHlwZTogRGlhZ25vc3RpY0hhbmRsaW5nU3RyYXRlZ3ksIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgaWYgKHR5cGUgPT09ICdpZ25vcmUnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHsgdHlwZSwgbWVzc2FnZSB9KTtcbiAgICAgIHRoaXMuaGFzRXJyb3JzIHx8PSB0eXBlID09PSAnZXJyb3InO1xuICAgICAgcmVwb3J0ZXI/Lih0eXBlLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBlcnJvcihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHRoaXMuYWRkKCdlcnJvcicsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnd2FybmluZycsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIG1lcmdlKG90aGVyOiBEaWFnbm9zdGljcyk6IHZvaWQge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIG90aGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMuYWRkKGRpYWdub3N0aWMudHlwZSwgZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JtYXREaWFnbm9zdGljcygpOiBuZXZlciB7XG4gICAgICBhc3NlcnQuZmFpbChcbiAgICAgICAgJ0Bhbmd1bGFyL2xvY2FsaXplIERpYWdub3N0aWNzIGZvcm1hdERpYWdub3N0aWNzIHNob3VsZCBub3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGJhYmVsLicsXG4gICAgICApO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+IHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBkaWFnbm9zdGljUmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCxcbiAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyxcbikge1xuICBjb25zdCBkaWFnbm9zdGljcyA9IGNyZWF0ZUkxOG5EaWFnbm9zdGljcyhkaWFnbm9zdGljUmVwb3J0ZXIpO1xuICBjb25zdCBwbHVnaW5zID0gW107XG5cbiAgY29uc3QgeyBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPSBwbHVnaW5DcmVhdG9ycztcblxuICBpZiAodHJhbnNsYXRpb24pIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCB0cmFuc2xhdGlvbiwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIHJldHVybiBwbHVnaW5zO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOZ3RzY0xvZ2dlcihyZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkKTogTmd0c2NMb2dnZXIge1xuICByZXR1cm4ge1xuICAgIGxldmVsOiAxLCAvLyBJbmZvIGxldmVsXG4gICAgZGVidWcoLi4uYXJnczogc3RyaW5nW10pIHt9LFxuICAgIGluZm8oLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2luZm8nLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgICB3YXJuKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCd3YXJuaW5nJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgZXJyb3IoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2Vycm9yJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChhcGk6IHVua25vd24sIG9wdGlvbnM6IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucykge1xuICBjb25zdCBwcmVzZXRzID0gW107XG4gIGNvbnN0IHBsdWdpbnMgPSBbXTtcbiAgbGV0IG5lZWRSdW50aW1lVHJhbnNmb3JtID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMuYW5ndWxhckxpbmtlcj8uc2hvdWxkTGluaykge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG9wdGlvbnMuYW5ndWxhckxpbmtlci5saW5rZXJQbHVnaW5DcmVhdG9yKHtcbiAgICAgICAgbGlua2VySml0TW9kZTogb3B0aW9ucy5hbmd1bGFyTGlua2VyLmppdE1vZGUsXG4gICAgICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzQyNzY5IGlzIGZpeGVkLlxuICAgICAgICBzb3VyY2VNYXBwaW5nOiBmYWxzZSxcbiAgICAgICAgbG9nZ2VyOiBjcmVhdGVOZ3RzY0xvZ2dlcihvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlciksXG4gICAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgICByZXNvbHZlOiBwYXRoLnJlc29sdmUsXG4gICAgICAgICAgZXhpc3RzOiBmcy5leGlzdHNTeW5jLFxuICAgICAgICAgIGRpcm5hbWU6IHBhdGguZGlybmFtZSxcbiAgICAgICAgICByZWxhdGl2ZTogcGF0aC5yZWxhdGl2ZSxcbiAgICAgICAgICByZWFkRmlsZTogZnMucmVhZEZpbGVTeW5jLFxuICAgICAgICAgIC8vIE5vZGUuSlMgdHlwZXMgZG9uJ3Qgb3ZlcmxhcCB0aGUgQ29tcGlsZXIgdHlwZXMuXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgfSBhcyBhbnksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gQXBwbGljYXRpb25zIGNvZGUgRVMgdmVyc2lvbiBjYW4gYmUgY29udHJvbGxlZCB1c2luZyBUeXBlU2NyaXB0J3MgYHRhcmdldGAgb3B0aW9uLlxuICAvLyBIb3dldmVyLCB0aGlzIGRvZXNuJ3QgZWZmZWN0IGxpYnJhcmllcyBhbmQgaGVuY2Ugd2UgdXNlIHByZXNldC1lbnYgdG8gZG93bmxldmVsIEVTIGZlYXR1cmVzXG4gIC8vIGJhc2VkIG9uIHRoZSBzdXBwb3J0ZWQgYnJvd3NlcnMgaW4gYnJvd3NlcnNsaXN0LlxuICBpZiAob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycykge1xuICAgIGNvbnN0IGluY2x1ZGVQbHVnaW5zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gSWYgYSBTYWZhcmkgYnJvd3NlciBhZmZlY3RlZCBieSB0aGUgY2xhc3MgZmllbGQgc2NvcGUgYnVnIGlzIHNlbGVjdGVkLCB3ZVxuICAgIC8vIGRvd25sZXZlbCBjbGFzcyBwcm9wZXJ0aWVzIGJ5IGVuc3VyaW5nIHRoZSBjbGFzcyBwcm9wZXJ0aWVzIEJhYmVsIHBsdWdpblxuICAgIC8vIGlzIGFsd2F5cyBpbmNsdWRlZC0gcmVnYXJkbGVzcyBvZiB0aGUgcHJlc2V0LWVudiB0YXJnZXRzLlxuICAgIGlmIChvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLnNvbWUoKGIpID0+IHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Z0Jyb3dzZXJzLmhhcyhiKSkpIHtcbiAgICAgIGluY2x1ZGVQbHVnaW5zLnB1c2goXG4gICAgICAgICdAYmFiZWwvcGx1Z2luLXByb3Bvc2FsLWNsYXNzLXByb3BlcnRpZXMnLFxuICAgICAgICAnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1wcml2YXRlLW1ldGhvZHMnLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBwcmVzZXRzLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3ByZXNldC1lbnYnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgbW9kdWxlczogZmFsc2UsXG4gICAgICAgIHRhcmdldHM6IG9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIGluY2x1ZGU6IGluY2x1ZGVQbHVnaW5zLFxuICAgICAgICBleGNsdWRlOiBbJ3RyYW5zZm9ybS10eXBlb2Ytc3ltYm9sJ10sXG4gICAgICB9LFxuICAgIF0pO1xuICAgIG5lZWRSdW50aW1lVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmkxOG4pIHtcbiAgICBjb25zdCB7IGxvY2FsZSwgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsIHBsdWdpbkNyZWF0b3JzLCB0cmFuc2xhdGlvbiB9ID0gb3B0aW9ucy5pMThuO1xuICAgIGNvbnN0IGkxOG5QbHVnaW5zID0gY3JlYXRlSTE4blBsdWdpbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICB0cmFuc2xhdGlvbixcbiAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yIHx8ICdpZ25vcmUnLFxuICAgICAgb3B0aW9ucy5kaWFnbm9zdGljUmVwb3J0ZXIsXG4gICAgICBwbHVnaW5DcmVhdG9ycyxcbiAgICApO1xuXG4gICAgcGx1Z2lucy5wdXNoKC4uLmkxOG5QbHVnaW5zKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbikge1xuICAgIC8vIEFsd2F5cyB0cmFuc2Zvcm0gYXN5bmMvYXdhaXQgdG8gc3VwcG9ydCBab25lLmpzXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tYXN5bmMtdG8tZ2VuZXJhdG9yJykuZGVmYXVsdCxcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tcHJvcG9zYWwtYXN5bmMtZ2VuZXJhdG9yLWZ1bmN0aW9ucycpLmRlZmF1bHQsXG4gICAgKTtcbiAgICBuZWVkUnVudGltZVRyYW5zZm9ybSA9IHRydWU7XG4gIH1cblxuICBpZiAob3B0aW9ucy5vcHRpbWl6ZSkge1xuICAgIGlmIChvcHRpb25zLm9wdGltaXplLnB1cmVUb3BMZXZlbCkge1xuICAgICAgcGx1Z2lucy5wdXNoKHJlcXVpcmUoJy4uL3BsdWdpbnMvcHVyZS10b3BsZXZlbC1mdW5jdGlvbnMnKS5kZWZhdWx0KTtcbiAgICB9XG5cbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2VsaWRlLWFuZ3VsYXItbWV0YWRhdGEnKS5kZWZhdWx0LFxuICAgICAgW1xuICAgICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2FkanVzdC10eXBlc2NyaXB0LWVudW1zJykuZGVmYXVsdCxcbiAgICAgICAgeyBsb29zZTogb3B0aW9ucy5vcHRpbWl6ZS5sb29zZUVudW1zIH0sXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2FkanVzdC1zdGF0aWMtY2xhc3MtbWVtYmVycycpLmRlZmF1bHQsXG4gICAgICAgIHsgd3JhcERlY29yYXRvcnM6IG9wdGlvbnMub3B0aW1pemUud3JhcERlY29yYXRvcnMgfSxcbiAgICAgIF0sXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmluc3RydW1lbnRDb2RlKSB7XG4gICAgcGx1Z2lucy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ2JhYmVsLXBsdWdpbi1pc3RhbmJ1bCcpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIGlucHV0U291cmNlTWFwOiBvcHRpb25zLmluc3RydW1lbnRDb2RlLmlucHV0U291cmNlTWFwID8/IGZhbHNlLFxuICAgICAgICBjd2Q6IG9wdGlvbnMuaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aCxcbiAgICAgIH0sXG4gICAgXSk7XG4gIH1cblxuICBpZiAobmVlZFJ1bnRpbWVUcmFuc2Zvcm0pIHtcbiAgICAvLyBCYWJlbCBlcXVpdmFsZW50IHRvIFR5cGVTY3JpcHQncyBgaW1wb3J0SGVscGVyc2Agb3B0aW9uXG4gICAgcGx1Z2lucy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tdHJhbnNmb3JtLXJ1bnRpbWUnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICB1c2VFU01vZHVsZXM6IHRydWUsXG4gICAgICAgIHZlcnNpb246IHJlcXVpcmUoJ0BiYWJlbC9ydW50aW1lL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXG4gICAgICAgIGFic29sdXRlUnVudGltZTogcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgnQGJhYmVsL3J1bnRpbWUvcGFja2FnZS5qc29uJykpLFxuICAgICAgfSxcbiAgICBdKTtcbiAgfVxuXG4gIHJldHVybiB7IHByZXNldHMsIHBsdWdpbnMgfTtcbn1cbiJdfQ==