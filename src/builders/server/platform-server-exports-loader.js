"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
/**
 * This loader is needed to add additional exports and is a workaround for a Webpack bug that doesn't
 * allow exports from multiple files in the same entry.
 * @see https://github.com/webpack/webpack/issues/15936.
 */
function default_1(content, map) {
    const { angularSSRInstalled } = this.getOptions();
    let source = `${content}

  // EXPORTS added by @angular-devkit/build-angular
  export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';
  `;
    if (angularSSRInstalled) {
        source += `
      export { ɵgetRoutesFromAngularRouterConfig } from '@angular/ssr';
    `;
    }
    this.callback(null, source, map);
    return;
}
