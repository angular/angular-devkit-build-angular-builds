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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1leGVjdXRpb24tcmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBS0gsbUNBQW1EO0FBUW5EOztHQUVHO0FBQ0gsTUFBYSxlQUFlO0lBS2hCO0lBQ0E7SUFMVixXQUFXLEdBQXNCLEVBQUUsQ0FBQztJQUNwQyxVQUFVLEdBQThDLEVBQUUsQ0FBQztJQUUzRCxZQUNVLGVBQWlDLEVBQ2pDLGVBQWlDO1FBRGpDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQUNqQyxvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7SUFDeEMsQ0FBQztJQUVKLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBZSxFQUFFLElBQXlCO1FBQ3BFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUEsZ0NBQXdCLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxTQUFTLENBQUMsTUFBaUQ7UUFDekQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO1NBQ3JDLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxlQUFlO1FBQ2pCLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztZQUNwQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO1NBQzVCLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ1osTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNqRixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFO1lBQ3pDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ3JEO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsa0JBQWtCLENBQUMsV0FBeUI7UUFDMUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVwRixPQUFPO1lBQ0wsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ3JDLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNyQyxXQUFXO1NBQ1osQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTztRQUNYLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyRixDQUFDO0NBQ0Y7QUFyREQsMENBcURDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ2hhbmdlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC93YXRjaGVyJztcbmltcG9ydCB0eXBlIHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB0eXBlIHsgQnVpbGRPdXRwdXRGaWxlLCBCdWlsZE91dHB1dEZpbGVUeXBlLCBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCB9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIHJlYnVpbGRDb250ZXh0czogQnVuZGxlckNvbnRleHRbXTtcbiAgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc3VsdCBvZiBhIHNpbmdsZSBidWlsZGVyIGV4ZWN1dGUgY2FsbC5cbiAqL1xuZXhwb3J0IGNsYXNzIEV4ZWN1dGlvblJlc3VsdCB7XG4gIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSA9IFtdO1xuICBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVidWlsZENvbnRleHRzOiBCdW5kbGVyQ29udGV4dFtdLFxuICAgIHByaXZhdGUgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuICApIHt9XG5cbiAgYWRkT3V0cHV0RmlsZShwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgdHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZSk6IHZvaWQge1xuICAgIHRoaXMub3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aCwgY29udGVudCwgdHlwZSkpO1xuICB9XG5cbiAgYWRkQXNzZXRzKGFzc2V0czogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10pOiB2b2lkIHtcbiAgICB0aGlzLmFzc2V0RmlsZXMucHVzaCguLi5hc3NldHMpO1xuICB9XG5cbiAgZ2V0IG91dHB1dCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgIH07XG4gIH1cblxuICBnZXQgb3V0cHV0V2l0aEZpbGVzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLm91dHB1dEZpbGVzLmxlbmd0aCA+IDAsXG4gICAgICBvdXRwdXRGaWxlczogdGhpcy5vdXRwdXRGaWxlcyxcbiAgICAgIGFzc2V0RmlsZXM6IHRoaXMuYXNzZXRGaWxlcyxcbiAgICB9O1xuICB9XG5cbiAgZ2V0IHdhdGNoRmlsZXMoKSB7XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLnJlYnVpbGRDb250ZXh0cy5mbGF0TWFwKChjb250ZXh0KSA9PiBbLi4uY29udGV4dC53YXRjaEZpbGVzXSk7XG4gICAgaWYgKHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5yZWZlcmVuY2VkRmlsZXMpIHtcbiAgICAgIGZpbGVzLnB1c2goLi4udGhpcy5jb2RlQnVuZGxlQ2FjaGUucmVmZXJlbmNlZEZpbGVzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmlsZXM7XG4gIH1cblxuICBjcmVhdGVSZWJ1aWxkU3RhdGUoZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcyk6IFJlYnVpbGRTdGF0ZSB7XG4gICAgdGhpcy5jb2RlQnVuZGxlQ2FjaGU/LmludmFsaWRhdGUoWy4uLmZpbGVDaGFuZ2VzLm1vZGlmaWVkLCAuLi5maWxlQ2hhbmdlcy5yZW1vdmVkXSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcmVidWlsZENvbnRleHRzOiB0aGlzLnJlYnVpbGRDb250ZXh0cyxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZTogdGhpcy5jb2RlQnVuZGxlQ2FjaGUsXG4gICAgICBmaWxlQ2hhbmdlcyxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQodGhpcy5yZWJ1aWxkQ29udGV4dHMubWFwKChjb250ZXh0KSA9PiBjb250ZXh0LmRpc3Bvc2UoKSkpO1xuICB9XG59XG4iXX0=