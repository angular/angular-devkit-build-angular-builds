"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionResult = void 0;
const utils_1 = require("./utils");
/**
 * Represents the result of a single builder execute call.
 */
class ExecutionResult {
    rebuildContexts;
    codeBundleCache;
    outputFiles = [];
    assetFiles = [];
    constructor(rebuildContexts, codeBundleCache) {
        this.rebuildContexts = rebuildContexts;
        this.codeBundleCache = codeBundleCache;
    }
    addOutputFile(path, content, type) {
        this.outputFiles.push((0, utils_1.createOutputFileFromText)(path, content, type));
    }
    addAssets(assets) {
        this.assetFiles.push(...assets);
    }
    get output() {
        return {
            success: this.outputFiles.length > 0,
        };
    }
    get outputWithFiles() {
        return {
            success: this.outputFiles.length > 0,
            outputFiles: this.outputFiles,
            assetFiles: this.assetFiles,
        };
    }
    get watchFiles() {
        const files = this.rebuildContexts.flatMap((context) => [...context.watchFiles]);
        if (this.codeBundleCache?.referencedFiles) {
            files.push(...this.codeBundleCache.referencedFiles);
        }
        return files;
    }
    createRebuildState(fileChanges) {
        this.codeBundleCache?.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            rebuildContexts: this.rebuildContexts,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
        };
    }
    async dispose() {
        await Promise.allSettled(this.rebuildContexts.map((context) => context.dispose()));
    }
}
exports.ExecutionResult = ExecutionResult;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1leGVjdXRpb24tcmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsbUNBQW1EO0FBUW5EOztHQUVHO0FBQ0gsTUFBYSxlQUFlO0lBS2hCO0lBQ0E7SUFMVixXQUFXLEdBQXNCLEVBQUUsQ0FBQztJQUNwQyxVQUFVLEdBQThDLEVBQUUsQ0FBQztJQUUzRCxZQUNVLGVBQWlDLEVBQ2pDLGVBQWlDO1FBRGpDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQUNqQyxvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7SUFDeEMsQ0FBQztJQUVKLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBZSxFQUFFLElBQXlCO1FBQ3BFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUEsZ0NBQXdCLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxTQUFTLENBQUMsTUFBaUQ7UUFDekQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO1NBQ3JDLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxlQUFlO1FBQ2pCLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztZQUNwQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO1NBQzVCLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ1osTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNqRixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFO1lBQ3pDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ3JEO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsa0JBQWtCLENBQUMsV0FBeUI7UUFDMUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVwRixPQUFPO1lBQ0wsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ3JDLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNyQyxXQUFXO1NBQ1osQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTztRQUNYLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyRixDQUFDO0NBQ0Y7QUFyREQsMENBcURDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ2hhbmdlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC93YXRjaGVyJztcbmltcG9ydCB0eXBlIHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSwgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQgfSBmcm9tICcuL3V0aWxzJztcblxuZXhwb3J0IGludGVyZmFjZSBSZWJ1aWxkU3RhdGUge1xuICByZWJ1aWxkQ29udGV4dHM6IEJ1bmRsZXJDb250ZXh0W107XG4gIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXN1bHQgb2YgYSBzaW5nbGUgYnVpbGRlciBleGVjdXRlIGNhbGwuXG4gKi9cbmV4cG9ydCBjbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICBvdXRwdXRGaWxlczogQnVpbGRPdXRwdXRGaWxlW10gPSBbXTtcbiAgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYnVpbGRDb250ZXh0czogQnVuZGxlckNvbnRleHRbXSxcbiAgICBwcml2YXRlIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbiAgKSB7fVxuXG4gIGFkZE91dHB1dEZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGUpOiB2b2lkIHtcbiAgICB0aGlzLm91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGgsIGNvbnRlbnQsIHR5cGUpKTtcbiAgfVxuXG4gIGFkZEFzc2V0cyhhc3NldHM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdKTogdm9pZCB7XG4gICAgdGhpcy5hc3NldEZpbGVzLnB1c2goLi4uYXNzZXRzKTtcbiAgfVxuXG4gIGdldCBvdXRwdXQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMub3V0cHV0RmlsZXMubGVuZ3RoID4gMCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0IG91dHB1dFdpdGhGaWxlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgICAgb3V0cHV0RmlsZXM6IHRoaXMub3V0cHV0RmlsZXMsXG4gICAgICBhc3NldEZpbGVzOiB0aGlzLmFzc2V0RmlsZXMsXG4gICAgfTtcbiAgfVxuXG4gIGdldCB3YXRjaEZpbGVzKCkge1xuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5yZWJ1aWxkQ29udGV4dHMuZmxhdE1hcCgoY29udGV4dCkgPT4gWy4uLmNvbnRleHQud2F0Y2hGaWxlc10pO1xuICAgIGlmICh0aGlzLmNvZGVCdW5kbGVDYWNoZT8ucmVmZXJlbmNlZEZpbGVzKSB7XG4gICAgICBmaWxlcy5wdXNoKC4uLnRoaXMuY29kZUJ1bmRsZUNhY2hlLnJlZmVyZW5jZWRGaWxlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYnVpbGRDb250ZXh0czogdGhpcy5yZWJ1aWxkQ29udGV4dHMsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMucmVidWlsZENvbnRleHRzLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5kaXNwb3NlKCkpKTtcbiAgfVxufVxuIl19