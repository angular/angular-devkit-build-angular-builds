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
            reporter === null || reporter === void 0 ? void 0 : reporter(type, message);
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
            reporter === null || reporter === void 0 ? void 0 : reporter('info', args.join());
        },
        warn(...args) {
            reporter === null || reporter === void 0 ? void 0 : reporter('warning', args.join());
        },
        error(...args) {
            reporter === null || reporter === void 0 ? void 0 : reporter('error', args.join());
        },
    };
}
function default_1(api, options) {
    var _a, _b;
    const presets = [];
    const plugins = [];
    let needRuntimeTransform = false;
    if ((_a = options.angularLinker) === null || _a === void 0 ? void 0 : _a.shouldLink) {
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
            includePlugins.push('@babel/plugin-proposal-class-properties');
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
                inputSourceMap: (_b = options.instrumentCode.inputSourceMap) !== null && _b !== void 0 ? _b : false,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFTSCxtQ0FBMEM7QUFDMUMsZ0VBQXdDO0FBQ3hDLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7Ozs7OztHQU1HO0FBQ0gsTUFBTSxnQ0FBZ0MsR0FBRyxJQUFJLEdBQUcsQ0FDOUMsSUFBQSxzQkFBWSxFQUFDO0lBQ1gsd0ZBQXdGO0lBQ3hGLG9EQUFvRDtJQUNwRCxhQUFhO0lBQ2IsVUFBVTtDQUNYLENBQUMsQ0FDSCxDQUFDO0FBa0RGLFNBQVMscUJBQXFCLENBQUMsUUFBd0M7SUFDckUsTUFBTSxXQUFXLEdBQWdCLElBQUksQ0FBQztRQUFBO1lBQzNCLGFBQVEsR0FBNEIsRUFBRSxDQUFDO1lBQ2hELGNBQVMsR0FBRyxLQUFLLENBQUM7UUErQnBCLENBQUM7UUE3QkMsR0FBRyxDQUFDLElBQWdDLEVBQUUsT0FBZTtZQUNuRCxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQ3JCLE9BQU87YUFDUjtZQUVELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDLFNBQVMsS0FBZCxJQUFJLENBQUMsU0FBUyxHQUFLLElBQUksS0FBSyxPQUFPLEVBQUM7WUFDcEMsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QixDQUFDO1FBRUQsS0FBSyxDQUFDLE9BQWU7WUFDbkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxD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QU87WUFDbEQ7Z0JBQ0UsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxPQUFPO2dCQUN2RCxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDOUU7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQWxIRCw0QkFrSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZFRyYW5zbGF0aW9uIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUnO1xuaW1wb3J0IHR5cGUge1xuICBEaWFnbm9zdGljSGFuZGxpbmdTdHJhdGVneSxcbiAgRGlhZ25vc3RpY3MsXG4gIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sXG4gIG1ha2VMb2NhbGVQbHVnaW4sXG59IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCB7IHN0cmljdCBhcyBhc3NlcnQgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IGJyb3dzZXJzbGlzdCBmcm9tICdicm93c2Vyc2xpc3QnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBMaXN0IG9mIGJyb3dzZXJzIHdoaWNoIGFyZSBhZmZlY3RlZCBieSBhIFdlYktpdCBidWcgd2hlcmUgY2xhc3MgZmllbGRcbiAqIGluaXRpYWxpemVycyBtaWdodCBoYXZlIGluY29ycmVjdCB2YXJpYWJsZSBzY29wZXMuXG4gKlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1dlYktpdC9XZWJLaXQvY29tbWl0L2U4Nzg4YTM0YjNkNWY1YjRlZGQ3ZmY2NDUwYjgwOTM2YmZmMzk2ZjJcbiAqL1xuY29uc3Qgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnQnJvd3NlcnMgPSBuZXcgU2V0KFxuICBicm93c2Vyc2xpc3QoW1xuICAgIC8vIFNhZmFyaSA8MTUgaXMgdGVjaG5pY2FsbHkgbm90IHN1cHBvcnRlZCB2aWEgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2Jyb3dzZXItc3VwcG9ydCxcbiAgICAvLyBidXQgd2UgYXBwbHkgdGhlIHdvcmthcm91bmQgaWYgZm9yY2libHkgc2VsZWN0ZWQuXG4gICAgJ1NhZmFyaSA8PTE1JyxcbiAgICAnaU9TIDw9MTUnLFxuICBdKSxcbik7XG5cbmV4cG9ydCB0eXBlIERpYWdub3N0aWNSZXBvcnRlciA9ICh0eXBlOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nLCBtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHJlcHJlc2VudGluZyB0aGUgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIEJhYmVsIHBsdWdpbnMuXG4gKiBUaGlzIG11c3QgYmUgcHJvdmlkZWQgZm9yIHRoZSBFU00gaW1wb3J0cyBzaW5jZSBkeW5hbWljIGltcG9ydHMgYXJlIHJlcXVpcmVkIHRvIGJlIGFzeW5jaHJvbm91cyBhbmRcbiAqIEJhYmVsIHByZXNldHMgY3VycmVudGx5IGNhbiBvbmx5IGJlIHN5bmNocm9ub3VzLlxuICpcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuUGx1Z2luQ3JlYXRvcnMge1xuICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luOiB0eXBlb2YgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjtcbiAgbWFrZUxvY2FsZVBsdWdpbjogdHlwZW9mIG1ha2VMb2NhbGVQbHVnaW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zIHtcbiAgaTE4bj86IHtcbiAgICBsb2NhbGU6IHN0cmluZztcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbj86IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+O1xuICAgIHRyYW5zbGF0aW9uRmlsZXM/OiBzdHJpbmdbXTtcbiAgICBwbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzO1xuICB9O1xuXG4gIGFuZ3VsYXJMaW5rZXI/OiB7XG4gICAgc2hvdWxkTGluazogYm9vbGVhbjtcbiAgICBqaXRNb2RlOiBib29sZWFuO1xuICAgIGxpbmtlclBsdWdpbkNyZWF0b3I6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG4gIH07XG5cbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgaW5jbHVkZWRCYXNlUGF0aDogc3RyaW5nO1xuICAgIGlucHV0U291cmNlTWFwOiB1bmtub3duO1xuICB9O1xuICBvcHRpbWl6ZT86IHtcbiAgICBsb29zZUVudW1zOiBib29sZWFuO1xuICAgIHB1cmVUb3BMZXZlbDogYm9vbGVhbjtcbiAgICB3cmFwRGVjb3JhdG9yczogYm9vbGVhbjtcbiAgfTtcblxuICBzdXBwb3J0ZWRCcm93c2Vycz86IHN0cmluZ1tdO1xuICBkaWFnbm9zdGljUmVwb3J0ZXI/OiBEaWFnbm9zdGljUmVwb3J0ZXI7XG59XG5cbi8vIEV4dHJhY3QgTG9nZ2VyIHR5cGUgZnJvbSB0aGUgbGlua2VyIGZ1bmN0aW9uIHRvIGF2b2lkIGRlZXAgaW1wb3J0aW5nIHRvIGFjY2VzcyB0aGUgdHlwZVxudHlwZSBOZ3RzY0xvZ2dlciA9IFBhcmFtZXRlcnM8XG4gIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbj5bMF1bJ2xvZ2dlciddO1xuXG5mdW5jdGlvbiBjcmVhdGVJMThuRGlhZ25vc3RpY3MocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IERpYWdub3N0aWNzIHtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzID0gbmV3IChjbGFzcyB7XG4gICAgcmVhZG9ubHkgbWVzc2FnZXM6IERpYWdub3N0aWNzWydtZXNzYWdlcyddID0gW107XG4gICAgaGFzRXJyb3JzID0gZmFsc2U7XG5cbiAgICBhZGQodHlwZTogRGlhZ25vc3RpY0hhbmRsaW5nU3RyYXRlZ3ksIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgaWYgKHR5cGUgPT09ICdpZ25vcmUnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHsgdHlwZSwgbWVzc2FnZSB9KTtcbiAgICAgIHRoaXMuaGFzRXJyb3JzIHx8PSB0eXBlID09PSAnZXJyb3InO1xuICAgICAgcmVwb3J0ZXI/Lih0eXBlLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBlcnJvcihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHRoaXMuYWRkKCdlcnJvcicsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnd2FybmluZycsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIG1lcmdlKG90aGVyOiBEaWFnbm9zdGljcyk6IHZvaWQge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIG90aGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMuYWRkKGRpYWdub3N0aWMudHlwZSwgZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JtYXREaWFnbm9zdGljcygpOiBuZXZlciB7XG4gICAgICBhc3NlcnQuZmFpbChcbiAgICAgICAgJ0Bhbmd1bGFyL2xvY2FsaXplIERpYWdub3N0aWNzIGZvcm1hdERpYWdub3N0aWNzIHNob3VsZCBub3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGJhYmVsLicsXG4gICAgICApO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+IHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBkaWFnbm9zdGljUmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCxcbiAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyxcbikge1xuICBjb25zdCBkaWFnbm9zdGljcyA9IGNyZWF0ZUkxOG5EaWFnbm9zdGljcyhkaWFnbm9zdGljUmVwb3J0ZXIpO1xuICBjb25zdCBwbHVnaW5zID0gW107XG5cbiAgY29uc3QgeyBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPSBwbHVnaW5DcmVhdG9ycztcblxuICBpZiAodHJhbnNsYXRpb24pIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCB0cmFuc2xhdGlvbiwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIHJldHVybiBwbHVnaW5zO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOZ3RzY0xvZ2dlcihyZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkKTogTmd0c2NMb2dnZXIge1xuICByZXR1cm4ge1xuICAgIGxldmVsOiAxLCAvLyBJbmZvIGxldmVsXG4gICAgZGVidWcoLi4uYXJnczogc3RyaW5nW10pIHt9LFxuICAgIGluZm8oLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2luZm8nLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgICB3YXJuKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCd3YXJuaW5nJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgZXJyb3IoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2Vycm9yJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChhcGk6IHVua25vd24sIG9wdGlvbnM6IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucykge1xuICBjb25zdCBwcmVzZXRzID0gW107XG4gIGNvbnN0IHBsdWdpbnMgPSBbXTtcbiAgbGV0IG5lZWRSdW50aW1lVHJhbnNmb3JtID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMuYW5ndWxhckxpbmtlcj8uc2hvdWxkTGluaykge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG9wdGlvbnMuYW5ndWxhckxpbmtlci5saW5rZXJQbHVnaW5DcmVhdG9yKHtcbiAgICAgICAgbGlua2VySml0TW9kZTogb3B0aW9ucy5hbmd1bGFyTGlua2VyLmppdE1vZGUsXG4gICAgICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzQyNzY5IGlzIGZpeGVkLlxuICAgICAgICBzb3VyY2VNYXBwaW5nOiBmYWxzZSxcbiAgICAgICAgbG9nZ2VyOiBjcmVhdGVOZ3RzY0xvZ2dlcihvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlciksXG4gICAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgICByZXNvbHZlOiBwYXRoLnJlc29sdmUsXG4gICAgICAgICAgZXhpc3RzOiBmcy5leGlzdHNTeW5jLFxuICAgICAgICAgIGRpcm5hbWU6IHBhdGguZGlybmFtZSxcbiAgICAgICAgICByZWxhdGl2ZTogcGF0aC5yZWxhdGl2ZSxcbiAgICAgICAgICByZWFkRmlsZTogZnMucmVhZEZpbGVTeW5jLFxuICAgICAgICAgIC8vIE5vZGUuSlMgdHlwZXMgZG9uJ3Qgb3ZlcmxhcCB0aGUgQ29tcGlsZXIgdHlwZXMuXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgfSBhcyBhbnksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gQXBwbGljYXRpb25zIGNvZGUgRVMgdmVyc2lvbiBjYW4gYmUgY29udHJvbGxlZCB1c2luZyBUeXBlU2NyaXB0J3MgYHRhcmdldGAgb3B0aW9uLlxuICAvLyBIb3dldmVyLCB0aGlzIGRvZXNuJ3QgZWZmZWN0IGxpYnJhcmllcyBhbmQgaGVuY2Ugd2UgdXNlIHByZXNldC1lbnYgdG8gZG93bmxldmVsIEVTIGZlYXR1cmVzXG4gIC8vIGJhc2VkIG9uIHRoZSBzdXBwb3J0ZWQgYnJvd3NlcnMgaW4gYnJvd3NlcnNsaXN0LlxuICBpZiAob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycykge1xuICAgIGNvbnN0IGluY2x1ZGVQbHVnaW5zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gSWYgYSBTYWZhcmkgYnJvd3NlciBhZmZlY3RlZCBieSB0aGUgY2xhc3MgZmllbGQgc2NvcGUgYnVnIGlzIHNlbGVjdGVkLCB3ZVxuICAgIC8vIGRvd25sZXZlbCBjbGFzcyBwcm9wZXJ0aWVzIGJ5IGVuc3VyaW5nIHRoZSBjbGFzcyBwcm9wZXJ0aWVzIEJhYmVsIHBsdWdpblxuICAgIC8vIGlzIGFsd2F5cyBpbmNsdWRlZC0gcmVnYXJkbGVzcyBvZiB0aGUgcHJlc2V0LWVudiB0YXJnZXRzLlxuICAgIGlmIChvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLnNvbWUoKGIpID0+IHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Z0Jyb3dzZXJzLmhhcyhiKSkpIHtcbiAgICAgIGluY2x1ZGVQbHVnaW5zLnB1c2goJ0BiYWJlbC9wbHVnaW4tcHJvcG9zYWwtY2xhc3MtcHJvcGVydGllcycpO1xuICAgIH1cblxuICAgIHByZXNldHMucHVzaChbXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcHJlc2V0LWVudicpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIGJ1Z2ZpeGVzOiB0cnVlLFxuICAgICAgICBtb2R1bGVzOiBmYWxzZSxcbiAgICAgICAgdGFyZ2V0czogb3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgaW5jbHVkZTogaW5jbHVkZVBsdWdpbnMsXG4gICAgICAgIGV4Y2x1ZGU6IFsndHJhbnNmb3JtLXR5cGVvZi1zeW1ib2wnXSxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaTE4bikge1xuICAgIGNvbnN0IHsgbG9jYWxlLCBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciwgcGx1Z2luQ3JlYXRvcnMsIHRyYW5zbGF0aW9uIH0gPSBvcHRpb25zLmkxOG47XG4gICAgY29uc3QgaTE4blBsdWdpbnMgPSBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9uLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgfHwgJ2lnbm9yZScsXG4gICAgICBvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlcixcbiAgICAgIHBsdWdpbkNyZWF0b3JzLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goLi4uaTE4blBsdWdpbnMpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uKSB7XG4gICAgLy8gQWx3YXlzIHRyYW5zZm9ybSBhc3luYy9hd2FpdCB0byBzdXBwb3J0IFpvbmUuanNcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS1hc3luYy10by1nZW5lcmF0b3InKS5kZWZhdWx0LFxuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1hc3luYy1nZW5lcmF0b3ItZnVuY3Rpb25zJykuZGVmYXVsdCxcbiAgICApO1xuICAgIG5lZWRSdW50aW1lVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLm9wdGltaXplKSB7XG4gICAgaWYgKG9wdGlvbnMub3B0aW1pemUucHVyZVRvcExldmVsKSB7XG4gICAgICBwbHVnaW5zLnB1c2gocmVxdWlyZSgnLi4vcGx1Z2lucy9wdXJlLXRvcGxldmVsLWZ1bmN0aW9ucycpLmRlZmF1bHQpO1xuICAgIH1cblxuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvZWxpZGUtYW5ndWxhci1tZXRhZGF0YScpLmRlZmF1bHQsXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXR5cGVzY3JpcHQtZW51bXMnKS5kZWZhdWx0LFxuICAgICAgICB7IGxvb3NlOiBvcHRpb25zLm9wdGltaXplLmxvb3NlRW51bXMgfSxcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzJykuZGVmYXVsdCxcbiAgICAgICAgeyB3cmFwRGVjb3JhdG9yczogb3B0aW9ucy5vcHRpbWl6ZS53cmFwRGVjb3JhdG9ycyB9LFxuICAgICAgXSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaW5zdHJ1bWVudENvZGUpIHtcbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnYmFiZWwtcGx1Z2luLWlzdGFuYnVsJykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgaW5wdXRTb3VyY2VNYXA6IG9wdGlvbnMuaW5zdHJ1bWVudENvZGUuaW5wdXRTb3VyY2VNYXAgPz8gZmFsc2UsXG4gICAgICAgIGN3ZDogb3B0aW9ucy5pbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgfSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmIChuZWVkUnVudGltZVRyYW5zZm9ybSkge1xuICAgIC8vIEJhYmVsIGVxdWl2YWxlbnQgdG8gVHlwZVNjcmlwdCdzIGBpbXBvcnRIZWxwZXJzYCBvcHRpb25cbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tcnVudGltZScpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIHVzZUVTTW9kdWxlczogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbjogcmVxdWlyZSgnQGJhYmVsL3J1bnRpbWUvcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICAgICAgYWJzb2x1dGVSdW50aW1lOiBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcnVudGltZS9wYWNrYWdlLmpzb24nKSksXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgcHJlc2V0cywgcGx1Z2lucyB9O1xufVxuIl19