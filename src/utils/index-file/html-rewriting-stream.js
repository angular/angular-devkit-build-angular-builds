"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlRewritingStream = void 0;
const stream_1 = require("stream");
const load_esm_1 = require("../load-esm");
async function htmlRewritingStream(content) {
    const { RewritingStream } = await (0, load_esm_1.loadEsmModule)('parse5-html-rewriting-stream');
    const chunks = [];
    const rewriter = new RewritingStream();
    return {
        rewriter,
        transformedContent: () => {
            return new Promise((resolve) => {
                new stream_1.Readable({
                    encoding: 'utf8',
                    read() {
                        this.push(Buffer.from(content));
                        this.push(null);
                    },
                })
                    .pipe(rewriter)
                    .pipe(new stream_1.Writable({
                    write(chunk, encoding, callback) {
                        chunks.push(typeof chunk === 'string'
                            ? Buffer.from(chunk, encoding)
                            : chunk);
                        callback();
                    },
                    final(callback) {
                        callback();
                        resolve(Buffer.concat(chunks).toString());
                    },
                }));
            });
        },
    };
}
exports.htmlRewritingStream = htmlRewritingStream;
