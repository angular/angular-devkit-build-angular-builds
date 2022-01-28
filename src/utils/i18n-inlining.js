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
exports.i18nInlineEmittedFiles = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const action_executor_1 = require("./action-executor");
const copy_assets_1 = require("./copy-assets");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1pbmxpbmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2kxOG4taW5saW5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlILHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsdURBQXlEO0FBQ3pELCtDQUEyQztBQUczQyx1Q0FBb0M7QUFFcEMsU0FBUywyQkFBMkIsQ0FDbEMsWUFBNEIsRUFDNUIscUJBQStCLEVBQy9CLFdBQW1CLEVBQ25CLFVBQWtCLEVBQ2xCLEdBQVksRUFDWixrQkFBOEQsRUFDOUQsT0FBdUI7SUFFdkIsTUFBTSxPQUFPLEdBQW9CLEVBQUUsQ0FBQztJQUNwQyxNQUFNLGFBQWEsR0FBYSxFQUFFLENBQUM7SUFDbkMsS0FBSyxNQUFNLFdBQVcsSUFBSSxZQUFZLEVBQUU7UUFDdEMsSUFDRSxXQUFXLENBQUMsS0FBSztZQUNqQixXQUFXLENBQUMsU0FBUyxLQUFLLEtBQUs7WUFDL0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFDdEU7WUFDQSxTQUFTO1NBQ1Y7UUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUQsTUFBTSxNQUFNLEdBQWtCO1lBQzVCLFFBQVEsRUFBRSxXQUFXLENBQUMsSUFBSTtZQUMxQixJQUFJLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDO1lBQzNDLEdBQUc7WUFDSCxVQUFVO1lBQ1Ysa0JBQWtCO1lBQ2xCLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFB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QUFDO1FBRW5FLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7WUFBUztRQUNSLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNqQjtJQUVELElBQUksU0FBUyxFQUFFO1FBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0tBQ3JEO1NBQU07UUFDTCxPQUFPLENBQUMsT0FBTyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxPQUFPLENBQUMsU0FBUyxDQUFDO0FBQ3BCLENBQUM7QUF0RUQsd0RBc0VDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFbWl0dGVkRmlsZXMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQnVuZGxlQWN0aW9uRXhlY3V0b3IgfSBmcm9tICcuL2FjdGlvbi1leGVjdXRvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4vaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IElubGluZU9wdGlvbnMgfSBmcm9tICcuL3Byb2Nlc3MtYnVuZGxlJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuL3NwaW5uZXInO1xuXG5mdW5jdGlvbiBlbWl0dGVkRmlsZXNUb0lubGluZU9wdGlvbnMoXG4gIGVtaXR0ZWRGaWxlczogRW1pdHRlZEZpbGVzW10sXG4gIHNjcmlwdHNFbnRyeVBvaW50TmFtZTogc3RyaW5nW10sXG4gIGVtaXR0ZWRQYXRoOiBzdHJpbmcsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbiAgZXM1OiBib29sZWFuLFxuICBtaXNzaW5nVHJhbnNsYXRpb246ICdlcnJvcicgfCAnd2FybmluZycgfCAnaWdub3JlJyB8IHVuZGVmaW5lZCxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiB7IG9wdGlvbnM6IElubGluZU9wdGlvbnNbXTsgb3JpZ2luYWxGaWxlczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IG9wdGlvbnM6IElubGluZU9wdGlvbnNbXSA9IFtdO1xuICBjb25zdCBvcmlnaW5hbEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGVtaXR0ZWRGaWxlIG9mIGVtaXR0ZWRGaWxlcykge1xuICAgIGlmIChcbiAgICAgIGVtaXR0ZWRGaWxlLmFzc2V0IHx8XG4gICAgICBlbWl0dGVkRmlsZS5leHRlbnNpb24gIT09ICcuanMnIHx8XG4gICAgICAoZW1pdHRlZEZpbGUubmFtZSAmJiBzY3JpcHRzRW50cnlQb2ludE5hbWUuaW5jbHVkZXMoZW1pdHRlZEZpbGUubmFtZSkpXG4gICAgKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW5hbFBhdGggPSBwYXRoLmpvaW4oZW1pdHRlZFBhdGgsIGVtaXR0ZWRGaWxlLmZpbGUpO1xuICAgIGNvbnN0IGFjdGlvbjogSW5saW5lT3B0aW9ucyA9IHtcbiAgICAgIGZpbGVuYW1lOiBlbWl0dGVkRmlsZS5maWxlLFxuICAgICAgY29kZTogZnMucmVhZEZpbGVTeW5jKG9yaWdpbmFsUGF0aCwgJ3V0ZjgnKSxcbiAgICAgIGVzNSxcbiAgICAgIG91dHB1dFBhdGgsXG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICBzZXRMb2NhbGU6IGVtaXR0ZWRGaWxlLm5hbWUgPT09ICdtYWluJyB8fCBlbWl0dGVkRmlsZS5uYW1lID09PSAndmVuZG9yJyxcbiAgICB9O1xuICAgIG9yaWdpbmFsRmlsZXMucHVzaChvcmlnaW5hbFBhdGgpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsTWFwUGF0aCA9IG9yaWdpbmFsUGF0aCArICcubWFwJztcbiAgICAgIGFjdGlvbi5tYXAgPSBmcy5yZWFkRmlsZVN5bmMob3JpZ2luYWxNYXBQYXRoLCAndXRmOCcpO1xuICAgICAgb3JpZ2luYWxGaWxlcy5wdXNoKG9yaWdpbmFsTWFwUGF0aCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb250ZXh0LmxvZ2dlci5kZWJ1ZyhgaTE4biBmaWxlIHF1ZXVlZCBmb3IgcHJvY2Vzc2luZzogJHthY3Rpb24uZmlsZW5hbWV9YCk7XG5cbiAgICBvcHRpb25zLnB1c2goYWN0aW9uKTtcbiAgfVxuXG4gIHJldHVybiB7IG9wdGlvbnMsIG9yaWdpbmFsRmlsZXMgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBlbWl0dGVkRmlsZXM6IEVtaXR0ZWRGaWxlc1tdLFxuICBpMThuOiBJMThuT3B0aW9ucyxcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZyxcbiAgb3V0cHV0UGF0aHM6IHN0cmluZ1tdLFxuICBzY3JpcHRzRW50cnlQb2ludE5hbWU6IHN0cmluZ1tdLFxuICBlbWl0dGVkUGF0aDogc3RyaW5nLFxuICBlczU6IGJvb2xlYW4sXG4gIG1pc3NpbmdUcmFuc2xhdGlvbjogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpZ25vcmUnIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IGV4ZWN1dG9yID0gbmV3IEJ1bmRsZUFjdGlvbkV4ZWN1dG9yKHsgaTE4biB9KTtcbiAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlO1xuICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBsb2NhbGl6ZWQgYnVuZGxlcy4uLicpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcHRpb25zLCBvcmlnaW5hbEZpbGVzOiBwcm9jZXNzZWRGaWxlcyB9ID0gZW1pdHRlZEZpbGVzVG9JbmxpbmVPcHRpb25zKFxuICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgc2NyaXB0c0VudHJ5UG9pbnROYW1lLFxuICAgICAgZW1pdHRlZFBhdGgsXG4gICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgIGVzNSxcbiAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgIGNvbnRleHQsXG4gICAgKTtcblxuICAgIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGV4ZWN1dG9yLmlubGluZUFsbChvcHRpb25zKSkge1xuICAgICAgY29udGV4dC5sb2dnZXIuZGVidWcoYGkxOG4gZmlsZSBwcm9jZXNzZWQ6ICR7cmVzdWx0LmZpbGV9YCk7XG5cbiAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiByZXN1bHQuZGlhZ25vc3RpY3MpIHtcbiAgICAgICAgc3Bpbm5lci5zdG9wKCk7XG4gICAgICAgIGlmIChkaWFnbm9zdGljLnR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlO1xuICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGRpYWdub3N0aWMubWVzc2FnZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihkaWFnbm9zdGljLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb3B5IGFueSBub24tcHJvY2Vzc2VkIGZpbGVzIGludG8gdGhlIG91dHB1dCBsb2NhdGlvbnNcbiAgICBhd2FpdCBjb3B5QXNzZXRzKFxuICAgICAgW1xuICAgICAgICB7XG4gICAgICAgICAgZ2xvYjogJyoqLyonLFxuICAgICAgICAgIGlucHV0OiBlbWl0dGVkUGF0aCxcbiAgICAgICAgICBvdXRwdXQ6ICcnLFxuICAgICAgICAgIGlnbm9yZTogWy4uLnByb2Nlc3NlZEZpbGVzXS5tYXAoKGYpID0+IHBhdGgucmVsYXRpdmUoZW1pdHRlZFBhdGgsIGYpKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBvdXRwdXRQYXRocyxcbiAgICAgICcnLFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNwaW5uZXIuZmFpbCgnTG9jYWxpemVkIGJ1bmRsZSBnZW5lcmF0aW9uIGZhaWxlZDogJyArIGVyci5tZXNzYWdlKTtcblxuICAgIHJldHVybiBmYWxzZTtcbiAgfSBmaW5hbGx5IHtcbiAgICBleGVjdXRvci5zdG9wKCk7XG4gIH1cblxuICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgc3Bpbm5lci5mYWlsKCdMb2NhbGl6ZWQgYnVuZGxlIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuICB9IGVsc2Uge1xuICAgIHNwaW5uZXIuc3VjY2VlZCgnTG9jYWxpemVkIGJ1bmRsZSBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICB9XG5cbiAgcmV0dXJuICFoYXNFcnJvcnM7XG59XG4iXX0=