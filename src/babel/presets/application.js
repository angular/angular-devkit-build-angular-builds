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
    const { makeEs5TranslatePlugin, makeEs2015TranslatePlugin, makeLocalePlugin } = pluginCreators;
    if (translation) {
        plugins.push(makeEs2015TranslatePlugin(diagnostics, translation, {
            missingTranslation: missingTranslationBehavior,
        }));
        plugins.push(makeEs5TranslatePlugin(diagnostics, translation, {
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
    if (options.forceES5) {
        presets.push([
            require('@babel/preset-env').default,
            {
                bugfixes: true,
                modules: false,
                // Comparable behavior to tsconfig target of ES5
                targets: { ie: 9 },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFVSCxtQ0FBMEM7QUFDMUMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQW1EN0IsU0FBUyxxQkFBcUIsQ0FBQyxRQUF3QztJQUNyRSxNQUFNLFdBQVcsR0FBZ0IsSUFBSSxDQUFDO1FBQUE7WUFDM0IsYUFBUSxHQUE0QixFQUFFLENBQUM7WUFDaEQsY0FBUyxHQUFHLEtBQUssQ0FBQztRQStCcEIsQ0FBQztRQTdCQyxHQUFHLENBQUMsSUFBZ0MsRUFBRSxPQUFlO1lBQ25ELElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDckIsT0FBTzthQUNSO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsU0FBUyxLQUFkLElBQUksQ0FBQyxTQUFTLEdBQUssSUFBSSxLQUFLLE9BQU8sRUFBQztZQUNwQyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxLQUFLLENBQUMsT0FBZTtZQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQWU7WUFDbEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFrQjtZQUN0QixLQUFLLE1BQU0sVUFBVSxJQUFJLEtB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QWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgybVQYXJzZWRUcmFuc2xhdGlvbiB9IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplJztcbmltcG9ydCB0eXBlIHtcbiAgRGlhZ25vc3RpY0hhbmRsaW5nU3RyYXRlZ3ksXG4gIERpYWdub3N0aWNzLFxuICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLFxuICBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luLFxuICBtYWtlTG9jYWxlUGx1Z2luLFxufSBmcm9tICdAYW5ndWxhci9sb2NhbGl6ZS90b29scyc7XG5pbXBvcnQgeyBzdHJpY3QgYXMgYXNzZXJ0IH0gZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCB0eXBlIERpYWdub3N0aWNSZXBvcnRlciA9ICh0eXBlOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nLCBtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHJlcHJlc2VudGluZyB0aGUgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHRyYW5zbGF0aW9uIEJhYmVsIHBsdWdpbnMuXG4gKiBUaGlzIG11c3QgYmUgcHJvdmlkZWQgZm9yIHRoZSBFU00gaW1wb3J0cyBzaW5jZSBkeW5hbWljIGltcG9ydHMgYXJlIHJlcXVpcmVkIHRvIGJlIGFzeW5jaHJvbm91cyBhbmRcbiAqIEJhYmVsIHByZXNldHMgY3VycmVudGx5IGNhbiBvbmx5IGJlIHN5bmNocm9ub3VzLlxuICpcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJMThuUGx1Z2luQ3JlYXRvcnMge1xuICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luOiB0eXBlb2YgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjtcbiAgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbjogdHlwZW9mIG1ha2VFczVUcmFuc2xhdGVQbHVnaW47XG4gIG1ha2VMb2NhbGVQbHVnaW46IHR5cGVvZiBtYWtlTG9jYWxlUGx1Z2luO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucyB7XG4gIGkxOG4/OiB7XG4gICAgbG9jYWxlOiBzdHJpbmc7XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3I/OiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZSc7XG4gICAgdHJhbnNsYXRpb24/OiBSZWNvcmQ8c3RyaW5nLCDJtVBhcnNlZFRyYW5zbGF0aW9uPjtcbiAgICB0cmFuc2xhdGlvbkZpbGVzPzogc3RyaW5nW107XG4gICAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycztcbiAgfTtcblxuICBhbmd1bGFyTGlua2VyPzoge1xuICAgIHNob3VsZExpbms6IGJvb2xlYW47XG4gICAgaml0TW9kZTogYm9vbGVhbjtcbiAgICBsaW5rZXJQbHVnaW5DcmVhdG9yOiB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luO1xuICB9O1xuXG4gIGZvcmNlRVM1PzogYm9vbGVhbjtcbiAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uPzogYm9vbGVhbjtcbiAgaW5zdHJ1bWVudENvZGU/OiB7XG4gICAgaW5jbHVkZWRCYXNlUGF0aDogc3RyaW5nO1xuICAgIGlucHV0U291cmNlTWFwOiB1bmtub3duO1xuICB9O1xuICBvcHRpbWl6ZT86IHtcbiAgICBsb29zZUVudW1zOiBib29sZWFuO1xuICAgIHB1cmVUb3BMZXZlbDogYm9vbGVhbjtcbiAgICB3cmFwRGVjb3JhdG9yczogYm9vbGVhbjtcbiAgfTtcblxuICBkaWFnbm9zdGljUmVwb3J0ZXI/OiBEaWFnbm9zdGljUmVwb3J0ZXI7XG59XG5cbi8vIEV4dHJhY3QgTG9nZ2VyIHR5cGUgZnJvbSB0aGUgbGlua2VyIGZ1bmN0aW9uIHRvIGF2b2lkIGRlZXAgaW1wb3J0aW5nIHRvIGFjY2VzcyB0aGUgdHlwZVxudHlwZSBOZ3RzY0xvZ2dlciA9IFBhcmFtZXRlcnM8XG4gIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbj5bMF1bJ2xvZ2dlciddO1xuXG5mdW5jdGlvbiBjcmVhdGVJMThuRGlhZ25vc3RpY3MocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IERpYWdub3N0aWNzIHtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzID0gbmV3IChjbGFzcyB7XG4gICAgcmVhZG9ubHkgbWVzc2FnZXM6IERpYWdub3N0aWNzWydtZXNzYWdlcyddID0gW107XG4gICAgaGFzRXJyb3JzID0gZmFsc2U7XG5cbiAgICBhZGQodHlwZTogRGlhZ25vc3RpY0hhbmRsaW5nU3RyYXRlZ3ksIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgaWYgKHR5cGUgPT09ICdpZ25vcmUnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHsgdHlwZSwgbWVzc2FnZSB9KTtcbiAgICAgIHRoaXMuaGFzRXJyb3JzIHx8PSB0eXBlID09PSAnZXJyb3InO1xuICAgICAgcmVwb3J0ZXI/Lih0eXBlLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBlcnJvcihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHRoaXMuYWRkKCdlcnJvcicsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnd2FybmluZycsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIG1lcmdlKG90aGVyOiBEaWFnbm9zdGljcyk6IHZvaWQge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIG90aGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMuYWRkKGRpYWdub3N0aWMudHlwZSwgZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JtYXREaWFnbm9zdGljcygpOiBuZXZlciB7XG4gICAgICBhc3NlcnQuZmFpbChcbiAgICAgICAgJ0Bhbmd1bGFyL2xvY2FsaXplIERpYWdub3N0aWNzIGZvcm1hdERpYWdub3N0aWNzIHNob3VsZCBub3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGJhYmVsLicsXG4gICAgICApO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5QbHVnaW5zKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgdHJhbnNsYXRpb246IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+IHwgdW5kZWZpbmVkLFxuICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnLFxuICBkaWFnbm9zdGljUmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCxcbiAgcGx1Z2luQ3JlYXRvcnM6IEkxOG5QbHVnaW5DcmVhdG9ycyxcbikge1xuICBjb25zdCBkaWFnbm9zdGljcyA9IGNyZWF0ZUkxOG5EaWFnbm9zdGljcyhkaWFnbm9zdGljUmVwb3J0ZXIpO1xuICBjb25zdCBwbHVnaW5zID0gW107XG5cbiAgY29uc3QgeyBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luLCBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luLCBtYWtlTG9jYWxlUGx1Z2luIH0gPSBwbHVnaW5DcmVhdG9ycztcblxuICBpZiAodHJhbnNsYXRpb24pIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCB0cmFuc2xhdGlvbiwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4oZGlhZ25vc3RpY3MsIHRyYW5zbGF0aW9uLCB7XG4gICAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcGx1Z2lucy5wdXNoKG1ha2VMb2NhbGVQbHVnaW4obG9jYWxlKSk7XG5cbiAgcmV0dXJuIHBsdWdpbnM7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU5ndHNjTG9nZ2VyKHJlcG9ydGVyOiBEaWFnbm9zdGljUmVwb3J0ZXIgfCB1bmRlZmluZWQpOiBOZ3RzY0xvZ2dlciB7XG4gIHJldHVybiB7XG4gICAgbGV2ZWw6IDEsIC8vIEluZm8gbGV2ZWxcbiAgICBkZWJ1ZyguLi5hcmdzOiBzdHJpbmdbXSkge30sXG4gICAgaW5mbyguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgICAgcmVwb3J0ZXI/LignaW5mbycsIGFyZ3Muam9pbigpKTtcbiAgICB9LFxuICAgIHdhcm4oLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ3dhcm5pbmcnLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgICBlcnJvciguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgICAgcmVwb3J0ZXI/LignZXJyb3InLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGFwaTogdW5rbm93biwgb3B0aW9uczogQXBwbGljYXRpb25QcmVzZXRPcHRpb25zKSB7XG4gIGNvbnN0IHByZXNldHMgPSBbXTtcbiAgY29uc3QgcGx1Z2lucyA9IFtdO1xuICBsZXQgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucy5hbmd1bGFyTGlua2VyPy5zaG91bGRMaW5rKSB7XG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgb3B0aW9ucy5hbmd1bGFyTGlua2VyLmxpbmtlclBsdWdpbkNyZWF0b3Ioe1xuICAgICAgICBsaW5rZXJKaXRNb2RlOiBvcHRpb25zLmFuZ3VsYXJMaW5rZXIuaml0TW9kZSxcbiAgICAgICAgLy8gVGhpcyBpcyBhIHdvcmthcm91bmQgdW50aWwgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvNDI3NjkgaXMgZml4ZWQuXG4gICAgICAgIHNvdXJjZU1hcHBpbmc6IGZhbHNlLFxuICAgICAgICBsb2dnZXI6IGNyZWF0ZU5ndHNjTG9nZ2VyKG9wdGlvbnMuZGlhZ25vc3RpY1JlcG9ydGVyKSxcbiAgICAgICAgZmlsZVN5c3RlbToge1xuICAgICAgICAgIHJlc29sdmU6IHBhdGgucmVzb2x2ZSxcbiAgICAgICAgICBleGlzdHM6IGZzLmV4aXN0c1N5bmMsXG4gICAgICAgICAgZGlybmFtZTogcGF0aC5kaXJuYW1lLFxuICAgICAgICAgIHJlbGF0aXZlOiBwYXRoLnJlbGF0aXZlLFxuICAgICAgICAgIHJlYWRGaWxlOiBmcy5yZWFkRmlsZVN5bmMsXG4gICAgICAgICAgLy8gTm9kZS5KUyB0eXBlcyBkb24ndCBvdmVybGFwIHRoZSBDb21waWxlciB0eXBlcy5cbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICB9IGFzIGFueSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5mb3JjZUVTNSkge1xuICAgIHByZXNldHMucHVzaChbXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcHJlc2V0LWVudicpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIGJ1Z2ZpeGVzOiB0cnVlLFxuICAgICAgICBtb2R1bGVzOiBmYWxzZSxcbiAgICAgICAgLy8gQ29tcGFyYWJsZSBiZWhhdmlvciB0byB0c2NvbmZpZyB0YXJnZXQgb2YgRVM1XG4gICAgICAgIHRhcmdldHM6IHsgaWU6IDkgfSxcbiAgICAgICAgZXhjbHVkZTogWyd0cmFuc2Zvcm0tdHlwZW9mLXN5bWJvbCddLFxuICAgICAgfSxcbiAgICBdKTtcbiAgICBuZWVkUnVudGltZVRyYW5zZm9ybSA9IHRydWU7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pMThuKSB7XG4gICAgY29uc3QgeyBsb2NhbGUsIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLCBwbHVnaW5DcmVhdG9ycywgdHJhbnNsYXRpb24gfSA9IG9wdGlvbnMuaTE4bjtcbiAgICBjb25zdCBpMThuUGx1Z2lucyA9IGNyZWF0ZUkxOG5QbHVnaW5zKFxuICAgICAgbG9jYWxlLFxuICAgICAgdHJhbnNsYXRpb24sXG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciB8fCAnaWdub3JlJyxcbiAgICAgIG9wdGlvbnMuZGlhZ25vc3RpY1JlcG9ydGVyLFxuICAgICAgcGx1Z2luQ3JlYXRvcnMsXG4gICAgKTtcblxuICAgIHBsdWdpbnMucHVzaCguLi5pMThuUGx1Z2lucyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5mb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24pIHtcbiAgICAvLyBBbHdheXMgdHJhbnNmb3JtIGFzeW5jL2F3YWl0IHRvIHN1cHBvcnQgWm9uZS5qc1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tdHJhbnNmb3JtLWFzeW5jLXRvLWdlbmVyYXRvcicpLmRlZmF1bHQsXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXByb3Bvc2FsLWFzeW5jLWdlbmVyYXRvci1mdW5jdGlvbnMnKS5kZWZhdWx0LFxuICAgICk7XG4gICAgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMub3B0aW1pemUpIHtcbiAgICBpZiAob3B0aW9ucy5vcHRpbWl6ZS5wdXJlVG9wTGV2ZWwpIHtcbiAgICAgIHBsdWdpbnMucHVzaChyZXF1aXJlKCcuLi9wbHVnaW5zL3B1cmUtdG9wbGV2ZWwtZnVuY3Rpb25zJykuZGVmYXVsdCk7XG4gICAgfVxuXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgcmVxdWlyZSgnLi4vcGx1Z2lucy9lbGlkZS1hbmd1bGFyLW1ldGFkYXRhJykuZGVmYXVsdCxcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZSgnLi4vcGx1Z2lucy9hZGp1c3QtdHlwZXNjcmlwdC1lbnVtcycpLmRlZmF1bHQsXG4gICAgICAgIHsgbG9vc2U6IG9wdGlvbnMub3B0aW1pemUubG9vc2VFbnVtcyB9LFxuICAgICAgXSxcbiAgICAgIFtcbiAgICAgICAgcmVxdWlyZSgnLi4vcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMnKS5kZWZhdWx0LFxuICAgICAgICB7IHdyYXBEZWNvcmF0b3JzOiBvcHRpb25zLm9wdGltaXplLndyYXBEZWNvcmF0b3JzIH0sXG4gICAgICBdLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pbnN0cnVtZW50Q29kZSkge1xuICAgIHBsdWdpbnMucHVzaChbXG4gICAgICByZXF1aXJlKCdiYWJlbC1wbHVnaW4taXN0YW5idWwnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICBpbnB1dFNvdXJjZU1hcDogb3B0aW9ucy5pbnN0cnVtZW50Q29kZS5pbnB1dFNvdXJjZU1hcCA/PyBmYWxzZSxcbiAgICAgICAgY3dkOiBvcHRpb25zLmluc3RydW1lbnRDb2RlLmluY2x1ZGVkQmFzZVBhdGgsXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG5cbiAgaWYgKG5lZWRSdW50aW1lVHJhbnNmb3JtKSB7XG4gICAgLy8gQmFiZWwgZXF1aXZhbGVudCB0byBUeXBlU2NyaXB0J3MgYGltcG9ydEhlbHBlcnNgIG9wdGlvblxuICAgIHBsdWdpbnMucHVzaChbXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS1ydW50aW1lJykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgdXNlRVNNb2R1bGVzOiB0cnVlLFxuICAgICAgICB2ZXJzaW9uOiByZXF1aXJlKCdAYmFiZWwvcnVudGltZS9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgICAgICBhYnNvbHV0ZVJ1bnRpbWU6IHBhdGguZGlybmFtZShyZXF1aXJlLnJlc29sdmUoJ0BiYWJlbC9ydW50aW1lL3BhY2thZ2UuanNvbicpKSxcbiAgICAgIH0sXG4gICAgXSk7XG4gIH1cblxuICByZXR1cm4geyBwcmVzZXRzLCBwbHVnaW5zIH07XG59XG4iXX0=