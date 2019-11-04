"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const fs = require("fs");
async function createTranslationLoader() {
    const parsers = await importParsers();
    return (path) => {
        const content = fs.readFileSync(path, 'utf8');
        for (const [format, parser] of Object.entries(parsers)) {
            if (parser.canParse(path, content)) {
                return { format, translation: parser.parse(path, content).translations };
            }
        }
        throw new Error('Unsupported translation file format.');
    };
}
exports.createTranslationLoader = createTranslationLoader;
async function importParsers() {
    try {
        return {
            json: new (await Promise.resolve().then(() => require(
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/simple_json/simple_json_translation_parser'))).SimpleJsonTranslationParser(),
            xlf: new (await Promise.resolve().then(() => require(
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/xliff1/xliff1_translation_parser'))).Xliff1TranslationParser(),
            xlf2: new (await Promise.resolve().then(() => require(
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/xliff2/xliff2_translation_parser'))).Xliff2TranslationParser(),
        };
    }
    catch (_a) {
        return {
            json: new (await Promise.resolve().then(() => require(
            // @ts-ignore
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/simple_json_translation_parser'))).SimpleJsonTranslationParser(),
            xlf: new (await Promise.resolve().then(() => require(
            // @ts-ignore
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/xliff1_translation_parser'))).Xliff1TranslationParser(),
            xlf2: new (await Promise.resolve().then(() => require(
            // @ts-ignore
            // tslint:disable-next-line:trailing-comma
            '@angular/localize/src/tools/src/translate/translation_files/translation_parsers/xliff2_translation_parser'))).Xliff2TranslationParser(),
        };
    }
}
