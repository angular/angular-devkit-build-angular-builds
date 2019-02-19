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
async function _run(config, context) {
    const systemRoot = context.workspaceRoot;
    process.chdir(context.currentDirectory);
    const options = config;
    const projectName = context.target && context.target.project || '<???>';
    // Print formatter output only for non human-readable formats.
    const printInfo = ['prose', 'verbose', 'stylish'].includes(options.format || '')
        && !options.silent;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90c2xpbnQvaW5kZXgyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUVBQW9HO0FBRXBHLDJCQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLDZCQUE2QjtBQUc3Qix3RUFBb0U7QUFPcEUsS0FBSyxVQUFVLFdBQVc7SUFDeEIsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJO1FBQ0YsTUFBTSxHQUFHLDJDQUFhLFFBQVEsRUFBQyxDQUFDLENBQUMsK0NBQStDO0tBQ2pGO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztLQUN2RTtJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBR0QsS0FBSyxVQUFVLElBQUksQ0FBQyxNQUE0QixFQUFFLE9BQXVCO0lBQ3ZFLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDekMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUN4QyxNQUFNLE9BQU8sR0FB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LENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUY7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsSUFBWTtJQUNuQyxzRkFBc0Y7SUFDdEYsSUFBSTtRQUNGLE9BQU8sb0JBQVEsQ0FBQyxpQkFBWSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQzlDO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLENBQUM7S0FDbkQ7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0L3NyYy9pbmRleDInO1xuaW1wb3J0IHsganNvbiB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBNaW5pbWF0Y2ggfSBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzbGludCBmcm9tICd0c2xpbnQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdHJpcC1ib20nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIFJlYWxUc2xpbnRCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuXG50eXBlIFRzbGludEJ1aWxkZXJPcHRpb25zID0gUmVhbFRzbGludEJ1aWxkZXJPcHRpb25zICYganNvbi5Kc29uT2JqZWN0O1xuXG5cbmFzeW5jIGZ1bmN0aW9uIF9sb2FkVHNsaW50KCkge1xuICBsZXQgdHNsaW50O1xuICB0cnkge1xuICAgIHRzbGludCA9IGF3YWl0IGltcG9ydCgndHNsaW50Jyk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgVFNMaW50LiBFbnN1cmUgVFNMaW50IGlzIGluc3RhbGxlZC4nKTtcbiAgfVxuXG4gIGNvbnN0IHZlcnNpb24gPSB0c2xpbnQuTGludGVyLlZFUlNJT04gJiYgdHNsaW50LkxpbnRlci5WRVJTSU9OLnNwbGl0KCcuJyk7XG4gIGlmICghdmVyc2lvbiB8fCB2ZXJzaW9uLmxlbmd0aCA8IDIgfHwgTnVtYmVyKHZlcnNpb25bMF0pIDwgNSB8fCBOdW1iZXIodmVyc2lvblsxXSkgPCA1KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUU0xpbnQgbXVzdCBiZSB2ZXJzaW9uIDUuNSBvciBoaWdoZXIuJyk7XG4gIH1cblxuICByZXR1cm4gdHNsaW50O1xufVxuXG5cbmFzeW5jIGZ1bmN0aW9uIF9ydW4oY29uZmlnOiBUc2xpbnRCdWlsZGVyT3B0aW9ucywgY29udGV4dDogQnVpbGRlckNvbnRleHQpOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgc3lzdGVtUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgcHJvY2Vzcy5jaGRpcihjb250ZXh0LmN1cnJlbnREaXJlY3RvcnkpO1xuICBjb25zdCBvcHRpb25zID0gY29uZmlnO1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3QgfHwgJzw/Pz8+JztcblxuICAvLyBQcmludCBmb3JtYXR0ZXIgb3V0cHV0IG9ubHkgZm9yIG5vbiBodW1hbi1yZWFkYWJsZSBmb3JtYXRzLlxuICBjb25zdCBwcmludEluZm8gPSBbJ3Byb3NlJywgJ3ZlcmJvc2UnLCAnc3R5bGlzaCddLmluY2x1ZGVzKG9wdGlvbnMuZm9ybWF0IHx8ICcnKVxuICAgICAgICAgICAgICAgICAgICAmJiAhb3B0aW9ucy5zaWxlbnQ7XG5cbiAgY29udGV4dC5yZXBvcnRTdGF0dXMoYExpbnRpbmcgJHtKU09OLnN0cmluZ2lmeShwcm9qZWN0TmFtZSl9Li4uYCk7XG4gIGlmIChwcmludEluZm8pIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGBMaW50aW5nICR7SlNPTi5zdHJpbmdpZnkocHJvamVjdE5hbWUpfS4uLmApO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zLnRzQ29uZmlnICYmIG9wdGlvbnMudHlwZUNoZWNrKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBIFwicHJvamVjdFwiIG11c3QgYmUgc3BlY2lmaWVkIHRvIGVuYWJsZSB0eXBlIGNoZWNraW5nLicpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdFRzbGludCA9IGF3YWl0IF9sb2FkVHNsaW50KCk7XG4gIGNvbnN0IHRzbGludENvbmZpZ1BhdGggPSBvcHRpb25zLnRzbGludENvbmZpZ1xuICAgID8gcGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIG9wdGlvbnMudHNsaW50Q29uZmlnKVxuICAgIDogbnVsbDtcbiAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG5cbiAgbGV0IHJlc3VsdDogdW5kZWZpbmVkIHwgdHNsaW50LkxpbnRSZXN1bHQgPSB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLnRzQ29uZmlnKSB7XG4gICAgY29uc3QgdHNDb25maWdzID0gQXJyYXkuaXNBcnJheShvcHRpb25zLnRzQ29uZmlnKSA/IG9wdGlvbnMudHNDb25maWcgOiBbb3B0aW9ucy50c0NvbmZpZ107XG4gICAgY29udGV4dC5yZXBvcnRQcm9ncmVzcygwLCB0c0NvbmZpZ3MubGVuZ3RoKTtcbiAgICBjb25zdCBhbGxQcm9ncmFtcyA9IHRzQ29uZmlncy5tYXAodHNDb25maWcgPT4ge1xuICAgICAgcmV0dXJuIExpbnRlci5jcmVhdGVQcm9ncmFtKHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCB0c0NvbmZpZykpO1xuICAgIH0pO1xuXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgcHJvZ3JhbSBvZiBhbGxQcm9ncmFtcykge1xuICAgICAgY29uc3QgcGFydGlhbFxuICAgICAgICA9IGF3YWl0IF9saW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMsIHByb2dyYW0sIGFsbFByb2dyYW1zKTtcbiAgICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHQgPSBwYXJ0aWFsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LmZhaWx1cmVzID0gcmVzdWx0LmZhaWx1cmVzXG4gICAgICAgICAgLmZpbHRlcihjdXJyID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhcGFydGlhbC5mYWlsdXJlcy5zb21lKHByZXYgPT4gY3Vyci5lcXVhbHMocHJldikpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAvLyB3ZSBhcmUgbm90IGRvaW5nIG11Y2ggd2l0aCAnZXJyb3JDb3VudCcgYW5kICd3YXJuaW5nQ291bnQnXG4gICAgICAgIC8vIGFwYXJ0IGZyb20gY2hlY2tpbmcgaWYgdGhleSBhcmUgZ3JlYXRlciB0aGFuIDAgdGh1cyBubyBuZWVkIHRvIGRlZHVwZSB0aGVzZS5cbiAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICByZXN1bHQud2FybmluZ0NvdW50ICs9IHBhcnRpYWwud2FybmluZ0NvdW50O1xuXG4gICAgICAgIGlmIChwYXJ0aWFsLmZpeGVzKSB7XG4gICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29udGV4dC5yZXBvcnRQcm9ncmVzcygrK2ksIGFsbFByb2dyYW1zLmxlbmd0aCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IGF3YWl0IF9saW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKHJlc3VsdCA9PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGludCBjb25maWd1cmF0aW9uLiBOb3RoaW5nIHRvIGxpbnQuJyk7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgY29uc3QgRm9ybWF0dGVyID0gcHJvamVjdFRzbGludC5maW5kRm9ybWF0dGVyKG9wdGlvbnMuZm9ybWF0IHx8ICcnKTtcbiAgICBpZiAoIUZvcm1hdHRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxpbnQgZm9ybWF0IFwiJHtvcHRpb25zLmZvcm1hdH1cIi5gKTtcbiAgICB9XG4gICAgY29uc3QgZm9ybWF0dGVyID0gbmV3IEZvcm1hdHRlcigpO1xuXG4gICAgY29uc3Qgb3V0cHV0ID0gZm9ybWF0dGVyLmZvcm1hdChyZXN1bHQuZmFpbHVyZXMsIHJlc3VsdC5maXhlcyk7XG4gICAgaWYgKG91dHB1dC50cmltKCkpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8ob3V0cHV0KTtcbiAgICB9XG4gIH1cblxuICBpZiAocmVzdWx0Lndhcm5pbmdDb3VudCA+IDAgJiYgcHJpbnRJbmZvKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybignTGludCB3YXJuaW5ncyBmb3VuZCBpbiB0aGUgbGlzdGVkIGZpbGVzLicpO1xuICB9XG5cbiAgaWYgKHJlc3VsdC5lcnJvckNvdW50ID4gMCAmJiBwcmludEluZm8pIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignTGludCBlcnJvcnMgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgfVxuXG4gIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID09PSAwICYmIHJlc3VsdC5lcnJvckNvdW50ID09PSAwICYmIHByaW50SW5mbykge1xuICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ0FsbCBmaWxlcyBwYXNzIGxpbnRpbmcuJyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHN1Y2Nlc3M6IG9wdGlvbnMuZm9yY2UgfHwgcmVzdWx0LmVycm9yQ291bnQgPT09IDAsXG4gIH07XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxUc2xpbnRCdWlsZGVyT3B0aW9ucz4oX3J1bik7XG5cblxuYXN5bmMgZnVuY3Rpb24gX2xpbnQoXG4gIHByb2plY3RUc2xpbnQ6IHR5cGVvZiB0c2xpbnQsXG4gIHN5c3RlbVJvb3Q6IHN0cmluZyxcbiAgdHNsaW50Q29uZmlnUGF0aDogc3RyaW5nIHwgbnVsbCxcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIHByb2dyYW0/OiB0cy5Qcm9ncmFtLFxuICBhbGxQcm9ncmFtcz86IHRzLlByb2dyYW1bXSxcbikge1xuICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcbiAgY29uc3QgQ29uZmlndXJhdGlvbiA9IHByb2plY3RUc2xpbnQuQ29uZmlndXJhdGlvbjtcblxuICBjb25zdCBmaWxlcyA9IGdldEZpbGVzVG9MaW50KHN5c3RlbVJvb3QsIG9wdGlvbnMsIExpbnRlciwgcHJvZ3JhbSk7XG4gIGNvbnN0IGxpbnRPcHRpb25zID0ge1xuICAgIGZpeDogISFvcHRpb25zLmZpeCxcbiAgICBmb3JtYXR0ZXI6IG9wdGlvbnMuZm9ybWF0LFxuICB9O1xuXG4gIGNvbnN0IGxpbnRlciA9IG5ldyBMaW50ZXIobGludE9wdGlvbnMsIHByb2dyYW0pO1xuXG4gIGxldCBsYXN0RGlyZWN0b3J5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBjb25maWdMb2FkO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBpZiAocHJvZ3JhbSAmJiBhbGxQcm9ncmFtcykge1xuICAgICAgLy8gSWYgaXQgY2Fubm90IGJlIGZvdW5kIGluIEFOWSBwcm9ncmFtLCB0aGVuIHRoaXMgaXMgYW4gZXJyb3IuXG4gICAgICBpZiAoYWxsUHJvZ3JhbXMuZXZlcnkocCA9PiBwLmdldFNvdXJjZUZpbGUoZmlsZSkgPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBGaWxlICR7SlNPTi5zdHJpbmdpZnkoZmlsZSl9IGlzIG5vdCBwYXJ0IG9mIGEgVHlwZVNjcmlwdCBwcm9qZWN0ICcke29wdGlvbnMudHNDb25maWd9Jy5gLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBUaGUgZmlsZSBleGlzdHMgaW4gc29tZSBvdGhlciBwcm9ncmFtcy4gV2Ugd2lsbCBsaW50IGl0IGxhdGVyIChvciBlYXJsaWVyKSBpbiB0aGUgbG9vcC5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29udGVudHMgPSBnZXRGaWxlQ29udGVudHMoZmlsZSk7XG5cbiAgICAvLyBPbmx5IGNoZWNrIGZvciBhIG5ldyB0c2xpbnQgY29uZmlnIGlmIHRoZSBwYXRoIGNoYW5nZXMuXG4gICAgY29uc3QgY3VycmVudERpcmVjdG9yeSA9IHBhdGguZGlybmFtZShmaWxlKTtcbiAgICBpZiAoY3VycmVudERpcmVjdG9yeSAhPT0gbGFzdERpcmVjdG9yeSkge1xuICAgICAgY29uZmlnTG9hZCA9IENvbmZpZ3VyYXRpb24uZmluZENvbmZpZ3VyYXRpb24odHNsaW50Q29uZmlnUGF0aCwgZmlsZSk7XG4gICAgICBsYXN0RGlyZWN0b3J5ID0gY3VycmVudERpcmVjdG9yeTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnTG9hZCkge1xuICAgICAgLy8gR2l2ZSBzb21lIGJyZWF0aGluZyBzcGFjZSB0byBvdGhlciBwcm9taXNlcyB0aGF0IG1pZ2h0IGJlIHdhaXRpbmcuXG4gICAgICBhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIGxpbnRlci5saW50KGZpbGUsIGNvbnRlbnRzLCBjb25maWdMb2FkLnJlc3VsdHMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW50ZXIuZ2V0UmVzdWx0KCk7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzVG9MaW50KFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBsaW50ZXI6IHR5cGVvZiB0c2xpbnQuTGludGVyLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaWdub3JlID0gb3B0aW9ucy5leGNsdWRlO1xuICBjb25zdCBmaWxlcyA9IG9wdGlvbnMuZmlsZXMgfHwgW107XG5cbiAgaWYgKGZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZmlsZXNcbiAgICAgIC5tYXAoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZSwgeyBjd2Q6IHJvb3QsIGlnbm9yZSwgbm9kaXI6IHRydWUgfSkpXG4gICAgICAucmVkdWNlKChwcmV2LCBjdXJyKSA9PiBwcmV2LmNvbmNhdChjdXJyKSwgW10pXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKHJvb3QsIGZpbGUpKTtcbiAgfVxuXG4gIGlmICghcHJvZ3JhbSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGxldCBwcm9ncmFtRmlsZXMgPSBsaW50ZXIuZ2V0RmlsZU5hbWVzKHByb2dyYW0pO1xuXG4gIGlmIChpZ25vcmUgJiYgaWdub3JlLmxlbmd0aCA+IDApIHtcbiAgICAvLyBub3JtYWxpemUgdG8gc3VwcG9ydCAuLyBwYXRoc1xuICAgIGNvbnN0IGlnbm9yZU1hdGNoZXJzID0gaWdub3JlXG4gICAgICAubWFwKHBhdHRlcm4gPT4gbmV3IE1pbmltYXRjaChwYXRoLm5vcm1hbGl6ZShwYXR0ZXJuKSwgeyBkb3Q6IHRydWUgfSkpO1xuXG4gICAgcHJvZ3JhbUZpbGVzID0gcHJvZ3JhbUZpbGVzXG4gICAgICAuZmlsdGVyKGZpbGUgPT4gIWlnbm9yZU1hdGNoZXJzLnNvbWUobWF0Y2hlciA9PiBtYXRjaGVyLm1hdGNoKHBhdGgucmVsYXRpdmUocm9vdCwgZmlsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gcHJvZ3JhbUZpbGVzO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlQ29udGVudHMoZmlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gTk9URTogVGhlIHRzbGludCBDTEkgY2hlY2tzIGZvciBhbmQgZXhjbHVkZXMgTVBFRyB0cmFuc3BvcnQgc3RyZWFtczsgdGhpcyBkb2VzIG5vdC5cbiAgdHJ5IHtcbiAgICByZXR1cm4gc3RyaXBCb20ocmVhZEZpbGVTeW5jKGZpbGUsICd1dGYtOCcpKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVhZCBmaWxlICcke2ZpbGV9Jy5gKTtcbiAgfVxufVxuIl19