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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVILG1DQUEwQztBQUMxQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBbUQ3QixTQUFTLHFCQUFxQixDQUFDLFFBQXdDO0lBQ3JFLE1BQU0sV0FBVyxHQUFnQixJQUFJLENBQUM7UUFBQTtZQUMzQixhQUFRLEdBQTRCLEVBQUUsQ0FBQztZQUNoRCxjQUFTLEdBQUcsS0FBSyxDQUFDO1FBK0JwQixDQUFDO1FBN0JDLEdBQUcsQ0FBQyxJQUFnQyxFQUFFLE9BQWU7WUFDbkQsSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNyQixPQUFPO2FBQ1I7WUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxTQUFTLEtBQWQsSUFBSSxDQUFDLFNBQVMsR0FBSyxJQUFJLEtBQUssT0FBTyxFQUFDO1lBQ3BDLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUVELEtBQUssQ0FBQyxPQUFlO1lBQ25CLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzdCLENBQUM7UUFFRCxJQUFJLENBQUMsT0FBZTtZQUNsQixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLEtBQUssTUFBTSxVQUFVLElBQUksS0FBSyxD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QUVELE9BQU8sQ0FBQyxJQUFJLENBQ1YsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLENBQUMsT0FBTyxFQUNwRDtZQUNFLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDLE9BQU87WUFDckQsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7U0FDdkMsRUFDRDtZQUNFLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLE9BQU87WUFDekQsRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7U0FDcEQsQ0FDRixDQUFDO0tBQ0g7SUFFRCxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUU7UUFDMUIsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE9BQU87WUFDeEM7Z0JBQ0UsY0FBYyxFQUFFLE1BQUEsT0FBTyxDQUFDLGNBQWMsQ0FBQyxjQUFjLG1DQUFJLEtBQUs7Z0JBQzlELEdBQUcsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLGdCQUFnQjthQUM3QztTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsSUFBSSxvQkFBb0IsRUFBRTtRQUN4QiwwREFBMEQ7UUFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLE9BQU87WUFDbEQ7Z0JBQ0UsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxPQUFPO2dCQUN2RCxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDOUU7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQXRHRCw0QkFzR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZFRyYW5zbGF0aW9uIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvcHJpdmF0ZSc7XG5pbXBvcnQgdHlwZSB7XG4gIERpYWdub3N0aWNIYW5kbGluZ1N0cmF0ZWd5LFxuICBEaWFnbm9zdGljcyxcbiAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbixcbiAgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbixcbiAgbWFrZUxvY2FsZVBsdWdpbixcbn0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUvdG9vbHMnO1xuaW1wb3J0IHsgc3RyaWN0IGFzIGFzc2VydCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgdHlwZSBEaWFnbm9zdGljUmVwb3J0ZXIgPSAodHlwZTogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJywgbWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkO1xuXG4vKipcbiAqIEFuIGludGVyZmFjZSByZXByZXNlbnRpbmcgdGhlIGZhY3RvcnkgZnVuY3Rpb25zIGZvciB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCB0cmFuc2xhdGlvbiBCYWJlbCBwbHVnaW5zLlxuICogVGhpcyBtdXN0IGJlIHByb3ZpZGVkIGZvciB0aGUgRVNNIGltcG9ydHMgc2luY2UgZHluYW1pYyBpbXBvcnRzIGFyZSByZXF1aXJlZCB0byBiZSBhc3luY2hyb25vdXMgYW5kXG4gKiBCYWJlbCBwcmVzZXRzIGN1cnJlbnRseSBjYW4gb25seSBiZSBzeW5jaHJvbm91cy5cbiAqXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSTE4blBsdWdpbkNyZWF0b3JzIHtcbiAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbjogdHlwZW9mIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW47XG4gIG1ha2VFczVUcmFuc2xhdGVQbHVnaW46IHR5cGVvZiBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luO1xuICBtYWtlTG9jYWxlUGx1Z2luOiB0eXBlb2YgbWFrZUxvY2FsZVBsdWdpbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMge1xuICBpMThuPzoge1xuICAgIGxvY2FsZTogc3RyaW5nO1xuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yPzogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnO1xuICAgIHRyYW5zbGF0aW9uPzogUmVjb3JkPHN0cmluZywgybVQYXJzZWRUcmFuc2xhdGlvbj47XG4gICAgdHJhbnNsYXRpb25GaWxlcz86IHN0cmluZ1tdO1xuICAgIHBsdWdpbkNyZWF0b3JzOiBJMThuUGx1Z2luQ3JlYXRvcnM7XG4gIH07XG5cbiAgYW5ndWxhckxpbmtlcj86IHtcbiAgICBzaG91bGRMaW5rOiBib29sZWFuO1xuICAgIGppdE1vZGU6IGJvb2xlYW47XG4gICAgbGlua2VyUGx1Z2luQ3JlYXRvcjogdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcbiAgfTtcblxuICBmb3JjZUVTNT86IGJvb2xlYW47XG4gIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbj86IGJvb2xlYW47XG4gIGluc3RydW1lbnRDb2RlPzoge1xuICAgIGluY2x1ZGVkQmFzZVBhdGg6IHN0cmluZztcbiAgICBpbnB1dFNvdXJjZU1hcDogdW5rbm93bjtcbiAgfTtcbiAgb3B0aW1pemU/OiB7XG4gICAgbG9vc2VFbnVtczogYm9vbGVhbjtcbiAgICBwdXJlVG9wTGV2ZWw6IGJvb2xlYW47XG4gICAgd3JhcERlY29yYXRvcnM6IGJvb2xlYW47XG4gIH07XG5cbiAgZGlhZ25vc3RpY1JlcG9ydGVyPzogRGlhZ25vc3RpY1JlcG9ydGVyO1xufVxuXG4vLyBFeHRyYWN0IExvZ2dlciB0eXBlIGZyb20gdGhlIGxpbmtlciBmdW5jdGlvbiB0byBhdm9pZCBkZWVwIGltcG9ydGluZyB0byBhY2Nlc3MgdGhlIHR5cGVcbnR5cGUgTmd0c2NMb2dnZXIgPSBQYXJhbWV0ZXJzPFxuICB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJykuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4+WzBdWydsb2dnZXInXTtcblxuZnVuY3Rpb24gY3JlYXRlSTE4bkRpYWdub3N0aWNzKHJlcG9ydGVyOiBEaWFnbm9zdGljUmVwb3J0ZXIgfCB1bmRlZmluZWQpOiBEaWFnbm9zdGljcyB7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiBEaWFnbm9zdGljcyA9IG5ldyAoY2xhc3Mge1xuICAgIHJlYWRvbmx5IG1lc3NhZ2VzOiBEaWFnbm9zdGljc1snbWVzc2FnZXMnXSA9IFtdO1xuICAgIGhhc0Vycm9ycyA9IGZhbHNlO1xuXG4gICAgYWRkKHR5cGU6IERpYWdub3N0aWNIYW5kbGluZ1N0cmF0ZWd5LCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlID09PSAnaWdub3JlJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7IHR5cGUsIG1lc3NhZ2UgfSk7XG4gICAgICB0aGlzLmhhc0Vycm9ycyB8fD0gdHlwZSA9PT0gJ2Vycm9yJztcbiAgICAgIHJlcG9ydGVyPy4odHlwZSwgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgZXJyb3IobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICB0aGlzLmFkZCgnZXJyb3InLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgdGhpcy5hZGQoJ3dhcm5pbmcnLCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICBtZXJnZShvdGhlcjogRGlhZ25vc3RpY3MpOiB2b2lkIHtcbiAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBvdGhlci5tZXNzYWdlcykge1xuICAgICAgICB0aGlzLmFkZChkaWFnbm9zdGljLnR5cGUsIGRpYWdub3N0aWMubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9ybWF0RGlhZ25vc3RpY3MoKTogbmV2ZXIge1xuICAgICAgYXNzZXJ0LmZhaWwoXG4gICAgICAgICdAYW5ndWxhci9sb2NhbGl6ZSBEaWFnbm9zdGljcyBmb3JtYXREaWFnbm9zdGljcyBzaG91bGQgbm90IGJlIGNhbGxlZCBmcm9tIHdpdGhpbiBiYWJlbC4nLFxuICAgICAgKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJMThuUGx1Z2lucyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHRyYW5zbGF0aW9uOiBSZWNvcmQ8c3RyaW5nLCDJtVBhcnNlZFRyYW5zbGF0aW9uPiB8IHVuZGVmaW5lZCxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3I6ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyxcbiAgZGlhZ25vc3RpY1JlcG9ydGVyOiBEaWFnbm9zdGljUmVwb3J0ZXIgfCB1bmRlZmluZWQsXG4gIHBsdWdpbkNyZWF0b3JzOiBJMThuUGx1Z2luQ3JlYXRvcnMsXG4pIHtcbiAgY29uc3QgZGlhZ25vc3RpY3MgPSBjcmVhdGVJMThuRGlhZ25vc3RpY3MoZGlhZ25vc3RpY1JlcG9ydGVyKTtcbiAgY29uc3QgcGx1Z2lucyA9IFtdO1xuXG4gIGNvbnN0IHsgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbiwgbWFrZUxvY2FsZVBsdWdpbiB9ID0gcGx1Z2luQ3JlYXRvcnM7XG5cbiAgaWYgKHRyYW5zbGF0aW9uKSB7XG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgbWFrZUVzMjAxNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgdHJhbnNsYXRpb24sIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luKGRpYWdub3N0aWNzLCB0cmFuc2xhdGlvbiwge1xuICAgICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHBsdWdpbnMucHVzaChtYWtlTG9jYWxlUGx1Z2luKGxvY2FsZSkpO1xuXG4gIHJldHVybiBwbHVnaW5zO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOZ3RzY0xvZ2dlcihyZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkKTogTmd0c2NMb2dnZXIge1xuICByZXR1cm4ge1xuICAgIGxldmVsOiAxLCAvLyBJbmZvIGxldmVsXG4gICAgZGVidWcoLi4uYXJnczogc3RyaW5nW10pIHt9LFxuICAgIGluZm8oLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2luZm8nLCBhcmdzLmpvaW4oKSk7XG4gICAgfSxcbiAgICB3YXJuKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCd3YXJuaW5nJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgZXJyb3IoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgICAgIHJlcG9ydGVyPy4oJ2Vycm9yJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChhcGk6IHVua25vd24sIG9wdGlvbnM6IEFwcGxpY2F0aW9uUHJlc2V0T3B0aW9ucykge1xuICBjb25zdCBwcmVzZXRzID0gW107XG4gIGNvbnN0IHBsdWdpbnMgPSBbXTtcbiAgbGV0IG5lZWRSdW50aW1lVHJhbnNmb3JtID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMuYW5ndWxhckxpbmtlcj8uc2hvdWxkTGluaykge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG9wdGlvbnMuYW5ndWxhckxpbmtlci5saW5rZXJQbHVnaW5DcmVhdG9yKHtcbiAgICAgICAgbGlua2VySml0TW9kZTogb3B0aW9ucy5hbmd1bGFyTGlua2VyLmppdE1vZGUsXG4gICAgICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzQyNzY5IGlzIGZpeGVkLlxuICAgICAgICBzb3VyY2VNYXBwaW5nOiBmYWxzZSxcbiAgICAgICAgbG9nZ2VyOiBjcmVhdGVOZ3RzY0xvZ2dlcihvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlciksXG4gICAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgICByZXNvbHZlOiBwYXRoLnJlc29sdmUsXG4gICAgICAgICAgZXhpc3RzOiBmcy5leGlzdHNTeW5jLFxuICAgICAgICAgIGRpcm5hbWU6IHBhdGguZGlybmFtZSxcbiAgICAgICAgICByZWxhdGl2ZTogcGF0aC5yZWxhdGl2ZSxcbiAgICAgICAgICByZWFkRmlsZTogZnMucmVhZEZpbGVTeW5jLFxuICAgICAgICAgIC8vIE5vZGUuSlMgdHlwZXMgZG9uJ3Qgb3ZlcmxhcCB0aGUgQ29tcGlsZXIgdHlwZXMuXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgfSBhcyBhbnksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZm9yY2VFUzUpIHtcbiAgICBwcmVzZXRzLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3ByZXNldC1lbnYnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICBidWdmaXhlczogdHJ1ZSxcbiAgICAgICAgbW9kdWxlczogZmFsc2UsXG4gICAgICAgIC8vIENvbXBhcmFibGUgYmVoYXZpb3IgdG8gdHNjb25maWcgdGFyZ2V0IG9mIEVTNVxuICAgICAgICB0YXJnZXRzOiB7IGllOiA5IH0sXG4gICAgICAgIGV4Y2x1ZGU6IFsndHJhbnNmb3JtLXR5cGVvZi1zeW1ib2wnXSxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgbmVlZFJ1bnRpbWVUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaTE4bikge1xuICAgIGNvbnN0IHsgbG9jYWxlLCBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciwgcGx1Z2luQ3JlYXRvcnMsIHRyYW5zbGF0aW9uIH0gPSBvcHRpb25zLmkxOG47XG4gICAgY29uc3QgaTE4blBsdWdpbnMgPSBjcmVhdGVJMThuUGx1Z2lucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIHRyYW5zbGF0aW9uLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgfHwgJ2lnbm9yZScsXG4gICAgICBvcHRpb25zLmRpYWdub3N0aWNSZXBvcnRlcixcbiAgICAgIHBsdWdpbkNyZWF0b3JzLFxuICAgICk7XG5cbiAgICBwbHVnaW5zLnB1c2goLi4uaTE4blBsdWdpbnMpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uKSB7XG4gICAgLy8gQWx3YXlzIHRyYW5zZm9ybSBhc3luYy9hd2FpdCB0byBzdXBwb3J0IFpvbmUuanNcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICByZXF1aXJlKCdAYmFiZWwvcGx1Z2luLXRyYW5zZm9ybS1hc3luYy10by1nZW5lcmF0b3InKS5kZWZhdWx0LFxuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi1wcm9wb3NhbC1hc3luYy1nZW5lcmF0b3ItZnVuY3Rpb25zJykuZGVmYXVsdCxcbiAgICApO1xuICAgIG5lZWRSdW50aW1lVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLm9wdGltaXplKSB7XG4gICAgaWYgKG9wdGlvbnMub3B0aW1pemUucHVyZVRvcExldmVsKSB7XG4gICAgICBwbHVnaW5zLnB1c2gocmVxdWlyZSgnLi4vcGx1Z2lucy9wdXJlLXRvcGxldmVsLWZ1bmN0aW9ucycpLmRlZmF1bHQpO1xuICAgIH1cblxuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvZWxpZGUtYW5ndWxhci1tZXRhZGF0YScpLmRlZmF1bHQsXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXR5cGVzY3JpcHQtZW51bXMnKS5kZWZhdWx0LFxuICAgICAgICB7IGxvb3NlOiBvcHRpb25zLm9wdGltaXplLmxvb3NlRW51bXMgfSxcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIHJlcXVpcmUoJy4uL3BsdWdpbnMvYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzJykuZGVmYXVsdCxcbiAgICAgICAgeyB3cmFwRGVjb3JhdG9yczogb3B0aW9ucy5vcHRpbWl6ZS53cmFwRGVjb3JhdG9ycyB9LFxuICAgICAgXSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuaW5zdHJ1bWVudENvZGUpIHtcbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnYmFiZWwtcGx1Z2luLWlzdGFuYnVsJykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgaW5wdXRTb3VyY2VNYXA6IG9wdGlvbnMuaW5zdHJ1bWVudENvZGUuaW5wdXRTb3VyY2VNYXAgPz8gZmFsc2UsXG4gICAgICAgIGN3ZDogb3B0aW9ucy5pbnN0cnVtZW50Q29kZS5pbmNsdWRlZEJhc2VQYXRoLFxuICAgICAgfSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmIChuZWVkUnVudGltZVRyYW5zZm9ybSkge1xuICAgIC8vIEJhYmVsIGVxdWl2YWxlbnQgdG8gVHlwZVNjcmlwdCdzIGBpbXBvcnRIZWxwZXJzYCBvcHRpb25cbiAgICBwbHVnaW5zLnB1c2goW1xuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tcnVudGltZScpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIHVzZUVTTW9kdWxlczogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbjogcmVxdWlyZSgnQGJhYmVsL3J1bnRpbWUvcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICAgICAgYWJzb2x1dGVSdW50aW1lOiBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKCdAYmFiZWwvcnVudGltZS9wYWNrYWdlLmpzb24nKSksXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgcHJlc2V0cywgcGx1Z2lucyB9O1xufVxuIl19