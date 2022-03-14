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
exports.checkPort = void 0;
const inquirer_1 = require("inquirer");
const net = __importStar(require("net"));
const tty_1 = require("./tty");
function createInUseError(port) {
    return new Error(`Port ${port} is already in use. Use '--port' to specify a different port.`);
}
async function checkPort(port, host) {
    if (port === 0) {
        return 0;
    }
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server
            .once('error', (err) => {
            if (err.code !== 'EADDRINUSE') {
                reject(err);
                return;
            }
            if (!tty_1.isTTY) {
                reject(createInUseError(port));
                return;
            }
            (0, inquirer_1.prompt)({
                type: 'confirm',
                name: 'useDifferent',
                message: `Port ${port} is already in use.\nWould you like to use a different port?`,
                default: true,
            }).then((answers) => (answers.useDifferent ? resolve(0) : reject(createInUseError(port))), () => reject(createInUseError(port)));
        })
            .once('listening', () => {
            server.close();
            resolve(port);
        })
            .listen(port, host);
    });
}
exports.checkPort = checkPort;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2stcG9ydC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2NoZWNrLXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUFrQztBQUNsQyx5Q0FBMkI7QUFDM0IsK0JBQThCO0FBRTlCLFNBQVMsZ0JBQWdCLENBQUMsSUFBWTtJQUNwQyxPQUFPLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSwrREFBK0QsQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFTSxLQUFLLFVBQVUsU0FBUyxDQUFDLElBQVksRUFBRSxJQUFZO0lBQ3hELElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtRQUNkLE9BQU8sQ0FBQyxDQUFDO0tBQ1Y7SUFFRCxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVsQyxNQUFNO2FBQ0gsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQTBCLEVBQUUsRUFBRTtZQUM1QyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFO2dCQUM3QixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRVosT0FBTzthQUNSO1lBRUQsSUFBSSxDQUFDLFdBQUssRUFBRTtnQkFDVixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFFL0IsT0FBTzthQUNSO1lBRUQsSUFBQSxpQkFBTSxFQUFDO2dCQUNMLElBQUksRUFBRSxTQUFTO2dCQUNmLElBQUksRUFBRSxjQUFjO2dCQUNwQixPQUFPLEVBQUUsUUFBUSxJQUFJLDhEQUE4RDtnQkFDbkYsT0FBTyxFQUFFLElBQUk7YUFDZCxDQUFDLENBQUMsSUFBSSxDQUNMLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFDakYsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQ3JDLENBQUM7UUFDSixDQUFDLENBQUM7YUFDRCxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtZQUN0QixNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEIsQ0FBQyxDQUFDO2FBQ0QsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUF0Q0QsOEJBc0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IHByb21wdCB9IGZyb20gJ2lucXVpcmVyJztcbmltcG9ydCAqIGFzIG5ldCBmcm9tICduZXQnO1xuaW1wb3J0IHsgaXNUVFkgfSBmcm9tICcuL3R0eSc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUluVXNlRXJyb3IocG9ydDogbnVtYmVyKTogRXJyb3Ige1xuICByZXR1cm4gbmV3IEVycm9yKGBQb3J0ICR7cG9ydH0gaXMgYWxyZWFkeSBpbiB1c2UuIFVzZSAnLS1wb3J0JyB0byBzcGVjaWZ5IGEgZGlmZmVyZW50IHBvcnQuYCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja1BvcnQocG9ydDogbnVtYmVyLCBob3N0OiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuICBpZiAocG9ydCA9PT0gMCkge1xuICAgIHJldHVybiAwO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKTtcblxuICAgIHNlcnZlclxuICAgICAgLm9uY2UoJ2Vycm9yJywgKGVycjogTm9kZUpTLkVycm5vRXhjZXB0aW9uKSA9PiB7XG4gICAgICAgIGlmIChlcnIuY29kZSAhPT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzVFRZKSB7XG4gICAgICAgICAgcmVqZWN0KGNyZWF0ZUluVXNlRXJyb3IocG9ydCkpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbXB0KHtcbiAgICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgICAgbmFtZTogJ3VzZURpZmZlcmVudCcsXG4gICAgICAgICAgbWVzc2FnZTogYFBvcnQgJHtwb3J0fSBpcyBhbHJlYWR5IGluIHVzZS5cXG5Xb3VsZCB5b3UgbGlrZSB0byB1c2UgYSBkaWZmZXJlbnQgcG9ydD9gLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgIH0pLnRoZW4oXG4gICAgICAgICAgKGFuc3dlcnMpID0+IChhbnN3ZXJzLnVzZURpZmZlcmVudCA/IHJlc29sdmUoMCkgOiByZWplY3QoY3JlYXRlSW5Vc2VFcnJvcihwb3J0KSkpLFxuICAgICAgICAgICgpID0+IHJlamVjdChjcmVhdGVJblVzZUVycm9yKHBvcnQpKSxcbiAgICAgICAgKTtcbiAgICAgIH0pXG4gICAgICAub25jZSgnbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgICBzZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgcmVzb2x2ZShwb3J0KTtcbiAgICAgIH0pXG4gICAgICAubGlzdGVuKHBvcnQsIGhvc3QpO1xuICB9KTtcbn1cbiJdfQ==