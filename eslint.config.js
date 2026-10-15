// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  /*
   * Formatting is reported as an ESLint rule, which is the setup Expo's SDK 57
   * lint guide documents. It is deliberately not a second gate: `AGENTS.md`
   * asks every task to pass `npx expo lint` and `npx tsc --noEmit`, and this
   * keeps formatting inside the first of those rather than adding a third
   * command that is easy to forget.
   *
   * `eslint-plugin-prettier/recommended` also pulls in `eslint-config-prettier`,
   * which turns off any ESLint rule that would argue with Prettier, so the two
   * can never disagree about the same line.
   *
   * Run `npm run format` to fix what this reports. That is Prettier directly
   * and is much faster than `expo lint --fix` on the whole project.
   */
  prettierRecommended,
  {
    ignores: ['dist/*', '.agents/*', '.expo/*'],
  },
]);
