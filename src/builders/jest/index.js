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
const architect_1 = require("@angular-devkit/architect");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const util_1 = require("util");
const color_1 = require("../../utils/color");
const application_1 = require("../application");
const schema_1 = require("../browser-esbuild/schema");
const options_1 = require("./options");
const test_files_1 = require("./test-files");
const execFile = (0, util_1.promisify)(child_process_1.execFile);
/** Main execution function for the Jest builder. */
exports.default = (0, architect_1.createBuilder)(async (schema, context) => {
    context.logger.warn('NOTE: The Jest builder is currently EXPERIMENTAL and not ready for production use.');
    const options = (0, options_1.normalizeOptions)(schema);
    const testOut = 'dist/test-out'; // TODO(dgp1130): Hide in temp directory.
    // Verify Jest installation and get the path to it's binary.
    // We need to `node_modules/.bin/jest`, but there is no means to resolve that directly. Fortunately Jest's `package.json` exports the
    // same file at `bin/jest`, so we can just resolve that instead.
    const jest = resolveModule('jest/bin/jest');
    if (!jest) {
        return {
            success: false,
            // TODO(dgp1130): Display a more accurate message for non-NPM users.
            error: 'Jest is not installed, most likely you need to run `npm install jest --save-dev` in your project.',
        };
    }
    // Verify that JSDom is installed in the project.
    const environment = resolveModule('jest-environment-jsdom');
    if (!environment) {
        return {
            success: false,
            // TODO(dgp1130): Display a more accurate message for non-NPM users.
            error: '`jest-environment-jsdom` is not installed. Install it with `npm install jest-environment-jsdom --save-dev`.',
        };
    }
    // Build all the test files.
    const testFiles = await (0, test_files_1.findTestFiles)(options, context.workspaceRoot);
    const jestGlobal = path.join(__dirname, 'jest-global.mjs');
    const initTestBed = path.join(__dirname, 'init-test-bed.mjs');
    const buildResult = await build(context, {
        // Build all the test files and also the `jest-global` and `init-test-bed` scripts.
        entryPoints: new Set([...testFiles, jestGlobal, initTestBed]),
        tsConfig: options.tsConfig,
        polyfills: options.polyfills ?? ['zone.js', 'zone.js/testing'],
        outputPath: testOut,
        aot: false,
        index: null,
        outputHashing: schema_1.OutputHashing.None,
        outExtension: 'mjs',
        optimization: false,
        sourceMap: {
            scripts: true,
            styles: false,
            vendor: false,
        },
    });
    if (!buildResult.success) {
        return buildResult;
    }
    // Execute Jest on the built output directory.
    const jestProc = execFile(process.execPath, [
        '--experimental-vm-modules',
        jest,
        `--rootDir="${testOut}"`,
        '--testEnvironment=jsdom',
        // TODO(dgp1130): Enable cache once we have a mechanism for properly clearing / disabling it.
        '--no-cache',
        // Run basically all files in the output directory, any excluded files were already dropped by the build.
        `--testMatch="<rootDir>/**/*.mjs"`,
        // Load polyfills and initialize the environment before executing each test file.
        // IMPORTANT: Order matters here.
        // First, we execute `jest-global.mjs` to initialize the `jest` global variable.
        // Second, we execute user polyfills, including `zone.js` and `zone.js/testing`. This is dependent on the Jest global so it can patch
        // the environment for fake async to work correctly.
        // Third, we initialize `TestBed`. This is dependent on fake async being set up correctly beforehand.
        `--setupFilesAfterEnv="<rootDir>/jest-global.mjs"`,
        ...(options.polyfills ? [`--setupFilesAfterEnv="<rootDir>/polyfills.mjs"`] : []),
        `--setupFilesAfterEnv="<rootDir>/init-test-bed.mjs"`,
        // Don't run any infrastructure files as tests, they are manually loaded where needed.
        `--testPathIgnorePatterns="<rootDir>/jest-global\\.mjs"`,
        ...(options.polyfills ? [`--testPathIgnorePatterns="<rootDir>/polyfills\\.mjs"`] : []),
        `--testPathIgnorePatterns="<rootDir>/init-test-bed\\.mjs"`,
        // Skip shared chunks, as they are not entry points to tests.
        `--testPathIgnorePatterns="<rootDir>/chunk-.*\\.mjs"`,
        // Optionally enable color.
        ...(color_1.colors.enabled ? ['--colors'] : []),
    ]);
    // Stream test output to the terminal.
    jestProc.child.stdout?.on('data', (chunk) => {
        context.logger.info(chunk);
    });
    jestProc.child.stderr?.on('data', (chunk) => {
        // Write to stderr directly instead of `context.logger.error(chunk)` because the logger will overwrite Jest's coloring information.
        process.stderr.write(chunk);
    });
    try {
        await jestProc;
    }
    catch (error) {
        // No need to propagate error message, already piped to terminal output.
        // TODO(dgp1130): Handle process spawning failures.
        return { success: false };
    }
    return { success: true };
});
async function build(context, options) {
    try {
        for await (const _ of (0, application_1.buildApplicationInternal)(options, context)) {
            // Nothing to do for each event, just wait for the whole build.
        }
        return { success: true };
    }
    catch (err) {
        return {
            success: false,
            error: err.message,
        };
    }
}
/** Safely resolves the given Node module string. */
function resolveModule(module) {
    try {
        return require.resolve(module);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9qZXN0L2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaURBQXVEO0FBQ3ZELDJDQUE2QjtBQUM3QiwrQkFBaUM7QUFDakMsNkNBQTJDO0FBQzNDLGdEQUEwRDtBQUUxRCxzREFBMEQ7QUFDMUQsdUNBQTZDO0FBRTdDLDZDQUE2QztBQUU3QyxNQUFNLFFBQVEsR0FBRyxJQUFBLGdCQUFTLEVBQUMsd0JBQVUsQ0FBQyxDQUFDO0FBRXZDLG9EQUFvRDtBQUNwRCxrQkFBZSxJQUFBLHlCQUFhLEVBQzFCLEtBQUssRUFBRSxNQUF5QixFQUFFLE9BQXVCLEVBQTBCLEVBQUU7SUFDbkYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLG9GQUFvRixDQUNyRixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsSUFBQSwwQkFBZ0IsRUFBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxNQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsQ0FBQyx5Q0FBeUM7SUFFMUUsNERBQTREO0lBQzVELHFJQUFxSTtJQUNySSxnRUFBZ0U7SUFDaEUsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzVDLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxvRUFBb0U7WUFDcEUsS0FBSyxFQUNILG1HQUFtRztTQUN0RyxDQUFDO0tBQ0g7SUFFRCxpREFBaUQ7SUFDakQsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDNUQsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixP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O0tBQ2hCO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCx3RUFBd0U7UUFDeEUsbURBQW1EO1FBQ25ELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDM0I7SUFFRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO0FBQzNCLENBQUMsQ0FDRixDQUFDO0FBRUYsS0FBSyxVQUFVLEtBQUssQ0FDbEIsT0FBdUIsRUFDdkIsT0FBMEM7SUFFMUMsSUFBSTtRQUNGLElBQUksS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUEsc0NBQXdCLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFO1lBQ2hFLCtEQUErRDtTQUNoRTtRQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7S0FDMUI7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLE9BQU87WUFDTCxPQUFPLEVBQUUsS0FBSztZQUNkLEtBQUssRUFBRyxHQUFhLENBQUMsT0FBTztTQUM5QixDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBRUQsb0RBQW9EO0FBQ3BELFNBQVMsYUFBYSxDQUFDLE1BQWM7SUFDbkMsSUFBSTtRQUNGLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNoQztJQUFDLE1BQU07UUFDTixPQUFPLFNBQVMsQ0FBQztLQUNsQjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGV4ZWNGaWxlIGFzIGV4ZWNGaWxlQ2IgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IGJ1aWxkQXBwbGljYXRpb25JbnRlcm5hbCB9IGZyb20gJy4uL2FwcGxpY2F0aW9uJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyB9IGZyb20gJy4uL2FwcGxpY2F0aW9uL29wdGlvbnMnO1xuaW1wb3J0IHsgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgSmVzdEJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBmaW5kVGVzdEZpbGVzIH0gZnJvbSAnLi90ZXN0LWZpbGVzJztcblxuY29uc3QgZXhlY0ZpbGUgPSBwcm9taXNpZnkoZXhlY0ZpbGVDYik7XG5cbi8qKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIEplc3QgYnVpbGRlci4gKi9cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoXG4gIGFzeW5jIChzY2hlbWE6IEplc3RCdWlsZGVyU2NoZW1hLCBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCk6IFByb21pc2U8QnVpbGRlck91dHB1dD4gPT4ge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAnTk9URTogVGhlIEplc3QgYnVpbGRlciBpcyBjdXJyZW50bHkgRVhQRVJJTUVOVEFMIGFuZCBub3QgcmVhZHkgZm9yIHByb2R1Y3Rpb24gdXNlLicsXG4gICAgKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKHNjaGVtYSk7XG4gICAgY29uc3QgdGVzdE91dCA9ICdkaXN0L3Rlc3Qtb3V0JzsgLy8gVE9ETyhkZ3AxMTMwKTogSGlkZSBpbiB0ZW1wIGRpcmVjdG9yeS5cblxuICAgIC8vIFZlcmlmeSBKZXN0IGluc3RhbGxhdGlvbiBhbmQgZ2V0IHRoZSBwYXRoIHRvIGl0J3MgYmluYXJ5LlxuICAgIC8vIFdlIG5lZWQgdG8gYG5vZGVfbW9kdWxlcy8uYmluL2plc3RgLCBidXQgdGhlcmUgaXMgbm8gbWVhbnMgdG8gcmVzb2x2ZSB0aGF0IGRpcmVjdGx5LiBGb3J0dW5hdGVseSBKZXN0J3MgYHBhY2thZ2UuanNvbmAgZXhwb3J0cyB0aGVcbiAgICAvLyBzYW1lIGZpbGUgYXQgYGJpbi9qZXN0YCwgc28gd2UgY2FuIGp1c3QgcmVzb2x2ZSB0aGF0IGluc3RlYWQuXG4gICAgY29uc3QgamVzdCA9IHJlc29sdmVNb2R1bGUoJ2plc3QvYmluL2plc3QnKTtcbiAgICBpZiAoIWplc3QpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAvLyBUT0RPKGRncDExMzApOiBEaXNwbGF5IGEgbW9yZSBhY2N1cmF0ZSBtZXNzYWdlIGZvciBub24tTlBNIHVzZXJzLlxuICAgICAgICBlcnJvcjpcbiAgICAgICAgICAnSmVzdCBpcyBub3QgaW5zdGFsbGVkLCBtb3N0IGxpa2VseSB5b3UgbmVlZCB0byBydW4gYG5wbSBpbnN0YWxsIGplc3QgLS1zYXZlLWRldmAgaW4geW91ciBwcm9qZWN0LicsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFZlcmlmeSB0aGF0IEpTRG9tIGlzIGluc3RhbGxlZCBpbiB0aGUgcHJvamVjdC5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHJlc29sdmVNb2R1bGUoJ2plc3QtZW52aXJvbm1lbnQtanNkb20nKTtcbiAgICBpZiAoIWVudmlyb25tZW50KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgLy8gVE9ETyhkZ3AxMTMwKTogRGlzcGxheSBhIG1vcmUgYWNjdXJhdGUgbWVzc2FnZSBmb3Igbm9uLU5QTSB1c2Vycy5cbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgJ2BqZXN0LWVudmlyb25tZW50LWpzZG9tYCBpcyBub3QgaW5zdGFsbGVkLiBJbnN0YWxsIGl0IHdpdGggYG5wbSBpbnN0YWxsIGplc3QtZW52aXJvbm1lbnQtanNkb20gLS1zYXZlLWRldmAuJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgYWxsIHRoZSB0ZXN0IGZpbGVzLlxuICAgIGNvbnN0IHRlc3RGaWxlcyA9IGF3YWl0IGZpbmRUZXN0RmlsZXMob3B0aW9ucywgY29udGV4dC53b3Jrc3BhY2VSb290KTtcbiAgICBjb25zdCBqZXN0R2xvYmFsID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJ2plc3QtZ2xvYmFsLm1qcycpO1xuICAgIGNvbnN0IGluaXRUZXN0QmVkID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJ2luaXQtdGVzdC1iZWQubWpzJyk7XG4gICAgY29uc3QgYnVpbGRSZXN1bHQgPSBhd2FpdCBidWlsZChjb250ZXh0LCB7XG4gICAgICAvLyBCdWlsZCBhbGwgdGhlIHRlc3QgZmlsZXMgYW5kIGFsc28gdGhlIGBqZXN0LWdsb2JhbGAgYW5kIGBpbml0LXRlc3QtYmVkYCBzY3JpcHRzLlxuICAgICAgZW50cnlQb2ludHM6IG5ldyBTZXQoWy4uLnRlc3RGaWxlcywgamVzdEdsb2JhbCwgaW5pdFRlc3RCZWRdKSxcbiAgICAgIHRzQ29uZmlnOiBvcHRpb25zLnRzQ29uZmlnLFxuICAgICAgcG9seWZpbGxzOiBvcHRpb25zLnBvbHlmaWxscyA/PyBbJ3pvbmUuanMnLCAnem9uZS5qcy90ZXN0aW5nJ10sXG4gICAgICBvdXRwdXRQYXRoOiB0ZXN0T3V0LFxuICAgICAgYW90OiBmYWxzZSxcbiAgICAgIGluZGV4OiBudWxsLFxuICAgICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgICAgb3V0RXh0ZW5zaW9uOiAnbWpzJywgLy8gRm9yY2UgbmF0aXZlIEVTTS5cbiAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBzb3VyY2VNYXA6IHtcbiAgICAgICAgc2NyaXB0czogdHJ1ZSxcbiAgICAgICAgc3R5bGVzOiBmYWxzZSxcbiAgICAgICAgdmVuZG9yOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgaWYgKCFidWlsZFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICByZXR1cm4gYnVpbGRSZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gRXhlY3V0ZSBKZXN0IG9uIHRoZSBidWlsdCBvdXRwdXQgZGlyZWN0b3J5LlxuICAgIGNvbnN0IGplc3RQcm9jID0gZXhlY0ZpbGUocHJvY2Vzcy5leGVjUGF0aCwgW1xuICAgICAgJy0tZXhwZXJpbWVudGFsLXZtLW1vZHVsZXMnLFxuICAgICAgamVzdCxcblxuICAgICAgYC0tcm9vdERpcj1cIiR7dGVzdE91dH1cImAsXG4gICAgICAnLS10ZXN0RW52aXJvbm1lbnQ9anNkb20nLFxuXG4gICAgICAvLyBUT0RPKGRncDExMzApOiBFbmFibGUgY2FjaGUgb25jZSB3ZSBoYXZlIGEgbWVjaGFuaXNtIGZvciBwcm9wZXJseSBjbGVhcmluZyAvIGRpc2FibGluZyBpdC5cbiAgICAgICctLW5vLWNhY2hlJyxcblxuICAgICAgLy8gUnVuIGJhc2ljYWxseSBhbGwgZmlsZXMgaW4gdGhlIG91dHB1dCBkaXJlY3RvcnksIGFueSBleGNsdWRlZCBmaWxlcyB3ZXJlIGFscmVhZHkgZHJvcHBlZCBieSB0aGUgYnVpbGQuXG4gICAgICBgLS10ZXN0TWF0Y2g9XCI8cm9vdERpcj4vKiovKi5tanNcImAsXG5cbiAgICAgIC8vIExvYWQgcG9seWZpbGxzIGFuZCBpbml0aWFsaXplIHRoZSBlbnZpcm9ubWVudCBiZWZvcmUgZXhlY3V0aW5nIGVhY2ggdGVzdCBmaWxlLlxuICAgICAgLy8gSU1QT1JUQU5UOiBPcmRlciBtYXR0ZXJzIGhlcmUuXG4gICAgICAvLyBGaXJzdCwgd2UgZXhlY3V0ZSBgamVzdC1nbG9iYWwubWpzYCB0byBpbml0aWFsaXplIHRoZSBgamVzdGAgZ2xvYmFsIHZhcmlhYmxlLlxuICAgICAgLy8gU2Vjb25kLCB3ZSBleGVjdXRlIHVzZXIgcG9seWZpbGxzLCBpbmNsdWRpbmcgYHpvbmUuanNgIGFuZCBgem9uZS5qcy90ZXN0aW5nYC4gVGhpcyBpcyBkZXBlbmRlbnQgb24gdGhlIEplc3QgZ2xvYmFsIHNvIGl0IGNhbiBwYXRjaFxuICAgICAgLy8gdGhlIGVudmlyb25tZW50IGZvciBmYWtlIGFzeW5jIHRvIHdvcmsgY29ycmVjdGx5LlxuICAgICAgLy8gVGhpcmQsIHdlIGluaXRpYWxpemUgYFRlc3RCZWRgLiBUaGlzIGlzIGRlcGVuZGVudCBvbiBmYWtlIGFzeW5jIGJlaW5nIHNldCB1cCBjb3JyZWN0bHkgYmVmb3JlaGFuZC5cbiAgICAgIGAtLXNldHVwRmlsZXNBZnRlckVudj1cIjxyb290RGlyPi9qZXN0LWdsb2JhbC5tanNcImAsXG4gICAgICAuLi4ob3B0aW9ucy5wb2x5ZmlsbHMgPyBbYC0tc2V0dXBGaWxlc0FmdGVyRW52PVwiPHJvb3REaXI+L3BvbHlmaWxscy5tanNcImBdIDogW10pLFxuICAgICAgYC0tc2V0dXBGaWxlc0FmdGVyRW52PVwiPHJvb3REaXI+L2luaXQtdGVzdC1iZWQubWpzXCJgLFxuXG4gICAgICAvLyBEb24ndCBydW4gYW55IGluZnJhc3RydWN0dXJlIGZpbGVzIGFzIHRlc3RzLCB0aGV5IGFyZSBtYW51YWxseSBsb2FkZWQgd2hlcmUgbmVlZGVkLlxuICAgICAgYC0tdGVzdFBhdGhJZ25vcmVQYXR0ZXJucz1cIjxyb290RGlyPi9qZXN0LWdsb2JhbFxcXFwubWpzXCJgLFxuICAgICAgLi4uKG9wdGlvbnMucG9seWZpbGxzID8gW2AtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vcG9seWZpbGxzXFxcXC5tanNcImBdIDogW10pLFxuICAgICAgYC0tdGVzdFBhdGhJZ25vcmVQYXR0ZXJucz1cIjxyb290RGlyPi9pbml0LXRlc3QtYmVkXFxcXC5tanNcImAsXG5cbiAgICAgIC8vIFNraXAgc2hhcmVkIGNodW5rcywgYXMgdGhleSBhcmUgbm90IGVudHJ5IHBvaW50cyB0byB0ZXN0cy5cbiAgICAgIGAtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vY2h1bmstLipcXFxcLm1qc1wiYCxcblxuICAgICAgLy8gT3B0aW9uYWxseSBlbmFibGUgY29sb3IuXG4gICAgICAuLi4oY29sb3JzLmVuYWJsZWQgPyBbJy0tY29sb3JzJ10gOiBbXSksXG4gICAgXSk7XG5cbiAgICAvLyBTdHJlYW0gdGVzdCBvdXRwdXQgdG8gdGhlIHRlcm1pbmFsLlxuICAgIGplc3RQcm9jLmNoaWxkLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2h1bmspO1xuICAgIH0pO1xuICAgIGplc3RQcm9jLmNoaWxkLnN0ZGVycj8ub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgIC8vIFdyaXRlIHRvIHN0ZGVyciBkaXJlY3RseSBpbnN0ZWFkIG9mIGBjb250ZXh0LmxvZ2dlci5lcnJvcihjaHVuaylgIGJlY2F1c2UgdGhlIGxvZ2dlciB3aWxsIG92ZXJ3cml0ZSBKZXN0J3MgY29sb3JpbmcgaW5mb3JtYXRpb24uXG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShjaHVuayk7XG4gICAgfSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgamVzdFByb2M7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE5vIG5lZWQgdG8gcHJvcGFnYXRlIGVycm9yIG1lc3NhZ2UsIGFscmVhZHkgcGlwZWQgdG8gdGVybWluYWwgb3V0cHV0LlxuICAgICAgLy8gVE9ETyhkZ3AxMTMwKTogSGFuZGxlIHByb2Nlc3Mgc3Bhd25pbmcgZmFpbHVyZXMuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgfSxcbik7XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgb3B0aW9uczogQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zLFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBfIG9mIGJ1aWxkQXBwbGljYXRpb25JbnRlcm5hbChvcHRpb25zLCBjb250ZXh0KSkge1xuICAgICAgLy8gTm90aGluZyB0byBkbyBmb3IgZWFjaCBldmVudCwganVzdCB3YWl0IGZvciB0aGUgd2hvbGUgYnVpbGQuXG4gICAgfVxuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSxcbiAgICB9O1xuICB9XG59XG5cbi8qKiBTYWZlbHkgcmVzb2x2ZXMgdGhlIGdpdmVuIE5vZGUgbW9kdWxlIHN0cmluZy4gKi9cbmZ1bmN0aW9uIHJlc29sdmVNb2R1bGUobW9kdWxlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICB0cnkge1xuICAgIHJldHVybiByZXF1aXJlLnJlc29sdmUobW9kdWxlKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuIl19