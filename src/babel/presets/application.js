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
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
    if (options.forcePresetEnv) {
        presets.push([
            require('@babel/preset-env').default,
            {
                bugfixes: true,
                modules: false,
                targets: options.supportedBrowsers,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFTSCxtQ0FBMEM7QUFDMUMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQW1EN0IsU0FBUyxxQkFBcUIsQ0FBQyxRQUF3QztJQUNyRSxNQUFNLFdBQVcsR0FBZ0IsSUFBSSxDQUFDO1FBQUE7WUFDM0IsYUFBUSxHQUE0QixFQUFFLENBQUM7WUFDaEQsY0FBUyxHQUFHLEtBQUssQ0FBQztRQStCcEIsQ0FBQztRQTdCQyxHQUFHLENBQUMsSUFBZ0MsRUFBRSxPQUFlO1lBQ25ELElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDckIsT0FBTzthQUNSO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsU0FBUyxLQUFkLElBQUksQ0FBQyxTQUFTLEdBQUssSUFBSSxLQUFLLE9BQU8sRUFBQztZQUNwQyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxLQUFLLENBQUMsT0FBZTtZQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQWU7WUFDbEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFrQjtZQUN0QixLQUFLLE1BQU0sVUFBVSxJQUFJLEtB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USxDQUFDLFVBQVUsRUFBRTtTQUN2QyxFQUNEO1lBQ0UsT0FBTyxDQUFDLHdDQUF3QyxDQUFDLENBQUMsT0FBTztZQUN6RCxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRTtTQUNwRCxDQUNGLENBQUM7S0FDSDtJQUVELElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRTtRQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ1gsT0FBTyxDQUFDLHVCQUF1QixDQUFDLENBQUMsT0FBTztZQUN4QztnQkFDRSxjQUFjLEVBQUUsTUFBQSxPQUFPLENBQUMsY0FBYyxDQUFDLGNBQWMsbUNBQUksS0FBSztnQkFDOUQsR0FBRyxFQUFFLE9BQU8sQ0FBQyxjQUFjLENBQUMsZ0JBQWdCO2FBQzdDO1NBQ0YsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLG9CQUFvQixFQUFFO1FBQ3hCLDBEQUEwRDtRQUMxRCxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ1gsT0FBTyxDQUFDLGlDQUFpQyxDQUFDLENBQUMsT0FBTztZQUNsRDtnQkFDRSxZQUFZLEVBQUUsSUFBSTtnQkFDbEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLE9BQU87Z0JBQ3ZELGVBQWUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsNkJBQTZCLENBQUMsQ0FBQzthQUM5RTtTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUM5QixDQUFDO0FBckdELDRCQXFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IMm1UGFyc2VkVHJhbnNsYXRpb24gfSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZSc7XG5pbXBvcnQgdHlwZSB7XG4gIERpYWdub3N0aWNIYW5kbGluZ1N0cmF0ZWd5LFxuICBEaWFnbm9zdGljcyxcbiAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbixcbiAgbWFrZUxvY2FsZVBsdWdpbixcbn0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnO1xuaW1wb3J0IHsgc3RyaWN0IGFzIGFzc2VydCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgdHlwZSBEaWFnbm9zdGljUmVwb3J0ZXIgPSAodHlwZTogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJywgbWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkO1xuXG4vKipcbiAqIEFuIGludGVyZmFjZSByZXByZXNlbnRpbmcgdGhlIGZhY3RvcnkgZnVuY3Rpb25zIGZvciB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCB0cmFuc2xhdGlvbiBCYWJlbCBwbHVnaW5zLlxuICogVGhpcyBtdXN0IGJlIHByb3ZpZGVkIGZvciB0aGUgRVNNIGltcG9ydHMgc2luY2UgZHluYW1pYyBpbXBvcnRzIGFyZSByZXF1aXJlZCB0byBiZSBhc3luY2hyb25vdXMgYW5kXG4gKiBCYWJlbCBwcmVzZXRzIGN1cnJlbnRseSBjYW4gb25seSBiZSBzeW5jaHJvbm91cy5cbiAqXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4blBsdWdpbkNyZWF0b3JzIHtcbiAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjogdHlwZW9mIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW47XG4gIG1ha2VMb2NhbGVQbHVnaW46IHR5cGVvZiBtYWtlTG9jYWxlUGx1Z2luO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucyB7XG4gIGkxOG4/OiB7XG4gICAgbG9jYWxlOiBzdHJpbmc7XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3I/OiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZSc7XG4gICAgdHJhbnNsYXRpb24/OiBSZWNvcmQ8c3RyaW5nLCDJtVBhcnNlZFRyYW5zbGF0aW9uPjtcbiAgICB0cmFuc2xhdGlvbkZpbGVzPzogc3RyaW5nW107XG4gICAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycztcbiAgfTtcblxuICBhbmd1bGFyTGlua2VyPzoge1xuICAgIHNob3VsZExpbms6IGJvb2xlYW47XG4gICAgaml0TW9kZTogYm9vbGVhbjtcbiAgICBsaW5rZXJQbHVnaW5DcmVhdG9yOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luO1xuICB9O1xuXG4gIGZvcmNlUHJlc2V0RW52PzogYm9vbGVhbjtcbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgaW5jbHVkZWRCYXNlUGF0aDogc3RyaW5nO1xuICAgIGlucHV0U291cmNlTWFwOiB1bmtub3duO1xuICB9O1xuICBvcHRpbWl6ZT86IHtcbiAgICBsb29zZUVudW1zOiBib29sZWFuO1xuICAgIHB1cmVUb3BMZXZlbDogYm9vbGVhbjtcbiAgICB3cmFwRGVjb3JhdG9yczogYm9vbGVhbjtcbiAgfTtcblxuICBzdXBwb3J0ZWRCcm93c2Vycz86IHN0cmluZ1tdO1xuICBkaWFnbm9zdGljUmVwb3J0ZXI/OiBEaWFnbm9zdGljUmVwb3J0ZXI7XG59XG5cbi8vIEV4dHJhY3QgTG9nZ2VyIHR5cGUgZnJvbSB0aGUgbGlua2VyIGZ1bmN0aW9uIHRvIGF2b2lkIGRlZXAgaW1wb3J0aW5nIHRvIGFjY2VzcyB0aGUgdHlwZVxudHlwZSBOZ3RzY0xvZ2dlciA9IFBhcmFtZXRlcnM8XG4gIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbj5bMF1bJ2xvZ2dlciddO1xuXG5mdW5jdGlvbiBjcmVhdGVJMThuRGlhZ25vc3RpY3MocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IERpYWdub3N0aWNzIHtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzID0gbmV3IChjbGFzcyB7XG4gICAgcmVhZG9ubHkgbWVzc2FnZXM6IERpYWdub3N0aWNzWydtZXNzYWdlcyddID0gW107XG4gICAgaGFzRXJyb3JzID0gZmFsc2U7XG5cbiAgICBhZGQodHlwZTogRGlhZ25vc3RpY0hhbmRsaW5nU3RyYXRlZ3ksIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgaWYgKHR5cGUgPT09ICdpZ25vcmUnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHsgdHlwZSwgbWVzc2FnZSB9KTtcbiAgICAgIHRoaXMuaGFzRXJyb3JzIHx8PSB0eXBlID09PSAnZXJyb3InO1xuICAgICAgcmVwb3J0ZXI/Lih0eXBlLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBlcnJvcihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHRoaXMuYWRkKCdlcnJvcicsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnd2FybmluZycsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIG1lcmdlKG90aGVyOiBEaWFnbm9zdGljcyk6IHZvaWQge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIG90aGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMuYWRkKGRpYWdub3N0aWMudHlwZSwgZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JtYXREaWFnbm9zdGljcygpOiBuZXZlciB7XG4gICAgICBhc3NlcnQuZmFpbChcbiAgICAgICAgJ0Bhbmd1bGFyL2xvY2FsaXplIERpYWdub3N0aWNzIGZvcm1hdERpYWdub3N0aWNzIHNob3VsZCBub3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGJhYmVsLicsXG4gICAgICApO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+IHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBkaWFnbm9zdGljUmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCxcbiAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyxcbikge1xuICBjb25zdCBkaWFnbm9zdGljcyA9IGNyZWF0ZUkxOG5EaWFnbm9zdGljcyhkaWFnbm9zdGljUmVwb3J0ZXIpO1xuICBjb25zdCBwbHVnaW5zID0gW107XG5cbiAgY29uc3QgeyBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPSBwbHVnaW5DcmVhdG9ycztcblxuICBpZiAodHJhbnNsYXRpb24pIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCB0cmFuc2xhdGlvbiwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIHJldHVybiBwbHVnaW5zO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOZ3RzY0xvZ2dlcihyZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkKTogTmd0c2NMb2dnZXIge1xuICByZXR1cm4ge1xuICAgIGxldmVsOiAxLCAvLyBJbmZvIGxldmVsXG4gICAgZGVidWcoLi4uYXJnczogc3RyaW5nW10pIHt9LFxuICAgIGluZm8oLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2luZm8nLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgICB3YXJuKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCd3YXJuaW5nJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgZXJyb3IoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2Vycm9yJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChhcGk6IHVua25vd24sIG9wdGlvbnM6IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucykge1xuICBjb25zdCBwcmVzZXRzID0gW107XG4gIGNvbnN0IHBsdWdpbnMgPSBbXTtcbiAgbGV0IG5lZWRSdW50aW1lVHJhbnNmb3JtID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMuYW5ndWxhckxpbmtlcj8uc2hvdWxkTGluaykge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG9wdGlvbnMuYW5ndWxhckxpbmtlci5saW5rZXJQbHVnaW5DcmVhdG9yKHtcbiAgICAgICAgbGlua2VySml0TW9kZTogb3B0aW9ucy5hbmd1bGFyTGlua2VyLmppdE1vZGUsXG4gICAgICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzQyNzY5IGlzIGZpeGVkLlxuICAgICAgICBzb3VyY2VNYXBwaW5nOiBmYWxzZSxcbiAgICAgICAgbG9nZ2VyOiBjcmVhdGVOZ3RzY0xvZ2dlcihvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlciksXG4gICAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgICByZXNvbHZlOiBwYXRoLnJlc29sdmUsXG4gICAgICAgICAgZXhpc3RzOiBmcy5leGlzdHNTeW5jLFxuICAgICAgICAgIGRpcm5hbWU6IHBhdGguZGlybmFtZSxcbiAgICAgICAgICByZWxhdGl2ZTogcGF0aC5yZWxhdGl2ZSxcbiAgICAgICAgICByZWFkRmlsZTogZnMucmVhZEZpbGVTeW5jLFxuICAgICAgICAgIC8vIE5vZGUuSlMgdHlwZXMgZG9uJ3Qgb3ZlcmxhcCB0aGUgQ29tcGlsZXIgdHlwZXMuXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgfSBhcyBhbnksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZm9yY2VQcmVzZXRFbnYpIHtcbiAgICBwcmVzZXRzLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3ByZXNldC1lbnYnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgbW9kdWxlczogZmFsc2UsXG4gICAgICAgIHRhcmdldHM6IG9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIGV4Y2x1ZGU6IFsndHJhbnNmb3JtLXR5cGVvZi1zeW1ib2wnXSxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaTE4bikge1xuICAgIGNvbnN0IHsgbG9jYWxlLCBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciwgcGx1Z2luQ3JlYXRvcnMsIHRyYW5zbGF0aW9uIH0gPSBvcHRpb25zLmkxOG47XG4gICAgY29uc3QgaTE4blBsdWdpbnMgPSBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9uLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgfHwgJ2lnbm9yZScsXG4gICAgICBvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlcixcbiAgICAgIHBsdWdpbkNyZWF0b3JzLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goLi4uaTE4blBsdWdpbnMpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uKSB7XG4gICAgLy8gQWx3YXlzIHRyYW5zZm9ybSBhc3luYy9hd2FpdCB0byBzdXBwb3J0IFpvbmUuanNcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS1hc3luYy10by1nZW5lcmF0b3InKS5kZWZhdWx0LFxuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1hc3luYy1nZW5lcmF0b3ItZnVuY3Rpb25zJykuZGVmYXVsdCxcbiAgICApO1xuICAgIG5lZWRSdW50aW1lVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLm9wdGltaXplKSB7XG4gICAgaWYgKG9wdGlvbnMub3B0aW1pemUucHVyZVRvcExldmVsKSB7XG4gICAgICBwbHVnaW5zLnB1c2gocmVxdWlyZSgnLi4vcGx1Z2lucy9wdXJlLXRvcGxldmVsLWZ1bmN0aW9ucycpLmRlZmF1bHQpO1xuICAgIH1cblxuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvZWxpZGUtYW5ndWxhci1tZXRhZGF0YScpLmRlZmF1bHQsXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXR5cGVzY3JpcHQtZW51bXMnKS5kZWZhdWx0LFxuICAgICAgICB7IGxvb3NlOiBvcHRpb25zLm9wdGltaXplLmxvb3NlRW51bXMgfSxcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzJykuZGVmYXVsdCxcbiAgICAgICAgeyB3cmFwRGVjb3JhdG9yczogb3B0aW9ucy5vcHRpbWl6ZS53cmFwRGVjb3JhdG9ycyB9LFxuICAgICAgXSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaW5zdHJ1bWVudENvZGUpIHtcbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnYmFiZWwtcGx1Z2luLWlzdGFuYnVsJykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgaW5wdXRTb3VyY2VNYXA6IG9wdGlvbnMuaW5zdHJ1bWVudENvZGUuaW5wdXRTb3VyY2VNYXAgPz8gZmFsc2UsXG4gICAgICAgIGN3ZDogb3B0aW9ucy5pbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgfSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmIChuZWVkUnVudGltZVRyYW5zZm9ybSkge1xuICAgIC8vIEJhYmVsIGVxdWl2YWxlbnQgdG8gVHlwZVNjcmlwdCdzIGBpbXBvcnRIZWxwZXJzYCBvcHRpb25cbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tcnVudGltZScpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIHVzZUVTTW9kdWxlczogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbjogcmVxdWlyZSgnQGJhYmVsL3J1bnRpbWUvcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICAgICAgYWJzb2x1dGVSdW50aW1lOiBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcnVudGltZS9wYWNrYWdlLmpzb24nKSksXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgcHJlc2V0cywgcGx1Z2lucyB9O1xufVxuIl19