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
                const output = formatter.format(result.failures, result.fixes);
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
        }
    }
    return linter.getResult();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3RzbGludC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQVFILCtDQUFxRDtBQUNyRCwyQkFBa0M7QUFDbEMsNkJBQTZCO0FBQzdCLHlDQUFzQztBQUN0Qyw2QkFBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUEyQztBQUczQyx3RUFBb0U7QUFjcEUsTUFBcUIsYUFBYTtJQUVoQyxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFdkMsS0FBSyxDQUFDLFVBQVU7UUFDdEIsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFJO1lBQ0YsTUFBTSxHQUFHLDJDQUFhLFFBQVEsRUFBQyxDQUFDLENBQUMsK0NBQStDO1NBQ2pGO1FBQUMsV0FBTTtZQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztTQUN2RTtRQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7U0FDMUQ7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsR0FBRyxDQUFDLGFBQXlEO1FBRTNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENB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QixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsSUFBWTtJQUNuQyxzRkFBc0Y7SUFDdEYsSUFBSTtRQUNGLE9BQU8sb0JBQVEsQ0FBQyxpQkFBWSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQzlDO0lBQUMsV0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLENBQUM7S0FDbkQ7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZ2V0U3lzdGVtUGF0aCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBNaW5pbWF0Y2ggfSBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzbGludCBmcm9tICd0c2xpbnQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdHJpcC1ib20nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRzbGludEJ1aWxkZXJPcHRpb25zIHtcbiAgdHNsaW50Q29uZmlnPzogc3RyaW5nO1xuICB0c0NvbmZpZz86IHN0cmluZyB8IHN0cmluZ1tdO1xuICBmaXg6IGJvb2xlYW47XG4gIHR5cGVDaGVjazogYm9vbGVhbjtcbiAgZm9yY2U6IGJvb2xlYW47XG4gIHNpbGVudDogYm9vbGVhbjtcbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGV4Y2x1ZGU6IHN0cmluZ1tdO1xuICBmaWxlczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRzbGludEJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPFRzbGludEJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRUc2xpbnQoKSB7XG4gICAgbGV0IHRzbGludDtcbiAgICB0cnkge1xuICAgICAgdHNsaW50ID0gYXdhaXQgaW1wb3J0KCd0c2xpbnQnKTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgVFNMaW50LiBFbnN1cmUgVFNMaW50IGlzIGluc3RhbGxlZC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCB2ZXJzaW9uID0gdHNsaW50LkxpbnRlci5WRVJTSU9OICYmIHRzbGludC5MaW50ZXIuVkVSU0lPTi5zcGxpdCgnLicpO1xuICAgIGlmICghdmVyc2lvbiB8fCB2ZXJzaW9uLmxlbmd0aCA8IDIgfHwgTnVtYmVyKHZlcnNpb25bMF0pIDwgNSB8fCBOdW1iZXIodmVyc2lvblsxXSkgPCA1KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RTTGludCBtdXN0IGJlIHZlcnNpb24gNS41IG9yIGhpZ2hlci4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHNsaW50O1xuICB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPFRzbGludEJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuXG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBzeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChyb290KTtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHRhcmdldFNwZWNpZmllciA9IHRoaXMuY29udGV4dC50YXJnZXRTcGVjaWZpZXI7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSB0YXJnZXRTcGVjaWZpZXIgJiYgdGFyZ2V0U3BlY2lmaWVyLnByb2plY3QgfHwgJyc7XG5cbiAgICAvLyBQcmludCBmb3JtYXR0ZXIgb3V0cHV0IG9ubHkgZm9yIG5vbiBodW1hbi1yZWFkYWJsZSBmb3JtYXRzLlxuICAgIGNvbnN0IHByaW50SW5mbyA9IFsncHJvc2UnLCAndmVyYm9zZScsICdzdHlsaXNoJ10uaW5jbHVkZXMob3B0aW9ucy5mb3JtYXQpXG4gICAgICAmJiAhb3B0aW9ucy5zaWxlbnQ7XG5cbiAgICBpZiAocHJpbnRJbmZvKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oYExpbnRpbmcgJHtKU09OLnN0cmluZ2lmeShwcm9qZWN0TmFtZSl9Li4uYCk7XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLnRzQ29uZmlnICYmIG9wdGlvbnMudHlwZUNoZWNrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgXCJwcm9qZWN0XCIgbXVzdCBiZSBzcGVjaWZpZWQgdG8gZW5hYmxlIHR5cGUgY2hlY2tpbmcuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZyb20odGhpcy5sb2FkVHNsaW50KCkpXG4gICAgICAucGlwZShjb25jYXRNYXAocHJvamVjdFRzbGludCA9PiBuZXcgT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PihvYnMgPT4ge1xuICAgICAgICBjb25zdCB0c2xpbnRDb25maWdQYXRoID0gb3B0aW9ucy50c2xpbnRDb25maWdcbiAgICAgICAgICA/IHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCBvcHRpb25zLnRzbGludENvbmZpZylcbiAgICAgICAgICA6IG51bGw7XG4gICAgICAgIGNvbnN0IExpbnRlciA9IHByb2plY3RUc2xpbnQuTGludGVyO1xuXG4gICAgICAgIGxldCByZXN1bHQ6IHVuZGVmaW5lZCB8IHRzbGludC5MaW50UmVzdWx0O1xuICAgICAgICBpZiAob3B0aW9ucy50c0NvbmZpZykge1xuICAgICAgICAgIGNvbnN0IHRzQ29uZmlncyA9IEFycmF5LmlzQXJyYXkob3B0aW9ucy50c0NvbmZpZykgPyBvcHRpb25zLnRzQ29uZmlnIDogW29wdGlvbnMudHNDb25maWddO1xuICAgICAgICAgIGNvbnN0IGFsbFByb2dyYW1zID1cbiAgICAgICAgICAgIHRzQ29uZmlncy5tYXAodHNDb25maWcgPT4gTGludGVyLmNyZWF0ZVByb2dyYW0ocGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIHRzQ29uZmlnKSkpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBwcm9ncmFtIG9mIGFsbFByb2dyYW1zKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0aWFsXG4gICAgICAgICAgICAgID0gbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zLCBwcm9ncmFtLCBhbGxQcm9ncmFtcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZXN1bHQgPSBwYXJ0aWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzdWx0LmZhaWx1cmVzID0gcmVzdWx0LmZhaWx1cmVzXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjdXJyID0+ICFwYXJ0aWFsLmZhaWx1cmVzLnNvbWUocHJldiA9PiBjdXJyLmVxdWFscyhwcmV2KSkpXG4gICAgICAgICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAgICAgICAvLyB3ZSBhcmUgbm90IGRvaW5nIG11Y2ggd2l0aCAnZXJyb3JDb3VudCcgYW5kICd3YXJuaW5nQ291bnQnXG4gICAgICAgICAgICAgIC8vIGFwYXJ0IGZyb20gY2hlY2tpbmcgaWYgdGhleSBhcmUgZ3JlYXRlciB0aGFuIDAgdGh1cyBubyBuZWVkIHRvIGRlZHVwZSB0aGVzZS5cbiAgICAgICAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICAgICAgICByZXN1bHQud2FybmluZ0NvdW50ICs9IHBhcnRpYWwud2FybmluZ0NvdW50O1xuXG4gICAgICAgICAgICAgIGlmIChwYXJ0aWFsLmZpeGVzKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpbnQgY29uZmlndXJhdGlvbi4gTm90aGluZyB0byBsaW50LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICAgIGNvbnN0IEZvcm1hdHRlciA9IHByb2plY3RUc2xpbnQuZmluZEZvcm1hdHRlcihvcHRpb25zLmZvcm1hdCk7XG4gICAgICAgICAgaWYgKCFGb3JtYXR0ZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsaW50IGZvcm1hdCBcIiR7b3B0aW9ucy5mb3JtYXR9XCIuYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBGb3JtYXR0ZXIoKTtcblxuICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGZvcm1hdHRlci5mb3JtYXQocmVzdWx0LmZhaWx1cmVzLCByZXN1bHQuZml4ZXMpO1xuICAgICAgICAgIGlmIChvdXRwdXQpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhvdXRwdXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID4gMCAmJiBwcmludEluZm8pIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oJ0xpbnQgd2FybmluZ3MgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3JDb3VudCA+IDAgJiYgcHJpbnRJbmZvKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcignTGludCBlcnJvcnMgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID09PSAwICYmIHJlc3VsdC5lcnJvckNvdW50ID09PSAwICYmIHByaW50SW5mbykge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbygnQWxsIGZpbGVzIHBhc3MgbGludGluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBvcHRpb25zLmZvcmNlIHx8IHJlc3VsdC5lcnJvckNvdW50ID09PSAwO1xuICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3MgfSk7XG5cbiAgICAgICAgcmV0dXJuIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsaW50KFxuICBwcm9qZWN0VHNsaW50OiB0eXBlb2YgdHNsaW50LFxuICBzeXN0ZW1Sb290OiBzdHJpbmcsXG4gIHRzbGludENvbmZpZ1BhdGg6IHN0cmluZyB8IG51bGwsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbiAgYWxsUHJvZ3JhbXM/OiB0cy5Qcm9ncmFtW10sXG4pIHtcbiAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG4gIGNvbnN0IENvbmZpZ3VyYXRpb24gPSBwcm9qZWN0VHNsaW50LkNvbmZpZ3VyYXRpb247XG5cbiAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1RvTGludChzeXN0ZW1Sb290LCBvcHRpb25zLCBMaW50ZXIsIHByb2dyYW0pO1xuICBjb25zdCBsaW50T3B0aW9ucyA9IHtcbiAgICBmaXg6IG9wdGlvbnMuZml4LFxuICAgIGZvcm1hdHRlcjogb3B0aW9ucy5mb3JtYXQsXG4gIH07XG5cbiAgY29uc3QgbGludGVyID0gbmV3IExpbnRlcihsaW50T3B0aW9ucywgcHJvZ3JhbSk7XG5cbiAgbGV0IGxhc3REaXJlY3Rvcnk7XG4gIGxldCBjb25maWdMb2FkO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBsZXQgY29udGVudHMgPSAnJztcbiAgICBpZiAocHJvZ3JhbSAmJiBhbGxQcm9ncmFtcykge1xuICAgICAgaWYgKCFwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSkpIHtcbiAgICAgICAgaWYgKCFhbGxQcm9ncmFtcy5zb21lKHAgPT4gcC5nZXRTb3VyY2VGaWxlKGZpbGUpICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgLy8gRmlsZSBpcyBub3QgcGFydCBvZiBhbnkgdHlwZXNjcmlwdCBwcm9ncmFtXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEZpbGUgJyR7ZmlsZX0nIGlzIG5vdCBwYXJ0IG9mIGEgVHlwZVNjcmlwdCBwcm9qZWN0ICcke29wdGlvbnMudHNDb25maWd9Jy5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBTb3VyY2UgZmlsZSBleGlzdHMgYnV0IGl0J3Mgbm90IGluIHRoZSBjdXJyZW50IHByb2dyYW0gc2tpcFxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGVudHMgPSBnZXRGaWxlQ29udGVudHMoZmlsZSk7XG4gICAgfVxuXG4gICAgLy8gT25seSBjaGVjayBmb3IgYSBuZXcgdHNsaW50IGNvbmZpZyBpZiB0aGUgcGF0aCBjaGFuZ2VzLlxuICAgIGNvbnN0IGN1cnJlbnREaXJlY3RvcnkgPSBwYXRoLmRpcm5hbWUoZmlsZSk7XG4gICAgaWYgKGN1cnJlbnREaXJlY3RvcnkgIT09IGxhc3REaXJlY3RvcnkpIHtcbiAgICAgIGNvbmZpZ0xvYWQgPSBDb25maWd1cmF0aW9uLmZpbmRDb25maWd1cmF0aW9uKHRzbGludENvbmZpZ1BhdGgsIGZpbGUpO1xuICAgICAgbGFzdERpcmVjdG9yeSA9IGN1cnJlbnREaXJlY3Rvcnk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZ0xvYWQpIHtcbiAgICAgIGxpbnRlci5saW50KGZpbGUsIGNvbnRlbnRzLCBjb25maWdMb2FkLnJlc3VsdHMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW50ZXIuZ2V0UmVzdWx0KCk7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzVG9MaW50KFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBsaW50ZXI6IHR5cGVvZiB0c2xpbnQuTGludGVyLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaWdub3JlID0gb3B0aW9ucy5leGNsdWRlO1xuXG4gIGlmIChvcHRpb25zLmZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gb3B0aW9ucy5maWxlc1xuICAgICAgLm1hcChmaWxlID0+IGdsb2Iuc3luYyhmaWxlLCB7IGN3ZDogcm9vdCwgaWdub3JlLCBub2RpcjogdHJ1ZSB9KSlcbiAgICAgIC5yZWR1Y2UoKHByZXYsIGN1cnIpID0+IHByZXYuY29uY2F0KGN1cnIpLCBbXSlcbiAgICAgIC5tYXAoZmlsZSA9PiBwYXRoLmpvaW4ocm9vdCwgZmlsZSkpO1xuICB9XG5cbiAgaWYgKCFwcm9ncmFtKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgbGV0IHByb2dyYW1GaWxlcyA9IGxpbnRlci5nZXRGaWxlTmFtZXMocHJvZ3JhbSk7XG5cbiAgaWYgKGlnbm9yZSAmJiBpZ25vcmUubGVuZ3RoID4gMCkge1xuICAgIC8vIG5vcm1hbGl6ZSB0byBzdXBwb3J0IC4vIHBhdGhzXG4gICAgY29uc3QgaWdub3JlTWF0Y2hlcnMgPSBpZ25vcmVcbiAgICAgIC5tYXAocGF0dGVybiA9PiBuZXcgTWluaW1hdGNoKHBhdGgubm9ybWFsaXplKHBhdHRlcm4pLCB7IGRvdDogdHJ1ZSB9KSk7XG5cbiAgICBwcm9ncmFtRmlsZXMgPSBwcm9ncmFtRmlsZXNcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiAhaWdub3JlTWF0Y2hlcnMuc29tZShtYXRjaGVyID0+IG1hdGNoZXIubWF0Y2gocGF0aC5yZWxhdGl2ZShyb290LCBmaWxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9ncmFtRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVDb250ZW50cyhmaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOT1RFOiBUaGUgdHNsaW50IENMSSBjaGVja3MgZm9yIGFuZCBleGNsdWRlcyBNUEVHIHRyYW5zcG9ydCBzdHJlYW1zOyB0aGlzIGRvZXMgbm90LlxuICB0cnkge1xuICAgIHJldHVybiBzdHJpcEJvbShyZWFkRmlsZVN5bmMoZmlsZSwgJ3V0Zi04JykpO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZWFkIGZpbGUgJyR7ZmlsZX0nLmApO1xuICB9XG59XG4iXX0=