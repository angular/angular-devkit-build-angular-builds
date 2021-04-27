"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOptimization = void 0;
function normalizeOptimization(optimization = true) {
    if (typeof optimization === 'object') {
        return {
            scripts: !!optimization.scripts,
            styles: typeof optimization.styles === 'object' ? optimization.styles : {
                minify: !!optimization.styles,
                inlineCritical: !!optimization.styles,
            },
            fonts: typeof optimization.fonts === 'object' ? optimization.fonts : {
                inline: !!optimization.fonts,
            },
        };
    }
    return {
        scripts: optimization,
        styles: {
            minify: optimization,
            inlineCritical: optimization,
        },
        fonts: {
            inline: optimization,
        },
    };
}
exports.normalizeOptimization = normalizeOptimization;
