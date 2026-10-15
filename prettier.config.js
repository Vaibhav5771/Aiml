/**
 * Prettier, configured to match the code that already exists rather than to
 * impose its own defaults over it.
 *
 * Both overrides below were measured, not picked. The codebase had 196 single
 * quoted imports and zero double quoted ones, and 282 lines sitting between 81
 * and 100 characters, which is code written to a 100 column width that
 * Prettier's default of 80 would have rewrapped end to end. Everything else is
 * left at the default on purpose: the fewer opinions recorded here, the less
 * there is to argue about later.
 *
 * One default was looked at and deliberately kept rather than just inherited.
 * `trailingComma` is `all`, so a comma follows the last function argument too,
 * which the hand written code did not do. It was kept because adding an
 * argument then touches one line instead of two, which makes a later diff
 * easier to read. Setting it to `es5` would restore the older look.
 *
 * Formatting is enforced through ESLint rather than as a separate gate, which
 * is what Expo's SDK 57 lint guide documents. That keeps `npx expo lint` the
 * single command `AGENTS.md` asks every task to pass.
 */
module.exports = {
  printWidth: 100,
  singleQuote: true,
};
