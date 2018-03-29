"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Observable_1 = require("rxjs/Observable");
const portfinder = require('portfinder');
function checkPort(port, host, basePort = 49152) {
    return new Observable_1.Observable(obs => {
        portfinder.basePort = basePort;
        // tslint:disable:no-any
        portfinder.getPort({ port, host }, (err, foundPort) => {
            if (err) {
                obs.error(err);
            }
            else if (port !== foundPort && port !== 0) {
                // If the port isn't available and we weren't looking for any port, throw error.
                obs.error(`Port ${port} is already in use. Use '--port' to specify a different port.`);
            }
            else {
                // Otherwise, our found port is good.
                obs.next(foundPort);
                obs.complete();
            }
        });
    });
}
exports.checkPort = checkPort;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2stcG9ydC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL2NoZWNrLXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCxnREFBNkM7QUFDN0MsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBR3pDLG1CQUEwQixJQUFZLEVBQUUsSUFBWSxFQUFFLFFBQVEsR0FBRyxLQUFLO0lBQ3BFLE1BQU0sQ0FBQyxJQUFJLHVCQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDMUIsVUFBVSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDL0Isd0JBQXdCO1FBQ3hCLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxHQUFRLEVBQUUsU0FBaUIsRUFBRSxFQUFFO1lBQ2pFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqQixDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVDLGdGQUFnRjtnQkFDaEYsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksK0RBQStELENBQUMsQ0FBQztZQUN6RixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04scUNBQXFDO2dCQUNyQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNwQixHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDakIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBakJELDhCQWlCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5jb25zdCBwb3J0ZmluZGVyID0gcmVxdWlyZSgncG9ydGZpbmRlcicpO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja1BvcnQocG9ydDogbnVtYmVyLCBob3N0OiBzdHJpbmcsIGJhc2VQb3J0ID0gNDkxNTIpOiBPYnNlcnZhYmxlPG51bWJlcj4ge1xuICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICBwb3J0ZmluZGVyLmJhc2VQb3J0ID0gYmFzZVBvcnQ7XG4gICAgLy8gdHNsaW50OmRpc2FibGU6bm8tYW55XG4gICAgcG9ydGZpbmRlci5nZXRQb3J0KHsgcG9ydCwgaG9zdCB9LCAoZXJyOiBhbnksIGZvdW5kUG9ydDogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgfSBlbHNlIGlmIChwb3J0ICE9PSBmb3VuZFBvcnQgJiYgcG9ydCAhPT0gMCkge1xuICAgICAgICAvLyBJZiB0aGUgcG9ydCBpc24ndCBhdmFpbGFibGUgYW5kIHdlIHdlcmVuJ3QgbG9va2luZyBmb3IgYW55IHBvcnQsIHRocm93IGVycm9yLlxuICAgICAgICBvYnMuZXJyb3IoYFBvcnQgJHtwb3J0fSBpcyBhbHJlYWR5IGluIHVzZS4gVXNlICctLXBvcnQnIHRvIHNwZWNpZnkgYSBkaWZmZXJlbnQgcG9ydC5gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE90aGVyd2lzZSwgb3VyIGZvdW5kIHBvcnQgaXMgZ29vZC5cbiAgICAgICAgb2JzLm5leHQoZm91bmRQb3J0KTtcbiAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuIl19