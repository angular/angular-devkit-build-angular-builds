"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileReferenceTracker = void 0;
class FileReferenceTracker {
    #referencingFiles = new Map();
    get referencedFiles() {
        return this.#referencingFiles.keys();
    }
    add(containingFile, referencedFiles) {
        for (const file of referencedFiles) {
            if (file === containingFile) {
                // Containing file is already known to the AOT compiler
                continue;
            }
            const referencing = this.#referencingFiles.get(file);
            if (referencing === undefined) {
                this.#referencingFiles.set(file, new Set([containingFile]));
            }
            else {
                referencing.add(containingFile);
            }
        }
    }
    /**
     *
     * @param changed The set of changed files.
     */
    update(changed) {
        // Lazily initialized to avoid unneeded copying if there are no additions to return
        let allChangedFiles;
        // Add referencing files to fully notify the AOT compiler of required component updates
        for (const modifiedFile of changed) {
            const referencing = this.#referencingFiles.get(modifiedFile);
            if (referencing) {
                allChangedFiles ??= new Set(changed);
                for (const referencingFile of referencing) {
                    allChangedFiles.add(referencingFile);
                }
                // Cleanup the stale record which will be updated by new resource transforms
                this.#referencingFiles.delete(modifiedFile);
            }
        }
        return allChangedFiles ?? changed;
    }
}
exports.FileReferenceTracker = FileReferenceTracker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS1yZWZlcmVuY2UtdHJhY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9maWxlLXJlZmVyZW5jZS10cmFja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILE1BQWEsb0JBQW9CO0lBQy9CLGlCQUFpQixHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO0lBRW5ELElBQUksZUFBZTtRQUNqQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN2QyxDQUFDO0lBRUQsR0FBRyxDQUFDLGNBQXNCLEVBQUUsZUFBaUM7UUFDM0QsS0FBSyxNQUFNLElBQUksSUFBSSxlQUFlLEVBQUU7WUFDbEMsSUFBSSxJQUFJLEtBQUssY0FBYyxFQUFFO2dCQUMzQix1REFBdUQ7Z0JBQ3ZELFNBQVM7YUFDVjtZQUVELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckQsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFO2dCQUM3QixJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUM3RDtpQkFBTTtnQkFDTCxXQUFXLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQ2pDO1NBQ0Y7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE9BQW9CO1FBQ3pCLG1GQUFtRjtRQUNuRixJQUFJLGVBQXdDLENBQUM7UUFFN0MsdUZBQXVGO1FBQ3ZGLEtBQUssTUFBTSxZQUFZLElBQUksT0FBTyxFQUFFO1lBQ2xDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDN0QsSUFBSSxXQUFXLEVBQUU7Z0JBQ2YsZUFBZSxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNyQyxLQUFLLE1BQU0sZUFBZSxJQUFJLFdBQVcsRUFBRTtvQkFDekMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztpQkFDdEM7Z0JBQ0QsNEVBQTRFO2dCQUM1RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzdDO1NBQ0Y7UUFFRCxPQUFPLGVBQWUsSUFBSSxPQUFPLENBQUM7SUFDcEMsQ0FBQztDQUNGO0FBOUNELG9EQThDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgY2xhc3MgRmlsZVJlZmVyZW5jZVRyYWNrZXIge1xuICAjcmVmZXJlbmNpbmdGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcblxuICBnZXQgcmVmZXJlbmNlZEZpbGVzKCkge1xuICAgIHJldHVybiB0aGlzLiNyZWZlcmVuY2luZ0ZpbGVzLmtleXMoKTtcbiAgfVxuXG4gIGFkZChjb250YWluaW5nRmlsZTogc3RyaW5nLCByZWZlcmVuY2VkRmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVmZXJlbmNlZEZpbGVzKSB7XG4gICAgICBpZiAoZmlsZSA9PT0gY29udGFpbmluZ0ZpbGUpIHtcbiAgICAgICAgLy8gQ29udGFpbmluZyBmaWxlIGlzIGFscmVhZHkga25vd24gdG8gdGhlIEFPVCBjb21waWxlclxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVmZXJlbmNpbmcgPSB0aGlzLiNyZWZlcmVuY2luZ0ZpbGVzLmdldChmaWxlKTtcbiAgICAgIGlmIChyZWZlcmVuY2luZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRoaXMuI3JlZmVyZW5jaW5nRmlsZXMuc2V0KGZpbGUsIG5ldyBTZXQoW2NvbnRhaW5pbmdGaWxlXSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVmZXJlbmNpbmcuYWRkKGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIGNoYW5nZWQgVGhlIHNldCBvZiBjaGFuZ2VkIGZpbGVzLlxuICAgKi9cbiAgdXBkYXRlKGNoYW5nZWQ6IFNldDxzdHJpbmc+KTogU2V0PHN0cmluZz4ge1xuICAgIC8vIExhemlseSBpbml0aWFsaXplZCB0byBhdm9pZCB1bm5lZWRlZCBjb3B5aW5nIGlmIHRoZXJlIGFyZSBubyBhZGRpdGlvbnMgdG8gcmV0dXJuXG4gICAgbGV0IGFsbENoYW5nZWRGaWxlczogU2V0PHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBBZGQgcmVmZXJlbmNpbmcgZmlsZXMgdG8gZnVsbHkgbm90aWZ5IHRoZSBBT1QgY29tcGlsZXIgb2YgcmVxdWlyZWQgY29tcG9uZW50IHVwZGF0ZXNcbiAgICBmb3IgKGNvbnN0IG1vZGlmaWVkRmlsZSBvZiBjaGFuZ2VkKSB7XG4gICAgICBjb25zdCByZWZlcmVuY2luZyA9IHRoaXMuI3JlZmVyZW5jaW5nRmlsZXMuZ2V0KG1vZGlmaWVkRmlsZSk7XG4gICAgICBpZiAocmVmZXJlbmNpbmcpIHtcbiAgICAgICAgYWxsQ2hhbmdlZEZpbGVzID8/PSBuZXcgU2V0KGNoYW5nZWQpO1xuICAgICAgICBmb3IgKGNvbnN0IHJlZmVyZW5jaW5nRmlsZSBvZiByZWZlcmVuY2luZykge1xuICAgICAgICAgIGFsbENoYW5nZWRGaWxlcy5hZGQocmVmZXJlbmNpbmdGaWxlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhbnVwIHRoZSBzdGFsZSByZWNvcmQgd2hpY2ggd2lsbCBiZSB1cGRhdGVkIGJ5IG5ldyByZXNvdXJjZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMuI3JlZmVyZW5jaW5nRmlsZXMuZGVsZXRlKG1vZGlmaWVkRmlsZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbENoYW5nZWRGaWxlcyA/PyBjaGFuZ2VkO1xuICB9XG59XG4iXX0=