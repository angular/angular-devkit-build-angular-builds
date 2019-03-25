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
