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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFVSCxtQ0FBMEM7QUFDMUMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQW9EN0IsU0FBUyxxQkFBcUIsQ0FBQyxRQUF3QztJQUNyRSxNQUFNLFdBQVcsR0FBZ0IsSUFBSSxDQUFDO1FBQUE7WUFDM0IsYUFBUSxHQUE0QixFQUFFLENBQUM7WUFDaEQsY0FBUyxHQUFHLEtBQUssQ0FBQztRQStCcEIsQ0FBQztRQTdCQyxHQUFHLENBQUMsSUFBZ0MsRUFBRSxPQUFlO1lBQ25ELElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDckIsT0FBTzthQUNSO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsU0FBUyxLQUFkLElBQUksQ0FBQyxTQUFTLEdBQUssSUFBSSxLQUFLLE9BQU8sRUFBQztZQUNwQyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxLQUFLLENBQUMsT0FBZTtZQUNuQixJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQWU7WUFDbEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELEtBQUssQ0FBQyxLQUFrQjtZQUN0QixLQUFLLE1BQU0sVUFBVSxJQUFJLEtB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LENBQ1YsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLENBQUMsT0FBTyxFQUNwRDtZQUNFLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDLE9BQU87WUFDckQsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7U0FDdkMsRUFDRDtZQUNFLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLE9BQU87WUFDekQsRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7U0FDcEQsQ0FDRixDQUFDO0tBQ0g7SUFFRCxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUU7UUFDMUIsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE9BQU87WUFDeEM7Z0JBQ0UsY0FBYyxFQUFFLE1BQUEsT0FBTyxDQUFDLGNBQWMsQ0FBQyxjQUFjLG1DQUFJLEtBQUs7Z0JBQzlELEdBQUcsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLGdCQUFnQjthQUM3QztTQUNGLENBQUMsQ0FBQztLQUNKO0lBRUQsSUFBSSxvQkFBb0IsRUFBRTtRQUN4QiwwREFBMEQ7UUFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLE9BQU87WUFDbEQ7Z0JBQ0UsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxPQUFPO2dCQUN2RCxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDOUU7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQXJHRCw0QkFxR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyDJtVBhcnNlZFRyYW5zbGF0aW9uIH0gZnJvbSAnQGFuZ3VsYXIvbG9jYWxpemUnO1xuaW1wb3J0IHR5cGUge1xuICBEaWFnbm9zdGljSGFuZGxpbmdTdHJhdGVneSxcbiAgRGlhZ25vc3RpY3MsXG4gIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sXG4gIG1ha2VFczVUcmFuc2xhdGVQbHVnaW4sXG4gIG1ha2VMb2NhbGVQbHVnaW4sXG59IGZyb20gJ0Bhbmd1bGFyL2xvY2FsaXplL3Rvb2xzJztcbmltcG9ydCB7IHN0cmljdCBhcyBhc3NlcnQgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IHR5cGUgRGlhZ25vc3RpY1JlcG9ydGVyID0gKHR5cGU6ICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycsIG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZDtcblxuLyoqXG4gKiBBbiBpbnRlcmZhY2UgcmVwcmVzZW50aW5nIHRoZSBmYWN0b3J5IGZ1bmN0aW9ucyBmb3IgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgdHJhbnNsYXRpb24gQmFiZWwgcGx1Z2lucy5cbiAqIFRoaXMgbXVzdCBiZSBwcm92aWRlZCBmb3IgdGhlIEVTTSBpbXBvcnRzIHNpbmNlIGR5bmFtaWMgaW1wb3J0cyBhcmUgcmVxdWlyZWQgdG8gYmUgYXN5bmNocm9ub3VzIGFuZFxuICogQmFiZWwgcHJlc2V0cyBjdXJyZW50bHkgY2FuIG9ubHkgYmUgc3luY2hyb25vdXMuXG4gKlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEkxOG5QbHVnaW5DcmVhdG9ycyB7XG4gIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW46IHR5cGVvZiBtYWtlRXMyMDE1VHJhbnNsYXRlUGx1Z2luO1xuICBtYWtlRXM1VHJhbnNsYXRlUGx1Z2luOiB0eXBlb2YgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbjtcbiAgbWFrZUxvY2FsZVBsdWdpbjogdHlwZW9mIG1ha2VMb2NhbGVQbHVnaW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbGljYXRpb25QcmVzZXRPcHRpb25zIHtcbiAgaTE4bj86IHtcbiAgICBsb2NhbGU6IHN0cmluZztcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbj86IFJlY29yZDxzdHJpbmcsIMm1UGFyc2VkVHJhbnNsYXRpb24+O1xuICAgIHRyYW5zbGF0aW9uRmlsZXM/OiBzdHJpbmdbXTtcbiAgICBwbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzO1xuICB9O1xuXG4gIGFuZ3VsYXJMaW5rZXI/OiB7XG4gICAgc2hvdWxkTGluazogYm9vbGVhbjtcbiAgICBqaXRNb2RlOiBib29sZWFuO1xuICAgIGxpbmtlclBsdWdpbkNyZWF0b3I6IHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW47XG4gIH07XG5cbiAgZm9yY2VQcmVzZXRFbnY/OiBib29sZWFuO1xuICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24/OiBib29sZWFuO1xuICBpbnN0cnVtZW50Q29kZT86IHtcbiAgICBpbmNsdWRlZEJhc2VQYXRoOiBzdHJpbmc7XG4gICAgaW5wdXRTb3VyY2VNYXA6IHVua25vd247XG4gIH07XG4gIG9wdGltaXplPzoge1xuICAgIGxvb3NlRW51bXM6IGJvb2xlYW47XG4gICAgcHVyZVRvcExldmVsOiBib29sZWFuO1xuICAgIHdyYXBEZWNvcmF0b3JzOiBib29sZWFuO1xuICB9O1xuXG4gIHN1cHBvcnRlZEJyb3dzZXJzPzogc3RyaW5nW107XG4gIGRpYWdub3N0aWNSZXBvcnRlcj86IERpYWdub3N0aWNSZXBvcnRlcjtcbn1cblxuLy8gRXh0cmFjdCBMb2dnZXIgdHlwZSBmcm9tIHRoZSBsaW5rZXIgZnVuY3Rpb24gdG8gYXZvaWQgZGVlcCBpbXBvcnRpbmcgdG8gYWNjZXNzIHRoZSB0eXBlXG50eXBlIE5ndHNjTG9nZ2VyID0gUGFyYW1ldGVyczxcbiAgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpblxuPlswXVsnbG9nZ2VyJ107XG5cbmZ1bmN0aW9uIGNyZWF0ZUkxOG5EaWFnbm9zdGljcyhyZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkKTogRGlhZ25vc3RpY3Mge1xuICBjb25zdCBkaWFnbm9zdGljczogRGlhZ25vc3RpY3MgPSBuZXcgKGNsYXNzIHtcbiAgICByZWFkb25seSBtZXNzYWdlczogRGlhZ25vc3RpY3NbJ21lc3NhZ2VzJ10gPSBbXTtcbiAgICBoYXNFcnJvcnMgPSBmYWxzZTtcblxuICAgIGFkZCh0eXBlOiBEaWFnbm9zdGljSGFuZGxpbmdTdHJhdGVneSwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICBpZiAodHlwZSA9PT0gJ2lnbm9yZScpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goeyB0eXBlLCBtZXNzYWdlIH0pO1xuICAgICAgdGhpcy5oYXNFcnJvcnMgfHw9IHR5cGUgPT09ICdlcnJvcic7XG4gICAgICByZXBvcnRlcj8uKHR5cGUsIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgdGhpcy5hZGQoJ2Vycm9yJywgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgd2FybihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHRoaXMuYWRkKCd3YXJuaW5nJywgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgbWVyZ2Uob3RoZXI6IERpYWdub3N0aWNzKTogdm9pZCB7XG4gICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2Ygb3RoZXIubWVzc2FnZXMpIHtcbiAgICAgICAgdGhpcy5hZGQoZGlhZ25vc3RpYy50eXBlLCBkaWFnbm9zdGljLm1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvcm1hdERpYWdub3N0aWNzKCk6IG5ldmVyIHtcbiAgICAgIGFzc2VydC5mYWlsKFxuICAgICAgICAnQGFuZ3VsYXIvbG9jYWxpemUgRGlhZ25vc3RpY3MgZm9ybWF0RGlhZ25vc3RpY3Mgc2hvdWxkIG5vdCBiZSBjYWxsZWQgZnJvbSB3aXRoaW4gYmFiZWwuJyxcbiAgICAgICk7XG4gICAgfVxuICB9KSgpO1xuXG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuZnVuY3Rpb24gY3JlYXRlSTE4blBsdWdpbnMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB0cmFuc2xhdGlvbjogUmVjb3JkPHN0cmluZywgybVQYXJzZWRUcmFuc2xhdGlvbj4gfCB1bmRlZmluZWQsXG4gIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScsXG4gIGRpYWdub3N0aWNSZXBvcnRlcjogRGlhZ25vc3RpY1JlcG9ydGVyIHwgdW5kZWZpbmVkLFxuICBwbHVnaW5DcmVhdG9yczogSTE4blBsdWdpbkNyZWF0b3JzLFxuKSB7XG4gIGNvbnN0IGRpYWdub3N0aWNzID0gY3JlYXRlSTE4bkRpYWdub3N0aWNzKGRpYWdub3N0aWNSZXBvcnRlcik7XG4gIGNvbnN0IHBsdWdpbnMgPSBbXTtcblxuICBjb25zdCB7IG1ha2VFczVUcmFuc2xhdGVQbHVnaW4sIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4sIG1ha2VMb2NhbGVQbHVnaW4gfSA9IHBsdWdpbkNyZWF0b3JzO1xuXG4gIGlmICh0cmFuc2xhdGlvbikge1xuICAgIHBsdWdpbnMucHVzaChcbiAgICAgIG1ha2VFczIwMTVUcmFuc2xhdGVQbHVnaW4oZGlhZ25vc3RpY3MsIHRyYW5zbGF0aW9uLCB7XG4gICAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgbWFrZUVzNVRyYW5zbGF0ZVBsdWdpbihkaWFnbm9zdGljcywgdHJhbnNsYXRpb24sIHtcbiAgICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwbHVnaW5zLnB1c2gobWFrZUxvY2FsZVBsdWdpbihsb2NhbGUpKTtcblxuICByZXR1cm4gcGx1Z2lucztcbn1cblxuZnVuY3Rpb24gY3JlYXRlTmd0c2NMb2dnZXIocmVwb3J0ZXI6IERpYWdub3N0aWNSZXBvcnRlciB8IHVuZGVmaW5lZCk6IE5ndHNjTG9nZ2VyIHtcbiAgcmV0dXJuIHtcbiAgICBsZXZlbDogMSwgLy8gSW5mbyBsZXZlbFxuICAgIGRlYnVnKC4uLmFyZ3M6IHN0cmluZ1tdKSB7fSxcbiAgICBpbmZvKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCdpbmZvJywgYXJncy5qb2luKCkpO1xuICAgIH0sXG4gICAgd2FybiguLi5hcmdzOiBzdHJpbmdbXSkge1xuICAgICAgcmVwb3J0ZXI/Lignd2FybmluZycsIGFyZ3Muam9pbigpKTtcbiAgICB9LFxuICAgIGVycm9yKC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgICByZXBvcnRlcj8uKCdlcnJvcicsIGFyZ3Muam9pbigpKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoYXBpOiB1bmtub3duLCBvcHRpb25zOiBBcHBsaWNhdGlvblByZXNldE9wdGlvbnMpIHtcbiAgY29uc3QgcHJlc2V0cyA9IFtdO1xuICBjb25zdCBwbHVnaW5zID0gW107XG4gIGxldCBuZWVkUnVudGltZVRyYW5zZm9ybSA9IGZhbHNlO1xuXG4gIGlmIChvcHRpb25zLmFuZ3VsYXJMaW5rZXI/LnNob3VsZExpbmspIHtcbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICBvcHRpb25zLmFuZ3VsYXJMaW5rZXIubGlua2VyUGx1Z2luQ3JlYXRvcih7XG4gICAgICAgIGxpbmtlckppdE1vZGU6IG9wdGlvbnMuYW5ndWxhckxpbmtlci5qaXRNb2RlLFxuICAgICAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCB1bnRpbCBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy80Mjc2OSBpcyBmaXhlZC5cbiAgICAgICAgc291cmNlTWFwcGluZzogZmFsc2UsXG4gICAgICAgIGxvZ2dlcjogY3JlYXRlTmd0c2NMb2dnZXIob3B0aW9ucy5kaWFnbm9zdGljUmVwb3J0ZXIpLFxuICAgICAgICBmaWxlU3lzdGVtOiB7XG4gICAgICAgICAgcmVzb2x2ZTogcGF0aC5yZXNvbHZlLFxuICAgICAgICAgIGV4aXN0czogZnMuZXhpc3RzU3luYyxcbiAgICAgICAgICBkaXJuYW1lOiBwYXRoLmRpcm5hbWUsXG4gICAgICAgICAgcmVsYXRpdmU6IHBhdGgucmVsYXRpdmUsXG4gICAgICAgICAgcmVhZEZpbGU6IGZzLnJlYWRGaWxlU3luYyxcbiAgICAgICAgICAvLyBOb2RlLkpTIHR5cGVzIGRvbid0IG92ZXJsYXAgdGhlIENvbXBpbGVyIHR5cGVzLlxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIH0gYXMgYW55LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmZvcmNlUHJlc2V0RW52KSB7XG4gICAgcHJlc2V0cy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wcmVzZXQtZW52JykuZGVmYXVsdCxcbiAgICAgIHtcbiAgICAgICAgYnVnZml4ZXM6IHRydWUsXG4gICAgICAgIG1vZHVsZXM6IGZhbHNlLFxuICAgICAgICB0YXJnZXRzOiBvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICBleGNsdWRlOiBbJ3RyYW5zZm9ybS10eXBlb2Ytc3ltYm9sJ10sXG4gICAgICB9LFxuICAgIF0pO1xuICAgIG5lZWRSdW50aW1lVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmkxOG4pIHtcbiAgICBjb25zdCB7IGxvY2FsZSwgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsIHBsdWdpbkNyZWF0b3JzLCB0cmFuc2xhdGlvbiB9ID0gb3B0aW9ucy5pMThuO1xuICAgIGNvbnN0IGkxOG5QbHVnaW5zID0gY3JlYXRlSTE4blBsdWdpbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICB0cmFuc2xhdGlvbixcbiAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yIHx8ICdpZ25vcmUnLFxuICAgICAgb3B0aW9ucy5kaWFnbm9zdGljUmVwb3J0ZXIsXG4gICAgICBwbHVnaW5DcmVhdG9ycyxcbiAgICApO1xuXG4gICAgcGx1Z2lucy5wdXNoKC4uLmkxOG5QbHVnaW5zKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbikge1xuICAgIC8vIEFsd2F5cyB0cmFuc2Zvcm0gYXN5bmMvYXdhaXQgdG8gc3VwcG9ydCBab25lLmpzXG4gICAgcGx1Z2lucy5wdXNoKFxuICAgICAgcmVxdWlyZSgnQGJhYmVsL3BsdWdpbi10cmFuc2Zvcm0tYXN5bmMtdG8tZ2VuZXJhdG9yJykuZGVmYXVsdCxcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tcHJvcG9zYWwtYXN5bmMtZ2VuZXJhdG9yLWZ1bmN0aW9ucycpLmRlZmF1bHQsXG4gICAgKTtcbiAgICBuZWVkUnVudGltZVRyYW5zZm9ybSA9IHRydWU7XG4gIH1cblxuICBpZiAob3B0aW9ucy5vcHRpbWl6ZSkge1xuICAgIGlmIChvcHRpb25zLm9wdGltaXplLnB1cmVUb3BMZXZlbCkge1xuICAgICAgcGx1Z2lucy5wdXNoKHJlcXVpcmUoJy4uL3BsdWdpbnMvcHVyZS10b3BsZXZlbC1mdW5jdGlvbnMnKS5kZWZhdWx0KTtcbiAgICB9XG5cbiAgICBwbHVnaW5zLnB1c2goXG4gICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2VsaWRlLWFuZ3VsYXItbWV0YWRhdGEnKS5kZWZhdWx0LFxuICAgICAgW1xuICAgICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2FkanVzdC10eXBlc2NyaXB0LWVudW1zJykuZGVmYXVsdCxcbiAgICAgICAgeyBsb29zZTogb3B0aW9ucy5vcHRpbWl6ZS5sb29zZUVudW1zIH0sXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZXF1aXJlKCcuLi9wbHVnaW5zL2FkanVzdC1zdGF0aWMtY2xhc3MtbWVtYmVycycpLmRlZmF1bHQsXG4gICAgICAgIHsgd3JhcERlY29yYXRvcnM6IG9wdGlvbnMub3B0aW1pemUud3JhcERlY29yYXRvcnMgfSxcbiAgICAgIF0sXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmluc3RydW1lbnRDb2RlKSB7XG4gICAgcGx1Z2lucy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ2JhYmVsLXBsdWdpbi1pc3RhbmJ1bCcpLmRlZmF1bHQsXG4gICAgICB7XG4gICAgICAgIGlucHV0U291cmNlTWFwOiBvcHRpb25zLmluc3RydW1lbnRDb2RlLmlucHV0U291cmNlTWFwID8/IGZhbHNlLFxuICAgICAgICBjd2Q6IG9wdGlvbnMuaW5zdHJ1bWVudENvZGUuaW5jbHVkZWRCYXNlUGF0aCxcbiAgICAgIH0sXG4gICAgXSk7XG4gIH1cblxuICBpZiAobmVlZFJ1bnRpbWVUcmFuc2Zvcm0pIHtcbiAgICAvLyBCYWJlbCBlcXVpdmFsZW50IHRvIFR5cGVTY3JpcHQncyBgaW1wb3J0SGVscGVyc2Agb3B0aW9uXG4gICAgcGx1Z2lucy5wdXNoKFtcbiAgICAgIHJlcXVpcmUoJ0BiYWJlbC9wbHVnaW4tdHJhbnNmb3JtLXJ1bnRpbWUnKS5kZWZhdWx0LFxuICAgICAge1xuICAgICAgICB1c2VFU01vZHVsZXM6IHRydWUsXG4gICAgICAgIHZlcnNpb246IHJlcXVpcmUoJ0BiYWJlbC9ydW50aW1lL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXG4gICAgICAgIGFic29sdXRlUnVudGltZTogcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZSgnQGJhYmVsL3J1bnRpbWUvcGFja2FnZS5qc29uJykpLFxuICAgICAgfSxcbiAgICBdKTtcbiAgfVxuXG4gIHJldHVybiB7IHByZXNldHMsIHBsdWdpbnMgfTtcbn1cbiJdfQ==