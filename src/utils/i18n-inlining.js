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
exports.i18nInlineEmittedFiles = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const action_executor_1 = require("./action-executor");
const copy_assets_1 = require("./copy-assets");
const error_1 = require("./error");
const spinner_1 = require("./spinner");
function emittedFilesToInlineOptions(emittedFiles, scriptsEntryPointName, emittedPath, outputPath, es5, missingTranslation, context) {
    const options = [];
    const originalFiles = [];
    for (const emittedFile of emittedFiles) {
        if (emittedFile.asset ||
            emittedFile.extension !== '.js' ||
            (emittedFile.name && scriptsEntryPointName.includes(emittedFile.name))) {
            continue;
        }
        const originalPath = path.join(emittedPath, emittedFile.file);
        const action = {
            filename: emittedFile.file,
            code: fs.readFileSync(originalPath, 'utf8'),
            es5,
            outputPath,
            missingTranslation,
            setLocale: emittedFile.name === 'main' || emittedFile.name === 'vendor',
        };
        originalFiles.push(originalPath);
        try {
            const originalMapPath = originalPath + '.map';
            action.map = fs.readFileSync(originalMapPath, 'utf8');
            originalFiles.push(originalMapPath);
        }
        catch (err) {
            (0, error_1.assertIsError)(err);
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
        context.logger.debug(`i18n file queued for processing: ${action.filename}`);
        options.push(action);
    }
    return { options, originalFiles };
}
async function i18nInlineEmittedFiles(context, emittedFiles, i18n, baseOutputPath, outputPaths, scriptsEntryPointName, emittedPath, es5, missingTranslation) {
    const executor = new action_executor_1.BundleActionExecutor({ i18n });
    let hasErrors = false;
    const spinner = new spinner_1.Spinner();
    spinner.start('Generating localized bundles...');
    try {
        const { options, originalFiles: processedFiles } = emittedFilesToInlineOptions(emittedFiles, scriptsEntryPointName, emittedPath, baseOutputPath, es5, missingTranslation, context);
        for await (const result of executor.inlineAll(options)) {
            context.logger.debug(`i18n file processed: ${result.file}`);
            for (const diagnostic of result.diagnostics) {
                spinner.stop();
                if (diagnostic.type === 'error') {
                    hasErrors = true;
                    context.logger.error(diagnostic.message);
                }
                else {
                    context.logger.warn(diagnostic.message);
                }
                spinner.start();
            }
        }
        // Copy any non-processed files into the output locations
        await (0, copy_assets_1.copyAssets)([
            {
                glob: '**/*',
                input: emittedPath,
                output: '',
                ignore: [...processedFiles].map((f) => path.relative(emittedPath, f)),
            },
        ], outputPaths, '');
    }
    catch (err) {
        (0, error_1.assertIsError)(err);
        spinner.fail('Localized bundle generation failed: ' + err.message);
        return false;
    }
    finally {
        executor.stop();
    }
    if (hasErrors) {
        spinner.fail('Localized bundle generation failed.');
    }
    else {
        spinner.succeed('Localized bundle generation complete.');
    }
    return !hasErrors;
}
exports.i18nInlineEmittedFiles = i18nInlineEmittedFiles;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1pbmxpbmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4taW5saW5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHVEQUF5RDtBQUN6RCwrQ0FBMkM7QUFDM0MsbUNBQXdDO0FBR3hDLHVDQUFvQztBQUVwQyxTQUFTLDJCQUEyQixDQUNsQyxZQUE0QixFQUM1QixxQkFBK0IsRUFDL0IsV0FBbUIsRUFDbkIsVUFBa0IsRUFDbEIsR0FBWSxFQUNaLGtCQUE4RCxFQUM5RCxPQUF1QjtJQUV2QixNQUFNLE9BQU8sR0FBb0IsRUFBRSxDQUFDO0lBQ3BDLE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztJQUNuQyxLQUFLLE1BQU0sV0FBVyxJQUFJLFlBQVksRUFBRTtRQUN0QyxJQUNFLFdBQVcsQ0FBQyxLQUFLO1lBQ2pCLFdBQVcsQ0FBQyxTQUFTLEtBQUssS0FBSztZQUMvQixDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQUkscUJBQXFCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUN0RTtZQUNBLFNBQVM7U0FDVjtRQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBa0I7WUFDNUIsUUFBUSxFQUFFLFdBQVcsQ0FBQyxJQUFJO1lBQzFCLElBQUksRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUM7WUFDM0MsR0FBRztZQUNILFVBQVU7WUFDVixrQkFBa0I7WUFDbEIsU0FBUyxFQUFFLFdBQVcsQ0FBQyxJ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LElBQUEscUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQztRQUNuQixPQUFPLENBQUMsSUFBSSxDQUFDLHNDQUFzQyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVuRSxPQUFPLEtBQUssQ0FBQztLQUNkO1lBQVM7UUFDUixRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDakI7SUFFRCxJQUFJLFNBQVMsRUFBRTtRQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMscUNBQXFDLENBQUMsQ0FBQztLQUNyRDtTQUFNO1FBQ0wsT0FBTyxDQUFDLE9BQU8sQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0tBQzFEO0lBRUQsT0FBTyxDQUFDLFNBQVMsQ0FBQztBQUNwQixDQUFDO0FBdkVELHdEQXVFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgRW1pdHRlZEZpbGVzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEJ1bmRsZUFjdGlvbkV4ZWN1dG9yIH0gZnJvbSAnLi9hY3Rpb24tZXhlY3V0b3InO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4vY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBJbmxpbmVPcHRpb25zIH0gZnJvbSAnLi9wcm9jZXNzLWJ1bmRsZSc7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi9zcGlubmVyJztcblxuZnVuY3Rpb24gZW1pdHRlZEZpbGVzVG9JbmxpbmVPcHRpb25zKFxuICBlbWl0dGVkRmlsZXM6IEVtaXR0ZWRGaWxlc1tdLFxuICBzY3JpcHRzRW50cnlQb2ludE5hbWU6IHN0cmluZ1tdLFxuICBlbWl0dGVkUGF0aDogc3RyaW5nLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4gIGVzNTogYm9vbGVhbixcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScgfCB1bmRlZmluZWQsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogeyBvcHRpb25zOiBJbmxpbmVPcHRpb25zW107IG9yaWdpbmFsRmlsZXM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBvcHRpb25zOiBJbmxpbmVPcHRpb25zW10gPSBbXTtcbiAgY29uc3Qgb3JpZ2luYWxGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBlbWl0dGVkRmlsZSBvZiBlbWl0dGVkRmlsZXMpIHtcbiAgICBpZiAoXG4gICAgICBlbWl0dGVkRmlsZS5hc3NldCB8fFxuICAgICAgZW1pdHRlZEZpbGUuZXh0ZW5zaW9uICE9PSAnLmpzJyB8fFxuICAgICAgKGVtaXR0ZWRGaWxlLm5hbWUgJiYgc2NyaXB0c0VudHJ5UG9pbnROYW1lLmluY2x1ZGVzKGVtaXR0ZWRGaWxlLm5hbWUpKVxuICAgICkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxQYXRoID0gcGF0aC5qb2luKGVtaXR0ZWRQYXRoLCBlbWl0dGVkRmlsZS5maWxlKTtcbiAgICBjb25zdCBhY3Rpb246IElubGluZU9wdGlvbnMgPSB7XG4gICAgICBmaWxlbmFtZTogZW1pdHRlZEZpbGUuZmlsZSxcbiAgICAgIGNvZGU6IGZzLnJlYWRGaWxlU3luYyhvcmlnaW5hbFBhdGgsICd1dGY4JyksXG4gICAgICBlczUsXG4gICAgICBvdXRwdXRQYXRoLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgc2V0TG9jYWxlOiBlbWl0dGVkRmlsZS5uYW1lID09PSAnbWFpbicgfHwgZW1pdHRlZEZpbGUubmFtZSA9PT0gJ3ZlbmRvcicsXG4gICAgfTtcbiAgICBvcmlnaW5hbEZpbGVzLnB1c2gob3JpZ2luYWxQYXRoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBvcmlnaW5hbE1hcFBhdGggPSBvcmlnaW5hbFBhdGggKyAnLm1hcCc7XG4gICAgICBhY3Rpb24ubWFwID0gZnMucmVhZEZpbGVTeW5jKG9yaWdpbmFsTWFwUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIG9yaWdpbmFsRmlsZXMucHVzaChvcmlnaW5hbE1hcFBhdGgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuICAgICAgaWYgKGVyci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29udGV4dC5sb2dnZXIuZGVidWcoYGkxOG4gZmlsZSBxdWV1ZWQgZm9yIHByb2Nlc3Npbmc6ICR7YWN0aW9uLmZpbGVuYW1lfWApO1xuXG4gICAgb3B0aW9ucy5wdXNoKGFjdGlvbik7XG4gIH1cblxuICByZXR1cm4geyBvcHRpb25zLCBvcmlnaW5hbEZpbGVzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgZW1pdHRlZEZpbGVzOiBFbWl0dGVkRmlsZXNbXSxcbiAgaTE4bjogSTE4bk9wdGlvbnMsXG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmcsXG4gIG91dHB1dFBhdGhzOiBzdHJpbmdbXSxcbiAgc2NyaXB0c0VudHJ5UG9pbnROYW1lOiBzdHJpbmdbXSxcbiAgZW1pdHRlZFBhdGg6IHN0cmluZyxcbiAgZXM1OiBib29sZWFuLFxuICBtaXNzaW5nVHJhbnNsYXRpb246ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCBleGVjdXRvciA9IG5ldyBCdW5kbGVBY3Rpb25FeGVjdXRvcih7IGkxOG4gfSk7XG4gIGxldCBoYXNFcnJvcnMgPSBmYWxzZTtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgbG9jYWxpemVkIGJ1bmRsZXMuLi4nKTtcblxuICB0cnkge1xuICAgIGNvbnN0IHsgb3B0aW9ucywgb3JpZ2luYWxGaWxlczogcHJvY2Vzc2VkRmlsZXMgfSA9IGVtaXR0ZWRGaWxlc1RvSW5saW5lT3B0aW9ucyhcbiAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgIHNjcmlwdHNFbnRyeVBvaW50TmFtZSxcbiAgICAgIGVtaXR0ZWRQYXRoLFxuICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICBlczUsXG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICBjb250ZXh0LFxuICAgICk7XG5cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBleGVjdXRvci5pbmxpbmVBbGwob3B0aW9ucykpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmRlYnVnKGBpMThuIGZpbGUgcHJvY2Vzc2VkOiAke3Jlc3VsdC5maWxlfWApO1xuXG4gICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgcmVzdWx0LmRpYWdub3N0aWNzKSB7XG4gICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICBpZiAoZGlhZ25vc3RpYy50eXBlID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZTtcbiAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihkaWFnbm9zdGljLm1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29weSBhbnkgbm9uLXByb2Nlc3NlZCBmaWxlcyBpbnRvIHRoZSBvdXRwdXQgbG9jYXRpb25zXG4gICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgIFtcbiAgICAgICAge1xuICAgICAgICAgIGdsb2I6ICcqKi8qJyxcbiAgICAgICAgICBpbnB1dDogZW1pdHRlZFBhdGgsXG4gICAgICAgICAgb3V0cHV0OiAnJyxcbiAgICAgICAgICBpZ25vcmU6IFsuLi5wcm9jZXNzZWRGaWxlc10ubWFwKChmKSA9PiBwYXRoLnJlbGF0aXZlKGVtaXR0ZWRQYXRoLCBmKSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgb3V0cHV0UGF0aHMsXG4gICAgICAnJyxcbiAgICApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGVycik7XG4gICAgc3Bpbm5lci5mYWlsKCdMb2NhbGl6ZWQgYnVuZGxlIGdlbmVyYXRpb24gZmFpbGVkOiAnICsgZXJyLm1lc3NhZ2UpO1xuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGZpbmFsbHkge1xuICAgIGV4ZWN1dG9yLnN0b3AoKTtcbiAgfVxuXG4gIGlmIChoYXNFcnJvcnMpIHtcbiAgICBzcGlubmVyLmZhaWwoJ0xvY2FsaXplZCBidW5kbGUgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG4gIH0gZWxzZSB7XG4gICAgc3Bpbm5lci5zdWNjZWVkKCdMb2NhbGl6ZWQgYnVuZGxlIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gIH1cblxuICByZXR1cm4gIWhhc0Vycm9ycztcbn1cbiJdfQ==