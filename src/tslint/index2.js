"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const index2_1 = require("@angular-devkit/architect/src/index2");
const fs_1 = require("fs");
const glob = require("glob");
const minimatch_1 = require("minimatch");
const path = require("path");
const strip_bom_1 = require("../angular-cli-files/utilities/strip-bom");
async function _loadTslint() {
    let tslint;
    try {
        tslint = await Promise.resolve().then(() => require('tslint')); // tslint:disable-line:no-implicit-dependencies
    }
    catch (_a) {
        throw new Error('Unable to find TSLint. Ensure TSLint is installed.');
    }
    const version = tslint.Linter.VERSION && tslint.Linter.VERSION.split('.');
    if (!version || version.length < 2 || Number(version[0]) < 5 || Number(version[1]) < 5) {
        throw new Error('TSLint must be version 5.5 or higher.');
    }
    return tslint;
}
async function _run(options, context) {
    const systemRoot = context.workspaceRoot;
    process.chdir(context.currentDirectory);
    const projectName = (context.target && context.target.project) || '<???>';
    // Print formatter output only for non human-readable formats.
    const printInfo = ['prose', 'verbose', 'stylish'].includes(options.format || '') && !options.silent;
    context.reportStatus(`Linting ${JSON.stringify(projectName)}...`);
    if (printInfo) {
        context.logger.info(`Linting ${JSON.stringify(projectName)}...`);
    }
    if (!options.tsConfig && options.typeCheck) {
        throw new Error('A "project" must be specified to enable type checking.');
    }
    const projectTslint = await _loadTslint();
    const tslintConfigPath = options.tslintConfig
        ? path.resolve(systemRoot, options.tslintConfig)
        : null;
    const Linter = projectTslint.Linter;
    let result = undefined;
    if (options.tsConfig) {
        const tsConfigs = Array.isArray(options.tsConfig) ? options.tsConfig : [options.tsConfig];
        context.reportProgress(0, tsConfigs.length);
        const allPrograms = tsConfigs.map(tsConfig => {
            return Linter.createProgram(path.resolve(systemRoot, tsConfig));
        });
        let i = 0;
        for (const program of allPrograms) {
            const partial = await _lint(projectTslint, systemRoot, tslintConfigPath, options, program, allPrograms);
            if (result === undefined) {
                result = partial;
            }
            else {
                result.failures = result.failures
                    .filter(curr => {
                    return !partial.failures.some(prev => curr.equals(prev));
                })
                    .concat(partial.failures);
                // we are not doing much with 'errorCount' and 'warningCount'
                // apart from checking if they are greater than 0 thus no need to dedupe these.
                result.errorCount += partial.errorCount;
                result.warningCount += partial.warningCount;
                if (partial.fixes) {
                    result.fixes = result.fixes ? result.fixes.concat(partial.fixes) : partial.fixes;
                }
            }
            context.reportProgress(++i, allPrograms.length);
        }
    }
    else {
        result = await _lint(projectTslint, systemRoot, tslintConfigPath, options);
    }
    if (result == undefined) {
        throw new Error('Invalid lint configuration. Nothing to lint.');
    }
    if (!options.silent) {
        const Formatter = projectTslint.findFormatter(options.format || '');
        if (!Formatter) {
            throw new Error(`Invalid lint format "${options.format}".`);
        }
        const formatter = new Formatter();
        const output = formatter.format(result.failures, result.fixes);
        if (output.trim()) {
            context.logger.info(output);
        }
    }
    if (result.warningCount > 0 && printInfo) {
        context.logger.warn('Lint warnings found in the listed files.');
    }
    if (result.errorCount > 0 && printInfo) {
        context.logger.error('Lint errors found in the listed files.');
    }
    if (result.warningCount === 0 && result.errorCount === 0 && printInfo) {
        context.logger.info('All files pass linting.');
    }
    return {
        success: options.force || result.errorCount === 0,
    };
}
exports.default = index2_1.createBuilder(_run);
async function _lint(projectTslint, systemRoot, tslintConfigPath, options, program, allPrograms) {
    const Linter = projectTslint.Linter;
    const Configuration = projectTslint.Configuration;
    const files = getFilesToLint(systemRoot, options, Linter, program);
    const lintOptions = {
        fix: !!options.fix,
        formatter: options.format,
    };
    const linter = new Linter(lintOptions, program);
    let lastDirectory = undefined;
    let configLoad;
    for (const file of files) {
        if (program && allPrograms) {
            // If it cannot be found in ANY program, then this is an error.
            if (allPrograms.every(p => p.getSourceFile(file) === undefined)) {
                throw new Error(`File ${JSON.stringify(file)} is not part of a TypeScript project '${options.tsConfig}'.`);
            }
            else if (program.getSourceFile(file) === undefined) {
                // The file exists in some other programs. We will lint it later (or earlier) in the loop.
                continue;
            }
        }
        const contents = getFileContents(file);
        // Only check for a new tslint config if the path changes.
        const currentDirectory = path.dirname(file);
        if (currentDirectory !== lastDirectory) {
            configLoad = Configuration.findConfiguration(tslintConfigPath, file);
            lastDirectory = currentDirectory;
        }
        if (configLoad) {
            // Give some breathing space to other promises that might be waiting.
            await Promise.resolve();
            linter.lint(file, contents, configLoad.results);
        }
    }
    return linter.getResult();
}
function getFilesToLint(root, options, linter, program) {
    const ignore = options.exclude;
    const files = options.files || [];
    if (files.length > 0) {
        return files
            .map(file => glob.sync(file, { cwd: root, ignore, nodir: true }))
            .reduce((prev, curr) => prev.concat(curr), [])
            .map(file => path.join(root, file));
    }
    if (!program) {
        return [];
    }
    let programFiles = linter.getFileNames(program);
    if (ignore && ignore.length > 0) {
        // normalize to support ./ paths
        const ignoreMatchers = ignore
            .map(pattern => new minimatch_1.Minimatch(path.normalize(pattern), { dot: true }));
        programFiles = programFiles
            .filter(file => !ignoreMatchers.some(matcher => matcher.match(path.relative(root, file))));
    }
    return programFiles;
}
function getFileContents(file) {
    // NOTE: The tslint CLI checks for and excludes MPEG transport streams; this does not.
    try {
        return strip_bom_1.stripBom(fs_1.readFileSync(file, 'utf-8'));
    }
    catch (_a) {
        throw new Error(`Could not read file '${file}'.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90c2xpbnQvaW5kZXgyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUVBQW9HO0FBRXBHLDJCQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLDZCQUE2QjtBQUc3Qix3RUFBb0U7QUFPcEUsS0FBSyxVQUFVLFdBQVc7SUFDeEIsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJO1FBQ0YsTUFBTSxHQUFHLDJDQUFhLFFBQVEsRUFBQyxDQUFDLENBQUMsK0NBQStDO0tBQ2pGO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztLQUN2RTtJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBR0QsS0FBSyxVQUFVLElBQUksQ0FDakIsT0FBNkIsRUFDN0IsT0FBdUI7SUFFdkIsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUN6QyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sV0FBVyxH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QztLQUM5RjtJQUVELE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxJQUFZO0lBQ25DLHNGQUFzRjtJQUN0RixJQUFJO1FBQ0YsT0FBTyxvQkFBUSxDQUFDLGlCQUFZLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDOUM7SUFBQyxXQUFNO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUNuRDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvc3JjL2luZGV4Mic7XG5pbXBvcnQgeyBqc29uIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCB7IE1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHNsaW50IGZyb20gJ3RzbGludCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IHN0cmlwQm9tIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0cmlwLWJvbSc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgUmVhbFRzbGludEJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbnR5cGUgVHNsaW50QnVpbGRlck9wdGlvbnMgPSBSZWFsVHNsaW50QnVpbGRlck9wdGlvbnMgJiBqc29uLkpzb25PYmplY3Q7XG5cblxuYXN5bmMgZnVuY3Rpb24gX2xvYWRUc2xpbnQoKSB7XG4gIGxldCB0c2xpbnQ7XG4gIHRyeSB7XG4gICAgdHNsaW50ID0gYXdhaXQgaW1wb3J0KCd0c2xpbnQnKTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBUU0xpbnQuIEVuc3VyZSBUU0xpbnQgaXMgaW5zdGFsbGVkLicpO1xuICB9XG5cbiAgY29uc3QgdmVyc2lvbiA9IHRzbGludC5MaW50ZXIuVkVSU0lPTiAmJiB0c2xpbnQuTGludGVyLlZFUlNJT04uc3BsaXQoJy4nKTtcbiAgaWYgKCF2ZXJzaW9uIHx8IHZlcnNpb24ubGVuZ3RoIDwgMiB8fCBOdW1iZXIodmVyc2lvblswXSkgPCA1IHx8IE51bWJlcih2ZXJzaW9uWzFdKSA8IDUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RTTGludCBtdXN0IGJlIHZlcnNpb24gNS41IG9yIGhpZ2hlci4nKTtcbiAgfVxuXG4gIHJldHVybiB0c2xpbnQ7XG59XG5cblxuYXN5bmMgZnVuY3Rpb24gX3J1bihcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHN5c3RlbVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIHByb2Nlc3MuY2hkaXIoY29udGV4dC5jdXJyZW50RGlyZWN0b3J5KTtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSAoY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdCkgfHwgJzw/Pz8+JztcblxuICAvLyBQcmludCBmb3JtYXR0ZXIgb3V0cHV0IG9ubHkgZm9yIG5vbiBodW1hbi1yZWFkYWJsZSBmb3JtYXRzLlxuICBjb25zdCBwcmludEluZm8gPVxuICAgIFsncHJvc2UnLCAndmVyYm9zZScsICdzdHlsaXNoJ10uaW5jbHVkZXMob3B0aW9ucy5mb3JtYXQgfHwgJycpICYmICFvcHRpb25zLnNpbGVudDtcblxuICBjb250ZXh0LnJlcG9ydFN0YXR1cyhgTGludGluZyAke0pTT04uc3RyaW5naWZ5KHByb2plY3ROYW1lKX0uLi5gKTtcbiAgaWYgKHByaW50SW5mbykge1xuICAgIGNvbnRleHQubG9nZ2VyLmluZm8oYExpbnRpbmcgJHtKU09OLnN0cmluZ2lmeShwcm9qZWN0TmFtZSl9Li4uYCk7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMudHNDb25maWcgJiYgb3B0aW9ucy50eXBlQ2hlY2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgXCJwcm9qZWN0XCIgbXVzdCBiZSBzcGVjaWZpZWQgdG8gZW5hYmxlIHR5cGUgY2hlY2tpbmcuJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0VHNsaW50ID0gYXdhaXQgX2xvYWRUc2xpbnQoKTtcbiAgY29uc3QgdHNsaW50Q29uZmlnUGF0aCA9IG9wdGlvbnMudHNsaW50Q29uZmlnXG4gICAgPyBwYXRoLnJlc29sdmUoc3lzdGVtUm9vdCwgb3B0aW9ucy50c2xpbnRDb25maWcpXG4gICAgOiBudWxsO1xuICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcblxuICBsZXQgcmVzdWx0OiB1bmRlZmluZWQgfCB0c2xpbnQuTGludFJlc3VsdCA9IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMudHNDb25maWcpIHtcbiAgICBjb25zdCB0c0NvbmZpZ3MgPSBBcnJheS5pc0FycmF5KG9wdGlvbnMudHNDb25maWcpID8gb3B0aW9ucy50c0NvbmZpZyA6IFtvcHRpb25zLnRzQ29uZmlnXTtcbiAgICBjb250ZXh0LnJlcG9ydFByb2dyZXNzKDAsIHRzQ29uZmlncy5sZW5ndGgpO1xuICAgIGNvbnN0IGFsbFByb2dyYW1zID0gdHNDb25maWdzLm1hcCh0c0NvbmZpZyA9PiB7XG4gICAgICByZXR1cm4gTGludGVyLmNyZWF0ZVByb2dyYW0ocGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIHRzQ29uZmlnKSk7XG4gICAgfSk7XG5cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBwcm9ncmFtIG9mIGFsbFByb2dyYW1zKSB7XG4gICAgICBjb25zdCBwYXJ0aWFsID0gYXdhaXQgX2xpbnQoXG4gICAgICAgIHByb2plY3RUc2xpbnQsXG4gICAgICAgIHN5c3RlbVJvb3QsXG4gICAgICAgIHRzbGludENvbmZpZ1BhdGgsXG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIHByb2dyYW0sXG4gICAgICAgIGFsbFByb2dyYW1zLFxuICAgICAgKTtcbiAgICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHQgPSBwYXJ0aWFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LmZhaWx1cmVzID0gcmVzdWx0LmZhaWx1cmVzXG4gICAgICAgICAgLmZpbHRlcihjdXJyID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhcGFydGlhbC5mYWlsdXJlcy5zb21lKHByZXYgPT4gY3Vyci5lcXVhbHMocHJldikpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAvLyB3ZSBhcmUgbm90IGRvaW5nIG11Y2ggd2l0aCAnZXJyb3JDb3VudCcgYW5kICd3YXJuaW5nQ291bnQnXG4gICAgICAgIC8vIGFwYXJ0IGZyb20gY2hlY2tpbmcgaWYgdGhleSBhcmUgZ3JlYXRlciB0aGFuIDAgdGh1cyBubyBuZWVkIHRvIGRlZHVwZSB0aGVzZS5cbiAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICByZXN1bHQud2FybmluZ0NvdW50ICs9IHBhcnRpYWwud2FybmluZ0NvdW50O1xuXG4gICAgICAgIGlmIChwYXJ0aWFsLmZpeGVzKSB7XG4gICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29udGV4dC5yZXBvcnRQcm9ncmVzcygrK2ksIGFsbFByb2dyYW1zLmxlbmd0aCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IGF3YWl0IF9saW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKHJlc3VsdCA9PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGludCBjb25maWd1cmF0aW9uLiBOb3RoaW5nIHRvIGxpbnQuJyk7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgY29uc3QgRm9ybWF0dGVyID0gcHJvamVjdFRzbGludC5maW5kRm9ybWF0dGVyKG9wdGlvbnMuZm9ybWF0IHx8ICcnKTtcbiAgICBpZiAoIUZvcm1hdHRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxpbnQgZm9ybWF0IFwiJHtvcHRpb25zLmZvcm1hdH1cIi5gKTtcbiAgICB9XG4gICAgY29uc3QgZm9ybWF0dGVyID0gbmV3IEZvcm1hdHRlcigpO1xuXG4gICAgY29uc3Qgb3V0cHV0ID0gZm9ybWF0dGVyLmZvcm1hdChyZXN1bHQuZmFpbHVyZXMsIHJlc3VsdC5maXhlcyk7XG4gICAgaWYgKG91dHB1dC50cmltKCkpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8ob3V0cHV0KTtcbiAgICB9XG4gIH1cblxuICBpZiAocmVzdWx0Lndhcm5pbmdDb3VudCA+IDAgJiYgcHJpbnRJbmZvKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybignTGludCB3YXJuaW5ncyBmb3VuZCBpbiB0aGUgbGlzdGVkIGZpbGVzLicpO1xuICB9XG5cbiAgaWYgKHJlc3VsdC5lcnJvckNvdW50ID4gMCAmJiBwcmludEluZm8pIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignTGludCBlcnJvcnMgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgfVxuXG4gIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID09PSAwICYmIHJlc3VsdC5lcnJvckNvdW50ID09PSAwICYmIHByaW50SW5mbykge1xuICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ0FsbCBmaWxlcyBwYXNzIGxpbnRpbmcuJyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHN1Y2Nlc3M6IG9wdGlvbnMuZm9yY2UgfHwgcmVzdWx0LmVycm9yQ291bnQgPT09IDAsXG4gIH07XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxUc2xpbnRCdWlsZGVyT3B0aW9ucz4oX3J1bik7XG5cblxuYXN5bmMgZnVuY3Rpb24gX2xpbnQoXG4gIHByb2plY3RUc2xpbnQ6IHR5cGVvZiB0c2xpbnQsXG4gIHN5c3RlbVJvb3Q6IHN0cmluZyxcbiAgdHNsaW50Q29uZmlnUGF0aDogc3RyaW5nIHwgbnVsbCxcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIHByb2dyYW0/OiB0cy5Qcm9ncmFtLFxuICBhbGxQcm9ncmFtcz86IHRzLlByb2dyYW1bXSxcbikge1xuICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcbiAgY29uc3QgQ29uZmlndXJhdGlvbiA9IHByb2plY3RUc2xpbnQuQ29uZmlndXJhdGlvbjtcblxuICBjb25zdCBmaWxlcyA9IGdldEZpbGVzVG9MaW50KHN5c3RlbVJvb3QsIG9wdGlvbnMsIExpbnRlciwgcHJvZ3JhbSk7XG4gIGNvbnN0IGxpbnRPcHRpb25zID0ge1xuICAgIGZpeDogISFvcHRpb25zLmZpeCxcbiAgICBmb3JtYXR0ZXI6IG9wdGlvbnMuZm9ybWF0LFxuICB9O1xuXG4gIGNvbnN0IGxpbnRlciA9IG5ldyBMaW50ZXIobGludE9wdGlvbnMsIHByb2dyYW0pO1xuXG4gIGxldCBsYXN0RGlyZWN0b3J5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBjb25maWdMb2FkO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBpZiAocHJvZ3JhbSAmJiBhbGxQcm9ncmFtcykge1xuICAgICAgLy8gSWYgaXQgY2Fubm90IGJlIGZvdW5kIGluIEFOWSBwcm9ncmFtLCB0aGVuIHRoaXMgaXMgYW4gZXJyb3IuXG4gICAgICBpZiAoYWxsUHJvZ3JhbXMuZXZlcnkocCA9PiBwLmdldFNvdXJjZUZpbGUoZmlsZSkgPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBGaWxlICR7SlNPTi5zdHJpbmdpZnkoZmlsZSl9IGlzIG5vdCBwYXJ0IG9mIGEgVHlwZVNjcmlwdCBwcm9qZWN0ICcke29wdGlvbnMudHNDb25maWd9Jy5gLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBUaGUgZmlsZSBleGlzdHMgaW4gc29tZSBvdGhlciBwcm9ncmFtcy4gV2Ugd2lsbCBsaW50IGl0IGxhdGVyIChvciBlYXJsaWVyKSBpbiB0aGUgbG9vcC5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudHMgPSBnZXRGaWxlQ29udGVudHMoZmlsZSk7XG5cbiAgICAvLyBPbmx5IGNoZWNrIGZvciBhIG5ldyB0c2xpbnQgY29uZmlnIGlmIHRoZSBwYXRoIGNoYW5nZXMuXG4gICAgY29uc3QgY3VycmVudERpcmVjdG9yeSA9IHBhdGguZGlybmFtZShmaWxlKTtcbiAgICBpZiAoY3VycmVudERpcmVjdG9yeSAhPT0gbGFzdERpcmVjdG9yeSkge1xuICAgICAgY29uZmlnTG9hZCA9IENvbmZpZ3VyYXRpb24uZmluZENvbmZpZ3VyYXRpb24odHNsaW50Q29uZmlnUGF0aCwgZmlsZSk7XG4gICAgICBsYXN0RGlyZWN0b3J5ID0gY3VycmVudERpcmVjdG9yeTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnTG9hZCkge1xuICAgICAgLy8gR2l2ZSBzb21lIGJyZWF0aGluZyBzcGFjZSB0byBvdGhlciBwcm9taXNlcyB0aGF0IG1pZ2h0IGJlIHdhaXRpbmcuXG4gICAgICBhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIGxpbnRlci5saW50KGZpbGUsIGNvbnRlbnRzLCBjb25maWdMb2FkLnJlc3VsdHMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW50ZXIuZ2V0UmVzdWx0KCk7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzVG9MaW50KFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBsaW50ZXI6IHR5cGVvZiB0c2xpbnQuTGludGVyLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaWdub3JlID0gb3B0aW9ucy5leGNsdWRlO1xuICBjb25zdCBmaWxlcyA9IG9wdGlvbnMuZmlsZXMgfHwgW107XG5cbiAgaWYgKGZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZmlsZXNcbiAgICAgIC5tYXAoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZSwgeyBjd2Q6IHJvb3QsIGlnbm9yZSwgbm9kaXI6IHRydWUgfSkpXG4gICAgICAucmVkdWNlKChwcmV2LCBjdXJyKSA9PiBwcmV2LmNvbmNhdChjdXJyKSwgW10pXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKHJvb3QsIGZpbGUpKTtcbiAgfVxuXG4gIGlmICghcHJvZ3JhbSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGxldCBwcm9ncmFtRmlsZXMgPSBsaW50ZXIuZ2V0RmlsZU5hbWVzKHByb2dyYW0pO1xuXG4gIGlmIChpZ25vcmUgJiYgaWdub3JlLmxlbmd0aCA+IDApIHtcbiAgICAvLyBub3JtYWxpemUgdG8gc3VwcG9ydCAuLyBwYXRoc1xuICAgIGNvbnN0IGlnbm9yZU1hdGNoZXJzID0gaWdub3JlXG4gICAgICAubWFwKHBhdHRlcm4gPT4gbmV3IE1pbmltYXRjaChwYXRoLm5vcm1hbGl6ZShwYXR0ZXJuKSwgeyBkb3Q6IHRydWUgfSkpO1xuXG4gICAgcHJvZ3JhbUZpbGVzID0gcHJvZ3JhbUZpbGVzXG4gICAgICAuZmlsdGVyKGZpbGUgPT4gIWlnbm9yZU1hdGNoZXJzLnNvbWUobWF0Y2hlciA9PiBtYXRjaGVyLm1hdGNoKHBhdGgucmVsYXRpdmUocm9vdCwgZmlsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gcHJvZ3JhbUZpbGVzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlQ29udGVudHMoZmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gTk9URTogVGhlIHRzbGludCBDTEkgY2hlY2tzIGZvciBhbmQgZXhjbHVkZXMgTVBFRyB0cmFuc3BvcnQgc3RyZWFtczsgdGhpcyBkb2VzIG5vdC5cbiAgdHJ5IHtcbiAgICByZXR1cm4gc3RyaXBCb20ocmVhZEZpbGVTeW5jKGZpbGUsICd1dGYtOCcpKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVhZCBmaWxlICcke2ZpbGV9Jy5gKTtcbiAgfVxufVxuIl19