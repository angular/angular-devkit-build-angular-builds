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
                throw new Error('Unable to find TSLint. Ensure TSLint is installed.');
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
    catch (_a) {
        throw new Error(`Could not read file '${file}'.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3RzbGludC9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7O0FBUUgsK0NBQXFEO0FBQ3JELDJCQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLDZCQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJDO0FBRzNDLHdFQUFvRTtBQWNwRTtJQUVFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUVqQyxVQUFVOztZQUN0QixJQUFJLE1BQU0sQ0FBQztZQUNYLElBQUksQ0FBQztnQkFDSCxNQUFNLEdBQUcsMkNBQWEsUUFBUSxFQUFDLENBQUMsQ0FBQywrQ0FBK0M7WUFDbEYsQ0FBQztZQUFDLEtBQUssQ0FBQyxDQUFDLElBQUQsQ0FBQztnQkFDUCxNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7WUFDeEUsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2RixNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7WUFDM0QsQ0FBQztZQUVELE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEIsQ0FBQztLQUFB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RXBCLDRFQUE0RTtJQUM1RSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzdDLE1BQU0sT0FBTyxHQUFHLFNBQVMsSUFBSSw0Q0FBNEMsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDO1lBQzlGLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUVELCtGQUErRjtRQUMvRixvQkFBb0I7SUFDdEIsQ0FBQztJQUVELHNGQUFzRjtJQUN0RixJQUFJLENBQUM7UUFDSCxNQUFNLENBQUMsb0JBQVEsQ0FBQyxpQkFBWSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFBQyxLQUFLLENBQUMsQ0FBQyxJQUFELENBQUM7UUFDUCxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixJQUFJLElBQUksQ0FBQyxDQUFDO0lBQ3BELENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZ2V0U3lzdGVtUGF0aCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBNaW5pbWF0Y2ggfSBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzbGludCBmcm9tICd0c2xpbnQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdHJpcC1ib20nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRzbGludEJ1aWxkZXJPcHRpb25zIHtcbiAgdHNsaW50Q29uZmlnPzogc3RyaW5nO1xuICB0c0NvbmZpZz86IHN0cmluZyB8IHN0cmluZ1tdO1xuICBmaXg6IGJvb2xlYW47XG4gIHR5cGVDaGVjazogYm9vbGVhbjtcbiAgZm9yY2U6IGJvb2xlYW47XG4gIHNpbGVudDogYm9vbGVhbjtcbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGV4Y2x1ZGU6IHN0cmluZ1tdO1xuICBmaWxlczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRzbGludEJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPFRzbGludEJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRUc2xpbnQoKSB7XG4gICAgbGV0IHRzbGludDtcbiAgICB0cnkge1xuICAgICAgdHNsaW50ID0gYXdhaXQgaW1wb3J0KCd0c2xpbnQnKTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgVFNMaW50LiBFbnN1cmUgVFNMaW50IGlzIGluc3RhbGxlZC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCB2ZXJzaW9uID0gdHNsaW50LkxpbnRlci5WRVJTSU9OICYmIHRzbGludC5MaW50ZXIuVkVSU0lPTi5zcGxpdCgnLicpO1xuICAgIGlmICghdmVyc2lvbiB8fCB2ZXJzaW9uLmxlbmd0aCA8IDIgfHwgTnVtYmVyKHZlcnNpb25bMF0pIDwgNSB8fCBOdW1iZXIodmVyc2lvblsxXSkgPCA1KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RTTGludCBtdXN0IGJlIHZlcnNpb24gNS41IG9yIGhpZ2hlci4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHNsaW50O1xuICB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPFRzbGludEJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuXG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBzeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChyb290KTtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuXG4gICAgaWYgKCFvcHRpb25zLnRzQ29uZmlnICYmIG9wdGlvbnMudHlwZUNoZWNrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgXCJwcm9qZWN0XCIgbXVzdCBiZSBzcGVjaWZpZWQgdG8gZW5hYmxlIHR5cGUgY2hlY2tpbmcuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZyb20odGhpcy5sb2FkVHNsaW50KCkpLnBpcGUoY29uY2F0TWFwKHByb2plY3RUc2xpbnQgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIGNvbnN0IHRzbGludENvbmZpZ1BhdGggPSBvcHRpb25zLnRzbGludENvbmZpZ1xuICAgICAgICA/IHBhdGgucmVzb2x2ZShzeXN0ZW1Sb290LCBvcHRpb25zLnRzbGludENvbmZpZylcbiAgICAgICAgOiBudWxsO1xuICAgICAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG5cbiAgICAgIGxldCByZXN1bHQ6IHVuZGVmaW5lZCB8IHRzbGludC5MaW50UmVzdWx0O1xuICAgICAgaWYgKG9wdGlvbnMudHNDb25maWcpIHtcbiAgICAgICAgY29uc3QgdHNDb25maWdzID0gQXJyYXkuaXNBcnJheShvcHRpb25zLnRzQ29uZmlnKSA/IG9wdGlvbnMudHNDb25maWcgOiBbb3B0aW9ucy50c0NvbmZpZ107XG5cbiAgICAgICAgZm9yIChjb25zdCB0c0NvbmZpZyBvZiB0c0NvbmZpZ3MpIHtcbiAgICAgICAgICBjb25zdCBwcm9ncmFtID0gTGludGVyLmNyZWF0ZVByb2dyYW0ocGF0aC5yZXNvbHZlKHN5c3RlbVJvb3QsIHRzQ29uZmlnKSk7XG4gICAgICAgICAgY29uc3QgcGFydGlhbCA9IGxpbnQocHJvamVjdFRzbGludCwgc3lzdGVtUm9vdCwgdHNsaW50Q29uZmlnUGF0aCwgb3B0aW9ucywgcHJvZ3JhbSk7XG4gICAgICAgICAgaWYgKHJlc3VsdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHBhcnRpYWw7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5mYWlsdXJlcyA9IHJlc3VsdC5mYWlsdXJlc1xuICAgICAgICAgICAgICAuZmlsdGVyKGN1cnIgPT4gIXBhcnRpYWwuZmFpbHVyZXMuc29tZShwcmV2ID0+IGN1cnIuZXF1YWxzKHByZXYpKSlcbiAgICAgICAgICAgICAgLmNvbmNhdChwYXJ0aWFsLmZhaWx1cmVzKTtcblxuICAgICAgICAgICAgLy8gd2UgYXJlIG5vdCBkb2luZyBtdWNoIHdpdGggJ2Vycm9yQ291bnQnIGFuZCAnd2FybmluZ0NvdW50J1xuICAgICAgICAgICAgLy8gYXBhcnQgZnJvbSBjaGVja2luZyBpZiB0aGV5IGFyZSBncmVhdGVyIHRoYW4gMCB0aHVzIG5vIG5lZWQgdG8gZGVkdXBlIHRoZXNlLlxuICAgICAgICAgICAgcmVzdWx0LmVycm9yQ291bnQgKz0gcGFydGlhbC5lcnJvckNvdW50O1xuICAgICAgICAgICAgcmVzdWx0Lndhcm5pbmdDb3VudCArPSBwYXJ0aWFsLndhcm5pbmdDb3VudDtcblxuICAgICAgICAgICAgaWYgKHBhcnRpYWwuZml4ZXMpIHtcbiAgICAgICAgICAgICAgcmVzdWx0LmZpeGVzID0gcmVzdWx0LmZpeGVzID8gcmVzdWx0LmZpeGVzLmNvbmNhdChwYXJ0aWFsLmZpeGVzKSA6IHBhcnRpYWwuZml4ZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBsaW50KHByb2plY3RUc2xpbnQsIHN5c3RlbVJvb3QsIHRzbGludENvbmZpZ1BhdGgsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGludCBjb25maWd1cmF0aW9uLiBOb3RoaW5nIHRvIGxpbnQuJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgY29uc3QgRm9ybWF0dGVyID0gcHJvamVjdFRzbGludC5maW5kRm9ybWF0dGVyKG9wdGlvbnMuZm9ybWF0KTtcbiAgICAgICAgaWYgKCFGb3JtYXR0ZXIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGludCBmb3JtYXQgXCIke29wdGlvbnMuZm9ybWF0fVwiLmApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBGb3JtYXR0ZXIoKTtcblxuICAgICAgICBjb25zdCBvdXRwdXQgPSBmb3JtYXR0ZXIuZm9ybWF0KHJlc3VsdC5mYWlsdXJlcywgcmVzdWx0LmZpeGVzKTtcbiAgICAgICAgaWYgKG91dHB1dCkge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhvdXRwdXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFByaW50IGZvcm1hdHRlciBvdXRwdXQgZGlyZWN0bHkgZm9yIG5vbiBodW1hbi1yZWFkYWJsZSBmb3JtYXRzLlxuICAgICAgaWYgKFsncHJvc2UnLCAndmVyYm9zZScsICdzdHlsaXNoJ10uaW5kZXhPZihvcHRpb25zLmZvcm1hdCkgPT0gLTEpIHtcbiAgICAgICAgb3B0aW9ucy5zaWxlbnQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0Lndhcm5pbmdDb3VudCA+IDAgJiYgIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybignTGludCB3YXJuaW5ncyBmb3VuZCBpbiB0aGUgbGlzdGVkIGZpbGVzLicpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0LmVycm9yQ291bnQgPiAwICYmICFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKCdMaW50IGVycm9ycyBmb3VuZCBpbiB0aGUgbGlzdGVkIGZpbGVzLicpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0Lndhcm5pbmdDb3VudCA9PT0gMCAmJiByZXN1bHQuZXJyb3JDb3VudCA9PT0gMCAmJiAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKCdBbGwgZmlsZXMgcGFzcyBsaW50aW5nLicpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzdWNjZXNzID0gb3B0aW9ucy5mb3JjZSB8fCByZXN1bHQuZXJyb3JDb3VudCA9PT0gMDtcbiAgICAgIG9icy5uZXh0KHsgc3VjY2VzcyB9KTtcblxuICAgICAgcmV0dXJuIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbGludChcbiAgcHJvamVjdFRzbGludDogdHlwZW9mIHRzbGludCxcbiAgc3lzdGVtUm9vdDogc3RyaW5nLFxuICB0c2xpbnRDb25maWdQYXRoOiBzdHJpbmcgfCBudWxsLFxuICBvcHRpb25zOiBUc2xpbnRCdWlsZGVyT3B0aW9ucyxcbiAgcHJvZ3JhbT86IHRzLlByb2dyYW0sXG4pIHtcbiAgY29uc3QgTGludGVyID0gcHJvamVjdFRzbGludC5MaW50ZXI7XG4gIGNvbnN0IENvbmZpZ3VyYXRpb24gPSBwcm9qZWN0VHNsaW50LkNvbmZpZ3VyYXRpb247XG5cbiAgY29uc3QgZmlsZXMgPSBnZXRGaWxlc1RvTGludChzeXN0ZW1Sb290LCBvcHRpb25zLCBMaW50ZXIsIHByb2dyYW0pO1xuICBjb25zdCBsaW50T3B0aW9ucyA9IHtcbiAgICBmaXg6IG9wdGlvbnMuZml4LFxuICAgIGZvcm1hdHRlcjogb3B0aW9ucy5mb3JtYXQsXG4gIH07XG5cbiAgY29uc3QgbGludGVyID0gbmV3IExpbnRlcihsaW50T3B0aW9ucywgcHJvZ3JhbSk7XG5cbiAgbGV0IGxhc3REaXJlY3Rvcnk7XG4gIGxldCBjb25maWdMb2FkO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBjb25zdCBjb250ZW50cyA9IGdldEZpbGVDb250ZW50cyhmaWxlLCBvcHRpb25zLCBwcm9ncmFtKTtcblxuICAgIC8vIE9ubHkgY2hlY2sgZm9yIGEgbmV3IHRzbGludCBjb25maWcgaWYgdGhlIHBhdGggY2hhbmdlcy5cbiAgICBjb25zdCBjdXJyZW50RGlyZWN0b3J5ID0gcGF0aC5kaXJuYW1lKGZpbGUpO1xuICAgIGlmIChjdXJyZW50RGlyZWN0b3J5ICE9PSBsYXN0RGlyZWN0b3J5KSB7XG4gICAgICBjb25maWdMb2FkID0gQ29uZmlndXJhdGlvbi5maW5kQ29uZmlndXJhdGlvbih0c2xpbnRDb25maWdQYXRoLCBmaWxlKTtcbiAgICAgIGxhc3REaXJlY3RvcnkgPSBjdXJyZW50RGlyZWN0b3J5O1xuICAgIH1cblxuICAgIGlmIChjb250ZW50cyAmJiBjb25maWdMb2FkKSB7XG4gICAgICBsaW50ZXIubGludChmaWxlLCBjb250ZW50cywgY29uZmlnTG9hZC5yZXN1bHRzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGludGVyLmdldFJlc3VsdCgpO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlc1RvTGludChcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBUc2xpbnRCdWlsZGVyT3B0aW9ucyxcbiAgbGludGVyOiB0eXBlb2YgdHNsaW50LkxpbnRlcixcbiAgcHJvZ3JhbT86IHRzLlByb2dyYW0sXG4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGlnbm9yZSA9IG9wdGlvbnMuZXhjbHVkZTtcblxuICBpZiAob3B0aW9ucy5maWxlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMuZmlsZXNcbiAgICAgIC5tYXAoZmlsZSA9PiBnbG9iLnN5bmMoZmlsZSwgeyBjd2Q6IHJvb3QsIGlnbm9yZSwgbm9kaXI6IHRydWUgfSkpXG4gICAgICAucmVkdWNlKChwcmV2LCBjdXJyKSA9PiBwcmV2LmNvbmNhdChjdXJyKSwgW10pXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKHJvb3QsIGZpbGUpKTtcbiAgfVxuXG4gIGlmICghcHJvZ3JhbSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGxldCBwcm9ncmFtRmlsZXMgPSBsaW50ZXIuZ2V0RmlsZU5hbWVzKHByb2dyYW0pO1xuXG4gIGlmIChpZ25vcmUgJiYgaWdub3JlLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBpZ25vcmVNYXRjaGVycyA9IGlnbm9yZS5tYXAocGF0dGVybiA9PiBuZXcgTWluaW1hdGNoKHBhdHRlcm4sIHsgZG90OiB0cnVlIH0pKTtcblxuICAgIHByb2dyYW1GaWxlcyA9IHByb2dyYW1GaWxlc1xuICAgICAgLmZpbHRlcihmaWxlID0+ICFpZ25vcmVNYXRjaGVycy5zb21lKG1hdGNoZXIgPT4gbWF0Y2hlci5tYXRjaChmaWxlKSkpO1xuICB9XG5cbiAgcmV0dXJuIHByb2dyYW1GaWxlcztcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZUNvbnRlbnRzKFxuICBmaWxlOiBzdHJpbmcsXG4gIG9wdGlvbnM6IFRzbGludEJ1aWxkZXJPcHRpb25zLFxuICBwcm9ncmFtPzogdHMuUHJvZ3JhbSxcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIC8vIFRoZSBsaW50ZXIgcmV0cmlldmVzIHRoZSBTb3VyY2VGaWxlIFRTIG5vZGUgZGlyZWN0bHkgaWYgYSBwcm9ncmFtIGlzIHVzZWRcbiAgaWYgKHByb2dyYW0pIHtcbiAgICBpZiAocHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpID09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGBGaWxlICcke2ZpbGV9JyBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9qZWN0ICcke29wdGlvbnMudHNDb25maWd9Jy5gO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHRoaXMgcmV0dXJuIGhhZCB0byBiZSBjb21tZW50ZWQgb3V0IG90aGVyd2lzZSBubyBmaWxlIHdvdWxkIGJlIGxpbnRlZCwgZmlndXJlIG91dCB3aHkuXG4gICAgLy8gcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8vIE5PVEU6IFRoZSB0c2xpbnQgQ0xJIGNoZWNrcyBmb3IgYW5kIGV4Y2x1ZGVzIE1QRUcgdHJhbnNwb3J0IHN0cmVhbXM7IHRoaXMgZG9lcyBub3QuXG4gIHRyeSB7XG4gICAgcmV0dXJuIHN0cmlwQm9tKHJlYWRGaWxlU3luYyhmaWxlLCAndXRmLTgnKSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlYWQgZmlsZSAnJHtmaWxlfScuYCk7XG4gIH1cbn1cbiJdfQ==