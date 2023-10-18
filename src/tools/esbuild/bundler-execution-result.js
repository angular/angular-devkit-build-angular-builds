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
    errors = [];
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
    addErrors(errors) {
        this.errors.push(...errors);
    }
    get output() {
        return {
            success: this.errors.length === 0,
        };
    }
    get outputWithFiles() {
        return {
            success: this.errors.length === 0,
            outputFiles: this.outputFiles,
            assetFiles: this.assetFiles,
            errors: this.errors,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1leGVjdXRpb24tcmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBTUgsbUNBQW1EO0FBYW5EOztHQUVHO0FBQ0gsTUFBYSxlQUFlO0lBTWhCO0lBQ0E7SUFOVixXQUFXLEdBQXNCLEVBQUUsQ0FBQztJQUNwQyxVQUFVLEdBQXVCLEVBQUUsQ0FBQztJQUNwQyxNQUFNLEdBQWMsRUFBRSxDQUFDO0lBRXZCLFlBQ1UsZUFBaUMsRUFDakMsZUFBaUM7UUFEakMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBQ2pDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtJQUN4QyxDQUFDO0lBRUosYUFBYSxDQUFDLElBQVksRUFBRSxPQUFlLEVBQUUsSUFBeUI7UUFDcEUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBQSxnQ0FBd0IsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELFNBQVMsQ0FBQyxNQUEwQjtRQUNsQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxTQUFTLENBQUMsTUFBaUI7UUFDekIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO1NBQ2xDLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxlQUFlO1FBQ2pCLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUNqQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQzNCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksVUFBVTtRQUNaLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakYsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLGVBQWUsRUFBRTtZQUN6QyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQztTQUNyRDtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELGtCQUFrQixDQUFDLFdBQXlCO1FBQzFDLElBQUksQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsUUFBUSxFQUFFLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFcEYsT0FBTztZQUNMLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNyQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWU7WUFDckMsV0FBVztTQUNaLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU87UUFDWCxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckYsQ0FBQztDQUNGO0FBM0RELDBDQTJEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgQ2hhbmdlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC93YXRjaGVyJztcbmltcG9ydCB0eXBlIHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB0eXBlIHsgQnVpbGRPdXRwdXRGaWxlLCBCdWlsZE91dHB1dEZpbGVUeXBlLCBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCB9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkT3V0cHV0QXNzZXQge1xuICBzb3VyY2U6IHN0cmluZztcbiAgZGVzdGluYXRpb246IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWJ1aWxkU3RhdGUge1xuICByZWJ1aWxkQ29udGV4dHM6IEJ1bmRsZXJDb250ZXh0W107XG4gIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXN1bHQgb2YgYSBzaW5nbGUgYnVpbGRlciBleGVjdXRlIGNhbGwuXG4gKi9cbmV4cG9ydCBjbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICBvdXRwdXRGaWxlczogQnVpbGRPdXRwdXRGaWxlW10gPSBbXTtcbiAgYXNzZXRGaWxlczogQnVpbGRPdXRwdXRBc3NldFtdID0gW107XG4gIGVycm9yczogTWVzc2FnZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWJ1aWxkQ29udGV4dHM6IEJ1bmRsZXJDb250ZXh0W10sXG4gICAgcHJpdmF0ZSBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4gICkge31cblxuICBhZGRPdXRwdXRGaWxlKHBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB0eXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlKTogdm9pZCB7XG4gICAgdGhpcy5vdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoLCBjb250ZW50LCB0eXBlKSk7XG4gIH1cblxuICBhZGRBc3NldHMoYXNzZXRzOiBCdWlsZE91dHB1dEFzc2V0W10pOiB2b2lkIHtcbiAgICB0aGlzLmFzc2V0RmlsZXMucHVzaCguLi5hc3NldHMpO1xuICB9XG5cbiAgYWRkRXJyb3JzKGVycm9yczogTWVzc2FnZVtdKTogdm9pZCB7XG4gICAgdGhpcy5lcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICB9XG5cbiAgZ2V0IG91dHB1dCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5lcnJvcnMubGVuZ3RoID09PSAwLFxuICAgIH07XG4gIH1cblxuICBnZXQgb3V0cHV0V2l0aEZpbGVzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLmVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBvdXRwdXRGaWxlczogdGhpcy5vdXRwdXRGaWxlcyxcbiAgICAgIGFzc2V0RmlsZXM6IHRoaXMuYXNzZXRGaWxlcyxcbiAgICAgIGVycm9yczogdGhpcy5lcnJvcnMsXG4gICAgfTtcbiAgfVxuXG4gIGdldCB3YXRjaEZpbGVzKCkge1xuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5yZWJ1aWxkQ29udGV4dHMuZmxhdE1hcCgoY29udGV4dCkgPT4gWy4uLmNvbnRleHQud2F0Y2hGaWxlc10pO1xuICAgIGlmICh0aGlzLmNvZGVCdW5kbGVDYWNoZT8ucmVmZXJlbmNlZEZpbGVzKSB7XG4gICAgICBmaWxlcy5wdXNoKC4uLnRoaXMuY29kZUJ1bmRsZUNhY2hlLnJlZmVyZW5jZWRGaWxlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpbGVzO1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYnVpbGRDb250ZXh0czogdGhpcy5yZWJ1aWxkQ29udGV4dHMsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMucmVidWlsZENvbnRleHRzLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5kaXNwb3NlKCkpKTtcbiAgfVxufVxuIl19