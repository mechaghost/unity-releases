// Bump these whenever the corresponding parser changes its normalized
// projection. Stored rows retain their original version so a backfill can
// distinguish historical output from data produced by the current parser.
// 2026-08-06: package-change parsing now captures "Packages added" /
// "Packages no longer available" / version-less deprecations, which the
// ^-anchored id regex silently dropped (prod held 0 added/removed rows).
// The bump makes backfill-unity6 re-walk and fill them in.
export const EDITOR_RELEASE_PARSER_VERSION = "2026-08-06";
export const LEGACY_LTS_PARSER_VERSION = `${EDITOR_RELEASE_PARSER_VERSION}-legacy-lts`;
export const PACKAGE_REGISTRY_PARSER_VERSION = "2026-06-12";
