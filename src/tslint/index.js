"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const glob = require("glob");
const minimatch_1 = require("minimatch");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const strip_bom_1 = require("../angular-cli-files/utilities/strip-bom");
class TslintBuilder {
    constructor(context) {
        this.context = context;
    }
    async loadTslint() {
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
    run(builderConfig) {
        const root = this.context.workspace.root;
        const systemRoot = core_1.getSystemPath(root);
        const options = builderConfig.options;
        const targetSpecifier = this.context.targetSpecifier;
        const projectName = targetSpecifier && targetSpecifier.project || '';
        // Print formatter output only for non human-readable formats.
        const printInfo = ['prose', 'verbose', 'stylish'].includes(options.format)
            && !options.silent;
        if (printInfo) {
            this.context.logger.info(`Linting ${JSON.stringify(projectName)}...`);
        }
        if (!options.tsConfig && options.typeCheck) {
            throw new Error('A "project" must be specified to enable type checking.');
        }
        return rxjs_1.from(this.loadTslint())
            .pipe(operators_1.concatMap(projectTslint => new rxjs_1.Observable(obs => {
            const tslintConfigPath = options.tslintConfig
                ? path.resolve(systemRoot, options.tslintConfig)
                : null;
            const Linter = projectTslint.Linter;
            let result;
            if (options.tsConfig) {
                const tsConfigs = Array.isArray(options.tsConfig) ? options.tsConfig : [options.tsConfig];
                const allPrograms = tsConfigs.map(tsConfig => Linter.createProgram(path.resolve(systemRoot, tsConfig)));
                for (const program of allPrograms) {
                    const partial = lint(projectTslint, systemRoot, tslintConfigPath, options, program, allPrograms);
                    if (result == undefined) {
                        result = partial;
                    }
                    else {
                        result.failures = result.failures
                            .filter(curr => !partial.failures.some(prev => curr.equals(prev)))
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
                }
            }
            else {
                result = lint(projectTslint, systemRoot, tslintConfigPath, options);
            }
            if (result == undefined) {
                throw new Error('Invalid lint configuration. Nothing to lint.');
            }
            if (!options.silent) {
                const Formatter = projectTslint.findFormatter(options.format);
                if (!Formatter) {
                    throw new Error(`Invalid lint format "${options.format}".`);
                }
                const formatter = new Formatter();
                const output = formatter.format(result.failures, result.fixes, result.fileNames);
                if (output) {
                    this.context.logger.info(output);
                }
            }
            if (result.warningCount > 0 && printInfo) {
                this.context.logger.warn('Lint warnings found in the listed files.');
            }
            if (result.errorCount > 0 && printInfo) {
                this.context.logger.error('Lint errors found in the listed files.');
            }
            if (result.warningCount === 0 && result.errorCount === 0 && printInfo) {
                this.context.logger.info('All files pass linting.');
            }
            const success = options.force || result.errorCount === 0;
            obs.next({ success });
            return obs.complete();
        })));
    }
}
exports.default = TslintBuilder;
function lint(projectTslint, systemRoot, tslintConfigPath, options, program, allPrograms) {
    const Linter = projectTslint.Linter;
    const Configuration = projectTslint.Configuration;
    const files = getFilesToLint(systemRoot, options, Linter, program);
    const lintOptions = {
        fix: options.fix,
        formatter: options.format,
    };
    const linter = new Linter(lintOptions, program);
    let lastDirectory;
    let configLoad;
    const lintedFiles = [];
    for (const file of files) {
        let contents = '';
        if (program && allPrograms) {
            if (!program.getSourceFile(file)) {
                if (!allPrograms.some(p => p.getSourceFile(file) !== undefined)) {
                    // File is not part of any typescript program
                    throw new Error(`File '${file}' is not part of a TypeScript project '${options.tsConfig}'.`);
                }
                // if the Source file exists but it's not in the current program skip
                continue;
            }
        }
        else {
            contents = getFileContents(file);
        }
        // Only check for a new tslint config if the path changes.
        const currentDirectory = path.dirname(file);
        if (currentDirectory !== lastDirectory) {
            configLoad = Configuration.findConfiguration(tslintConfigPath, file);
            lastDirectory = currentDirectory;
        }
        if (configLoad) {
            linter.lint(file, contents, configLoad.results);
            lintedFiles.push(file);
        }
    }
    return Object.assign({}, linter.getResult(), { fileNames: lintedFiles });
}
function getFilesToLint(root, options, linter, program) {
    const ignore = options.exclude;
    if (options.files.length > 0) {
        return options.files
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3RzbGludC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQVFILCtDQUFxRDtBQUNyRCwyQkFBa0M7QUFDbEMsNkJBQTZCO0FBQzdCLHlDQUFzQztBQUN0Qyw2QkFBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUEyQztBQUczQyx3RUFBb0U7QUFrQnBFLE1BQXFCLGFBQWE7SUFFaEMsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRXZDLEtBQUssQ0FBQyxVQUFVO1FBQ3RCLElBQUksTUFBTSxDQUFDO1FBQ1gsSUFBSTtZQUNGLE1BQU0sR0FBRywyQ0FBYSxRQUFRLEVBQUMsQ0FBQyxDQUFDLCtDQUErQztTQUNqRjtRQUFDLFdBQU07WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7U0FDdkU7UUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDdEYsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1NBQzFEO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELEdBQUcsQ0FBQyxhQUF5RDtRQUUzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxD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SUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXpFLFlBQVksR0FBRyxZQUFZO2FBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUY7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsSUFBWTtJQUNuQyxzRkFBc0Y7SUFDdEYsSUFBSTtRQUNGLE9BQU8sb0JBQVEsQ0FBQyxpQkFBWSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQzlDO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLENBQUM7S0FDbkQ7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZ2V0U3lzdGVtUGF0aCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBNaW5pbWF0Y2ggfSBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzbGludCBmcm9tICd0c2xpbnQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdHJpcC1ib20nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRzbGludEJ1aWxkZXJPcHRpb25zIHtcbiAgdHNsaW50Q29uZmlnPzogc3RyaW5nO1xuICB0c0NvbmZpZz86IHN0cmluZyB8IHN0cmluZ1tdO1xuICBmaXg6IGJvb2xlYW47XG4gIHR5cGVDaGVjazogYm9vbGVhbjtcbiAgZm9yY2U6IGJvb2xlYW47XG4gIHNpbGVudDogYm9vbGVhbjtcbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGV4Y2x1ZGU6IHN0cmluZ1tdO1xuICBmaWxlczogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBMaW50UmVzdWx0IGV4dGVuZHMgdHNsaW50LkxpbnRSZXN1bHQge1xuICBmaWxlTmFtZXM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUc2xpbnRCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxUc2xpbnRCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkVHNsaW50KCkge1xuICAgIGxldCB0c2xpbnQ7XG4gICAgdHJ5IHtcbiAgICAgIHRzbGludCA9IGF3YWl0IGltcG9ydCgndHNsaW50Jyk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIFRTTGludC4gRW5zdXJlIFRTTGludCBpcyBpbnN0YWxsZWQuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgdmVyc2lvbiA9IHRzbGludC5MaW50ZXIuVkVSU0lPTiAmJiB0c2xpbnQuTGludGVyLlZFUlNJT04uc3BsaXQoJy4nKTtcbiAgICBpZiAoIXZlcnNpb24gfHwgdmVyc2lvbi5sZW5ndGggPCAyIHx8IE51bWJlcih2ZXJzaW9uWzBdKSA8IDUgfHwgTnVtYmVyKHZlcnNpb25bMV0pIDwgNSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUU0xpbnQgbXVzdCBiZSB2ZXJzaW9uIDUuNSBvciBoaWdoZXIuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRzbGludDtcbiAgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxUc2xpbnRCdWlsZGVyT3B0aW9ucz4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcblxuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCB0YXJnZXRTcGVjaWZpZXIgPSB0aGlzLmNvbnRleHQudGFyZ2V0U3BlY2lmaWVyO1xuICAgIGNvbnN0IHByb2plY3ROYW1lID0gdGFyZ2V0U3BlY2lmaWVyICYmIHRhcmdldFNwZWNpZmllci5wcm9qZWN0IHx8ICcnO1xuXG4gICAgLy8gUHJpbnQgZm9ybWF0dGVyIG91dHB1dCBvbmx5IGZvciBub24gaHVtYW4tcmVhZGFibGUgZm9ybWF0cy5cbiAgICBjb25zdCBwcmludEluZm8gPSBbJ3Byb3NlJywgJ3ZlcmJvc2UnLCAnc3R5bGlzaCddLmluY2x1ZGVzKG9wdGlvbnMuZm9ybWF0KVxuICAgICAgJiYgIW9wdGlvbnMuc2lsZW50O1xuXG4gICAgaWYgKHByaW50SW5mbykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKGBMaW50aW5nICR7SlNPTi5zdHJpbmdpZnkocHJvamVjdE5hbWUpfS4uLmApO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucy50c0NvbmZpZyAmJiBvcHRpb25zLnR5cGVDaGVjaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIFwicHJvamVjdFwiIG11c3QgYmUgc3BlY2lmaWVkIHRvIGVuYWJsZSB0eXBlIGNoZWNraW5nLicpO1xuICAgIH1cblxuICAgIHJldHVybiBmcm9tKHRoaXMubG9hZFRzbGludCgpKVxuICAgICAgLnBpcGUoY29uY2F0TWFwKHByb2plY3RUc2xpbnQgPT4gbmV3IE9ic2VydmFibGU8QnVpbGRFdmVudD4ob2JzID0+IHtcbiAgICAgICAgY29uc3QgdHNsaW50Q29uZmlnUGF0aCA9IG9wdGlvbnMudHNsaW50Q29uZmlnXG4gICAgICAgICAgPyBwYXRoLnJlc29sdmUoc3lzdGVtUm9vdCwgb3B0aW9ucy50c2xpbnRDb25maWcpXG4gICAgICAgICAgOiBudWxsO1xuICAgICAgICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcblxuICAgICAgICBsZXQgcmVzdWx0OiB1bmRlZmluZWQgfCBMaW50UmVzdWx0O1xuICAgICAgICBpZiAob3B0aW9ucy50c0NvbmZpZykge1xuICAgICAgICAgIGNvbnN0IHRzQ29uZmlncyA9IEFycmF5LmlzQXJyYXkob3B0aW9ucy50c0NvbmZpZykgPyBvcHRpb25zLnRzQ29uZmlnIDogW29wdGlvbnMudHNDb25maWddO1xuICAgICAgICAgIGNvbnN0IGFsbFByb2dyYW1zID1cbiAgICAgICAgICAgIHRzQ29uZmlncy5tYXAodHNDb25maWcgPT4gTGludGVyLmNyZWF0ZVByb2dyYW0ocGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIHRzQ29uZmlnKSkpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBwcm9ncmFtIG9mIGFsbFByb2dyYW1zKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0aWFsXG4gICAgICAgICAgICAgID0gbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zLCBwcm9ncmFtLCBhbGxQcm9ncmFtcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZXN1bHQgPSBwYXJ0aWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzdWx0LmZhaWx1cmVzID0gcmVzdWx0LmZhaWx1cmVzXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjdXJyID0+ICFwYXJ0aWFsLmZhaWx1cmVzLnNvbWUocHJldiA9PiBjdXJyLmVxdWFscyhwcmV2KSkpXG4gICAgICAgICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAgICAgICAvLyB3ZSBhcmUgbm90IGRvaW5nIG11Y2ggd2l0aCAnZXJyb3JDb3VudCcgYW5kICd3YXJuaW5nQ291bnQnXG4gICAgICAgICAgICAgIC8vIGFwYXJ0IGZyb20gY2hlY2tpbmcgaWYgdGhleSBhcmUgZ3JlYXRlciB0aGFuIDAgdGh1cyBubyBuZWVkIHRvIGRlZHVwZSB0aGVzZS5cbiAgICAgICAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICAgICAgICByZXN1bHQud2FybmluZ0NvdW50ICs9IHBhcnRpYWwud2FybmluZ0NvdW50O1xuICAgICAgICAgICAgICByZXN1bHQuZmlsZU5hbWVzID0gWy4uLm5ldyBTZXQoWy4uLnJlc3VsdC5maWxlTmFtZXMsIC4uLnBhcnRpYWwuZmlsZU5hbWVzXSldO1xuXG4gICAgICAgICAgICAgIGlmIChwYXJ0aWFsLmZpeGVzKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpbnQgY29uZmlndXJhdGlvbi4gTm90aGluZyB0byBsaW50LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICAgIGNvbnN0IEZvcm1hdHRlciA9IHByb2plY3RUc2xpbnQuZmluZEZvcm1hdHRlcihvcHRpb25zLmZvcm1hdCk7XG4gICAgICAgICAgaWYgKCFGb3JtYXR0ZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsaW50IGZvcm1hdCBcIiR7b3B0aW9ucy5mb3JtYXR9XCIuYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBGb3JtYXR0ZXIoKTtcblxuICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGZvcm1hdHRlci5mb3JtYXQocmVzdWx0LmZhaWx1cmVzLCByZXN1bHQuZml4ZXMsIHJlc3VsdC5maWxlTmFtZXMpO1xuICAgICAgICAgIGlmIChvdXRwdXQpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhvdXRwdXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID4gMCAmJiBwcmludEluZm8pIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oJ0xpbnQgd2FybmluZ3MgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3JDb3VudCA+IDAgJiYgcHJpbnRJbmZvKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcignTGludCBlcnJvcnMgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID09PSAwICYmIHJlc3VsdC5lcnJvckNvdW50ID09PSAwICYmIHByaW50SW5mbykge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbygnQWxsIGZpbGVzIHBhc3MgbGludGluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBvcHRpb25zLmZvcmNlIHx8IHJlc3VsdC5lcnJvckNvdW50ID09PSAwO1xuICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3MgfSk7XG5cbiAgICAgICAgcmV0dXJuIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsaW50KFxuICBwcm9qZWN0VHNsaW50OiB0eXBlb2YgdHNsaW50LFxuICBzeXN0ZW1Sb290OiBzdHJpbmcsXG4gIHRzbGludENvbmZpZ1BhdGg6IHN0cmluZyB8IG51bGwsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbiAgYWxsUHJvZ3JhbXM/OiB0cy5Qcm9ncmFtW10sXG4pOiBMaW50UmVzdWx0IHtcbiAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG4gIGNvbnN0IENvbmZpZ3VyYXRpb24gPSBwcm9qZWN0VHNsaW50LkNvbmZpZ3VyYXRpb247XG5cbiAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1RvTGludChzeXN0ZW1Sb290LCBvcHRpb25zLCBMaW50ZXIsIHByb2dyYW0pO1xuICBjb25zdCBsaW50T3B0aW9ucyA9IHtcbiAgICBmaXg6IG9wdGlvbnMuZml4LFxuICAgIGZvcm1hdHRlcjogb3B0aW9ucy5mb3JtYXQsXG4gIH07XG5cbiAgY29uc3QgbGludGVyID0gbmV3IExpbnRlcihsaW50T3B0aW9ucywgcHJvZ3JhbSk7XG5cbiAgbGV0IGxhc3REaXJlY3Rvcnk7XG4gIGxldCBjb25maWdMb2FkO1xuICBjb25zdCBsaW50ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgbGV0IGNvbnRlbnRzID0gJyc7XG4gICAgaWYgKHByb2dyYW0gJiYgYWxsUHJvZ3JhbXMpIHtcbiAgICAgIGlmICghcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpKSB7XG4gICAgICAgIGlmICghYWxsUHJvZ3JhbXMuc29tZShwID0+IHAuZ2V0U291cmNlRmlsZShmaWxlKSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgIC8vIEZpbGUgaXMgbm90IHBhcnQgb2YgYW55IHR5cGVzY3JpcHQgcHJvZ3JhbVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBGaWxlICcke2ZpbGV9JyBpcyBub3QgcGFydCBvZiBhIFR5cGVTY3JpcHQgcHJvamVjdCAnJHtvcHRpb25zLnRzQ29uZmlnfScuYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgU291cmNlIGZpbGUgZXhpc3RzIGJ1dCBpdCdzIG5vdCBpbiB0aGUgY3VycmVudCBwcm9ncmFtIHNraXBcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRlbnRzID0gZ2V0RmlsZUNvbnRlbnRzKGZpbGUpO1xuICAgIH1cblxuICAgIC8vIE9ubHkgY2hlY2sgZm9yIGEgbmV3IHRzbGludCBjb25maWcgaWYgdGhlIHBhdGggY2hhbmdlcy5cbiAgICBjb25zdCBjdXJyZW50RGlyZWN0b3J5ID0gcGF0aC5kaXJuYW1lKGZpbGUpO1xuICAgIGlmIChjdXJyZW50RGlyZWN0b3J5ICE9PSBsYXN0RGlyZWN0b3J5KSB7XG4gICAgICBjb25maWdMb2FkID0gQ29uZmlndXJhdGlvbi5maW5kQ29uZmlndXJhdGlvbih0c2xpbnRDb25maWdQYXRoLCBmaWxlKTtcbiAgICAgIGxhc3REaXJlY3RvcnkgPSBjdXJyZW50RGlyZWN0b3J5O1xuICAgIH1cblxuICAgIGlmIChjb25maWdMb2FkKSB7XG4gICAgICBsaW50ZXIubGludChmaWxlLCBjb250ZW50cywgY29uZmlnTG9hZC5yZXN1bHRzKTtcbiAgICAgIGxpbnRlZEZpbGVzLnB1c2goZmlsZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5saW50ZXIuZ2V0UmVzdWx0KCksXG4gICAgZmlsZU5hbWVzOiBsaW50ZWRGaWxlcyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZXNUb0xpbnQoXG4gIHJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIGxpbnRlcjogdHlwZW9mIHRzbGludC5MaW50ZXIsXG4gIHByb2dyYW0/OiB0cy5Qcm9ncmFtLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBpZ25vcmUgPSBvcHRpb25zLmV4Y2x1ZGU7XG5cbiAgaWYgKG9wdGlvbnMuZmlsZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBvcHRpb25zLmZpbGVzXG4gICAgICAubWFwKGZpbGUgPT4gZ2xvYi5zeW5jKGZpbGUsIHsgY3dkOiByb290LCBpZ25vcmUsIG5vZGlyOiB0cnVlIH0pKVxuICAgICAgLnJlZHVjZSgocHJldiwgY3VycikgPT4gcHJldi5jb25jYXQoY3VyciksIFtdKVxuICAgICAgLm1hcChmaWxlID0+IHBhdGguam9pbihyb290LCBmaWxlKSk7XG4gIH1cblxuICBpZiAoIXByb2dyYW0pIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBsZXQgcHJvZ3JhbUZpbGVzID0gbGludGVyLmdldEZpbGVOYW1lcyhwcm9ncmFtKTtcblxuICBpZiAoaWdub3JlICYmIGlnbm9yZS5sZW5ndGggPiAwKSB7XG4gICAgLy8gbm9ybWFsaXplIHRvIHN1cHBvcnQgLi8gcGF0aHNcbiAgICBjb25zdCBpZ25vcmVNYXRjaGVycyA9IGlnbm9yZVxuICAgICAgLm1hcChwYXR0ZXJuID0+IG5ldyBNaW5pbWF0Y2gocGF0aC5ub3JtYWxpemUocGF0dGVybiksIHsgZG90OiB0cnVlIH0pKTtcblxuICAgIHByb2dyYW1GaWxlcyA9IHByb2dyYW1GaWxlc1xuICAgICAgLmZpbHRlcihmaWxlID0+ICFpZ25vcmVNYXRjaGVycy5zb21lKG1hdGNoZXIgPT4gbWF0Y2hlci5tYXRjaChwYXRoLnJlbGF0aXZlKHJvb3QsIGZpbGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHByb2dyYW1GaWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZUNvbnRlbnRzKGZpbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIE5PVEU6IFRoZSB0c2xpbnQgQ0xJIGNoZWNrcyBmb3IgYW5kIGV4Y2x1ZGVzIE1QRUcgdHJhbnNwb3J0IHN0cmVhbXM7IHRoaXMgZG9lcyBub3QuXG4gIHRyeSB7XG4gICAgcmV0dXJuIHN0cmlwQm9tKHJlYWRGaWxlU3luYyhmaWxlLCAndXRmLTgnKSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlYWQgZmlsZSAnJHtmaWxlfScuYCk7XG4gIH1cbn1cbiJdfQ==