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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndexOutputFile = exports.getRoutes = void 0;
const fs = __importStar(require("fs"));
const guess_parser_1 = require("guess-parser");
const path = __importStar(require("path"));
const error_1 = require("../../utils/error");
/**
 * Returns the union of routes, the contents of routesFile if given,
 * and the static routes extracted if guessRoutes is set to true.
 */
async function getRoutes(options, tsConfigPath, context) {
    let routes = options.routes || [];
    const { logger, workspaceRoot } = context;
    if (options.routesFile) {
        const routesFilePath = path.join(workspaceRoot, options.routesFile);
        routes = routes.concat(fs
            .readFileSync(routesFilePath, 'utf8')
            .split(/\r?\n/)
            .filter((v) => !!v));
    }
    if (options.guessRoutes && tsConfigPath) {
        try {
            routes = routes.concat((0, guess_parser_1.parseAngularRoutes)(path.join(workspaceRoot, tsConfigPath))
                .map((routeObj) => routeObj.path)
                .filter((route) => !route.includes('*') && !route.includes(':')));
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            logger.error('Unable to extract routes from application.', { ...e });
        }
    }
    routes = routes.map((r) => (r === '' ? '/' : r));
    return [...new Set(routes)];
}
exports.getRoutes = getRoutes;
/**
 * Returns the name of the index file outputted by the browser builder.
 */
function getIndexOutputFile(options) {
    if (typeof options.index === 'string') {
        return path.basename(options.index);
    }
    else {
        return options.index.output || 'index.html';
    }
}
exports.getIndexOutputFile = getIndexOutputFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLSCx1Q0FBeUI7QUFDekIsK0NBQWtEO0FBQ2xELDJDQUE2QjtBQUM3Qiw2Q0FBa0Q7QUFLbEQ7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLFNBQVMsQ0FDN0IsT0FBZ0MsRUFDaEMsWUFBZ0MsRUFDaEMsT0FBdUI7SUFFdkIsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUM7SUFDbEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDMUMsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQ3RCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FDcEIsRUFBRTthQUNDLFlBQVksQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDO2FBQ3BDLEtBQUssQ0FBQyxPQUFPLENBQUM7YUFDZCxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDdEIsQ0FBQztLQUNIO0lBRUQsSUFBSSxPQUFPLENBQUMsV0FBVyxJQUFJLFlBQVksRUFBRTtRQUN2QyxJQUFJO1lBQ0YsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQ3BCLElBQUEsaUNBQWtCLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUM7aUJBQ3ZELEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztpQkFDaEMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQ25FLENBQUM7U0FDSDtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBQSxxQkFBYSxFQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWpCLE1BQU0sQ0FBQyxLQUFLLENBQUMsNENBQTRDLEVBQUUsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDdEU7S0FDRjtJQUVELE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVqRCxPQUFPLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzlCLENBQUM7QUFsQ0QsOEJBa0NDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixrQkFBa0IsQ0FBQyxPQUE4QjtJQUMvRCxJQUFJLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDckMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNyQztTQUFNO1FBQ0wsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUM7S0FDN0M7QUFDSCxDQUFDO0FBTkQsZ0RBTUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJztcbmltcG9ydCB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBwYXJzZUFuZ3VsYXJSb3V0ZXMgfSBmcm9tICdndWVzcy1wYXJzZXInO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbnR5cGUgUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMgPSBTY2hlbWEgJiBqc29uLkpzb25PYmplY3Q7XG5cbi8qKlxuICogUmV0dXJucyB0aGUgdW5pb24gb2Ygcm91dGVzLCB0aGUgY29udGVudHMgb2Ygcm91dGVzRmlsZSBpZiBnaXZlbixcbiAqIGFuZCB0aGUgc3RhdGljIHJvdXRlcyBleHRyYWN0ZWQgaWYgZ3Vlc3NSb3V0ZXMgaXMgc2V0IHRvIHRydWUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRSb3V0ZXMoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICB0c0NvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIGxldCByb3V0ZXMgPSBvcHRpb25zLnJvdXRlcyB8fCBbXTtcbiAgY29uc3QgeyBsb2dnZXIsIHdvcmtzcGFjZVJvb3QgfSA9IGNvbnRleHQ7XG4gIGlmIChvcHRpb25zLnJvdXRlc0ZpbGUpIHtcbiAgICBjb25zdCByb3V0ZXNGaWxlUGF0aCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnJvdXRlc0ZpbGUpO1xuICAgIHJvdXRlcyA9IHJvdXRlcy5jb25jYXQoXG4gICAgICBmc1xuICAgICAgICAucmVhZEZpbGVTeW5jKHJvdXRlc0ZpbGVQYXRoLCAndXRmOCcpXG4gICAgICAgIC5zcGxpdCgvXFxyP1xcbi8pXG4gICAgICAgIC5maWx0ZXIoKHYpID0+ICEhdiksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmd1ZXNzUm91dGVzICYmIHRzQ29uZmlnUGF0aCkge1xuICAgIHRyeSB7XG4gICAgICByb3V0ZXMgPSByb3V0ZXMuY29uY2F0KFxuICAgICAgICBwYXJzZUFuZ3VsYXJSb3V0ZXMocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHRzQ29uZmlnUGF0aCkpXG4gICAgICAgICAgLm1hcCgocm91dGVPYmopID0+IHJvdXRlT2JqLnBhdGgpXG4gICAgICAgICAgLmZpbHRlcigocm91dGUpID0+ICFyb3V0ZS5pbmNsdWRlcygnKicpICYmICFyb3V0ZS5pbmNsdWRlcygnOicpKSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgYXNzZXJ0SXNFcnJvcihlKTtcblxuICAgICAgbG9nZ2VyLmVycm9yKCdVbmFibGUgdG8gZXh0cmFjdCByb3V0ZXMgZnJvbSBhcHBsaWNhdGlvbi4nLCB7IC4uLmUgfSk7XG4gICAgfVxuICB9XG5cbiAgcm91dGVzID0gcm91dGVzLm1hcCgocikgPT4gKHIgPT09ICcnID8gJy8nIDogcikpO1xuXG4gIHJldHVybiBbLi4ubmV3IFNldChyb3V0ZXMpXTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBpbmRleCBmaWxlIG91dHB1dHRlZCBieSB0aGUgYnJvd3NlciBidWlsZGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5pbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gcGF0aC5iYXNlbmFtZShvcHRpb25zLmluZGV4KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb3B0aW9ucy5pbmRleC5vdXRwdXQgfHwgJ2luZGV4Lmh0bWwnO1xuICB9XG59XG4iXX0=