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
exports.createAngularCompilation = void 0;
const environment_options_1 = require("../../../../utils/environment-options");
/**
 * Creates an Angular compilation object that can be used to perform Angular application
 * compilation either for AOT or JIT mode. By default a parallel compilation is created
 * that uses a Node.js worker thread.
 * @param jit True, for Angular JIT compilation; False, for Angular AOT compilation.
 * @returns An instance of an Angular compilation object.
 */
async function createAngularCompilation(jit) {
    if (environment_options_1.useParallelTs) {
        const { ParallelCompilation } = await Promise.resolve().then(() => __importStar(require('./parallel-compilation')));
        return new ParallelCompilation(jit);
    }
    if (jit) {
        const { JitCompilation } = await Promise.resolve().then(() => __importStar(require('./jit-compilation')));
        return new JitCompilation();
    }
    else {
        const { AotCompilation } = await Promise.resolve().then(() => __importStar(require('./aot-compilation')));
        return new AotCompilation();
    }
}
exports.createAngularCompilation = createAngularCompilation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9jb21waWxhdGlvbi9mYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0VBQXNFO0FBR3RFOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSx3QkFBd0IsQ0FBQyxHQUFZO0lBQ3pELElBQUksbUNBQWEsRUFBRTtRQUNqQixNQUFNLEVBQUUsbUJBQW1CLEVBQUUsR0FBRyx3REFBYSx3QkFBd0IsR0FBQyxDQUFDO1FBRXZFLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNyQztJQUVELElBQUksR0FBRyxFQUFFO1FBQ1AsTUFBTSxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLG1CQUFtQixHQUFDLENBQUM7UUFFN0QsT0FBTyxJQUFJLGNBQWMsRUFBRSxDQUFDO0tBQzdCO1NBQU07UUFDTCxNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsd0RBQWEsbUJBQW1CLEdBQUMsQ0FBQztRQUU3RCxPQUFPLElBQUksY0FBYyxFQUFFLENBQUM7S0FDN0I7QUFDSCxDQUFDO0FBaEJELDREQWdCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyB1c2VQYXJhbGxlbFRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IEFuZ3VsYXJDb21waWxhdGlvbiB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBBbmd1bGFyIGNvbXBpbGF0aW9uIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHRvIHBlcmZvcm0gQW5ndWxhciBhcHBsaWNhdGlvblxuICogY29tcGlsYXRpb24gZWl0aGVyIGZvciBBT1Qgb3IgSklUIG1vZGUuIEJ5IGRlZmF1bHQgYSBwYXJhbGxlbCBjb21waWxhdGlvbiBpcyBjcmVhdGVkXG4gKiB0aGF0IHVzZXMgYSBOb2RlLmpzIHdvcmtlciB0aHJlYWQuXG4gKiBAcGFyYW0gaml0IFRydWUsIGZvciBBbmd1bGFyIEpJVCBjb21waWxhdGlvbjsgRmFsc2UsIGZvciBBbmd1bGFyIEFPVCBjb21waWxhdGlvbi5cbiAqIEByZXR1cm5zIEFuIGluc3RhbmNlIG9mIGFuIEFuZ3VsYXIgY29tcGlsYXRpb24gb2JqZWN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlQW5ndWxhckNvbXBpbGF0aW9uKGppdDogYm9vbGVhbik6IFByb21pc2U8QW5ndWxhckNvbXBpbGF0aW9uPiB7XG4gIGlmICh1c2VQYXJhbGxlbFRzKSB7XG4gICAgY29uc3QgeyBQYXJhbGxlbENvbXBpbGF0aW9uIH0gPSBhd2FpdCBpbXBvcnQoJy4vcGFyYWxsZWwtY29tcGlsYXRpb24nKTtcblxuICAgIHJldHVybiBuZXcgUGFyYWxsZWxDb21waWxhdGlvbihqaXQpO1xuICB9XG5cbiAgaWYgKGppdCkge1xuICAgIGNvbnN0IHsgSml0Q29tcGlsYXRpb24gfSA9IGF3YWl0IGltcG9ydCgnLi9qaXQtY29tcGlsYXRpb24nKTtcblxuICAgIHJldHVybiBuZXcgSml0Q29tcGlsYXRpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB7IEFvdENvbXBpbGF0aW9uIH0gPSBhd2FpdCBpbXBvcnQoJy4vYW90LWNvbXBpbGF0aW9uJyk7XG5cbiAgICByZXR1cm4gbmV3IEFvdENvbXBpbGF0aW9uKCk7XG4gIH1cbn1cbiJdfQ==