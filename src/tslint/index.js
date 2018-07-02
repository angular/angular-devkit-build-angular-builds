"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    loadTslint() {
        return __awaiter(this, void 0, void 0, function* () {
            let tslint;
            try {
                tslint = yield Promise.resolve().then(() => require('tslint')); // tslint:disable-line:no-implicit-dependencies
            }
            catch (_a) {
                throw new Error('Unable to find TSLint.  Ensure TSLint is installed.');
            }
            const version = tslint.Linter.VERSION && tslint.Linter.VERSION.split('.');
            if (!version || version.length < 2 || Number(version[0]) < 5 || Number(version[1]) < 5) {
                throw new Error('TSLint must be version 5.5 or higher.');
            }
            return tslint;
        });
    }
    run(builderConfig) {
        const root = this.context.workspace.root;
        const systemRoot = core_1.getSystemPath(root);
        const options = builderConfig.options;
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
                        result.errorCount += partial.errorCount;
                        result.warningCount += partial.warningCount;
                        result.failures = result.failures.concat(partial.failures);
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
            // Print formatter output directly for non human-readable formats.
            if (['prose', 'verbose', 'stylish'].indexOf(options.format) == -1) {
                options.silent = true;
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
        const ignoreMatchers = ignore.map(pattern => new minimatch_1.Minimatch(pattern, { dot: true }));
        programFiles = programFiles
            .filter(file => !ignoreMatchers.some(matcher => matcher.match(file)));
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
    catch (e) {
        throw new Error(`Could not read file '${file}'.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3RzbGludC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7O0FBUUgsK0NBQXFEO0FBQ3JELDJCQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLDZCQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJDO0FBRzNDLHdFQUFvRTtBQWVwRTtJQUVFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUVqQyxVQUFVOztZQUN0QixJQUFJLE1BQU0sQ0FBQztZQUNYLElBQUksQ0FBQztnQkFDSCxNQUFNLEdBQUcsMkNBQWEsUUFBUSxFQUFDLENBQUMsQ0FBQywrQ0FBK0M7WUFDbEYsQ0FBQztZQUFDLEtBQUssQ0FBQyxDQUFDLElBQUQsQ0FBQztnQkFDUCxNQUFNLElBQUksS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7WUFDekUsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7WUFDM0QsQ0FBQztZQUVELE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEIsQ0FBQztLQUFB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LE9BQU8sQ0FBQyxRQUFRLElBQUksQ0FBQztZQUM5RixNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFFRCwrRkFBK0Y7UUFDL0Ysb0JBQW9CO0lBQ3RCLENBQUM7SUFFRCxzRkFBc0Y7SUFDdEYsSUFBSSxDQUFDO1FBQ0gsTUFBTSxDQUFDLG9CQUFRLENBQUMsaUJBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLElBQUksSUFBSSxDQUFDLENBQUM7SUFDcEQsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBnZXRTeXN0ZW1QYXRoIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCB7IE1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHNsaW50IGZyb20gJ3RzbGludCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IHN0cmlwQm9tIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0cmlwLWJvbSc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBUc2xpbnRCdWlsZGVyT3B0aW9ucyB7XG4gIHRzbGludENvbmZpZz86IHN0cmluZztcbiAgdHNDb25maWc/OiBzdHJpbmcgfCBzdHJpbmdbXTtcbiAgZml4OiBib29sZWFuO1xuICB0eXBlQ2hlY2s6IGJvb2xlYW47XG4gIGZvcmNlOiBib29sZWFuO1xuICBzaWxlbnQ6IGJvb2xlYW47XG4gIGZvcm1hdDogc3RyaW5nO1xuICBleGNsdWRlOiBzdHJpbmdbXTtcbiAgZmlsZXM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUc2xpbnRCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxUc2xpbnRCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkVHNsaW50KCkge1xuICAgIGxldCB0c2xpbnQ7XG4gICAgdHJ5IHtcbiAgICAgIHRzbGludCA9IGF3YWl0IGltcG9ydCgndHNsaW50Jyk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBmaW5kIFRTTGludC4gIEVuc3VyZSBUU0xpbnQgaXMgaW5zdGFsbGVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IHZlcnNpb24gPSB0c2xpbnQuTGludGVyLlZFUlNJT04gJiYgdHNsaW50LkxpbnRlci5WRVJTSU9OLnNwbGl0KCcuJyk7XG4gICAgaWYgKCF2ZXJzaW9uIHx8IHZlcnNpb24ubGVuZ3RoIDwgMiB8fCBOdW1iZXIodmVyc2lvblswXSkgPCA1IHx8IE51bWJlcih2ZXJzaW9uWzFdKSA8IDUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVFNMaW50IG11c3QgYmUgdmVyc2lvbiA1LjUgb3IgaGlnaGVyLicpO1xuICAgIH1cblxuICAgIHJldHVybiB0c2xpbnQ7XG4gIH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248VHNsaW50QnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG5cbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHN5c3RlbVJvb3QgPSBnZXRTeXN0ZW1QYXRoKHJvb3QpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG5cbiAgICBpZiAoIW9wdGlvbnMudHNDb25maWcgJiYgb3B0aW9ucy50eXBlQ2hlY2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQSBcInByb2plY3RcIiBtdXN0IGJlIHNwZWNpZmllZCB0byBlbmFibGUgdHlwZSBjaGVja2luZy4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnJvbSh0aGlzLmxvYWRUc2xpbnQoKSkucGlwZShjb25jYXRNYXAocHJvamVjdFRzbGludCA9PiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgY29uc3QgdHNsaW50Q29uZmlnUGF0aCA9IG9wdGlvbnMudHNsaW50Q29uZmlnXG4gICAgICAgID8gcGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIG9wdGlvbnMudHNsaW50Q29uZmlnKVxuICAgICAgICA6IG51bGw7XG4gICAgICBjb25zdCBMaW50ZXIgPSBwcm9qZWN0VHNsaW50LkxpbnRlcjtcblxuICAgICAgbGV0IHJlc3VsdDtcbiAgICAgIGlmIChvcHRpb25zLnRzQ29uZmlnKSB7XG4gICAgICAgIGNvbnN0IHRzQ29uZmlncyA9IEFycmF5LmlzQXJyYXkob3B0aW9ucy50c0NvbmZpZykgPyBvcHRpb25zLnRzQ29uZmlnIDogW29wdGlvbnMudHNDb25maWddO1xuXG4gICAgICAgIGZvciAoY29uc3QgdHNDb25maWcgb2YgdHNDb25maWdzKSB7XG4gICAgICAgICAgY29uc3QgcHJvZ3JhbSA9IExpbnRlci5jcmVhdGVQcm9ncmFtKHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCB0c0NvbmZpZykpO1xuICAgICAgICAgIGNvbnN0IHBhcnRpYWwgPSBsaW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMsIHByb2dyYW0pO1xuICAgICAgICAgIGlmIChyZXN1bHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBwYXJ0aWFsO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuZXJyb3JDb3VudCArPSBwYXJ0aWFsLmVycm9yQ291bnQ7XG4gICAgICAgICAgICByZXN1bHQud2FybmluZ0NvdW50ICs9IHBhcnRpYWwud2FybmluZ0NvdW50O1xuICAgICAgICAgICAgcmVzdWx0LmZhaWx1cmVzID0gcmVzdWx0LmZhaWx1cmVzLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcbiAgICAgICAgICAgIGlmIChwYXJ0aWFsLmZpeGVzKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5maXhlcyA9IHJlc3VsdC5maXhlcyA/IHJlc3VsdC5maXhlcy5jb25jYXQocGFydGlhbC5maXhlcykgOiBwYXJ0aWFsLmZpeGVzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gbGludChwcm9qZWN0VHNsaW50LCBzeXN0ZW1Sb290LCB0c2xpbnRDb25maWdQYXRoLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpbnQgY29uZmlndXJhdGlvbi4gTm90aGluZyB0byBsaW50LicpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgIGNvbnN0IEZvcm1hdHRlciA9IHByb2plY3RUc2xpbnQuZmluZEZvcm1hdHRlcihvcHRpb25zLmZvcm1hdCk7XG4gICAgICAgIGlmICghRm9ybWF0dGVyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxpbnQgZm9ybWF0IFwiJHtvcHRpb25zLmZvcm1hdH1cIi5gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmb3JtYXR0ZXIgPSBuZXcgRm9ybWF0dGVyKCk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gZm9ybWF0dGVyLmZvcm1hdChyZXN1bHQuZmFpbHVyZXMsIHJlc3VsdC5maXhlcyk7XG4gICAgICAgIGlmIChvdXRwdXQpIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8ob3V0cHV0KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBQcmludCBmb3JtYXR0ZXIgb3V0cHV0IGRpcmVjdGx5IGZvciBub24gaHVtYW4tcmVhZGFibGUgZm9ybWF0cy5cbiAgICAgIGlmIChbJ3Byb3NlJywgJ3ZlcmJvc2UnLCAnc3R5bGlzaCddLmluZGV4T2Yob3B0aW9ucy5mb3JtYXQpID09IC0xKSB7XG4gICAgICAgIG9wdGlvbnMuc2lsZW50ID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC53YXJuaW5nQ291bnQgPiAwICYmICFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oJ0xpbnQgd2FybmluZ3MgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC5lcnJvckNvdW50ID4gMCAmJiAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcignTGludCBlcnJvcnMgZm91bmQgaW4gdGhlIGxpc3RlZCBmaWxlcy4nKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC53YXJuaW5nQ291bnQgPT09IDAgJiYgcmVzdWx0LmVycm9yQ291bnQgPT09IDAgJiYgIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbygnQWxsIGZpbGVzIHBhc3MgbGludGluZy4nKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3VjY2VzcyA9IG9wdGlvbnMuZm9yY2UgfHwgcmVzdWx0LmVycm9yQ291bnQgPT09IDA7XG4gICAgICBvYnMubmV4dCh7IHN1Y2Nlc3MgfSk7XG5cbiAgICAgIHJldHVybiBvYnMuY29tcGxldGUoKTtcbiAgICB9KSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxpbnQoXG4gIHByb2plY3RUc2xpbnQ6IHR5cGVvZiB0c2xpbnQsXG4gIHN5c3RlbVJvb3Q6IHN0cmluZyxcbiAgdHNsaW50Q29uZmlnUGF0aDogc3RyaW5nIHwgbnVsbCxcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIHByb2dyYW0/OiB0cy5Qcm9ncmFtLFxuKSB7XG4gIGNvbnN0IExpbnRlciA9IHByb2plY3RUc2xpbnQuTGludGVyO1xuICBjb25zdCBDb25maWd1cmF0aW9uID0gcHJvamVjdFRzbGludC5Db25maWd1cmF0aW9uO1xuXG4gIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXNUb0xpbnQoc3lzdGVtUm9vdCwgb3B0aW9ucywgTGludGVyLCBwcm9ncmFtKTtcbiAgY29uc3QgbGludE9wdGlvbnMgPSB7XG4gICAgZml4OiBvcHRpb25zLmZpeCxcbiAgICBmb3JtYXR0ZXI6IG9wdGlvbnMuZm9ybWF0LFxuICB9O1xuXG4gIGNvbnN0IGxpbnRlciA9IG5ldyBMaW50ZXIobGludE9wdGlvbnMsIHByb2dyYW0pO1xuXG4gIGxldCBsYXN0RGlyZWN0b3J5O1xuICBsZXQgY29uZmlnTG9hZDtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgY29uc3QgY29udGVudHMgPSBnZXRGaWxlQ29udGVudHMoZmlsZSwgb3B0aW9ucywgcHJvZ3JhbSk7XG5cbiAgICAvLyBPbmx5IGNoZWNrIGZvciBhIG5ldyB0c2xpbnQgY29uZmlnIGlmIHRoZSBwYXRoIGNoYW5nZXMuXG4gICAgY29uc3QgY3VycmVudERpcmVjdG9yeSA9IHBhdGguZGlybmFtZShmaWxlKTtcbiAgICBpZiAoY3VycmVudERpcmVjdG9yeSAhPT0gbGFzdERpcmVjdG9yeSkge1xuICAgICAgY29uZmlnTG9hZCA9IENvbmZpZ3VyYXRpb24uZmluZENvbmZpZ3VyYXRpb24odHNsaW50Q29uZmlnUGF0aCwgZmlsZSk7XG4gICAgICBsYXN0RGlyZWN0b3J5ID0gY3VycmVudERpcmVjdG9yeTtcbiAgICB9XG5cbiAgICBpZiAoY29udGVudHMgJiYgY29uZmlnTG9hZCkge1xuICAgICAgbGludGVyLmxpbnQoZmlsZSwgY29udGVudHMsIGNvbmZpZ0xvYWQucmVzdWx0cyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxpbnRlci5nZXRSZXN1bHQoKTtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZXNUb0xpbnQoXG4gIHJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uczogVHNsaW50QnVpbGRlck9wdGlvbnMsXG4gIGxpbnRlcjogdHlwZW9mIHRzbGludC5MaW50ZXIsXG4gIHByb2dyYW0/OiB0cy5Qcm9ncmFtLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBpZ25vcmUgPSBvcHRpb25zLmV4Y2x1ZGU7XG5cbiAgaWYgKG9wdGlvbnMuZmlsZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBvcHRpb25zLmZpbGVzXG4gICAgICAubWFwKGZpbGUgPT4gZ2xvYi5zeW5jKGZpbGUsIHsgY3dkOiByb290LCBpZ25vcmUsIG5vZGlyOiB0cnVlIH0pKVxuICAgICAgLnJlZHVjZSgocHJldiwgY3VycikgPT4gcHJldi5jb25jYXQoY3VyciksIFtdKVxuICAgICAgLm1hcChmaWxlID0+IHBhdGguam9pbihyb290LCBmaWxlKSk7XG4gIH1cblxuICBpZiAoIXByb2dyYW0pIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBsZXQgcHJvZ3JhbUZpbGVzID0gbGludGVyLmdldEZpbGVOYW1lcyhwcm9ncmFtKTtcblxuICBpZiAoaWdub3JlICYmIGlnbm9yZS5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaWdub3JlTWF0Y2hlcnMgPSBpZ25vcmUubWFwKHBhdHRlcm4gPT4gbmV3IE1pbmltYXRjaChwYXR0ZXJuLCB7IGRvdDogdHJ1ZSB9KSk7XG5cbiAgICBwcm9ncmFtRmlsZXMgPSBwcm9ncmFtRmlsZXNcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiAhaWdub3JlTWF0Y2hlcnMuc29tZShtYXRjaGVyID0+IG1hdGNoZXIubWF0Y2goZmlsZSkpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9ncmFtRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVDb250ZW50cyhcbiAgZmlsZTogc3RyaW5nLFxuICBvcHRpb25zOiBUc2xpbnRCdWlsZGVyT3B0aW9ucyxcbiAgcHJvZ3JhbT86IHRzLlByb2dyYW0sXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBUaGUgbGludGVyIHJldHJpZXZlcyB0aGUgU291cmNlRmlsZSBUUyBub2RlIGRpcmVjdGx5IGlmIGEgcHJvZ3JhbSBpcyB1c2VkXG4gIGlmIChwcm9ncmFtKSB7XG4gICAgaWYgKHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKSA9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgRmlsZSAnJHtmaWxlfScgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvamVjdCAnJHtvcHRpb25zLnRzQ29uZmlnfScuYDtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIHJldHVybiBoYWQgdG8gYmUgY29tbWVudGVkIG91dCBvdGhlcndpc2Ugbm8gZmlsZSB3b3VsZCBiZSBsaW50ZWQsIGZpZ3VyZSBvdXQgd2h5LlxuICAgIC8vIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBOT1RFOiBUaGUgdHNsaW50IENMSSBjaGVja3MgZm9yIGFuZCBleGNsdWRlcyBNUEVHIHRyYW5zcG9ydCBzdHJlYW1zOyB0aGlzIGRvZXMgbm90LlxuICB0cnkge1xuICAgIHJldHVybiBzdHJpcEJvbShyZWFkRmlsZVN5bmMoZmlsZSwgJ3V0Zi04JykpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcmVhZCBmaWxlICcke2ZpbGV9Jy5gKTtcbiAgfVxufVxuIl19