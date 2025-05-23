/**
 * ng-packagr target options for Build Architect. Use to build library projects.
 */
export type Schema = {
    /**
     * Enable and define the file watching poll time period in milliseconds.
     */
    poll?: number;
    /**
     * The file path for the ng-packagr configuration file, relative to the current workspace.
     */
    project: string;
    /**
     * The full path for the TypeScript configuration file, relative to the current workspace.
     */
    tsConfig?: string;
    /**
     * Run build when files change.
     */
    watch?: boolean;
};
