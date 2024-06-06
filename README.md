
# Snapshot build of @angular-devkit/build-angular

This repository is a snapshot of a commit on the original repository. The original code used to
generate this is located at http://github.com/angular/angular-cli.

We do not accept PRs or Issues opened on this repository. You should not use this over a tested and
released version of this package.

To test this snapshot in your own project, use

```bash
npm install git+https://github.com/angular/angular-devkit-build-angular-builds.git
```

----
# @angular-devkit/build-angular

This package contains [Architect builders](/packages/angular_devkit/architect/README.md) used to build and test Angular applications and libraries.

## Builders

| Name            | Description                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| application     | Build an Angular application targeting a browser and server environment using [esbuild](https://esbuild.github.io).                                                                                     |
| app-shell       | Build an Angular [App shell](https://angular.dev/ecosystem/service-workers/app-shell).                                                                                                                  |
| browser         | Build an Angular application targeting a browser environment using [Webpack](https://webpack.js.org).                                                                                                   |
| browser-esbuild | Build an Angular application targeting a browser environment using [esbuild](https://esbuild.github.io).                                                                                                |
| dev-server      | A development server that provides live reloading.                                                                                                                                                      |
| extract-i18n    | Extract i18n messages from an Angular application.                                                                                                                                                      |
| karma           | Execute unit tests using [Karma](https://github.com/karma-runner/karma) test runner.                                                                                                                    |
| ng-packagr      | Build and package an Angular library in [Angular Package Format (APF)](https://angular.dev/tools/libraries/angular-package-format) format using [ng-packagr](https://github.com/ng-packagr/ng-packagr). |
| prerender       | [Prerender](https://angular.dev/guide/prerendering) pages of your application. Prerendering is the process where a dynamic page is processed at build time generating static HTML.                      |
| server          | Build an Angular application targeting a [Node.js](https://nodejs.org) environment.                                                                                                                     |
| ssr-dev-server  | A development server which offers live reload during development, but uses server-side rendering.                                                                                                       |
| protractor      | **Deprecated** - Run end-to-end tests using [Protractor](https://www.protractortest.org/) framework.                                                                                                    |

## Disclaimer

While the builders when executed via the Angular CLI and their associated options are considered stable, the programmatic APIs are not considered officially supported and are not subject to the breaking change guarantees of SemVer.
