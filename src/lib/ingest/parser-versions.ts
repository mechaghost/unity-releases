// Bump these whenever the corresponding parser changes its normalized
// projection. Stored rows retain their original version so a backfill can
// distinguish historical output from data produced by the current parser.
export const EDITOR_RELEASE_PARSER_VERSION = "2026-06-12";
export const LEGACY_LTS_PARSER_VERSION = `${EDITOR_RELEASE_PARSER_VERSION}-legacy-lts`;
export const PACKAGE_REGISTRY_PARSER_VERSION = "2026-06-12";
