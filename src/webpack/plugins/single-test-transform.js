"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleTestTransformLoader = void 0;
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
exports.SingleTestTransformLoader = __filename;
/**
 * This loader transforms the default test file to only run tests
 * for some specs instead of all specs.
 * It works by replacing the known content of the auto-generated test file:
 *   const context = require.context('./', true, /\.spec\.ts$/);
 *   context.keys().map(context);
 * with:
 *   const context = { keys: () => ({ map: (_a) => { } }) };
 *   context.keys().map(context);
 * So that it does nothing.
 * Then it adds import statements for each file in the files options
 * array to import them directly, and thus run the tests there.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loader(source) {
    const { files = [], logger = console } = this.getOptions();
    // signal the user that expected content is not present.
    if (!source.includes('require.context(')) {
        logger.error(core_1.tags.stripIndent `The 'include' option requires that the 'main' file for tests includes the below line:
      const context = require.context('./', true, /\.spec\.ts$/);
      Arguments passed to require.context are not strict and can be changed.`);
        return source;
    }
    const targettedImports = files
        .map((path) => `require('./${path.replace('.' + (0, path_1.extname)(path), '')}');`)
        .join('\n');
    const mockedRequireContext = 'Object.assign(() => { }, { keys: () => [], resolve: () => undefined });\n';
    source = source.replace(/require\.context\(.*/, mockedRequireContext + targettedImports);
    return source;
}
exports.default = loader;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2luZ2xlLXRlc3QtdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3NpbmdsZS10ZXN0LXRyYW5zZm9ybS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQ0FBcUQ7QUFDckQsK0JBQStCO0FBUWxCLFFBQUEseUJBQXlCLEdBQUcsVUFBVSxDQUFDO0FBRXBEOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILDhEQUE4RDtBQUM5RCxTQUF3QixNQUFNLENBRTVCLE1BQWM7SUFFZCxNQUFNLEVBQUUsS0FBSyxHQUFHLEVBQUUsRUFBRSxNQUFNLEdBQUcsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQzNELHdEQUF3RDtJQUN4RCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO1FBQ3hDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBSSxDQUFDLFdBQVcsQ0FBQTs7NkVBRTRDLENBQUMsQ0FBQztRQUUzRSxPQUFPLE1BQU0sQ0FBQztLQUNmO0lBRUQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLO1NBQzNCLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsY0FBYyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFBLGNBQU8sRUFBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDO1NBQ3ZFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVkLE1BQU0sb0JBQW9CLEdBQ3hCLDJFQUEyRSxDQUFDO0lBQzlFLE1BQU0sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLHNCQUFzQixFQUFFLG9CQUFvQixHQUFHLGdCQUFnQixDQUFDLENBQUM7SUFFekYsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQXZCRCx5QkF1QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgbG9nZ2luZywgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IGludGVyZmFjZSBTaW5nbGVUZXN0VHJhbnNmb3JtTG9hZGVyT3B0aW9ucyB7XG4gIC8qIGxpc3Qgb2YgcGF0aHMgcmVsYXRpdmUgdG8gdGhlIGVudHJ5LXBvaW50ICovXG4gIGZpbGVzPzogc3RyaW5nW107XG4gIGxvZ2dlcj86IGxvZ2dpbmcuTG9nZ2VyO1xufVxuXG5leHBvcnQgY29uc3QgU2luZ2xlVGVzdFRyYW5zZm9ybUxvYWRlciA9IF9fZmlsZW5hbWU7XG5cbi8qKlxuICogVGhpcyBsb2FkZXIgdHJhbnNmb3JtcyB0aGUgZGVmYXVsdCB0ZXN0IGZpbGUgdG8gb25seSBydW4gdGVzdHNcbiAqIGZvciBzb21lIHNwZWNzIGluc3RlYWQgb2YgYWxsIHNwZWNzLlxuICogSXQgd29ya3MgYnkgcmVwbGFjaW5nIHRoZSBrbm93biBjb250ZW50IG9mIHRoZSBhdXRvLWdlbmVyYXRlZCB0ZXN0IGZpbGU6XG4gKiAgIGNvbnN0IGNvbnRleHQgPSByZXF1aXJlLmNvbnRleHQoJy4vJywgdHJ1ZSwgL1xcLnNwZWNcXC50cyQvKTtcbiAqICAgY29udGV4dC5rZXlzKCkubWFwKGNvbnRleHQpO1xuICogd2l0aDpcbiAqICAgY29uc3QgY29udGV4dCA9IHsga2V5czogKCkgPT4gKHsgbWFwOiAoX2EpID0+IHsgfSB9KSB9O1xuICogICBjb250ZXh0LmtleXMoKS5tYXAoY29udGV4dCk7XG4gKiBTbyB0aGF0IGl0IGRvZXMgbm90aGluZy5cbiAqIFRoZW4gaXQgYWRkcyBpbXBvcnQgc3RhdGVtZW50cyBmb3IgZWFjaCBmaWxlIGluIHRoZSBmaWxlcyBvcHRpb25zXG4gKiBhcnJheSB0byBpbXBvcnQgdGhlbSBkaXJlY3RseSwgYW5kIHRodXMgcnVuIHRoZSB0ZXN0cyB0aGVyZS5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGxvYWRlcihcbiAgdGhpczogaW1wb3J0KCd3ZWJwYWNrJykuTG9hZGVyQ29udGV4dDxTaW5nbGVUZXN0VHJhbnNmb3JtTG9hZGVyT3B0aW9ucz4sXG4gIHNvdXJjZTogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgeyBmaWxlcyA9IFtdLCBsb2dnZXIgPSBjb25zb2xlIH0gPSB0aGlzLmdldE9wdGlvbnMoKTtcbiAgLy8gc2lnbmFsIHRoZSB1c2VyIHRoYXQgZXhwZWN0ZWQgY29udGVudCBpcyBub3QgcHJlc2VudC5cbiAgaWYgKCFzb3VyY2UuaW5jbHVkZXMoJ3JlcXVpcmUuY29udGV4dCgnKSkge1xuICAgIGxvZ2dlci5lcnJvcih0YWdzLnN0cmlwSW5kZW50YFRoZSAnaW5jbHVkZScgb3B0aW9uIHJlcXVpcmVzIHRoYXQgdGhlICdtYWluJyBmaWxlIGZvciB0ZXN0cyBpbmNsdWRlcyB0aGUgYmVsb3cgbGluZTpcbiAgICAgIGNvbnN0IGNvbnRleHQgPSByZXF1aXJlLmNvbnRleHQoJy4vJywgdHJ1ZSwgL1xcLnNwZWNcXC50cyQvKTtcbiAgICAgIEFyZ3VtZW50cyBwYXNzZWQgdG8gcmVxdWlyZS5jb250ZXh0IGFyZSBub3Qgc3RyaWN0IGFuZCBjYW4gYmUgY2hhbmdlZC5gKTtcblxuICAgIHJldHVybiBzb3VyY2U7XG4gIH1cblxuICBjb25zdCB0YXJnZXR0ZWRJbXBvcnRzID0gZmlsZXNcbiAgICAubWFwKChwYXRoKSA9PiBgcmVxdWlyZSgnLi8ke3BhdGgucmVwbGFjZSgnLicgKyBleHRuYW1lKHBhdGgpLCAnJyl9Jyk7YClcbiAgICAuam9pbignXFxuJyk7XG5cbiAgY29uc3QgbW9ja2VkUmVxdWlyZUNvbnRleHQgPVxuICAgICdPYmplY3QuYXNzaWduKCgpID0+IHsgfSwgeyBrZXlzOiAoKSA9PiBbXSwgcmVzb2x2ZTogKCkgPT4gdW5kZWZpbmVkIH0pO1xcbic7XG4gIHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKC9yZXF1aXJlXFwuY29udGV4dFxcKC4qLywgbW9ja2VkUmVxdWlyZUNvbnRleHQgKyB0YXJnZXR0ZWRJbXBvcnRzKTtcblxuICByZXR1cm4gc291cmNlO1xufVxuIl19