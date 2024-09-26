"use strict";
// THIS FILE IS AUTOMATICALLY GENERATED. TO UPDATE THIS FILE YOU NEED TO CHANGE THE
// CORRESPONDING JSON SCHEMA FILE, THEN RUN devkit-admin build (or bazel build ...).
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineStyleLanguage = exports.BuilderMode = void 0;
/**
 * Determines how to build the code under test. If set to 'detect', attempts to follow the
 * development builder.
 */
var BuilderMode;
(function (BuilderMode) {
    BuilderMode["Application"] = "application";
    BuilderMode["Browser"] = "browser";
    BuilderMode["Detect"] = "detect";
})(BuilderMode || (exports.BuilderMode = BuilderMode = {}));
/**
 * The stylesheet language to use for the application's inline component styles.
 */
var InlineStyleLanguage;
(function (InlineStyleLanguage) {
    InlineStyleLanguage["Css"] = "css";
    InlineStyleLanguage["Less"] = "less";
    InlineStyleLanguage["Sass"] = "sass";
    InlineStyleLanguage["Scss"] = "scss";
})(InlineStyleLanguage || (exports.InlineStyleLanguage = InlineStyleLanguage = {}));
