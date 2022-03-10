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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyAssets = void 0;
const fs = __importStar(require("fs"));
const glob_1 = __importDefault(require("glob"));
const path = __importStar(require("path"));
function globAsync(pattern, options) {
    return new Promise((resolve, reject) => (0, glob_1.default)(pattern, options, (e, m) => (e ? reject(e) : resolve(m))));
}
async function copyAssets(entries, basePaths, root, changed) {
    const defaultIgnore = ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'];
    for (const entry of entries) {
        const cwd = path.resolve(root, entry.input);
        const files = await globAsync(entry.glob, {
            cwd,
            dot: true,
            nodir: true,
            ignore: entry.ignore ? defaultIgnore.concat(entry.ignore) : defaultIgnore,
            follow: entry.followSymlinks,
        });
        const directoryExists = new Set();
        for (const file of files) {
            const src = path.join(cwd, file);
            if (changed && !changed.has(src)) {
                continue;
            }
            const filePath = entry.flatten ? path.basename(file) : file;
            for (const base of basePaths) {
                const dest = path.join(base, entry.output, filePath);
                const dir = path.dirname(dest);
                if (!directoryExists.has(dir)) {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    directoryExists.add(dir);
                }
                fs.copyFileSync(src, dest, fs.constants.COPYFILE_FICLONE);
            }
        }
    }
}
exports.copyAssets = copyAssets;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weS1hc3NldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9jb3B5LWFzc2V0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixnREFBd0I7QUFDeEIsMkNBQTZCO0FBRTdCLFNBQVMsU0FBUyxDQUFDLE9BQWUsRUFBRSxPQUFzQjtJQUN4RCxPQUFPLElBQUksT0FBTyxDQUFXLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQy9DLElBQUEsY0FBSSxFQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUMvRCxDQUFDO0FBQ0osQ0FBQztBQUVNLEtBQUssVUFBVSxVQUFVLENBQzlCLE9BT0csRUFDSCxTQUEyQixFQUMzQixJQUFZLEVBQ1osT0FBcUI7SUFFckIsTUFBTSxhQUFhLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBRW5FLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxFQUFFO1FBQzNCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QyxNQUFNLEtBQUssR0FBRyxNQUFNLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO1lBQ3hDLEdBQUc7WUFDSCxHQUFHLEVBQUUsSUFBSTtZQUNULEtBQUssRUFBRSxJQUFJO1lBQ1gsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO1lBQ3pFLE1BQU0sRUFBRSxLQUFLLENBQUMsY0FBYztTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBRTFDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pDLElBQUksT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDaEMsU0FBUzthQUNWO1lBRUQsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQzVELEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxFQUFFO2dCQUM1QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMvQixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDN0IsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3ZCLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7cUJBQ3hDO29CQUNELGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQzFCO2dCQUNELEVBQUUsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUM7YUFDM0Q7U0FDRjtLQUNGO0FBQ0gsQ0FBQztBQS9DRCxnQ0ErQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5mdW5jdGlvbiBnbG9iQXN5bmMocGF0dGVybjogc3RyaW5nLCBvcHRpb25zOiBnbG9iLklPcHRpb25zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmdbXT4oKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICBnbG9iKHBhdHRlcm4sIG9wdGlvbnMsIChlLCBtKSA9PiAoZSA/IHJlamVjdChlKSA6IHJlc29sdmUobSkpKSxcbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvcHlBc3NldHMoXG4gIGVudHJpZXM6IHtcbiAgICBnbG9iOiBzdHJpbmc7XG4gICAgaWdub3JlPzogc3RyaW5nW107XG4gICAgaW5wdXQ6IHN0cmluZztcbiAgICBvdXRwdXQ6IHN0cmluZztcbiAgICBmbGF0dGVuPzogYm9vbGVhbjtcbiAgICBmb2xsb3dTeW1saW5rcz86IGJvb2xlYW47XG4gIH1bXSxcbiAgYmFzZVBhdGhzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICByb290OiBzdHJpbmcsXG4gIGNoYW5nZWQ/OiBTZXQ8c3RyaW5nPixcbikge1xuICBjb25zdCBkZWZhdWx0SWdub3JlID0gWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ107XG5cbiAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgY29uc3QgY3dkID0gcGF0aC5yZXNvbHZlKHJvb3QsIGVudHJ5LmlucHV0KTtcbiAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGdsb2JBc3luYyhlbnRyeS5nbG9iLCB7XG4gICAgICBjd2QsXG4gICAgICBkb3Q6IHRydWUsXG4gICAgICBub2RpcjogdHJ1ZSxcbiAgICAgIGlnbm9yZTogZW50cnkuaWdub3JlID8gZGVmYXVsdElnbm9yZS5jb25jYXQoZW50cnkuaWdub3JlKSA6IGRlZmF1bHRJZ25vcmUsXG4gICAgICBmb2xsb3c6IGVudHJ5LmZvbGxvd1N5bWxpbmtzLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGlyZWN0b3J5RXhpc3RzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IHNyYyA9IHBhdGguam9pbihjd2QsIGZpbGUpO1xuICAgICAgaWYgKGNoYW5nZWQgJiYgIWNoYW5nZWQuaGFzKHNyYykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVQYXRoID0gZW50cnkuZmxhdHRlbiA/IHBhdGguYmFzZW5hbWUoZmlsZSkgOiBmaWxlO1xuICAgICAgZm9yIChjb25zdCBiYXNlIG9mIGJhc2VQYXRocykge1xuICAgICAgICBjb25zdCBkZXN0ID0gcGF0aC5qb2luKGJhc2UsIGVudHJ5Lm91dHB1dCwgZmlsZVBhdGgpO1xuICAgICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUoZGVzdCk7XG4gICAgICAgIGlmICghZGlyZWN0b3J5RXhpc3RzLmhhcyhkaXIpKSB7XG4gICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIHtcbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGRpcik7XG4gICAgICAgIH1cbiAgICAgICAgZnMuY29weUZpbGVTeW5jKHNyYywgZGVzdCwgZnMuY29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19