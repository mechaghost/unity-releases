Captured from public Unity documentation on 2026-10-25:

- `hdrp-latest-redirect.html`: `https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@6.6/changelog/CHANGELOG.html` returned HTTP 200 at `https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@latest/`. Its HTML fallback link identifies HDRP 17.7.
- `package-manager-manual.html`: `https://docs.unity3d.com/Packages/com.unity.package-manager-ui@6.6/changelog/CHANGELOG.html` returned HTTP 200 at `https://docs.unity3d.com/Manual/upm-ui.html`, canonically the Unity 6000.6 Package Manager window reference.

These are real response bodies with line endings and trailing whitespace normalized. The parser reads HTML metadata and links; it does not execute embedded scripts.

Captured on 2026-10-27:
- `package-manager-manual-migrated.html`: the same Package Manager UI 6.6 changelog URL now returns HTTP 200 at `https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/upm-ui-window/upm-ui`. This response contains the rendered reference article, its title and markdown alternate link. The recognizer requires those together; client-only shells remain uncertain. The `.md` twin was also checked against the article during diagnosis.
