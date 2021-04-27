"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSourceMaps = void 0;
function normalizeSourceMaps(sourceMap) {
    const scripts = typeof sourceMap === 'object' ? sourceMap.scripts : sourceMap;
    const styles = typeof sourceMap === 'object' ? sourceMap.styles : sourceMap;
    const hidden = typeof sourceMap === 'object' && sourceMap.hidden || false;
    const vendor = typeof sourceMap === 'object' && sourceMap.vendor || false;
    return {
        vendor,
        hidden,
        scripts,
        styles,
    };
}
exports.normalizeSourceMaps = normalizeSourceMaps;
