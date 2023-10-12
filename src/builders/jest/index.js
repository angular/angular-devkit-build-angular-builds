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
        index: false,
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
        `--rootDir="${path.join(testOut, 'browser')}"`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9qZXN0L2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaURBQXVEO0FBQ3ZELDJDQUE2QjtBQUM3QiwrQkFBaUM7QUFDakMsNkNBQTJDO0FBQzNDLGdEQUEwRDtBQUUxRCxzREFBMEQ7QUFDMUQsdUNBQTZDO0FBRTdDLDZDQUE2QztBQUU3QyxNQUFNLFFBQVEsR0FBRyxJQUFBLGdCQUFTLEVBQUMsd0JBQVUsQ0FBQyxDQUFDO0FBRXZDLG9EQUFvRDtBQUNwRCxrQkFBZSxJQUFBLHlCQUFhLEVBQzFCLEtBQUssRUFBRSxNQUF5QixFQUFFLE9BQXVCLEVBQTBCLEVBQUU7SUFDbkYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLG9GQUFvRixDQUNyRixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsSUFBQSwwQkFBZ0IsRUFBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxNQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsQ0FBQyx5Q0FBeUM7SUFFMUUsNERBQTREO0lBQzVELHFJQUFxSTtJQUNySSxnRUFBZ0U7SUFDaEUsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzVDLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxvRUFBb0U7WUFDcEUsS0FBSyxFQUNILG1HQUFtRztTQUN0RyxDQUFDO0tBQ0g7SUFFRCxpREFBaUQ7SUFDakQsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDNUQsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixP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LENBQUM7SUFFSCxJQUFJO1FBQ0YsTUFBTSxRQUFRLENBQUM7S0FDaEI7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLHdFQUF3RTtRQUN4RSxtREFBbUQ7UUFDbkQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDM0IsQ0FBQyxDQUNGLENBQUM7QUFFRixLQUFLLFVBQVUsS0FBSyxDQUNsQixPQUF1QixFQUN2QixPQUEwQztJQUUxQyxJQUFJO1FBQ0YsSUFBSSxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBQSxzQ0FBd0IsRUFBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUU7WUFDaEUsK0RBQStEO1NBQ2hFO1FBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUMxQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osT0FBTztZQUNMLE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFHLEdBQWEsQ0FBQyxPQUFPO1NBQzlCLENBQUM7S0FDSDtBQUNILENBQUM7QUFFRCxvREFBb0Q7QUFDcEQsU0FBUyxhQUFhLENBQUMsTUFBYztJQUNuQyxJQUFJO1FBQ0YsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2hDO0lBQUMsTUFBTTtRQUNOLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZXhlY0ZpbGUgYXMgZXhlY0ZpbGVDYiB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgYnVpbGRBcHBsaWNhdGlvbkludGVybmFsIH0gZnJvbSAnLi4vYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zIH0gZnJvbSAnLi4vYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IFNjaGVtYSBhcyBKZXN0QnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGZpbmRUZXN0RmlsZXMgfSBmcm9tICcuL3Rlc3QtZmlsZXMnO1xuXG5jb25zdCBleGVjRmlsZSA9IHByb21pc2lmeShleGVjRmlsZUNiKTtcblxuLyoqIE1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgSmVzdCBidWlsZGVyLiAqL1xuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihcbiAgYXN5bmMgKHNjaGVtYTogSmVzdEJ1aWxkZXJTY2hlbWEsIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiA9PiB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdOT1RFOiBUaGUgSmVzdCBidWlsZGVyIGlzIGN1cnJlbnRseSBFWFBFUklNRU5UQUwgYW5kIG5vdCByZWFkeSBmb3IgcHJvZHVjdGlvbiB1c2UuJyxcbiAgICApO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoc2NoZW1hKTtcbiAgICBjb25zdCB0ZXN0T3V0ID0gJ2Rpc3QvdGVzdC1vdXQnOyAvLyBUT0RPKGRncDExMzApOiBIaWRlIGluIHRlbXAgZGlyZWN0b3J5LlxuXG4gICAgLy8gVmVyaWZ5IEplc3QgaW5zdGFsbGF0aW9uIGFuZCBnZXQgdGhlIHBhdGggdG8gaXQncyBiaW5hcnkuXG4gICAgLy8gV2UgbmVlZCB0byBgbm9kZV9tb2R1bGVzLy5iaW4vamVzdGAsIGJ1dCB0aGVyZSBpcyBubyBtZWFucyB0byByZXNvbHZlIHRoYXQgZGlyZWN0bHkuIEZvcnR1bmF0ZWx5IEplc3QncyBgcGFja2FnZS5qc29uYCBleHBvcnRzIHRoZVxuICAgIC8vIHNhbWUgZmlsZSBhdCBgYmluL2plc3RgLCBzbyB3ZSBjYW4ganVzdCByZXNvbHZlIHRoYXQgaW5zdGVhZC5cbiAgICBjb25zdCBqZXN0ID0gcmVzb2x2ZU1vZHVsZSgnamVzdC9iaW4vamVzdCcpO1xuICAgIGlmICghamVzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIC8vIFRPRE8oZGdwMTEzMCk6IERpc3BsYXkgYSBtb3JlIGFjY3VyYXRlIG1lc3NhZ2UgZm9yIG5vbi1OUE0gdXNlcnMuXG4gICAgICAgIGVycm9yOlxuICAgICAgICAgICdKZXN0IGlzIG5vdCBpbnN0YWxsZWQsIG1vc3QgbGlrZWx5IHlvdSBuZWVkIHRvIHJ1biBgbnBtIGluc3RhbGwgamVzdCAtLXNhdmUtZGV2YCBpbiB5b3VyIHByb2plY3QuJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVmVyaWZ5IHRoYXQgSlNEb20gaXMgaW5zdGFsbGVkIGluIHRoZSBwcm9qZWN0LlxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcmVzb2x2ZU1vZHVsZSgnamVzdC1lbnZpcm9ubWVudC1qc2RvbScpO1xuICAgIGlmICghZW52aXJvbm1lbnQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAvLyBUT0RPKGRncDExMzApOiBEaXNwbGF5IGEgbW9yZSBhY2N1cmF0ZSBtZXNzYWdlIGZvciBub24tTlBNIHVzZXJzLlxuICAgICAgICBlcnJvcjpcbiAgICAgICAgICAnYGplc3QtZW52aXJvbm1lbnQtanNkb21gIGlzIG5vdCBpbnN0YWxsZWQuIEluc3RhbGwgaXQgd2l0aCBgbnBtIGluc3RhbGwgamVzdC1lbnZpcm9ubWVudC1qc2RvbSAtLXNhdmUtZGV2YC4nLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCBhbGwgdGhlIHRlc3QgZmlsZXMuXG4gICAgY29uc3QgdGVzdEZpbGVzID0gYXdhaXQgZmluZFRlc3RGaWxlcyhvcHRpb25zLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuICAgIGNvbnN0IGplc3RHbG9iYWwgPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnamVzdC1nbG9iYWwubWpzJyk7XG4gICAgY29uc3QgaW5pdFRlc3RCZWQgPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnaW5pdC10ZXN0LWJlZC5tanMnKTtcbiAgICBjb25zdCBidWlsZFJlc3VsdCA9IGF3YWl0IGJ1aWxkKGNvbnRleHQsIHtcbiAgICAgIC8vIEJ1aWxkIGFsbCB0aGUgdGVzdCBmaWxlcyBhbmQgYWxzbyB0aGUgYGplc3QtZ2xvYmFsYCBhbmQgYGluaXQtdGVzdC1iZWRgIHNjcmlwdHMuXG4gICAgICBlbnRyeVBvaW50czogbmV3IFNldChbLi4udGVzdEZpbGVzLCBqZXN0R2xvYmFsLCBpbml0VGVzdEJlZF0pLFxuICAgICAgdHNDb25maWc6IG9wdGlvbnMudHNDb25maWcsXG4gICAgICBwb2x5ZmlsbHM6IG9wdGlvbnMucG9seWZpbGxzID8/IFsnem9uZS5qcycsICd6b25lLmpzL3Rlc3RpbmcnXSxcbiAgICAgIG91dHB1dFBhdGg6IHRlc3RPdXQsXG4gICAgICBhb3Q6IGZhbHNlLFxuICAgICAgaW5kZXg6IGZhbHNlLFxuICAgICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgICAgb3V0RXh0ZW5zaW9uOiAnbWpzJywgLy8gRm9yY2UgbmF0aXZlIEVTTS5cbiAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBzb3VyY2VNYXA6IHtcbiAgICAgICAgc2NyaXB0czogdHJ1ZSxcbiAgICAgICAgc3R5bGVzOiBmYWxzZSxcbiAgICAgICAgdmVuZG9yOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgaWYgKCFidWlsZFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICByZXR1cm4gYnVpbGRSZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gRXhlY3V0ZSBKZXN0IG9uIHRoZSBidWlsdCBvdXRwdXQgZGlyZWN0b3J5LlxuICAgIGNvbnN0IGplc3RQcm9jID0gZXhlY0ZpbGUocHJvY2Vzcy5leGVjUGF0aCwgW1xuICAgICAgJy0tZXhwZXJpbWVudGFsLXZtLW1vZHVsZXMnLFxuICAgICAgamVzdCxcblxuICAgICAgYC0tcm9vdERpcj1cIiR7cGF0aC5qb2luKHRlc3RPdXQsICdicm93c2VyJyl9XCJgLFxuICAgICAgJy0tdGVzdEVudmlyb25tZW50PWpzZG9tJyxcblxuICAgICAgLy8gVE9ETyhkZ3AxMTMwKTogRW5hYmxlIGNhY2hlIG9uY2Ugd2UgaGF2ZSBhIG1lY2hhbmlzbSBmb3IgcHJvcGVybHkgY2xlYXJpbmcgLyBkaXNhYmxpbmcgaXQuXG4gICAgICAnLS1uby1jYWNoZScsXG5cbiAgICAgIC8vIFJ1biBiYXNpY2FsbHkgYWxsIGZpbGVzIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LCBhbnkgZXhjbHVkZWQgZmlsZXMgd2VyZSBhbHJlYWR5IGRyb3BwZWQgYnkgdGhlIGJ1aWxkLlxuICAgICAgYC0tdGVzdE1hdGNoPVwiPHJvb3REaXI+LyoqLyoubWpzXCJgLFxuXG4gICAgICAvLyBMb2FkIHBvbHlmaWxscyBhbmQgaW5pdGlhbGl6ZSB0aGUgZW52aXJvbm1lbnQgYmVmb3JlIGV4ZWN1dGluZyBlYWNoIHRlc3QgZmlsZS5cbiAgICAgIC8vIElNUE9SVEFOVDogT3JkZXIgbWF0dGVycyBoZXJlLlxuICAgICAgLy8gRmlyc3QsIHdlIGV4ZWN1dGUgYGplc3QtZ2xvYmFsLm1qc2AgdG8gaW5pdGlhbGl6ZSB0aGUgYGplc3RgIGdsb2JhbCB2YXJpYWJsZS5cbiAgICAgIC8vIFNlY29uZCwgd2UgZXhlY3V0ZSB1c2VyIHBvbHlmaWxscywgaW5jbHVkaW5nIGB6b25lLmpzYCBhbmQgYHpvbmUuanMvdGVzdGluZ2AuIFRoaXMgaXMgZGVwZW5kZW50IG9uIHRoZSBKZXN0IGdsb2JhbCBzbyBpdCBjYW4gcGF0Y2hcbiAgICAgIC8vIHRoZSBlbnZpcm9ubWVudCBmb3IgZmFrZSBhc3luYyB0byB3b3JrIGNvcnJlY3RseS5cbiAgICAgIC8vIFRoaXJkLCB3ZSBpbml0aWFsaXplIGBUZXN0QmVkYC4gVGhpcyBpcyBkZXBlbmRlbnQgb24gZmFrZSBhc3luYyBiZWluZyBzZXQgdXAgY29ycmVjdGx5IGJlZm9yZWhhbmQuXG4gICAgICBgLS1zZXR1cEZpbGVzQWZ0ZXJFbnY9XCI8cm9vdERpcj4vamVzdC1nbG9iYWwubWpzXCJgLFxuICAgICAgLi4uKG9wdGlvbnMucG9seWZpbGxzID8gW2AtLXNldHVwRmlsZXNBZnRlckVudj1cIjxyb290RGlyPi9wb2x5ZmlsbHMubWpzXCJgXSA6IFtdKSxcbiAgICAgIGAtLXNldHVwRmlsZXNBZnRlckVudj1cIjxyb290RGlyPi9pbml0LXRlc3QtYmVkLm1qc1wiYCxcblxuICAgICAgLy8gRG9uJ3QgcnVuIGFueSBpbmZyYXN0cnVjdHVyZSBmaWxlcyBhcyB0ZXN0cywgdGhleSBhcmUgbWFudWFsbHkgbG9hZGVkIHdoZXJlIG5lZWRlZC5cbiAgICAgIGAtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vamVzdC1nbG9iYWxcXFxcLm1qc1wiYCxcbiAgICAgIC4uLihvcHRpb25zLnBvbHlmaWxscyA/IFtgLS10ZXN0UGF0aElnbm9yZVBhdHRlcm5zPVwiPHJvb3REaXI+L3BvbHlmaWxsc1xcXFwubWpzXCJgXSA6IFtdKSxcbiAgICAgIGAtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vaW5pdC10ZXN0LWJlZFxcXFwubWpzXCJgLFxuXG4gICAgICAvLyBTa2lwIHNoYXJlZCBjaHVua3MsIGFzIHRoZXkgYXJlIG5vdCBlbnRyeSBwb2ludHMgdG8gdGVzdHMuXG4gICAgICBgLS10ZXN0UGF0aElnbm9yZVBhdHRlcm5zPVwiPHJvb3REaXI+L2NodW5rLS4qXFxcXC5tanNcImAsXG5cbiAgICAgIC8vIE9wdGlvbmFsbHkgZW5hYmxlIGNvbG9yLlxuICAgICAgLi4uKGNvbG9ycy5lbmFibGVkID8gWyctLWNvbG9ycyddIDogW10pLFxuICAgIF0pO1xuXG4gICAgLy8gU3RyZWFtIHRlc3Qgb3V0cHV0IHRvIHRoZSB0ZXJtaW5hbC5cbiAgICBqZXN0UHJvYy5jaGlsZC5zdGRvdXQ/Lm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNodW5rKTtcbiAgICB9KTtcbiAgICBqZXN0UHJvYy5jaGlsZC5zdGRlcnI/Lm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XG4gICAgICAvLyBXcml0ZSB0byBzdGRlcnIgZGlyZWN0bHkgaW5zdGVhZCBvZiBgY29udGV4dC5sb2dnZXIuZXJyb3IoY2h1bmspYCBiZWNhdXNlIHRoZSBsb2dnZXIgd2lsbCBvdmVyd3JpdGUgSmVzdCdzIGNvbG9yaW5nIGluZm9ybWF0aW9uLlxuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoY2h1bmspO1xuICAgIH0pO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGplc3RQcm9jO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBObyBuZWVkIHRvIHByb3BhZ2F0ZSBlcnJvciBtZXNzYWdlLCBhbHJlYWR5IHBpcGVkIHRvIHRlcm1pbmFsIG91dHB1dC5cbiAgICAgIC8vIFRPRE8oZGdwMTEzMCk6IEhhbmRsZSBwcm9jZXNzIHNwYXduaW5nIGZhaWx1cmVzLlxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gIH0sXG4pO1xuXG5hc3luYyBmdW5jdGlvbiBidWlsZChcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIG9wdGlvbnM6IEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgXyBvZiBidWlsZEFwcGxpY2F0aW9uSW50ZXJuYWwob3B0aW9ucywgY29udGV4dCkpIHtcbiAgICAgIC8vIE5vdGhpbmcgdG8gZG8gZm9yIGVhY2ggZXZlbnQsIGp1c3Qgd2FpdCBmb3IgdGhlIHdob2xlIGJ1aWxkLlxuICAgIH1cblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufVxuXG4vKiogU2FmZWx5IHJlc29sdmVzIHRoZSBnaXZlbiBOb2RlIG1vZHVsZSBzdHJpbmcuICovXG5mdW5jdGlvbiByZXNvbHZlTW9kdWxlKG1vZHVsZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVxdWlyZS5yZXNvbHZlKG1vZHVsZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cbiJdfQ==