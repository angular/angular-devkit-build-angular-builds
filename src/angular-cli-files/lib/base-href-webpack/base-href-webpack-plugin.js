"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
class BaseHrefWebpackPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        // Ignore if baseHref is not passed
        if (!this.options.baseHref && this.options.baseHref !== '') {
            return;
        }
        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
                // Check if base tag already exists
                const baseTagRegex = /<base.*?>/i;
                const baseTagMatches = htmlPluginData.html.match(baseTagRegex);
                if (!baseTagMatches) {
                    // Insert it in top of the head if not exist
                    htmlPluginData.html = htmlPluginData.html.replace(/<head>/i, '$&' + `<base href="${this.options.baseHref}">`);
                }
                else {
                    // Replace only href attribute if exists
                    const modifiedBaseTag = baseTagMatches[0].replace(/href="\S*?"/i, `href="${this.options.baseHref}"`);
                    htmlPluginData.html = htmlPluginData.html.replace(baseTagRegex, modifiedBaseTag);
                }
                callback(null, htmlPluginData);
            });
        });
    }
}
exports.BaseHrefWebpackPlugin = BaseHrefWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1ocmVmLXdlYnBhY2stcGx1Z2luLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9saWIvYmFzZS1ocmVmLXdlYnBhY2svYmFzZS1ocmVmLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7QUFDSCxpQkFBaUI7QUFDakIsK0RBQStEOztBQU0vRCxNQUFhLHFCQUFxQjtJQUNoQyxZQUE0QixPQUFxQztRQUFyQyxZQUFPLEdBQVAsT0FBTyxDQUE4QjtJQUFJLENBQUM7SUFFdEUsS0FBSyxDQUFDLFFBQWE7UUFDakIsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsS0FBSyxFQUFFLEVBQUU7WUFDMUQsT0FBTztTQUNSO1FBRUQsUUFBUSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxXQUFnQixFQUFFLEVBQUU7WUFDbEQsV0FBVyxDQUFDLE1BQU0sQ0FDaEIsNENBQTRDLEVBQzVDLENBQUMsY0FBbUIsRUFBRSxRQUFrQixFQUFFLEVBQUU7Z0JBQzFDLG1DQUFtQztnQkFDbkMsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDO2dCQUNsQyxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDL0QsSUFBSSxDQUFDLGNBQWMsRUFBRTtvQkFDbkIsNENBQTRDO29CQUM1QyxjQUFjLENBQUMsSUFBSSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUMvQyxTQUFTLEVBQUUsSUFBSSxHQUFHLGVBQWUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksQ0FDM0QsQ0FBQztpQkFDSDtxQkFBTTtvQkFDTCx3Q0FBd0M7b0JBQ3hDLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQy9DLGNBQWMsRUFBRSxTQUFTLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxHQUFHLENBQ2xELENBQUM7b0JBQ0YsY0FBYyxDQUFDLElBQUksR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUM7aUJBQ2xGO2dCQUVELFFBQVEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDakMsQ0FBQyxDQUNGLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxDRCxzREFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZUhyZWZXZWJwYWNrUGx1Z2luT3B0aW9ucyB7XG4gIGJhc2VIcmVmOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCYXNlSHJlZldlYnBhY2tQbHVnaW4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQmFzZUhyZWZXZWJwYWNrUGx1Z2luT3B0aW9ucykgeyB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IGFueSk6IHZvaWQge1xuICAgIC8vIElnbm9yZSBpZiBiYXNlSHJlZiBpcyBub3QgcGFzc2VkXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuYmFzZUhyZWYgJiYgdGhpcy5vcHRpb25zLmJhc2VIcmVmICE9PSAnJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbXBpbGVyLnBsdWdpbignY29tcGlsYXRpb24nLCAoY29tcGlsYXRpb246IGFueSkgPT4ge1xuICAgICAgY29tcGlsYXRpb24ucGx1Z2luKFxuICAgICAgICAnaHRtbC13ZWJwYWNrLXBsdWdpbi1iZWZvcmUtaHRtbC1wcm9jZXNzaW5nJyxcbiAgICAgICAgKGh0bWxQbHVnaW5EYXRhOiBhbnksIGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgIC8vIENoZWNrIGlmIGJhc2UgdGFnIGFscmVhZHkgZXhpc3RzXG4gICAgICAgICAgY29uc3QgYmFzZVRhZ1JlZ2V4ID0gLzxiYXNlLio/Pi9pO1xuICAgICAgICAgIGNvbnN0IGJhc2VUYWdNYXRjaGVzID0gaHRtbFBsdWdpbkRhdGEuaHRtbC5tYXRjaChiYXNlVGFnUmVnZXgpO1xuICAgICAgICAgIGlmICghYmFzZVRhZ01hdGNoZXMpIHtcbiAgICAgICAgICAgIC8vIEluc2VydCBpdCBpbiB0b3Agb2YgdGhlIGhlYWQgaWYgbm90IGV4aXN0XG4gICAgICAgICAgICBodG1sUGx1Z2luRGF0YS5odG1sID0gaHRtbFBsdWdpbkRhdGEuaHRtbC5yZXBsYWNlKFxuICAgICAgICAgICAgICAvPGhlYWQ+L2ksICckJicgKyBgPGJhc2UgaHJlZj1cIiR7dGhpcy5vcHRpb25zLmJhc2VIcmVmfVwiPmBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFJlcGxhY2Ugb25seSBocmVmIGF0dHJpYnV0ZSBpZiBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVkQmFzZVRhZyA9IGJhc2VUYWdNYXRjaGVzWzBdLnJlcGxhY2UoXG4gICAgICAgICAgICAgIC9ocmVmPVwiXFxTKj9cIi9pLCBgaHJlZj1cIiR7dGhpcy5vcHRpb25zLmJhc2VIcmVmfVwiYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGh0bWxQbHVnaW5EYXRhLmh0bWwgPSBodG1sUGx1Z2luRGF0YS5odG1sLnJlcGxhY2UoYmFzZVRhZ1JlZ2V4LCBtb2RpZmllZEJhc2VUYWcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGh0bWxQbHVnaW5EYXRhKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxufVxuIl19