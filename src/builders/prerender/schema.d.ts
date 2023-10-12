export interface Schema {
    /**
     * Target to build.
     */
    browserTarget: string;
    /**
     * Whether the builder should discover routers using the Angular Router.
     */
    discoverRoutes?: boolean;
    /**
     * The routes to render.
     */
    routes?: string[];
    /**
     * The path to a file containing routes separated by newlines.
     */
    routesFile?: string;
    /**
     * Server target to use for prerendering the app.
     */
    serverTarget: string;
}
