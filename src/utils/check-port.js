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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2stcG9ydC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2NoZWNrLXBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx1Q0FBa0M7QUFDbEMseUNBQTJCO0FBQzNCLCtCQUE4QjtBQUU5QixTQUFTLGdCQUFnQixDQUFDLElBQVk7SUFDcEMsT0FBTyxJQUFJLEtBQUssQ0FBQyxRQUFRLElBQUksK0RBQStELENBQUMsQ0FBQztBQUNoRyxDQUFDO0FBRU0sS0FBSyxVQUFVLFNBQVMsQ0FBQyxJQUFZLEVBQUUsSUFBWTtJQUN4RCxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7UUFDZCxPQUFPLENBQUMsQ0FBQztLQUNWO0lBRUQsT0FBTyxJQUFJLE9BQU8sQ0FBUyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUM3QyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFbEMsTUFBTTthQUNILElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUEwQixFQUFFLEVBQUU7WUFDNUMsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtnQkFDN0IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUVaLE9BQU87YUFDUjtZQUVELElBQUksQ0FBQyxXQUFLLEVBQUU7Z0JBQ1YsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBRS9CLE9BQU87YUFDUjtZQUVELElBQUEsaUJBQU0sRUFBQztnQkFDTCxJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsY0FBYztnQkFDcEIsT0FBTyxFQUFFLFFBQVEsSUFBSSw4REFBOEQ7Z0JBQ25GLE9BQU8sRUFBRSxJQUFJO2FBQ2QsQ0FBQyxDQUFDLElBQUksQ0FDTCxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQ2pGLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNyQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO2FBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUU7WUFDdEIsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hCLENBQUMsQ0FBQzthQUNELE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBdENELDhCQXNDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBwcm9tcHQgfSBmcm9tICdpbnF1aXJlcic7XG5pbXBvcnQgKiBhcyBuZXQgZnJvbSAnbmV0JztcbmltcG9ydCB7IGlzVFRZIH0gZnJvbSAnLi90dHknO1xuXG5mdW5jdGlvbiBjcmVhdGVJblVzZUVycm9yKHBvcnQ6IG51bWJlcik6IEVycm9yIHtcbiAgcmV0dXJuIG5ldyBFcnJvcihgUG9ydCAke3BvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBVc2UgJy0tcG9ydCcgdG8gc3BlY2lmeSBhIGRpZmZlcmVudCBwb3J0LmApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0KHBvcnQ6IG51bWJlciwgaG9zdDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgaWYgKHBvcnQgPT09IDApIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG5cbiAgICBzZXJ2ZXJcbiAgICAgIC5vbmNlKCdlcnJvcicsIChlcnI6IE5vZGVKUy5FcnJub0V4Y2VwdGlvbikgPT4ge1xuICAgICAgICBpZiAoZXJyLmNvZGUgIT09ICdFQUREUklOVVNFJykge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1RUWSkge1xuICAgICAgICAgIHJlamVjdChjcmVhdGVJblVzZUVycm9yKHBvcnQpKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb21wdCh7XG4gICAgICAgICAgdHlwZTogJ2NvbmZpcm0nLFxuICAgICAgICAgIG5hbWU6ICd1c2VEaWZmZXJlbnQnLFxuICAgICAgICAgIG1lc3NhZ2U6IGBQb3J0ICR7cG9ydH0gaXMgYWxyZWFkeSBpbiB1c2UuXFxuV291bGQgeW91IGxpa2UgdG8gdXNlIGEgZGlmZmVyZW50IHBvcnQ/YCxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICB9KS50aGVuKFxuICAgICAgICAgIChhbnN3ZXJzKSA9PiAoYW5zd2Vycy51c2VEaWZmZXJlbnQgPyByZXNvbHZlKDApIDogcmVqZWN0KGNyZWF0ZUluVXNlRXJyb3IocG9ydCkpKSxcbiAgICAgICAgICAoKSA9PiByZWplY3QoY3JlYXRlSW5Vc2VFcnJvcihwb3J0KSksXG4gICAgICAgICk7XG4gICAgICB9KVxuICAgICAgLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgc2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHJlc29sdmUocG9ydCk7XG4gICAgICB9KVxuICAgICAgLmxpc3Rlbihwb3J0LCBob3N0KTtcbiAgfSk7XG59XG4iXX0=