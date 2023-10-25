"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const mrmime_1 = require("mrmime");
const promises_1 = require("node:fs/promises");
const node_http_1 = require("node:http");
const node_path_1 = require("node:path");
/**
 * Start a server that can handle HTTP requests to assets.
 *
 * @example
 * ```ts
 * httpClient.get('/assets/content.json');
 * ```
 * @returns the server address.
 */
async function startServer(assets) {
    if (Object.keys(assets).length === 0) {
        return {
            address: '',
        };
    }
    const assetsReversed = {};
    for (const { source, destination } of assets) {
        assetsReversed[addLeadingSlash(destination.replace(/\\/g, node_path_1.posix.sep))] = source;
    }
    const assetsCache = new Map();
    const server = (0, node_http_1.createServer)(requestHandler(assetsReversed, assetsCache));
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    const serverAddress = server.address();
    let address;
    if (!serverAddress) {
        address = '';
    }
    else if (typeof serverAddress === 'string') {
        address = serverAddress;
    }
    else {
        const { port, address: host } = serverAddress;
        address = `http://${host}:${port}`;
    }
    return {
        address,
        close: () => {
            assetsCache.clear();
            server.unref();
            server.close();
        },
    };
}
exports.startServer = startServer;
function requestHandler(assetsReversed, assetsCache) {
    return (req, res) => {
        if (!req.url) {
            res.destroy(new Error('Request url was empty.'));
            return;
        }
        const { pathname } = new URL(req.url, 'resolve://');
        const asset = assetsReversed[pathname];
        if (!asset) {
            res.statusCode = 404;
            res.statusMessage = 'Asset not found.';
            res.end();
            return;
        }
        const cachedAsset = assetsCache.get(pathname);
        if (cachedAsset) {
            const { content, mimeType } = cachedAsset;
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
            res.end(content);
            return;
        }
        (0, promises_1.readFile)(asset)
            .then((content) => {
            const extension = (0, node_path_1.extname)(pathname);
            const mimeType = (0, mrmime_1.lookup)(extension);
            assetsCache.set(pathname, {
                mimeType,
                content,
            });
            if (mimeType) {
                res.setHeader('Content-Type', mimeType);
            }
            res.end(content);
        })
            .catch((e) => res.destroy(e));
    };
}
function addLeadingSlash(value) {
    return value.charAt(0) === '/' ? value : '/' + value;
}
