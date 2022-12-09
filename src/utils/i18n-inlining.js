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
function emittedFilesToInlineOptions(emittedFiles, scriptsEntryPointName, emittedPath, outputPath, missingTranslation, context) {
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
            outputPath,
            missingTranslation,
            setLocale: emittedFile.name === 'main',
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
async function i18nInlineEmittedFiles(context, emittedFiles, i18n, baseOutputPath, outputPaths, scriptsEntryPointName, emittedPath, missingTranslation) {
    const executor = new action_executor_1.BundleActionExecutor({ i18n });
    let hasErrors = false;
    const spinner = new spinner_1.Spinner();
    spinner.start('Generating localized bundles...');
    try {
        const { options, originalFiles: processedFiles } = emittedFilesToInlineOptions(emittedFiles, scriptsEntryPointName, emittedPath, baseOutputPath, missingTranslation, context);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1pbmxpbmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4taW5saW5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHVEQUF5RDtBQUN6RCwrQ0FBMkM7QUFDM0MsbUNBQXdDO0FBR3hDLHVDQUFvQztBQUVwQyxTQUFTLDJCQUEyQixDQUNsQyxZQUE0QixFQUM1QixxQkFBK0IsRUFDL0IsV0FBbUIsRUFDbkIsVUFBa0IsRUFDbEIsa0JBQThELEVBQzlELE9BQXVCO0lBRXZCLE1BQU0sT0FBTyxHQUFvQixFQUFFLENBQUM7SUFDcEMsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0lBQ25DLEtBQUssTUFBTSxXQUFXLElBQUksWUFBWSxFQUFFO1FBQ3RDLElBQ0UsV0FBVyxDQUFDLEtBQUs7WUFDakIsV0FBVyxDQUFDLFNBQVMsS0FBSyxLQUFLO1lBQy9CLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ3RFO1lBQ0EsU0FBUztTQUNWO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlELE1BQU0sTUFBTSxHQUFrQjtZQUM1QixRQUFRLEVBQUUsV0FBVyxDQUFDLElBQUk7WUFDMUIsSUFBSSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQztZQUMzQyxVQUFVO1lBQ1Ysa0JBQWtCO1lBQ2xCLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxLQUFLLE1BQU07U0FDdkMs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R0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRW5FLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7WUFBUztRQUNSLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNqQjtJQUVELElBQUksU0FBUyxFQUFFO1FBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0tBQ3JEO1NBQU07UUFDTCxPQUFPLENBQUMsT0FBTyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxPQUFPLENBQUMsU0FBUyxDQUFDO0FBQ3BCLENBQUM7QUFyRUQsd0RBcUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFbWl0dGVkRmlsZXMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQnVuZGxlQWN0aW9uRXhlY3V0b3IgfSBmcm9tICcuL2FjdGlvbi1leGVjdXRvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IElubGluZU9wdGlvbnMgfSBmcm9tICcuL3Byb2Nlc3MtYnVuZGxlJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuL3NwaW5uZXInO1xuXG5mdW5jdGlvbiBlbWl0dGVkRmlsZXNUb0lubGluZU9wdGlvbnMoXG4gIGVtaXR0ZWRGaWxlczogRW1pdHRlZEZpbGVzW10sXG4gIHNjcmlwdHNFbnRyeVBvaW50TmFtZTogc3RyaW5nW10sXG4gIGVtaXR0ZWRQYXRoOiBzdHJpbmcsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScgfCB1bmRlZmluZWQsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogeyBvcHRpb25zOiBJbmxpbmVPcHRpb25zW107IG9yaWdpbmFsRmlsZXM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBvcHRpb25zOiBJbmxpbmVPcHRpb25zW10gPSBbXTtcbiAgY29uc3Qgb3JpZ2luYWxGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBlbWl0dGVkRmlsZSBvZiBlbWl0dGVkRmlsZXMpIHtcbiAgICBpZiAoXG4gICAgICBlbWl0dGVkRmlsZS5hc3NldCB8fFxuICAgICAgZW1pdHRlZEZpbGUuZXh0ZW5zaW9uICE9PSAnLmpzJyB8fFxuICAgICAgKGVtaXR0ZWRGaWxlLm5hbWUgJiYgc2NyaXB0c0VudHJ5UG9pbnROYW1lLmluY2x1ZGVzKGVtaXR0ZWRGaWxlLm5hbWUpKVxuICAgICkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxQYXRoID0gcGF0aC5qb2luKGVtaXR0ZWRQYXRoLCBlbWl0dGVkRmlsZS5maWxlKTtcbiAgICBjb25zdCBhY3Rpb246IElubGluZU9wdGlvbnMgPSB7XG4gICAgICBmaWxlbmFtZTogZW1pdHRlZEZpbGUuZmlsZSxcbiAgICAgIGNvZGU6IGZzLnJlYWRGaWxlU3luYyhvcmlnaW5hbFBhdGgsICd1dGY4JyksXG4gICAgICBvdXRwdXRQYXRoLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgc2V0TG9jYWxlOiBlbWl0dGVkRmlsZS5uYW1lID09PSAnbWFpbicsXG4gICAgfTtcbiAgICBvcmlnaW5hbEZpbGVzLnB1c2gob3JpZ2luYWxQYXRoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBvcmlnaW5hbE1hcFBhdGggPSBvcmlnaW5hbFBhdGggKyAnLm1hcCc7XG4gICAgICBhY3Rpb24ubWFwID0gZnMucmVhZEZpbGVTeW5jKG9yaWdpbmFsTWFwUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIG9yaWdpbmFsRmlsZXMucHVzaChvcmlnaW5hbE1hcFBhdGgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuICAgICAgaWYgKGVyci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29udGV4dC5sb2dnZXIuZGVidWcoYGkxOG4gZmlsZSBxdWV1ZWQgZm9yIHByb2Nlc3Npbmc6ICR7YWN0aW9uLmZpbGVuYW1lfWApO1xuXG4gICAgb3B0aW9ucy5wdXNoKGFjdGlvbik7XG4gIH1cblxuICByZXR1cm4geyBvcHRpb25zLCBvcmlnaW5hbEZpbGVzIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgZW1pdHRlZEZpbGVzOiBFbWl0dGVkRmlsZXNbXSxcbiAgaTE4bjogSTE4bk9wdGlvbnMsXG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmcsXG4gIG91dHB1dFBhdGhzOiBzdHJpbmdbXSxcbiAgc2NyaXB0c0VudHJ5UG9pbnROYW1lOiBzdHJpbmdbXSxcbiAgZW1pdHRlZFBhdGg6IHN0cmluZyxcbiAgbWlzc2luZ1RyYW5zbGF0aW9uOiAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2lnbm9yZScgfCB1bmRlZmluZWQsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgZXhlY3V0b3IgPSBuZXcgQnVuZGxlQWN0aW9uRXhlY3V0b3IoeyBpMThuIH0pO1xuICBsZXQgaGFzRXJyb3JzID0gZmFsc2U7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGxvY2FsaXplZCBidW5kbGVzLi4uJyk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9wdGlvbnMsIG9yaWdpbmFsRmlsZXM6IHByb2Nlc3NlZEZpbGVzIH0gPSBlbWl0dGVkRmlsZXNUb0lubGluZU9wdGlvbnMoXG4gICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICBzY3JpcHRzRW50cnlQb2ludE5hbWUsXG4gICAgICBlbWl0dGVkUGF0aCxcbiAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgY29udGV4dCxcbiAgICApO1xuXG4gICAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgZXhlY3V0b3IuaW5saW5lQWxsKG9wdGlvbnMpKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5kZWJ1ZyhgaTE4biBmaWxlIHByb2Nlc3NlZDogJHtyZXN1bHQuZmlsZX1gKTtcblxuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIHJlc3VsdC5kaWFnbm9zdGljcykge1xuICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgaWYgKGRpYWdub3N0aWMudHlwZSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWU7XG4gICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZGlhZ25vc3RpYy5tZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKGRpYWdub3N0aWMubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgICAgc3Bpbm5lci5zdGFydCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvcHkgYW55IG5vbi1wcm9jZXNzZWQgZmlsZXMgaW50byB0aGUgb3V0cHV0IGxvY2F0aW9uc1xuICAgIGF3YWl0IGNvcHlBc3NldHMoXG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBnbG9iOiAnKiovKicsXG4gICAgICAgICAgaW5wdXQ6IGVtaXR0ZWRQYXRoLFxuICAgICAgICAgIG91dHB1dDogJycsXG4gICAgICAgICAgaWdub3JlOiBbLi4ucHJvY2Vzc2VkRmlsZXNdLm1hcCgoZikgPT4gcGF0aC5yZWxhdGl2ZShlbWl0dGVkUGF0aCwgZikpLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIG91dHB1dFBhdGhzLFxuICAgICAgJycsXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuICAgIHNwaW5uZXIuZmFpbCgnTG9jYWxpemVkIGJ1bmRsZSBnZW5lcmF0aW9uIGZhaWxlZDogJyArIGVyci5tZXNzYWdlKTtcblxuICAgIHJldHVybiBmYWxzZTtcbiAgfSBmaW5hbGx5IHtcbiAgICBleGVjdXRvci5zdG9wKCk7XG4gIH1cblxuICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgc3Bpbm5lci5mYWlsKCdMb2NhbGl6ZWQgYnVuZGxlIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuICB9IGVsc2Uge1xuICAgIHNwaW5uZXIuc3VjY2VlZCgnTG9jYWxpemVkIGJ1bmRsZSBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICB9XG5cbiAgcmV0dXJuICFoYXNFcnJvcnM7XG59XG4iXX0=