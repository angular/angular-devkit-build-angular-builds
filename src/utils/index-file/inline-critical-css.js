"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineCriticalCssProcessor = void 0;
const fs = __importStar(require("fs"));
const Critters = require('critters');
class CrittersExtended extends Critters {
    constructor(optionsExtended) {
        super({
            logger: {
                warn: (s) => this.warnings.push(s),
                error: (s) => this.errors.push(s),
                info: () => { },
            },
            logLevel: 'warn',
            path: optionsExtended.outputPath,
            publicPath: optionsExtended.deployUrl,
            compress: !!optionsExtended.minify,
            pruneSource: false,
            reduceInlineStyles: false,
            mergeStylesheets: false,
            preload: 'media',
            noscriptFallback: true,
            inlineFonts: true,
        });
        this.optionsExtended = optionsExtended;
        this.warnings = [];
        this.errors = [];
    }
    readFile(path) {
        const readAsset = this.optionsExtended.readAsset;
        return readAsset ? readAsset(path) : fs.promises.readFile(path, 'utf-8');
    }
}
class InlineCriticalCssProcessor {
    constructor(options) {
        this.options = options;
    }
    async process(html, options) {
        const critters = new CrittersExtended({ ...this.options, ...options });
        const content = await critters.process(html);
        return {
            // Clean up value from value less attributes.
            // This is caused because parse5 always requires attributes to have a string value.
            // nomodule="" defer="" -> nomodule defer.
            content: content.replace(/(\s(?:defer|nomodule))=""/g, '$1'),
            errors: critters.errors,
            warnings: critters.warnings,
        };
    }
}
exports.InlineCriticalCssProcessor = InlineCriticalCssProcessor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLWNyaXRpY2FsLWNzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBRXpCLE1BQU0sUUFBUSxHQUFzQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFZeEUsTUFBTSxnQkFBaUIsU0FBUSxRQUFRO0lBSXJDLFlBQ21CLGVBQ2dCO1FBRWpDLEtBQUssQ0FBQztZQUNKLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDMUMsS0FBSyxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDO2FBQ2Y7WUFDRCxRQUFRLEVBQUUsTUFBTTtZQUNoQixJQUFJLEVBQUUsZUFBZSxDQUFDLFVBQVU7WUFDaEMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxTQUFTO1lBQ3JDLFFBQVEsRUFBRSxDQUFDLENBQUMsZUFBZSxDQUFDLE1BQU07WUFDbEMsV0FBVyxFQUFFLEtBQUs7WUFDbEIsa0JBQWtCLEVBQUUsS0FBSztZQUN6QixnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FBQyxDQUFDO1FBbkJjLG9CQUFlLEdBQWYsZUFBZSxDQUNDO1FBTDFCLGFBQVEsR0FBYSxFQUFFLENBQUM7UUFDeEIsV0FBTSxHQUFhLEVBQUUsQ0FBQztJQXVCL0IsQ0FBQztJQUVlLFFBQVEsQ0FBQyxJQUFZO1FBQ25DLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDO1FBRWpELE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMzRSxDQUFDO0NBQ0Y7QUFFRCxNQUFhLDBCQUEwQjtJQUNyQyxZQUErQixPQUEwQztRQUExQyxZQUFPLEdBQVAsT0FBTyxDQUFtQztJQUFHLENBQUM7SUFFN0UsS0FBSyxDQUFDLE9BQU8sQ0FDWCxJQUFZLEVBQ1osT0FBd0M7UUFFeEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdkUsTUFBTSxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTdDLE9BQU87WUFDTCw2Q0FBNkM7WUFDN0MsbUZBQW1GO1lBQ25GLDBDQUEwQztZQUMxQyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxJQUFJLENBQUM7WUFDNUQsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNO1lBQ3ZCLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtTQUM1QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBbkJELGdFQW1CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5cbmNvbnN0IENyaXR0ZXJzOiB0eXBlb2YgaW1wb3J0KCdjcml0dGVycycpLmRlZmF1bHQgPSByZXF1aXJlKCdjcml0dGVycycpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc09wdGlvbnMge1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3JPcHRpb25zIHtcbiAgbWluaWZ5PzogYm9vbGVhbjtcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICByZWFkQXNzZXQ/OiAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG59XG5cbmNsYXNzIENyaXR0ZXJzRXh0ZW5kZWQgZXh0ZW5kcyBDcml0dGVycyB7XG4gIHJlYWRvbmx5IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICByZWFkb25seSBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zRXh0ZW5kZWQ6IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yT3B0aW9ucyAmXG4gICAgICBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NPcHRpb25zLFxuICApIHtcbiAgICBzdXBlcih7XG4gICAgICBsb2dnZXI6IHtcbiAgICAgICAgd2FybjogKHM6IHN0cmluZykgPT4gdGhpcy53YXJuaW5ncy5wdXNoKHMpLFxuICAgICAgICBlcnJvcjogKHM6IHN0cmluZykgPT4gdGhpcy5lcnJvcnMucHVzaChzKSxcbiAgICAgICAgaW5mbzogKCkgPT4ge30sXG4gICAgICB9LFxuICAgICAgbG9nTGV2ZWw6ICd3YXJuJyxcbiAgICAgIHBhdGg6IG9wdGlvbnNFeHRlbmRlZC5vdXRwdXRQYXRoLFxuICAgICAgcHVibGljUGF0aDogb3B0aW9uc0V4dGVuZGVkLmRlcGxveVVybCxcbiAgICAgIGNvbXByZXNzOiAhIW9wdGlvbnNFeHRlbmRlZC5taW5pZnksXG4gICAgICBwcnVuZVNvdXJjZTogZmFsc2UsXG4gICAgICByZWR1Y2VJbmxpbmVTdHlsZXM6IGZhbHNlLFxuICAgICAgbWVyZ2VTdHlsZXNoZWV0czogZmFsc2UsXG4gICAgICBwcmVsb2FkOiAnbWVkaWEnLFxuICAgICAgbm9zY3JpcHRGYWxsYmFjazogdHJ1ZSxcbiAgICAgIGlubGluZUZvbnRzOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG92ZXJyaWRlIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgcmVhZEFzc2V0ID0gdGhpcy5vcHRpb25zRXh0ZW5kZWQucmVhZEFzc2V0O1xuXG4gICAgcmV0dXJuIHJlYWRBc3NldCA/IHJlYWRBc3NldChwYXRoKSA6IGZzLnByb21pc2VzLnJlYWRGaWxlKHBhdGgsICd1dGYtOCcpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCByZWFkb25seSBvcHRpb25zOiBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvck9wdGlvbnMpIHt9XG5cbiAgYXN5bmMgcHJvY2VzcyhcbiAgICBodG1sOiBzdHJpbmcsXG4gICAgb3B0aW9uczogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7IGNvbnRlbnQ6IHN0cmluZzsgd2FybmluZ3M6IHN0cmluZ1tdOyBlcnJvcnM6IHN0cmluZ1tdIH0+IHtcbiAgICBjb25zdCBjcml0dGVycyA9IG5ldyBDcml0dGVyc0V4dGVuZGVkKHsgLi4udGhpcy5vcHRpb25zLCAuLi5vcHRpb25zIH0pO1xuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBjcml0dGVycy5wcm9jZXNzKGh0bWwpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIENsZWFuIHVwIHZhbHVlIGZyb20gdmFsdWUgbGVzcyBhdHRyaWJ1dGVzLlxuICAgICAgLy8gVGhpcyBpcyBjYXVzZWQgYmVjYXVzZSBwYXJzZTUgYWx3YXlzIHJlcXVpcmVzIGF0dHJpYnV0ZXMgdG8gaGF2ZSBhIHN0cmluZyB2YWx1ZS5cbiAgICAgIC8vIG5vbW9kdWxlPVwiXCIgZGVmZXI9XCJcIiAtPiBub21vZHVsZSBkZWZlci5cbiAgICAgIGNvbnRlbnQ6IGNvbnRlbnQucmVwbGFjZSgvKFxccyg/OmRlZmVyfG5vbW9kdWxlKSk9XCJcIi9nLCAnJDEnKSxcbiAgICAgIGVycm9yczogY3JpdHRlcnMuZXJyb3JzLFxuICAgICAgd2FybmluZ3M6IGNyaXR0ZXJzLndhcm5pbmdzLFxuICAgIH07XG4gIH1cbn1cbiJdfQ==