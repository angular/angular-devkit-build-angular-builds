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
const browser_esbuild_1 = require("../browser-esbuild");
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
        commonChunk: false,
        optimization: false,
        buildOptimizer: false,
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
    const jestProc = execFile('node', [
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
        for await (const _ of (0, browser_esbuild_1.buildEsbuildBrowserInternal)(options, context)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9qZXN0L2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaURBQXVEO0FBQ3ZELDJDQUE2QjtBQUM3QiwrQkFBaUM7QUFDakMsNkNBQTJDO0FBQzNDLHdEQUFpRTtBQUVqRSxzREFBMEQ7QUFDMUQsdUNBQTZDO0FBRTdDLDZDQUE2QztBQUU3QyxNQUFNLFFBQVEsR0FBRyxJQUFBLGdCQUFTLEVBQUMsd0JBQVUsQ0FBQyxDQUFDO0FBRXZDLG9EQUFvRDtBQUNwRCxrQkFBZSxJQUFBLHlCQUFhLEVBQzFCLEtBQUssRUFBRSxNQUF5QixFQUFFLE9BQXVCLEVBQTBCLEVBQUU7SUFDbkYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLG9GQUFvRixDQUNyRixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsSUFBQSwwQkFBZ0IsRUFBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxNQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsQ0FBQyx5Q0FBeUM7SUFFMUUsNERBQTREO0lBQzVELHFJQUFxSTtJQUNySSxnRUFBZ0U7SUFDaEUsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzVDLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxvRUFBb0U7WUFDcEUsS0FBSyxFQUNILG1HQUFtRztTQUN0RyxDQUFDO0tBQ0g7SUFFRCxpREFBaUQ7SUFDakQsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDNUQsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUs7WUFDZCxvRUFBb0U7WUFDcEUsS0FBSyxFQUNILDZHQUE2RztTQUNoSCxDQUFDO0tBQ0g7SUFFRCw0QkFBNEI7SUFDNUIsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFBLDBCQUFhLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUN0RSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQzNELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG1CQUFtQixDQUFDLENBQUM7SUFDOUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFO1FBQ3ZDLG1GQUFtRjtRQUNuRixXQUFXLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLFNBQVMsRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDN0QsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1FBQzFCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUyxJQUFJLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDO1FBQzlELFVBQVUsRUFBRSxPQUFPO1FBQ25CLEdBQUcsRUFBRSxLQUFLO1FBQ1YsS0FBSyxFQUFFLElBQUk7UUFDWCxhQUFhLEVBQUUsc0JBQWEsQ0FBQyxJQUFJO1FBQ2pDLFlBQVksRUFBRSxLQUFLO1FBQ25CLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLFlBQVksRUFBRSxLQUFLO1FBQ25CLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLFNBQVMsRUFBRTtZQUNULE9BQU8sRUFBRSxJQUFJO1lBQ2IsTUFBTSxFQUFFLEtBQUs7WUFDYixNQUFNLEVBQUUsS0FBSztTQUNkO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7UUFDeEIsT0FBTyxXQUFXLENBQUM7S0FDcEI7SUFFRCw4Q0FBOEM7SUFDOUMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRTtRQUNoQywyQkFBMkI7UUFDM0IsSUFBSTtRQUVKLGNBQWMsT0FBTyxHQUFHO1FBQ3hCLHlCQUF5QjtRQUV6Qiw2RkFBNkY7UUFDN0YsWUFBWTtRQUVaLHlHQUF5RztRQUN6RyxrQ0FBa0M7UUFFbEMsaUZBQWlGO1FBQ2pGLGlDQUFpQztRQUNqQyxnRkFBZ0Y7UUFDaEYscUlBQXFJO1FBQ3JJLG9EQUFvRDtRQUNwRCxxR0FBcUc7UUFDckcsa0RBQWtEO1FBQ2xELEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNoRixvREFBb0Q7UUFFcEQsc0ZBQXNGO1FBQ3RGLHdEQUF3RDtRQUN4RCxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxzREFBc0QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEYsMERBQTBEO1FBRTFELDZEQUE2RDtRQUM3RCxxREFBcUQ7UUFFckQsMkJBQTJCO1FBQzNCLEdBQUcsQ0FBQyxjQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7S0FDeEMsQ0FBQyxDQUFDO0lBRUgsc0NBQXNDO0lBQ3RDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUMxQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUMsQ0FBQztJQUNILFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUMxQyxtSUFBbUk7UUFDbkksT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDOUIsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJO1FBQ0YsTUFBTSxRQUFRLENBQUM7S0FDaEI7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLHdFQUF3RTtRQUN4RSxtREFBbUQ7UUFDbkQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDM0IsQ0FBQyxDQUNGLENBQUM7QUFFRixLQUFLLFVBQVUsS0FBSyxDQUNsQixPQUF1QixFQUN2QixPQUE4QjtJQUU5QixJQUFJO1FBQ0YsSUFBSSxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBQSw2Q0FBMkIsRUFBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUU7WUFDbkUsK0RBQStEO1NBQ2hFO1FBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUMxQjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osT0FBTztZQUNMLE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFHLEdBQWEsQ0FBQyxPQUFPO1NBQzlCLENBQUM7S0FDSDtBQUNILENBQUM7QUFFRCxvREFBb0Q7QUFDcEQsU0FBUyxhQUFhLENBQUMsTUFBYztJQUNuQyxJQUFJO1FBQ0YsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2hDO0lBQUMsTUFBTTtRQUNOLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZXhlY0ZpbGUgYXMgZXhlY0ZpbGVDYiB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlckludGVybmFsIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB7IEJyb3dzZXJFc2J1aWxkT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zJztcbmltcG9ydCB7IE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQvc2NoZW1hJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEplc3RCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgZmluZFRlc3RGaWxlcyB9IGZyb20gJy4vdGVzdC1maWxlcyc7XG5cbmNvbnN0IGV4ZWNGaWxlID0gcHJvbWlzaWZ5KGV4ZWNGaWxlQ2IpO1xuXG4vKiogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBKZXN0IGJ1aWxkZXIuICovXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKFxuICBhc3luYyAoc2NoZW1hOiBKZXN0QnVpbGRlclNjaGVtYSwgY29udGV4dDogQnVpbGRlckNvbnRleHQpOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+ID0+IHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgJ05PVEU6IFRoZSBKZXN0IGJ1aWxkZXIgaXMgY3VycmVudGx5IEVYUEVSSU1FTlRBTCBhbmQgbm90IHJlYWR5IGZvciBwcm9kdWN0aW9uIHVzZS4nLFxuICAgICk7XG5cbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhzY2hlbWEpO1xuICAgIGNvbnN0IHRlc3RPdXQgPSAnZGlzdC90ZXN0LW91dCc7IC8vIFRPRE8oZGdwMTEzMCk6IEhpZGUgaW4gdGVtcCBkaXJlY3RvcnkuXG5cbiAgICAvLyBWZXJpZnkgSmVzdCBpbnN0YWxsYXRpb24gYW5kIGdldCB0aGUgcGF0aCB0byBpdCdzIGJpbmFyeS5cbiAgICAvLyBXZSBuZWVkIHRvIGBub2RlX21vZHVsZXMvLmJpbi9qZXN0YCwgYnV0IHRoZXJlIGlzIG5vIG1lYW5zIHRvIHJlc29sdmUgdGhhdCBkaXJlY3RseS4gRm9ydHVuYXRlbHkgSmVzdCdzIGBwYWNrYWdlLmpzb25gIGV4cG9ydHMgdGhlXG4gICAgLy8gc2FtZSBmaWxlIGF0IGBiaW4vamVzdGAsIHNvIHdlIGNhbiBqdXN0IHJlc29sdmUgdGhhdCBpbnN0ZWFkLlxuICAgIGNvbnN0IGplc3QgPSByZXNvbHZlTW9kdWxlKCdqZXN0L2Jpbi9qZXN0Jyk7XG4gICAgaWYgKCFqZXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgLy8gVE9ETyhkZ3AxMTMwKTogRGlzcGxheSBhIG1vcmUgYWNjdXJhdGUgbWVzc2FnZSBmb3Igbm9uLU5QTSB1c2Vycy5cbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgJ0plc3QgaXMgbm90IGluc3RhbGxlZCwgbW9zdCBsaWtlbHkgeW91IG5lZWQgdG8gcnVuIGBucG0gaW5zdGFsbCBqZXN0IC0tc2F2ZS1kZXZgIGluIHlvdXIgcHJvamVjdC4nLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBWZXJpZnkgdGhhdCBKU0RvbSBpcyBpbnN0YWxsZWQgaW4gdGhlIHByb2plY3QuXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSByZXNvbHZlTW9kdWxlKCdqZXN0LWVudmlyb25tZW50LWpzZG9tJyk7XG4gICAgaWYgKCFlbnZpcm9ubWVudCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIC8vIFRPRE8oZGdwMTEzMCk6IERpc3BsYXkgYSBtb3JlIGFjY3VyYXRlIG1lc3NhZ2UgZm9yIG5vbi1OUE0gdXNlcnMuXG4gICAgICAgIGVycm9yOlxuICAgICAgICAgICdgamVzdC1lbnZpcm9ubWVudC1qc2RvbWAgaXMgbm90IGluc3RhbGxlZC4gSW5zdGFsbCBpdCB3aXRoIGBucG0gaW5zdGFsbCBqZXN0LWVudmlyb25tZW50LWpzZG9tIC0tc2F2ZS1kZXZgLicsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEJ1aWxkIGFsbCB0aGUgdGVzdCBmaWxlcy5cbiAgICBjb25zdCB0ZXN0RmlsZXMgPSBhd2FpdCBmaW5kVGVzdEZpbGVzKG9wdGlvbnMsIGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG4gICAgY29uc3QgamVzdEdsb2JhbCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdqZXN0LWdsb2JhbC5tanMnKTtcbiAgICBjb25zdCBpbml0VGVzdEJlZCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdpbml0LXRlc3QtYmVkLm1qcycpO1xuICAgIGNvbnN0IGJ1aWxkUmVzdWx0ID0gYXdhaXQgYnVpbGQoY29udGV4dCwge1xuICAgICAgLy8gQnVpbGQgYWxsIHRoZSB0ZXN0IGZpbGVzIGFuZCBhbHNvIHRoZSBgamVzdC1nbG9iYWxgIGFuZCBgaW5pdC10ZXN0LWJlZGAgc2NyaXB0cy5cbiAgICAgIGVudHJ5UG9pbnRzOiBuZXcgU2V0KFsuLi50ZXN0RmlsZXMsIGplc3RHbG9iYWwsIGluaXRUZXN0QmVkXSksXG4gICAgICB0c0NvbmZpZzogb3B0aW9ucy50c0NvbmZpZyxcbiAgICAgIHBvbHlmaWxsczogb3B0aW9ucy5wb2x5ZmlsbHMgPz8gWyd6b25lLmpzJywgJ3pvbmUuanMvdGVzdGluZyddLFxuICAgICAgb3V0cHV0UGF0aDogdGVzdE91dCxcbiAgICAgIGFvdDogZmFsc2UsXG4gICAgICBpbmRleDogbnVsbCxcbiAgICAgIG91dHB1dEhhc2hpbmc6IE91dHB1dEhhc2hpbmcuTm9uZSxcbiAgICAgIG91dEV4dGVuc2lvbjogJ21qcycsIC8vIEZvcmNlIG5hdGl2ZSBFU00uXG4gICAgICBjb21tb25DaHVuazogZmFsc2UsXG4gICAgICBvcHRpbWl6YXRpb246IGZhbHNlLFxuICAgICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgICAgc291cmNlTWFwOiB7XG4gICAgICAgIHNjcmlwdHM6IHRydWUsXG4gICAgICAgIHN0eWxlczogZmFsc2UsXG4gICAgICAgIHZlbmRvcjogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGlmICghYnVpbGRSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgcmV0dXJuIGJ1aWxkUmVzdWx0O1xuICAgIH1cblxuICAgIC8vIEV4ZWN1dGUgSmVzdCBvbiB0aGUgYnVpbHQgb3V0cHV0IGRpcmVjdG9yeS5cbiAgICBjb25zdCBqZXN0UHJvYyA9IGV4ZWNGaWxlKCdub2RlJywgW1xuICAgICAgJy0tZXhwZXJpbWVudGFsLXZtLW1vZHVsZXMnLFxuICAgICAgamVzdCxcblxuICAgICAgYC0tcm9vdERpcj1cIiR7dGVzdE91dH1cImAsXG4gICAgICAnLS10ZXN0RW52aXJvbm1lbnQ9anNkb20nLFxuXG4gICAgICAvLyBUT0RPKGRncDExMzApOiBFbmFibGUgY2FjaGUgb25jZSB3ZSBoYXZlIGEgbWVjaGFuaXNtIGZvciBwcm9wZXJseSBjbGVhcmluZyAvIGRpc2FibGluZyBpdC5cbiAgICAgICctLW5vLWNhY2hlJyxcblxuICAgICAgLy8gUnVuIGJhc2ljYWxseSBhbGwgZmlsZXMgaW4gdGhlIG91dHB1dCBkaXJlY3RvcnksIGFueSBleGNsdWRlZCBmaWxlcyB3ZXJlIGFscmVhZHkgZHJvcHBlZCBieSB0aGUgYnVpbGQuXG4gICAgICBgLS10ZXN0TWF0Y2g9XCI8cm9vdERpcj4vKiovKi5tanNcImAsXG5cbiAgICAgIC8vIExvYWQgcG9seWZpbGxzIGFuZCBpbml0aWFsaXplIHRoZSBlbnZpcm9ubWVudCBiZWZvcmUgZXhlY3V0aW5nIGVhY2ggdGVzdCBmaWxlLlxuICAgICAgLy8gSU1QT1JUQU5UOiBPcmRlciBtYXR0ZXJzIGhlcmUuXG4gICAgICAvLyBGaXJzdCwgd2UgZXhlY3V0ZSBgamVzdC1nbG9iYWwubWpzYCB0byBpbml0aWFsaXplIHRoZSBgamVzdGAgZ2xvYmFsIHZhcmlhYmxlLlxuICAgICAgLy8gU2Vjb25kLCB3ZSBleGVjdXRlIHVzZXIgcG9seWZpbGxzLCBpbmNsdWRpbmcgYHpvbmUuanNgIGFuZCBgem9uZS5qcy90ZXN0aW5nYC4gVGhpcyBpcyBkZXBlbmRlbnQgb24gdGhlIEplc3QgZ2xvYmFsIHNvIGl0IGNhbiBwYXRjaFxuICAgICAgLy8gdGhlIGVudmlyb25tZW50IGZvciBmYWtlIGFzeW5jIHRvIHdvcmsgY29ycmVjdGx5LlxuICAgICAgLy8gVGhpcmQsIHdlIGluaXRpYWxpemUgYFRlc3RCZWRgLiBUaGlzIGlzIGRlcGVuZGVudCBvbiBmYWtlIGFzeW5jIGJlaW5nIHNldCB1cCBjb3JyZWN0bHkgYmVmb3JlaGFuZC5cbiAgICAgIGAtLXNldHVwRmlsZXNBZnRlckVudj1cIjxyb290RGlyPi9qZXN0LWdsb2JhbC5tanNcImAsXG4gICAgICAuLi4ob3B0aW9ucy5wb2x5ZmlsbHMgPyBbYC0tc2V0dXBGaWxlc0FmdGVyRW52PVwiPHJvb3REaXI+L3BvbHlmaWxscy5tanNcImBdIDogW10pLFxuICAgICAgYC0tc2V0dXBGaWxlc0FmdGVyRW52PVwiPHJvb3REaXI+L2luaXQtdGVzdC1iZWQubWpzXCJgLFxuXG4gICAgICAvLyBEb24ndCBydW4gYW55IGluZnJhc3RydWN0dXJlIGZpbGVzIGFzIHRlc3RzLCB0aGV5IGFyZSBtYW51YWxseSBsb2FkZWQgd2hlcmUgbmVlZGVkLlxuICAgICAgYC0tdGVzdFBhdGhJZ25vcmVQYXR0ZXJucz1cIjxyb290RGlyPi9qZXN0LWdsb2JhbFxcXFwubWpzXCJgLFxuICAgICAgLi4uKG9wdGlvbnMucG9seWZpbGxzID8gW2AtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vcG9seWZpbGxzXFxcXC5tanNcImBdIDogW10pLFxuICAgICAgYC0tdGVzdFBhdGhJZ25vcmVQYXR0ZXJucz1cIjxyb290RGlyPi9pbml0LXRlc3QtYmVkXFxcXC5tanNcImAsXG5cbiAgICAgIC8vIFNraXAgc2hhcmVkIGNodW5rcywgYXMgdGhleSBhcmUgbm90IGVudHJ5IHBvaW50cyB0byB0ZXN0cy5cbiAgICAgIGAtLXRlc3RQYXRoSWdub3JlUGF0dGVybnM9XCI8cm9vdERpcj4vY2h1bmstLipcXFxcLm1qc1wiYCxcblxuICAgICAgLy8gT3B0aW9uYWxseSBlbmFibGUgY29sb3IuXG4gICAgICAuLi4oY29sb3JzLmVuYWJsZWQgPyBbJy0tY29sb3JzJ10gOiBbXSksXG4gICAgXSk7XG5cbiAgICAvLyBTdHJlYW0gdGVzdCBvdXRwdXQgdG8gdGhlIHRlcm1pbmFsLlxuICAgIGplc3RQcm9jLmNoaWxkLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2h1bmspO1xuICAgIH0pO1xuICAgIGplc3RQcm9jLmNoaWxkLnN0ZGVycj8ub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgIC8vIFdyaXRlIHRvIHN0ZGVyciBkaXJlY3RseSBpbnN0ZWFkIG9mIGBjb250ZXh0LmxvZ2dlci5lcnJvcihjaHVuaylgIGJlY2F1c2UgdGhlIGxvZ2dlciB3aWxsIG92ZXJ3cml0ZSBKZXN0J3MgY29sb3JpbmcgaW5mb3JtYXRpb24uXG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShjaHVuayk7XG4gICAgfSk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgamVzdFByb2M7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE5vIG5lZWQgdG8gcHJvcGFnYXRlIGVycm9yIG1lc3NhZ2UsIGFscmVhZHkgcGlwZWQgdG8gdGVybWluYWwgb3V0cHV0LlxuICAgICAgLy8gVE9ETyhkZ3AxMTMwKTogSGFuZGxlIHByb2Nlc3Mgc3Bhd25pbmcgZmFpbHVyZXMuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgfSxcbik7XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgb3B0aW9uczogQnJvd3NlckVzYnVpbGRPcHRpb25zLFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBfIG9mIGJ1aWxkRXNidWlsZEJyb3dzZXJJbnRlcm5hbChvcHRpb25zLCBjb250ZXh0KSkge1xuICAgICAgLy8gTm90aGluZyB0byBkbyBmb3IgZWFjaCBldmVudCwganVzdCB3YWl0IGZvciB0aGUgd2hvbGUgYnVpbGQuXG4gICAgfVxuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSxcbiAgICB9O1xuICB9XG59XG5cbi8qKiBTYWZlbHkgcmVzb2x2ZXMgdGhlIGdpdmVuIE5vZGUgbW9kdWxlIHN0cmluZy4gKi9cbmZ1bmN0aW9uIHJlc29sdmVNb2R1bGUobW9kdWxlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICB0cnkge1xuICAgIHJldHVybiByZXF1aXJlLnJlc29sdmUobW9kdWxlKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuIl19