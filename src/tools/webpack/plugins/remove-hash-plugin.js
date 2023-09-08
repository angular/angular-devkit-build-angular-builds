"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveHashPlugin = void 0;
class RemoveHashPlugin {
    options;
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('remove-hash-plugin', (compilation) => {
            const assetPath = (path, data) => {
                const chunkName = data.chunk?.name;
                const { chunkNames, hashFormat } = this.options;
                if (chunkName && chunkNames?.includes(chunkName)) {
                    // Replace hash formats with empty strings.
                    return path.replace(hashFormat.chunk, '').replace(hashFormat.extract, '');
                }
                return path;
            };
            compilation.hooks.assetPath.tap('remove-hash-plugin', assetPath);
        });
    }
}
exports.RemoveHashPlugin = RemoveHashPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3ZlLWhhc2gtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9wbHVnaW5zL3JlbW92ZS1oYXNoLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFVSCxNQUFhLGdCQUFnQjtJQUNQO0lBQXBCLFlBQW9CLE9BQWdDO1FBQWhDLFlBQU8sR0FBUCxPQUFPLENBQXlCO0lBQUcsQ0FBQztJQUV4RCxLQUFLLENBQUMsUUFBa0I7UUFDdEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLG9CQUFvQixFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDbkUsTUFBTSxTQUFTLEdBQUcsQ0FBQyxJQUFZLEVBQUUsSUFBa0MsRUFBRSxFQUFFO2dCQUNyRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztnQkFDbkMsTUFBTSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUVoRCxJQUFJLFNBQVMsSUFBSSxVQUFVLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUNoRCwyQ0FBMkM7b0JBQzNDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2lCQUMzRTtnQkFFRCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUMsQ0FBQztZQUVGLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNuRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXBCRCw0Q0FvQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQ29tcGlsZXIgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEhhc2hGb3JtYXQgfSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuZXhwb3J0IGludGVyZmFjZSBSZW1vdmVIYXNoUGx1Z2luT3B0aW9ucyB7XG4gIGNodW5rTmFtZXM6IHN0cmluZ1tdO1xuICBoYXNoRm9ybWF0OiBIYXNoRm9ybWF0O1xufVxuXG5leHBvcnQgY2xhc3MgUmVtb3ZlSGFzaFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogUmVtb3ZlSGFzaFBsdWdpbk9wdGlvbnMpIHt9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB7XG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKCdyZW1vdmUtaGFzaC1wbHVnaW4nLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IGFzc2V0UGF0aCA9IChwYXRoOiBzdHJpbmcsIGRhdGE6IHsgY2h1bms/OiB7IG5hbWU6IHN0cmluZyB9IH0pID0+IHtcbiAgICAgICAgY29uc3QgY2h1bmtOYW1lID0gZGF0YS5jaHVuaz8ubmFtZTtcbiAgICAgICAgY29uc3QgeyBjaHVua05hbWVzLCBoYXNoRm9ybWF0IH0gPSB0aGlzLm9wdGlvbnM7XG5cbiAgICAgICAgaWYgKGNodW5rTmFtZSAmJiBjaHVua05hbWVzPy5pbmNsdWRlcyhjaHVua05hbWUpKSB7XG4gICAgICAgICAgLy8gUmVwbGFjZSBoYXNoIGZvcm1hdHMgd2l0aCBlbXB0eSBzdHJpbmdzLlxuICAgICAgICAgIHJldHVybiBwYXRoLnJlcGxhY2UoaGFzaEZvcm1hdC5jaHVuaywgJycpLnJlcGxhY2UoaGFzaEZvcm1hdC5leHRyYWN0LCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgIH07XG5cbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmFzc2V0UGF0aC50YXAoJ3JlbW92ZS1oYXNoLXBsdWdpbicsIGFzc2V0UGF0aCk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==