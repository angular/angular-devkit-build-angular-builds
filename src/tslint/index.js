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
        // Print formatter output directly for non human-readable formats.
        if (!['prose', 'verbose', 'stylish'].includes(options.format)) {
            options.silent = true;
        }
        if (!options.silent) {
            this.context.logger.info(`Linting ${JSON.stringify(projectName)}...`);
        }
        if (!options.tsConfig && options.typeCheck) {
            throw new Error('A "project" must be specified to enable type checking.');
        }
        return rxjs_1.from(this.loadTslint()).pipe(operators_1.concatMap(projectTslint => new rxjs_1.Observable(obs => {
            const tslintConfigPath = options.tslintConfig
                ? path.resolve(systemRoot, options.tslintConfig)
                : null;
            const Linter = projectTslint.Linter;
            let result;
            if (options.tsConfig) {
                const tsConfigs = Array.isArray(options.tsConfig) ? options.tsConfig : [options.tsConfig];
                for (const tsConfig of tsConfigs) {
                    const program = Linter.createProgram(path.resolve(systemRoot, tsConfig));
                    const partial = lint(projectTslint, systemRoot, tslintConfigPath, options, program);
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
            if (result.warningCount > 0 && !options.silent) {
                this.context.logger.warn('Lint warnings found in the listed files.');
            }
            if (result.errorCount > 0 && !options.silent) {
                this.context.logger.error('Lint errors found in the listed files.');
            }
            if (result.warningCount === 0 && result.errorCount === 0 && !options.silent) {
                this.context.logger.info('All files pass linting.');
            }
            const success = options.force || result.errorCount === 0;
            obs.next({ success });
            return obs.complete();
        })));
    }
}
exports.default = TslintBuilder;
function lint(projectTslint, systemRoot, tslintConfigPath, options, program) {
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
        const contents = getFileContents(file, options, program);
        // Only check for a new tslint config if the path changes.
        const currentDirectory = path.dirname(file);
        if (currentDirectory !== lastDirectory) {
            configLoad = Configuration.findConfiguration(tslintConfigPath, file);
            lastDirectory = currentDirectory;
        }
        if (contents && configLoad) {
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
function getFileContents(file, options, program) {
    // The linter retrieves the SourceFile TS node directly if a program is used
    if (program) {
        if (program.getSourceFile(file) == undefined) {
            const message = `File '${file}' is not part of the TypeScript project '${options.tsConfig}'.`;
            throw new Error(message);
        }
        // TODO: this return had to be commented out otherwise no file would be linted, figure out why.
        // return undefined;
    }
    // NOTE: The tslint CLI checks for and excludes MPEG transport streams; this does not.
    try {
        return strip_bom_1.stripBom(fs_1.readFileSync(file, 'utf-8'));
    }
    catch (_a) {
        throw new Error(`Could not read file '${file}'.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3RzbGludC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQVFILCtDQUFxRDtBQUNyRCwyQkFBa0M7QUFDbEMsNkJBQTZCO0FBQzdCLHlDQUFzQztBQUN0Qyw2QkFBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUEyQztBQUczQyx3RUFBb0U7QUFjcEUsTUFBcUIsYUFBYTtJQUVoQyxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFdkMsS0FBSyxDQUFDLFVBQVU7UUFDdEIsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFJO1lBQ0YsTUFBTSxHQUFHLDJDQUFhLFFBQVEsRUFBQyxDQUFDLENBQUMsK0NBQStDO1NBQ2pGO1FBQUMsV0FBTTtZQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztTQUN2RTtRQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7U0FDMUQ7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBRUQsR0FBRyxDQUFDLGFBQXlEO1FBRTNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENB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QkFBUSxDQUFDLGlCQUFZLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDOUM7SUFBQyxXQUFNO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsQ0FBQztLQUNuRDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBnZXRTeXN0ZW1QYXRoIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCB7IE1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHNsaW50IGZyb20gJ3RzbGludCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IHN0cmlwQm9tIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0cmlwLWJvbSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHNsaW50QnVpbGRlck9wdGlvbnMge1xuICB0c2xpbnRDb25maWc/OiBzdHJpbmc7XG4gIHRzQ29uZmlnPzogc3RyaW5nIHwgc3RyaW5nW107XG4gIGZpeDogYm9vbGVhbjtcbiAgdHlwZUNoZWNrOiBib29sZWFuO1xuICBmb3JjZTogYm9vbGVhbjtcbiAgc2lsZW50OiBib29sZWFuO1xuICBmb3JtYXQ6IHN0cmluZztcbiAgZXhjbHVkZTogc3RyaW5nW107XG4gIGZpbGVzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHNsaW50QnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8VHNsaW50QnVpbGRlck9wdGlvbnM+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZFRzbGludCgpIHtcbiAgICBsZXQgdHNsaW50O1xuICAgIHRyeSB7XG4gICAgICB0c2xpbnQgPSBhd2FpdCBpbXBvcnQoJ3RzbGludCcpOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBUU0xpbnQuIEVuc3VyZSBUU0xpbnQgaXMgaW5zdGFsbGVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IHZlcnNpb24gPSB0c2xpbnQuTGludGVyLlZFUlNJT04gJiYgdHNsaW50LkxpbnRlci5WRVJTSU9OLnNwbGl0KCcuJyk7XG4gICAgaWYgKCF2ZXJzaW9uIHx8IHZlcnNpb24ubGVuZ3RoIDwgMiB8fCBOdW1iZXIodmVyc2lvblswXSkgPCA1IHx8IE51bWJlcih2ZXJzaW9uWzFdKSA8IDUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVFNMaW50IG11c3QgYmUgdmVyc2lvbiA1LjUgb3IgaGlnaGVyLicpO1xuICAgIH1cblxuICAgIHJldHVybiB0c2xpbnQ7XG4gIH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248VHNsaW50QnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG5cbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHN5c3RlbVJvb3QgPSBnZXRTeXN0ZW1QYXRoKHJvb3QpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3QgdGFyZ2V0U3BlY2lmaWVyID0gdGhpcy5jb250ZXh0LnRhcmdldFNwZWNpZmllcjtcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHRhcmdldFNwZWNpZmllciAmJiB0YXJnZXRTcGVjaWZpZXIucHJvamVjdCB8fCAnJztcblxuICAgIC8vIFByaW50IGZvcm1hdHRlciBvdXRwdXQgZGlyZWN0bHkgZm9yIG5vbiBodW1hbi1yZWFkYWJsZSBmb3JtYXRzLlxuICAgIGlmICghWydwcm9zZScsICd2ZXJib3NlJywgJ3N0eWxpc2gnXS5pbmNsdWRlcyhvcHRpb25zLmZvcm1hdCkpIHtcbiAgICAgIG9wdGlvbnMuc2lsZW50ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oYExpbnRpbmcgJHtKU09OLnN0cmluZ2lmeShwcm9qZWN0TmFtZSl9Li4uYCk7XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLnRzQ29uZmlnICYmIG9wdGlvbnMudHlwZUNoZWNrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgXCJwcm9qZWN0XCIgbXVzdCBiZSBzcGVjaWZpZWQgdG8gZW5hYmxlIHR5cGUgY2hlY2tpbmcuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZyb20odGhpcy5sb2FkVHNsaW50KCkpLnBpcGUoY29uY2F0TWFwKHByb2plY3RUc2xpbnQgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIGNvbnN0IHRzbGludENvbmZpZ1BhdGggPSBvcHRpb25zLnRzbGludENvbmZpZ1xuICAgICAgICA/IHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCBvcHRpb25zLnRzbGludENvbmZpZylcbiAgICAgICAgOiBudWxsO1xuICAgICAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG5cbiAgICAgIGxldCByZXN1bHQ6IHVuZGVmaW5lZCB8IHRzbGludC5MaW50UmVzdWx0O1xuICAgICAgaWYgKG9wdGlvbnMudHNDb25maWcpIHtcbiAgICAgICAgY29uc3QgdHNDb25maWdzID0gQXJyYXkuaXNBcnJheShvcHRpb25zLnRzQ29uZmlnKSA/IG9wdGlvbnMudHNDb25maWcgOiBbb3B0aW9ucy50c0NvbmZpZ107XG5cbiAgICAgICAgZm9yIChjb25zdCB0c0NvbmZpZyBvZiB0c0NvbmZpZ3MpIHtcbiAgICAgICAgICBjb25zdCBwcm9ncmFtID0gTGludGVyLmNyZWF0ZVByb2dyYW0ocGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIHRzQ29uZmlnKSk7XG4gICAgICAgICAgY29uc3QgcGFydGlhbCA9IGxpbnQocHJvamVjdFRzbGludCwgc3lzdGVtUm9vdCwgdHNsaW50Q29uZmlnUGF0aCwgb3B0aW9ucywgcHJvZ3JhbSk7XG4gICAgICAgICAgaWYgKHJlc3VsdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHBhcnRpYWw7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5mYWlsdXJlcyA9IHJlc3VsdC5mYWlsdXJlc1xuICAgICAgICAgICAgICAuZmlsdGVyKGN1cnIgPT4gIXBhcnRpYWwuZmFpbHVyZXMuc29tZShwcmV2ID0+IGN1cnIuZXF1YWxzKHByZXYpKSlcbiAgICAgICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAgICAgLy8gd2UgYXJlIG5vdCBkb2luZyBtdWNoIHdpdGggJ2Vycm9yQ291bnQnIGFuZCAnd2FybmluZ0NvdW50J1xuICAgICAgICAgICAgLy8gYXBhcnQgZnJvbSBjaGVja2luZyBpZiB0aGV5IGFyZSBncmVhdGVyIHRoYW4gMCB0aHVzIG5vIG5lZWQgdG8gZGVkdXBlIHRoZXNlLlxuICAgICAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICAgICAgcmVzdWx0Lndhcm5pbmdDb3VudCArPSBwYXJ0aWFsLndhcm5pbmdDb3VudDtcblxuICAgICAgICAgICAgaWYgKHBhcnRpYWwuZml4ZXMpIHtcbiAgICAgICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBsaW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGludCBjb25maWd1cmF0aW9uLiBOb3RoaW5nIHRvIGxpbnQuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgY29uc3QgRm9ybWF0dGVyID0gcHJvamVjdFRzbGludC5maW5kRm9ybWF0dGVyKG9wdGlvbnMuZm9ybWF0KTtcbiAgICAgICAgaWYgKCFGb3JtYXR0ZXIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGludCBmb3JtYXQgXCIke29wdGlvbnMuZm9ybWF0fVwiLmApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBGb3JtYXR0ZXIoKTtcblxuICAgICAgICBjb25zdCBvdXRwdXQgPSBmb3JtYXR0ZXIuZm9ybWF0KHJlc3VsdC5mYWlsdXJlcywgcmVzdWx0LmZpeGVzKTtcbiAgICAgICAgaWYgKG91dHB1dCkge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhvdXRwdXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID4gMCAmJiAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKCdMaW50IHdhcm5pbmdzIGZvdW5kIGluIHRoZSBsaXN0ZWQgZmlsZXMuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN1bHQuZXJyb3JDb3VudCA+IDAgJiYgIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IoJ0xpbnQgZXJyb3JzIGZvdW5kIGluIHRoZSBsaXN0ZWQgZmlsZXMuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN1bHQud2FybmluZ0NvdW50ID09PSAwICYmIHJlc3VsdC5lcnJvckNvdW50ID09PSAwICYmICFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oJ0FsbCBmaWxlcyBwYXNzIGxpbnRpbmcuJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBvcHRpb25zLmZvcmNlIHx8IHJlc3VsdC5lcnJvckNvdW50ID09PSAwO1xuICAgICAgb2JzLm5leHQoeyBzdWNjZXNzIH0pO1xuXG4gICAgICByZXR1cm4gb2JzLmNvbXBsZXRlKCk7XG4gICAgfSkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsaW50KFxuICBwcm9qZWN0VHNsaW50OiB0eXBlb2YgdHNsaW50LFxuICBzeXN0ZW1Sb290OiBzdHJpbmcsXG4gIHRzbGludENvbmZpZ1BhdGg6IHN0cmluZyB8IG51bGwsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbikge1xuICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcbiAgY29uc3QgQ29uZmlndXJhdGlvbiA9IHByb2plY3RUc2xpbnQuQ29uZmlndXJhdGlvbjtcblxuICBjb25zdCBmaWxlcyA9IGdldEZpbGVzVG9MaW50KHN5c3RlbVJvb3QsIG9wdGlvbnMsIExpbnRlciwgcHJvZ3JhbSk7XG4gIGNvbnN0IGxpbnRPcHRpb25zID0ge1xuICAgIGZpeDogb3B0aW9ucy5maXgsXG4gICAgZm9ybWF0dGVyOiBvcHRpb25zLmZvcm1hdCxcbiAgfTtcblxuICBjb25zdCBsaW50ZXIgPSBuZXcgTGludGVyKGxpbnRPcHRpb25zLCBwcm9ncmFtKTtcblxuICBsZXQgbGFzdERpcmVjdG9yeTtcbiAgbGV0IGNvbmZpZ0xvYWQ7XG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgIGNvbnN0IGNvbnRlbnRzID0gZ2V0RmlsZUNvbnRlbnRzKGZpbGUsIG9wdGlvbnMsIHByb2dyYW0pO1xuXG4gICAgLy8gT25seSBjaGVjayBmb3IgYSBuZXcgdHNsaW50IGNvbmZpZyBpZiB0aGUgcGF0aCBjaGFuZ2VzLlxuICAgIGNvbnN0IGN1cnJlbnREaXJlY3RvcnkgPSBwYXRoLmRpcm5hbWUoZmlsZSk7XG4gICAgaWYgKGN1cnJlbnREaXJlY3RvcnkgIT09IGxhc3REaXJlY3RvcnkpIHtcbiAgICAgIGNvbmZpZ0xvYWQgPSBDb25maWd1cmF0aW9uLmZpbmRDb25maWd1cmF0aW9uKHRzbGludENvbmZpZ1BhdGgsIGZpbGUpO1xuICAgICAgbGFzdERpcmVjdG9yeSA9IGN1cnJlbnREaXJlY3Rvcnk7XG4gICAgfVxuXG4gICAgaWYgKGNvbnRlbnRzICYmIGNvbmZpZ0xvYWQpIHtcbiAgICAgIGxpbnRlci5saW50KGZpbGUsIGNvbnRlbnRzLCBjb25maWdMb2FkLnJlc3VsdHMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW50ZXIuZ2V0UmVzdWx0KCk7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzVG9MaW50KFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBsaW50ZXI6IHR5cGVvZiB0c2xpbnQuTGludGVyLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaWdub3JlID0gb3B0aW9ucy5leGNsdWRlO1xuXG4gIGlmIChvcHRpb25zLmZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gb3B0aW9ucy5maWxlc1xuICAgICAgLm1hcChmaWxlID0+IGdsb2Iuc3luYyhmaWxlLCB7IGN3ZDogcm9vdCwgaWdub3JlLCBub2RpcjogdHJ1ZSB9KSlcbiAgICAgIC5yZWR1Y2UoKHByZXYsIGN1cnIpID0+IHByZXYuY29uY2F0KGN1cnIpLCBbXSlcbiAgICAgIC5tYXAoZmlsZSA9PiBwYXRoLmpvaW4ocm9vdCwgZmlsZSkpO1xuICB9XG5cbiAgaWYgKCFwcm9ncmFtKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgbGV0IHByb2dyYW1GaWxlcyA9IGxpbnRlci5nZXRGaWxlTmFtZXMocHJvZ3JhbSk7XG5cbiAgaWYgKGlnbm9yZSAmJiBpZ25vcmUubGVuZ3RoID4gMCkge1xuICAgIC8vIG5vcm1hbGl6ZSB0byBzdXBwb3J0IC4vIHBhdGhzXG4gICAgY29uc3QgaWdub3JlTWF0Y2hlcnMgPSBpZ25vcmVcbiAgICAgIC5tYXAocGF0dGVybiA9PiBuZXcgTWluaW1hdGNoKHBhdGgubm9ybWFsaXplKHBhdHRlcm4pLCB7IGRvdDogdHJ1ZSB9KSk7XG5cbiAgICBwcm9ncmFtRmlsZXMgPSBwcm9ncmFtRmlsZXNcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiAhaWdub3JlTWF0Y2hlcnMuc29tZShtYXRjaGVyID0+IG1hdGNoZXIubWF0Y2gocGF0aC5yZWxhdGl2ZShyb290LCBmaWxlKSkpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9ncmFtRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVDb250ZW50cyhcbiAgZmlsZTogc3RyaW5nLFxuICBvcHRpb25zOiBUc2xpbnRCdWlsZGVyT3B0aW9ucyxcbiAgcHJvZ3JhbT86IHRzLlByb2dyYW0sXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBUaGUgbGludGVyIHJldHJpZXZlcyB0aGUgU291cmNlRmlsZSBUUyBub2RlIGRpcmVjdGx5IGlmIGEgcHJvZ3JhbSBpcyB1c2VkXG4gIGlmIChwcm9ncmFtKSB7XG4gICAgaWYgKHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKSA9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgRmlsZSAnJHtmaWxlfScgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvamVjdCAnJHtvcHRpb25zLnRzQ29uZmlnfScuYDtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIHJldHVybiBoYWQgdG8gYmUgY29tbWVudGVkIG91dCBvdGhlcndpc2Ugbm8gZmlsZSB3b3VsZCBiZSBsaW50ZWQsIGZpZ3VyZSBvdXQgd2h5LlxuICAgIC8vIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBOT1RFOiBUaGUgdHNsaW50IENMSSBjaGVja3MgZm9yIGFuZCBleGNsdWRlcyBNUEVHIHRyYW5zcG9ydCBzdHJlYW1zOyB0aGlzIGRvZXMgbm90LlxuICB0cnkge1xuICAgIHJldHVybiBzdHJpcEJvbShyZWFkRmlsZVN5bmMoZmlsZSwgJ3V0Zi04JykpO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZWFkIGZpbGUgJyR7ZmlsZX0nLmApO1xuICB9XG59XG4iXX0=