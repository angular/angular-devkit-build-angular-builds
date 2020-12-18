"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectFile = exports.describeBuilder = void 0;
const fs_1 = require("fs");
const test_utils_1 = require("../test-utils");
const builder_harness_1 = require("./builder-harness");
const optionSchemaCache = new Map();
function describeBuilder(builderHandler, options, specDefinitions) {
    let optionSchema = optionSchemaCache.get(options.schemaPath);
    if (optionSchema === undefined) {
        optionSchema = JSON.parse(fs_1.readFileSync(options.schemaPath, 'utf8'));
        optionSchemaCache.set(options.schemaPath, optionSchema);
    }
    const harness = new JasmineBuilderHarness(builderHandler, test_utils_1.host, {
        builderName: options.name,
        optionSchema,
    });
    describe(options.name || builderHandler.name, () => {
        beforeEach(() => test_utils_1.host.initialize().toPromise());
        afterEach(() => test_utils_1.host.restore().toPromise());
        specDefinitions(harness);
    });
}
exports.describeBuilder = describeBuilder;
class JasmineBuilderHarness extends builder_harness_1.BuilderHarness {
    expectFile(path) {
        return expectFile(path, this);
    }
}
function expectFile(path, harness) {
    return {
        toExist: () => expect(harness.hasFile(path)).toBe(true, 'Expected file to exist: ' + path),
        toNotExist: () => expect(harness.hasFile(path)).toBe(false, 'Expected file to not exist: ' + path),
        get content() {
            return expect(harness.readFile(path)).withContext(`With file content for '${path}'`);
        },
        get size() {
            return expect(Buffer.byteLength(harness.readFile(path))).withContext(`With file size for '${path}'`);
        },
    };
}
exports.expectFile = expectFile;
