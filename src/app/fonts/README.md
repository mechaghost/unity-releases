# Local brand fonts

Inter and JetBrains Mono are self-hosted; page rendering needs no font-service requests.

- Inter variable: https://github.com/google/fonts/tree/main/ofl/inter
- JetBrains Mono variable: https://github.com/google/fonts/tree/main/ofl/jetbrainsmono
- Inter ExtraBold static: Google Fonts CSS endpoint `https://fonts.googleapis.com/css2?family=Inter:wght@800` (2026-10-24). Static TTF is used by the Open Graph renderer, which did not render the variable font successfully.

Each family has its SIL Open Font License alongside the fonts. `next/font/local` loads variable fonts for the UI. The OG route reads the static face on the server.
