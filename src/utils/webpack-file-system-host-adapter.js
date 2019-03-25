"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
class WebpackFileSystemHostAdapter {
    constructor(_host) {
        this._host = _host;
        this._syncHost = null;
    }
    _doHostCall(o, callback) {
        const token = Symbol();
        let value = token;
        let error = false;
        try {
            o.subscribe({
                error(err) {
                    error = true;
                    callback(err);
                },
                next(v) {
                    value = v;
                },
                complete() {
                    if (value !== token) {
                        callback(null, value);
                    }
                    else {
                        callback(new Error('Unknown error happened.'));
                    }
                },
            });
        }
        catch (err) {
            // In some occasions, the error handler above will be called, then an exception will be
            // thrown (by design in observable constructors in RxJS 5). Don't call the callback
            // twice.
            if (!error) {
                callback(err);
            }
        }
    }
    stat(path, callback) {
        const p = core_1.normalize('/' + path);
        const result = this._host.stat(p);
        if (result === null) {
            const o = this._host.exists(p).pipe(operators_1.switchMap(exists => {
                if (!exists) {
                    throw new core_1.FileDoesNotExistException(p);
                }
                return this._host.isDirectory(p).pipe(operators_1.mergeMap(isDirectory => {
                    return (isDirectory ? rxjs_1.of(0) : this._host.read(p).pipe(operators_1.map(content => content.byteLength))).pipe(operators_1.map(size => [isDirectory, size]));
                }));
            }), operators_1.map(([isDirectory, size]) => {
                return {
                    isFile() { return !isDirectory; },
                    isDirectory() { return isDirectory; },
                    size,
                    atime: new Date(),
                    mtime: new Date(),
                    ctime: new Date(),
                    birthtime: new Date(),
                };
            }));
            this._doHostCall(o, callback);
        }
        else {
            this._doHostCall(result, callback);
        }
    }
    readdir(path, callback) {
        return this._doHostCall(this._host.list(core_1.normalize('/' + path)), callback);
    }
    readFile(path, callback) {
        const o = this._host.read(core_1.normalize('/' + path)).pipe(operators_1.map(content => Buffer.from(content)));
        return this._doHostCall(o, callback);
    }
    readJson(path, callback) {
        const o = this._host.read(core_1.normalize('/' + path)).pipe(operators_1.map(content => JSON.parse(core_1.virtualFs.fileBufferToString(content))));
        return this._doHostCall(o, callback);
    }
    readlink(path, callback) {
        const err = new Error('Not a symlink.');
        err.code = 'EINVAL';
        callback(err);
    }
    statSync(path) {
        if (!this._syncHost) {
            this._syncHost = new core_1.virtualFs.SyncDelegateHost(this._host);
        }
        const result = this._syncHost.stat(core_1.normalize('/' + path));
        if (result) {
            return result;
        }
        else {
            return {};
        }
    }
    readdirSync(path) {
        if (!this._syncHost) {
            this._syncHost = new core_1.virtualFs.SyncDelegateHost(this._host);
        }
        return this._syncHost.list(core_1.normalize('/' + path));
    }
    readFileSync(path) {
        if (!this._syncHost) {
            this._syncHost = new core_1.virtualFs.SyncDelegateHost(this._host);
        }
        return Buffer.from(this._syncHost.read(core_1.normalize('/' + path)));
    }
    readJsonSync(path) {
        if (!this._syncHost) {
            this._syncHost = new core_1.virtualFs.SyncDelegateHost(this._host);
        }
        const data = this._syncHost.read(core_1.normalize('/' + path));
        return JSON.parse(core_1.virtualFs.fileBufferToString(data));
    }
    readlinkSync(path) {
        const err = new Error('Not a symlink.');
        err.code = 'EINVAL';
        throw err;
    }
    purge(_changes) { }
}
exports.WebpackFileSystemHostAdapter = WebpackFileSystemHostAdapter;
