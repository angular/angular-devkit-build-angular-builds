"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
function emittedFilesToInlineOptions(emittedFiles, scriptsEntryPointName, emittedPath, outputPath, es5, missingTranslation) {
    const options = [];
    const originalFiles = [];
    for (const emittedFile of emittedFiles) {
        if (emittedFile.asset ||
            emittedFile.extension !== '.js' ||
            (emittedFile.name && scriptsEntryPointName.includes(emittedFile.name))) {
            continue;
        }
        const originalPath = path.join(emittedPath, emittedFile.file);
        const action = {
            filename: emittedFile.file,
            code: fs.readFileSync(originalPath, 'utf8'),
            es5,
            outputPath,
            missingTranslation,
            setLocale: emittedFile.name === 'main',
        };
        originalFiles.push(originalPath);
        try {
            const originalMapPath = originalPath + '.map';
            action.map = fs.readFileSync(originalMapPath, 'utf8');
            originalFiles.push(originalMapPath);
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
        options.push(action);
    }
    return { options, originalFiles };
}
exports.emittedFilesToInlineOptions = emittedFilesToInlineOptions;
