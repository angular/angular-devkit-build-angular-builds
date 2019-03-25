"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// TODO: cleanup this file, it's copied as is from Angular CLI.
const core_1 = require("@angular-devkit/core");
const crypto = require("crypto");
const fs = require("fs");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const semver = require("semver");
const require_project_module_1 = require("../require-project-module");
exports.NEW_SW_VERSION = '5.0.0-rc.0';
class CliFilesystem {
    constructor(_host, base) {
        this._host = _host;
        this.base = base;
    }
    list(path) {
        const recursiveList = (path) => this._host.list(path).pipe(
        // Emit each fragment individually.
        operators_1.concatMap(fragments => rxjs_1.from(fragments)), 
        // Join the path with fragment.
        operators_1.map(fragment => core_1.join(path, fragment)), 
        // Emit directory content paths instead of the directory path.
        operators_1.mergeMap(path => this._host.isDirectory(path).pipe(operators_1.concatMap(isDir => isDir ? recursiveList(path) : rxjs_1.of(path)))));
        return recursiveList(this._resolve(path)).pipe(operators_1.map(path => path.replace(this.base, '')), operators_1.toArray()).toPromise().then(x => x, _err => []);
    }
    read(path) {
        return this._readIntoBuffer(path)
            .then(content => core_1.virtualFs.fileBufferToString(content));
    }
    hash(path) {
        const sha1 = crypto.createHash('sha1');
        return this._readIntoBuffer(path)
            .then(content => sha1.update(Buffer.from(content)))
            .then(() => sha1.digest('hex'));
    }
    write(path, content) {
        return this._host.write(this._resolve(path), core_1.virtualFs.stringToFileBuffer(content))
            .toPromise();
    }
    _readIntoBuffer(path) {
        return this._host.read(this._resolve(path))
            .toPromise();
    }
    _resolve(path) {
        return core_1.join(core_1.normalize(this.base), path);
    }
}
function usesServiceWorker(projectRoot) {
    let swPackageJsonPath;
    try {
        swPackageJsonPath = require_project_module_1.resolveProjectModule(projectRoot, '@angular/service-worker/package.json');
    }
    catch (_) {
        // @angular/service-worker is not installed
        throw new Error(core_1.tags.stripIndent `
    Your project is configured with serviceWorker = true, but @angular/service-worker
    is not installed. Run \`npm install --save-dev @angular/service-worker\`
    and try again, or run \`ng set apps.0.serviceWorker=false\` in your .angular-cli.json.
  `);
    }
    const swPackageJson = fs.readFileSync(swPackageJsonPath).toString();
    const swVersion = JSON.parse(swPackageJson)['version'];
    if (!semver.gte(swVersion, exports.NEW_SW_VERSION)) {
        throw new Error(core_1.tags.stripIndent `
    The installed version of @angular/service-worker is ${swVersion}. This version of the CLI
    requires the @angular/service-worker version to satisfy ${exports.NEW_SW_VERSION}. Please upgrade
    your service worker version.
  `);
    }
    return true;
}
exports.usesServiceWorker = usesServiceWorker;
function augmentAppWithServiceWorker(host, projectRoot, appRoot, outputPath, baseHref, ngswConfigPath) {
    // Path to the worker script itself.
    const distPath = core_1.normalize(outputPath);
    const workerPath = core_1.normalize(require_project_module_1.resolveProjectModule(core_1.getSystemPath(projectRoot), '@angular/service-worker/ngsw-worker.js'));
    const swConfigPath = require_project_module_1.resolveProjectModule(core_1.getSystemPath(projectRoot), '@angular/service-worker/config');
    const safetyPath = core_1.join(core_1.dirname(workerPath), 'safety-worker.js');
    const configPath = ngswConfigPath || core_1.join(appRoot, 'ngsw-config.json');
    return host.exists(configPath).pipe(operators_1.switchMap(exists => {
        if (!exists) {
            throw new Error(core_1.tags.oneLine `
          Error: Expected to find an ngsw-config.json configuration
          file in the ${appRoot} folder. Either provide one or disable Service Worker
          in your angular.json configuration file.`);
        }
        return host.read(configPath);
    }), operators_1.map(content => JSON.parse(core_1.virtualFs.fileBufferToString(content))), operators_1.switchMap(configJson => {
        const GeneratorConstructor = require(swConfigPath).Generator;
        const gen = new GeneratorConstructor(new CliFilesystem(host, outputPath), baseHref);
        return gen.process(configJson);
    }), operators_1.switchMap(output => {
        const manifest = JSON.stringify(output, null, 2);
        return host.read(workerPath).pipe(operators_1.switchMap(workerCode => {
            return rxjs_1.merge(host.write(core_1.join(distPath, 'ngsw.json'), core_1.virtualFs.stringToFileBuffer(manifest)), host.write(core_1.join(distPath, 'ngsw-worker.js'), workerCode));
        }));
    }), operators_1.switchMap(() => host.exists(safetyPath)), 
    // If @angular/service-worker has the safety script, copy it into two locations.
    operators_1.switchMap(exists => {
        if (!exists) {
            return rxjs_1.of(undefined);
        }
        return host.read(safetyPath).pipe(operators_1.switchMap(safetyCode => {
            return rxjs_1.merge(host.write(core_1.join(distPath, 'worker-basic.min.js'), safetyCode), host.write(core_1.join(distPath, 'safety-worker.js'), safetyCode));
        }));
    }), 
    // Remove all elements, reduce them to a single emit.
    operators_1.reduce(() => { })).toPromise();
}
exports.augmentAppWithServiceWorker = augmentAppWithServiceWorker;
