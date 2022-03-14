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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weS1hc3NldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9jb3B5LWFzc2V0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLGdEQUF3QjtBQUN4QiwyQ0FBNkI7QUFFN0IsU0FBUyxTQUFTLENBQUMsT0FBZSxFQUFFLE9BQXNCO0lBQ3hELE9BQU8sSUFBSSxPQUFPLENBQVcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDL0MsSUFBQSxjQUFJLEVBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQy9ELENBQUM7QUFDSixDQUFDO0FBRU0sS0FBSyxVQUFVLFVBQVUsQ0FDOUIsT0FPRyxFQUNILFNBQTJCLEVBQzNCLElBQVksRUFDWixPQUFxQjtJQUVyQixNQUFNLGFBQWEsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFbkUsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLEVBQUU7UUFDM0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVDLE1BQU0sS0FBSyxHQUFHLE1BQU0sU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDeEMsR0FBRztZQUNILEdBQUcsRUFBRSxJQUFJO1lBQ1QsS0FBSyxFQUFFLElBQUk7WUFDWCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWE7WUFDekUsTUFBTSxFQUFFLEtBQUssQ0FBQyxjQUFjO1NBQzdCLENBQUMsQ0FBQztRQUVILE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFFMUMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDakMsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUNoQyxTQUFTO2FBQ1Y7WUFFRCxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDNUQsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLEVBQUU7Z0JBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ3JELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUM3QixJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDdkIsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztxQkFDeEM7b0JBQ0QsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDMUI7Z0JBQ0QsRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzthQUMzRDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBL0NELGdDQStDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdnbG9iJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmZ1bmN0aW9uIGdsb2JBc3luYyhwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IGdsb2IuSU9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZ1tdPigocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgIGdsb2IocGF0dGVybiwgb3B0aW9ucywgKGUsIG0pID0+IChlID8gcmVqZWN0KGUpIDogcmVzb2x2ZShtKSkpLFxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weUFzc2V0cyhcbiAgZW50cmllczoge1xuICAgIGdsb2I6IHN0cmluZztcbiAgICBpZ25vcmU/OiBzdHJpbmdbXTtcbiAgICBpbnB1dDogc3RyaW5nO1xuICAgIG91dHB1dDogc3RyaW5nO1xuICAgIGZsYXR0ZW4/OiBib29sZWFuO1xuICAgIGZvbGxvd1N5bWxpbmtzPzogYm9vbGVhbjtcbiAgfVtdLFxuICBiYXNlUGF0aHM6IEl0ZXJhYmxlPHN0cmluZz4sXG4gIHJvb3Q6IHN0cmluZyxcbiAgY2hhbmdlZD86IFNldDxzdHJpbmc+LFxuKSB7XG4gIGNvbnN0IGRlZmF1bHRJZ25vcmUgPSBbJy5naXRrZWVwJywgJyoqLy5EU19TdG9yZScsICcqKi9UaHVtYnMuZGInXTtcblxuICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICBjb25zdCBjd2QgPSBwYXRoLnJlc29sdmUocm9vdCwgZW50cnkuaW5wdXQpO1xuICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZ2xvYkFzeW5jKGVudHJ5Lmdsb2IsIHtcbiAgICAgIGN3ZCxcbiAgICAgIGRvdDogdHJ1ZSxcbiAgICAgIG5vZGlyOiB0cnVlLFxuICAgICAgaWdub3JlOiBlbnRyeS5pZ25vcmUgPyBkZWZhdWx0SWdub3JlLmNvbmNhdChlbnRyeS5pZ25vcmUpIDogZGVmYXVsdElnbm9yZSxcbiAgICAgIGZvbGxvdzogZW50cnkuZm9sbG93U3ltbGlua3MsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkaXJlY3RvcnlFeGlzdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3Qgc3JjID0gcGF0aC5qb2luKGN3ZCwgZmlsZSk7XG4gICAgICBpZiAoY2hhbmdlZCAmJiAhY2hhbmdlZC5oYXMoc3JjKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZVBhdGggPSBlbnRyeS5mbGF0dGVuID8gcGF0aC5iYXNlbmFtZShmaWxlKSA6IGZpbGU7XG4gICAgICBmb3IgKGNvbnN0IGJhc2Ugb2YgYmFzZVBhdGhzKSB7XG4gICAgICAgIGNvbnN0IGRlc3QgPSBwYXRoLmpvaW4oYmFzZSwgZW50cnkub3V0cHV0LCBmaWxlUGF0aCk7XG4gICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShkZXN0KTtcbiAgICAgICAgaWYgKCFkaXJlY3RvcnlFeGlzdHMuaGFzKGRpcikpIHtcbiAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyKSkge1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoZGlyKTtcbiAgICAgICAgfVxuICAgICAgICBmcy5jb3B5RmlsZVN5bmMoc3JjLCBkZXN0LCBmcy5jb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=