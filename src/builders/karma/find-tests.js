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
exports.findTests = void 0;
const fs_1 = require("fs");
const glob = __importStar(require("glob"));
const path_1 = require("path");
const is_directory_1 = require("../../utils/is-directory");
// go through all patterns and find unique list of files
function findTests(patterns, cwd, workspaceRoot) {
    return patterns.reduce((files, pattern) => {
        const relativePathToMain = cwd.replace(workspaceRoot, '').substr(1); // remove leading slash
        const tests = findMatchingTests(pattern, cwd, relativePathToMain);
        tests.forEach((file) => {
            if (!files.includes(file)) {
                files.push(file);
            }
        });
        return files;
    }, []);
}
exports.findTests = findTests;
function findMatchingTests(pattern, cwd, relativePathToMain) {
    // normalize pattern, glob lib only accepts forward slashes
    pattern = pattern.replace(/\\/g, '/');
    relativePathToMain = relativePathToMain.replace(/\\/g, '/');
    // remove relativePathToMain to support relative paths from root
    // such paths are easy to get when running scripts via IDEs
    if (pattern.startsWith(relativePathToMain + '/')) {
        pattern = pattern.substr(relativePathToMain.length + 1); // +1 to include slash
    }
    // special logic when pattern does not look like a glob
    if (!glob.hasMagic(pattern)) {
        if ((0, is_directory_1.isDirectory)((0, path_1.join)(cwd, pattern))) {
            pattern = `${pattern}/**/*.spec.@(ts|tsx)`;
        }
        else {
            // see if matching spec file exists
            const extension = (0, path_1.extname)(pattern);
            const matchingSpec = `${(0, path_1.basename)(pattern, extension)}.spec${extension}`;
            if ((0, fs_1.existsSync)((0, path_1.join)(cwd, (0, path_1.dirname)(pattern), matchingSpec))) {
                pattern = (0, path_1.join)((0, path_1.dirname)(pattern), matchingSpec).replace(/\\/g, '/');
            }
        }
    }
    const files = glob.sync(pattern, {
        cwd,
    });
    return files;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2thcm1hL2ZpbmQtdGVzdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJCQUFnQztBQUNoQywyQ0FBNkI7QUFDN0IsK0JBQXdEO0FBQ3hELDJEQUF1RDtBQUV2RCx3REFBd0Q7QUFDeEQsU0FBZ0IsU0FBUyxDQUFDLFFBQWtCLEVBQUUsR0FBVyxFQUFFLGFBQXFCO0lBQzlFLE9BQU8sUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUN4QyxNQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtRQUM1RixNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ3JCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN6QixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xCO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsRUFBRSxFQUFjLENBQUMsQ0FBQztBQUNyQixDQUFDO0FBWkQsOEJBWUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQWUsRUFBRSxHQUFXLEVBQUUsa0JBQTBCO0lBQ2pGLDJEQUEyRDtJQUMzRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdEMsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUU1RCxnRUFBZ0U7SUFDaEUsMkRBQTJEO0lBQzNELElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLENBQUMsRUFBRTtRQUNoRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7S0FDaEY7SUFFRCx1REFBdUQ7SUFDdkQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDM0IsSUFBSSxJQUFBLDBCQUFXLEVBQUMsSUFBQSxXQUFJLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEVBQUU7WUFDbkMsT0FBTyxHQUFHLEdBQUcsT0FBTyxzQkFBc0IsQ0FBQztTQUM1QzthQUFNO1lBQ0wsbUNBQW1DO1lBQ25DLE1BQU0sU0FBUyxHQUFHLElBQUEsY0FBTyxFQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ25DLE1BQU0sWUFBWSxHQUFHLEdBQUcsSUFBQSxlQUFRLEVBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxRQUFRLFNBQVMsRUFBRSxDQUFDO1lBRXhFLElBQUksSUFBQSxlQUFVLEVBQUMsSUFBQSxXQUFJLEVBQUMsR0FBRyxFQUFFLElBQUEsY0FBTyxFQUFDLE9BQU8sQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pELE9BQU8sR0FBRyxJQUFBLFdBQUksRUFBQyxJQUFBLGNBQU8sRUFBQyxPQUFPLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQ3BFO1NBQ0Y7S0FDRjtJQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQy9CLEdBQUc7S0FDSixDQUFDLENBQUM7SUFFSCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgaXNEaXJlY3RvcnkgfSBmcm9tICcuLi8uLi91dGlscy9pcy1kaXJlY3RvcnknO1xuXG4vLyBnbyB0aHJvdWdoIGFsbCBwYXR0ZXJucyBhbmQgZmluZCB1bmlxdWUgbGlzdCBvZiBmaWxlc1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRUZXN0cyhwYXR0ZXJuczogc3RyaW5nW10sIGN3ZDogc3RyaW5nLCB3b3Jrc3BhY2VSb290OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBwYXR0ZXJucy5yZWR1Y2UoKGZpbGVzLCBwYXR0ZXJuKSA9PiB7XG4gICAgY29uc3QgcmVsYXRpdmVQYXRoVG9NYWluID0gY3dkLnJlcGxhY2Uod29ya3NwYWNlUm9vdCwgJycpLnN1YnN0cigxKTsgLy8gcmVtb3ZlIGxlYWRpbmcgc2xhc2hcbiAgICBjb25zdCB0ZXN0cyA9IGZpbmRNYXRjaGluZ1Rlc3RzKHBhdHRlcm4sIGN3ZCwgcmVsYXRpdmVQYXRoVG9NYWluKTtcbiAgICB0ZXN0cy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICBpZiAoIWZpbGVzLmluY2x1ZGVzKGZpbGUpKSB7XG4gICAgICAgIGZpbGVzLnB1c2goZmlsZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZmlsZXM7XG4gIH0sIFtdIGFzIHN0cmluZ1tdKTtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nVGVzdHMocGF0dGVybjogc3RyaW5nLCBjd2Q6IHN0cmluZywgcmVsYXRpdmVQYXRoVG9NYWluOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIC8vIG5vcm1hbGl6ZSBwYXR0ZXJuLCBnbG9iIGxpYiBvbmx5IGFjY2VwdHMgZm9yd2FyZCBzbGFzaGVzXG4gIHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgcmVsYXRpdmVQYXRoVG9NYWluID0gcmVsYXRpdmVQYXRoVG9NYWluLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAvLyByZW1vdmUgcmVsYXRpdmVQYXRoVG9NYWluIHRvIHN1cHBvcnQgcmVsYXRpdmUgcGF0aHMgZnJvbSByb290XG4gIC8vIHN1Y2ggcGF0aHMgYXJlIGVhc3kgdG8gZ2V0IHdoZW4gcnVubmluZyBzY3JpcHRzIHZpYSBJREVzXG4gIGlmIChwYXR0ZXJuLnN0YXJ0c1dpdGgocmVsYXRpdmVQYXRoVG9NYWluICsgJy8nKSkge1xuICAgIHBhdHRlcm4gPSBwYXR0ZXJuLnN1YnN0cihyZWxhdGl2ZVBhdGhUb01haW4ubGVuZ3RoICsgMSk7IC8vICsxIHRvIGluY2x1ZGUgc2xhc2hcbiAgfVxuXG4gIC8vIHNwZWNpYWwgbG9naWMgd2hlbiBwYXR0ZXJuIGRvZXMgbm90IGxvb2sgbGlrZSBhIGdsb2JcbiAgaWYgKCFnbG9iLmhhc01hZ2ljKHBhdHRlcm4pKSB7XG4gICAgaWYgKGlzRGlyZWN0b3J5KGpvaW4oY3dkLCBwYXR0ZXJuKSkpIHtcbiAgICAgIHBhdHRlcm4gPSBgJHtwYXR0ZXJufS8qKi8qLnNwZWMuQCh0c3x0c3gpYDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2VlIGlmIG1hdGNoaW5nIHNwZWMgZmlsZSBleGlzdHNcbiAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IGV4dG5hbWUocGF0dGVybik7XG4gICAgICBjb25zdCBtYXRjaGluZ1NwZWMgPSBgJHtiYXNlbmFtZShwYXR0ZXJuLCBleHRlbnNpb24pfS5zcGVjJHtleHRlbnNpb259YDtcblxuICAgICAgaWYgKGV4aXN0c1N5bmMoam9pbihjd2QsIGRpcm5hbWUocGF0dGVybiksIG1hdGNoaW5nU3BlYykpKSB7XG4gICAgICAgIHBhdHRlcm4gPSBqb2luKGRpcm5hbWUocGF0dGVybiksIG1hdGNoaW5nU3BlYykucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKHBhdHRlcm4sIHtcbiAgICBjd2QsXG4gIH0pO1xuXG4gIHJldHVybiBmaWxlcztcbn1cbiJdfQ==