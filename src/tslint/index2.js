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
                result.fileNames = [...new Set([...result.fileNames, ...partial.fileNames])];
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
        const output = formatter.format(result.failures, result.fixes, result.fileNames);
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
    const lintedFiles = [];
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
            lintedFiles.push(file);
        }
    }
    return Object.assign({}, linter.getResult(), { fileNames: lintedFiles });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90c2xpbnQvaW5kZXgyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUVBQW9HO0FBRXBHLDJCQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLDZCQUE2QjtBQUc3Qix3RUFBb0U7QUFTcEUsS0FBSyxVQUFVLFdBQVc7SUFDeEIsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJO1FBQ0YsTUFBTSxHQUFHLDJDQUFhLFFBQVEsRUFBQyxDQUFDLENBQUMsK0NBQStDO0tBQ2pGO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztLQUN2RTtJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBR0QsS0FBSyxVQUFVLElBQUksQ0FDakIsT0FBNkIsRUFDN0IsT0FBdUI7SUFFdkIsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUN6QyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sV0FBVyxH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LE9BQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV6RSxZQUFZLEdBQUcsWUFBWTthQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzlGO0lBRUQsT0FBTyxZQUFZLENBQUM7QUFDdEIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLElBQVk7SUFDbkMsc0ZBQXNGO0lBQ3RGLElBQUk7UUFDRixPQUFPLG9CQUFRLENBQUMsaUJBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztLQUM5QztJQUFDLFdBQU07UUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixJQUFJLElBQUksQ0FBQyxDQUFDO0tBQ25EO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0IHsgTWluaW1hdGNoIH0gZnJvbSAnbWluaW1hdGNoJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2xpbnQgZnJvbSAndHNsaW50JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgc3RyaXBCb20gfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc3RyaXAtYm9tJztcbmltcG9ydCB7IFNjaGVtYSBhcyBSZWFsVHNsaW50QnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cblxudHlwZSBUc2xpbnRCdWlsZGVyT3B0aW9ucyA9IFJlYWxUc2xpbnRCdWlsZGVyT3B0aW9ucyAmIGpzb24uSnNvbk9iamVjdDtcbmludGVyZmFjZSBMaW50UmVzdWx0IGV4dGVuZHMgdHNsaW50LkxpbnRSZXN1bHQge1xuICBmaWxlTmFtZXM6IHN0cmluZ1tdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZFRzbGludCgpIHtcbiAgbGV0IHRzbGludDtcbiAgdHJ5IHtcbiAgICB0c2xpbnQgPSBhd2FpdCBpbXBvcnQoJ3RzbGludCcpOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIFRTTGludC4gRW5zdXJlIFRTTGludCBpcyBpbnN0YWxsZWQuJyk7XG4gIH1cblxuICBjb25zdCB2ZXJzaW9uID0gdHNsaW50LkxpbnRlci5WRVJTSU9OICYmIHRzbGludC5MaW50ZXIuVkVSU0lPTi5zcGxpdCgnLicpO1xuICBpZiAoIXZlcnNpb24gfHwgdmVyc2lvbi5sZW5ndGggPCAyIHx8IE51bWJlcih2ZXJzaW9uWzBdKSA8IDUgfHwgTnVtYmVyKHZlcnNpb25bMV0pIDwgNSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVFNMaW50IG11c3QgYmUgdmVyc2lvbiA1LjUgb3IgaGlnaGVyLicpO1xuICB9XG5cbiAgcmV0dXJuIHRzbGludDtcbn1cblxuXG5hc3luYyBmdW5jdGlvbiBfcnVuKFxuICBvcHRpb25zOiBUc2xpbnRCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgc3lzdGVtUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgcHJvY2Vzcy5jaGRpcihjb250ZXh0LmN1cnJlbnREaXJlY3RvcnkpO1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IChjb250ZXh0LnRhcmdldCAmJiBjb250ZXh0LnRhcmdldC5wcm9qZWN0KSB8fCAnPD8/Pz4nO1xuXG4gIC8vIFByaW50IGZvcm1hdHRlciBvdXRwdXQgb25seSBmb3Igbm9uIGh1bWFuLXJlYWRhYmxlIGZvcm1hdHMuXG4gIGNvbnN0IHByaW50SW5mbyA9XG4gICAgWydwcm9zZScsICd2ZXJib3NlJywgJ3N0eWxpc2gnXS5pbmNsdWRlcyhvcHRpb25zLmZvcm1hdCB8fCAnJykgJiYgIW9wdGlvbnMuc2lsZW50O1xuXG4gIGNvbnRleHQucmVwb3J0U3RhdHVzKGBMaW50aW5nICR7SlNPTi5zdHJpbmdpZnkocHJvamVjdE5hbWUpfS4uLmApO1xuICBpZiAocHJpbnRJbmZvKSB7XG4gICAgY29udGV4dC5sb2dnZXIuaW5mbyhgTGludGluZyAke0pTT04uc3RyaW5naWZ5KHByb2plY3ROYW1lKX0uLi5gKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucy50c0NvbmZpZyAmJiBvcHRpb25zLnR5cGVDaGVjaykge1xuICAgIHRocm93IG5ldyBFcnJvcignQSBcInByb2plY3RcIiBtdXN0IGJlIHNwZWNpZmllZCB0byBlbmFibGUgdHlwZSBjaGVja2luZy4nKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RUc2xpbnQgPSBhd2FpdCBfbG9hZFRzbGludCgpO1xuICBjb25zdCB0c2xpbnRDb25maWdQYXRoID0gb3B0aW9ucy50c2xpbnRDb25maWdcbiAgICA/IHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCBvcHRpb25zLnRzbGludENvbmZpZylcbiAgICA6IG51bGw7XG4gIGNvbnN0IExpbnRlciA9IHByb2plY3RUc2xpbnQuTGludGVyO1xuXG4gIGxldCByZXN1bHQ6IHVuZGVmaW5lZCB8IExpbnRSZXN1bHQgPSB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLnRzQ29uZmlnKSB7XG4gICAgY29uc3QgdHNDb25maWdzID0gQXJyYXkuaXNBcnJheShvcHRpb25zLnRzQ29uZmlnKSA/IG9wdGlvbnMudHNDb25maWcgOiBbb3B0aW9ucy50c0NvbmZpZ107XG4gICAgY29udGV4dC5yZXBvcnRQcm9ncmVzcygwLCB0c0NvbmZpZ3MubGVuZ3RoKTtcbiAgICBjb25zdCBhbGxQcm9ncmFtcyA9IHRzQ29uZmlncy5tYXAodHNDb25maWcgPT4ge1xuICAgICAgcmV0dXJuIExpbnRlci5jcmVhdGVQcm9ncmFtKHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCB0c0NvbmZpZykpO1xuICAgIH0pO1xuXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgcHJvZ3JhbSBvZiBhbGxQcm9ncmFtcykge1xuICAgICAgY29uc3QgcGFydGlhbCA9IGF3YWl0IF9saW50KFxuICAgICAgICBwcm9qZWN0VHNsaW50LFxuICAgICAgICBzeXN0ZW1Sb290LFxuICAgICAgICB0c2xpbnRDb25maWdQYXRoLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICBwcm9ncmFtLFxuICAgICAgICBhbGxQcm9ncmFtcyxcbiAgICAgICk7XG4gICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0ID0gcGFydGlhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5mYWlsdXJlcyA9IHJlc3VsdC5mYWlsdXJlc1xuICAgICAgICAgIC5maWx0ZXIoY3VyciA9PiB7XG4gICAgICAgICAgICByZXR1cm4gIXBhcnRpYWwuZmFpbHVyZXMuc29tZShwcmV2ID0+IGN1cnIuZXF1YWxzKHByZXYpKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jb25jYXQocGFydGlhbC5mYWlsdXJlcyk7XG5cbiAgICAgICAgLy8gd2UgYXJlIG5vdCBkb2luZyBtdWNoIHdpdGggJ2Vycm9yQ291bnQnIGFuZCAnd2FybmluZ0NvdW50J1xuICAgICAgICAvLyBhcGFydCBmcm9tIGNoZWNraW5nIGlmIHRoZXkgYXJlIGdyZWF0ZXIgdGhhbiAwIHRodXMgbm8gbmVlZCB0byBkZWR1cGUgdGhlc2UuXG4gICAgICAgIHJlc3VsdC5lcnJvckNvdW50ICs9IHBhcnRpYWwuZXJyb3JDb3VudDtcbiAgICAgICAgcmVzdWx0Lndhcm5pbmdDb3VudCArPSBwYXJ0aWFsLndhcm5pbmdDb3VudDtcbiAgICAgICAgcmVzdWx0LmZpbGVOYW1lcyA9IFsuLi5uZXcgU2V0KFsuLi5yZXN1bHQuZmlsZU5hbWVzLCAuLi5wYXJ0aWFsLmZpbGVOYW1lc10pXTtcblxuICAgICAgICBpZiAocGFydGlhbC5maXhlcykge1xuICAgICAgICAgIHJlc3VsdC5maXhlcyA9IHJlc3VsdC5maXhlcyA/IHJlc3VsdC5maXhlcy5jb25jYXQocGFydGlhbC5maXhlcykgOiBwYXJ0aWFsLmZpeGVzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnRleHQucmVwb3J0UHJvZ3Jlc3MoKytpLCBhbGxQcm9ncmFtcy5sZW5ndGgpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSBhd2FpdCBfbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zKTtcbiAgfVxuXG4gIGlmIChyZXN1bHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpbnQgY29uZmlndXJhdGlvbi4gTm90aGluZyB0byBsaW50LicpO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zLnNpbGVudCkge1xuICAgIGNvbnN0IEZvcm1hdHRlciA9IHByb2plY3RUc2xpbnQuZmluZEZvcm1hdHRlcihvcHRpb25zLmZvcm1hdCB8fCAnJyk7XG4gICAgaWYgKCFGb3JtYXR0ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsaW50IGZvcm1hdCBcIiR7b3B0aW9ucy5mb3JtYXR9XCIuYCk7XG4gICAgfVxuICAgIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBGb3JtYXR0ZXIoKTtcblxuICAgIGNvbnN0IG91dHB1dCA9IGZvcm1hdHRlci5mb3JtYXQocmVzdWx0LmZhaWx1cmVzLCByZXN1bHQuZml4ZXMsIHJlc3VsdC5maWxlTmFtZXMpO1xuICAgIGlmIChvdXRwdXQudHJpbSgpKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKG91dHB1dCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHJlc3VsdC53YXJuaW5nQ291bnQgPiAwICYmIHByaW50SW5mbykge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oJ0xpbnQgd2FybmluZ3MgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgfVxuXG4gIGlmIChyZXN1bHQuZXJyb3JDb3VudCA+IDAgJiYgcHJpbnRJbmZvKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ0xpbnQgZXJyb3JzIGZvdW5kIGluIHRoZSBsaXN0ZWQgZmlsZXMuJyk7XG4gIH1cblxuICBpZiAocmVzdWx0Lndhcm5pbmdDb3VudCA9PT0gMCAmJiByZXN1bHQuZXJyb3JDb3VudCA9PT0gMCAmJiBwcmludEluZm8pIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdBbGwgZmlsZXMgcGFzcyBsaW50aW5nLicpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzdWNjZXNzOiBvcHRpb25zLmZvcmNlIHx8IHJlc3VsdC5lcnJvckNvdW50ID09PSAwLFxuICB9O1xufVxuXG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8VHNsaW50QnVpbGRlck9wdGlvbnM+KF9ydW4pO1xuXG5cbmFzeW5jIGZ1bmN0aW9uIF9saW50KFxuICBwcm9qZWN0VHNsaW50OiB0eXBlb2YgdHNsaW50LFxuICBzeXN0ZW1Sb290OiBzdHJpbmcsXG4gIHRzbGludENvbmZpZ1BhdGg6IHN0cmluZyB8IG51bGwsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbiAgYWxsUHJvZ3JhbXM/OiB0cy5Qcm9ncmFtW10sXG4pOiBQcm9taXNlPExpbnRSZXN1bHQ+IHtcbiAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG4gIGNvbnN0IENvbmZpZ3VyYXRpb24gPSBwcm9qZWN0VHNsaW50LkNvbmZpZ3VyYXRpb247XG5cbiAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1RvTGludChzeXN0ZW1Sb290LCBvcHRpb25zLCBMaW50ZXIsIHByb2dyYW0pO1xuICBjb25zdCBsaW50T3B0aW9ucyA9IHtcbiAgICBmaXg6ICEhb3B0aW9ucy5maXgsXG4gICAgZm9ybWF0dGVyOiBvcHRpb25zLmZvcm1hdCxcbiAgfTtcblxuICBjb25zdCBsaW50ZXIgPSBuZXcgTGludGVyKGxpbnRPcHRpb25zLCBwcm9ncmFtKTtcblxuICBsZXQgbGFzdERpcmVjdG9yeTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgY29uZmlnTG9hZDtcbiAgY29uc3QgbGludGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgIGlmIChwcm9ncmFtICYmIGFsbFByb2dyYW1zKSB7XG4gICAgICAvLyBJZiBpdCBjYW5ub3QgYmUgZm91bmQgaW4gQU5ZIHByb2dyYW0sIHRoZW4gdGhpcyBpcyBhbiBlcnJvci5cbiAgICAgIGlmIChhbGxQcm9ncmFtcy5ldmVyeShwID0+IHAuZ2V0U291cmNlRmlsZShmaWxlKSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEZpbGUgJHtKU09OLnN0cmluZ2lmeShmaWxlKX0gaXMgbm90IHBhcnQgb2YgYSBUeXBlU2NyaXB0IHByb2plY3QgJyR7b3B0aW9ucy50c0NvbmZpZ30nLmAsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIFRoZSBmaWxlIGV4aXN0cyBpbiBzb21lIG90aGVyIHByb2dyYW1zLiBXZSB3aWxsIGxpbnQgaXQgbGF0ZXIgKG9yIGVhcmxpZXIpIGluIHRoZSBsb29wLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50cyA9IGdldEZpbGVDb250ZW50cyhmaWxlKTtcblxuICAgIC8vIE9ubHkgY2hlY2sgZm9yIGEgbmV3IHRzbGludCBjb25maWcgaWYgdGhlIHBhdGggY2hhbmdlcy5cbiAgICBjb25zdCBjdXJyZW50RGlyZWN0b3J5ID0gcGF0aC5kaXJuYW1lKGZpbGUpO1xuICAgIGlmIChjdXJyZW50RGlyZWN0b3J5ICE9PSBsYXN0RGlyZWN0b3J5KSB7XG4gICAgICBjb25maWdMb2FkID0gQ29uZmlndXJhdGlvbi5maW5kQ29uZmlndXJhdGlvbih0c2xpbnRDb25maWdQYXRoLCBmaWxlKTtcbiAgICAgIGxhc3REaXJlY3RvcnkgPSBjdXJyZW50RGlyZWN0b3J5O1xuICAgIH1cblxuICAgIGlmIChjb25maWdMb2FkKSB7XG4gICAgICAvLyBHaXZlIHNvbWUgYnJlYXRoaW5nIHNwYWNlIHRvIG90aGVyIHByb21pc2VzIHRoYXQgbWlnaHQgYmUgd2FpdGluZy5cbiAgICAgIGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgbGludGVyLmxpbnQoZmlsZSwgY29udGVudHMsIGNvbmZpZ0xvYWQucmVzdWx0cyk7XG4gICAgICBsaW50ZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4ubGludGVyLmdldFJlc3VsdCgpLFxuICAgIGZpbGVOYW1lczogbGludGVkRmlsZXMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzVG9MaW50KFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBsaW50ZXI6IHR5cGVvZiB0c2xpbnQuTGludGVyLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaWdub3JlID0gb3B0aW9ucy5leGNsdWRlO1xuICBjb25zdCBmaWxlcyA9IG9wdGlvbnMuZmlsZXMgfHwgW107XG5cbiAgaWYgKGZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZmlsZXNcbiAgICAgIC5tYXAoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZSwgeyBjd2Q6IHJvb3QsIGlnbm9yZSwgbm9kaXI6IHRydWUgfSkpXG4gICAgICAucmVkdWNlKChwcmV2LCBjdXJyKSA9PiBwcmV2LmNvbmNhdChjdXJyKSwgW10pXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKHJvb3QsIGZpbGUpKTtcbiAgfVxuXG4gIGlmICghcHJvZ3JhbSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGxldCBwcm9ncmFtRmlsZXMgPSBsaW50ZXIuZ2V0RmlsZU5hbWVzKHByb2dyYW0pO1xuXG4gIGlmIChpZ25vcmUgJiYgaWdub3JlLmxlbmd0aCA+IDApIHtcbiAgICAvLyBub3JtYWxpemUgdG8gc3VwcG9ydCAuLyBwYXRoc1xuICAgIGNvbnN0IGlnbm9yZU1hdGNoZXJzID0gaWdub3JlXG4gICAgICAubWFwKHBhdHRlcm4gPT4gbmV3IE1pbmltYXRjaChwYXRoLm5vcm1hbGl6ZShwYXR0ZXJuKSwgeyBkb3Q6IHRydWUgfSkpO1xuXG4gICAgcHJvZ3JhbUZpbGVzID0gcHJvZ3JhbUZpbGVzXG4gICAgICAuZmlsdGVyKGZpbGUgPT4gIWlnbm9yZU1hdGNoZXJzLnNvbWUobWF0Y2hlciA9PiBtYXRjaGVyLm1hdGNoKHBhdGgucmVsYXRpdmUocm9vdCwgZmlsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gcHJvZ3JhbUZpbGVzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlQ29udGVudHMoZmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gTk9URTogVGhlIHRzbGludCBDTEkgY2hlY2tzIGZvciBhbmQgZXhjbHVkZXMgTVBFRyB0cmFuc3BvcnQgc3RyZWFtczsgdGhpcyBkb2VzIG5vdC5cbiAgdHJ5IHtcbiAgICByZXR1cm4gc3RyaXBCb20ocmVhZEZpbGVTeW5jKGZpbGUsICd1dGYtOCcpKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVhZCBmaWxlICcke2ZpbGV9Jy5gKTtcbiAgfVxufVxuIl19