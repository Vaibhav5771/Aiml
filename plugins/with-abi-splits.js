/**
 * Split the release APK per CPU architecture.
 *
 * Expo's SDK 57 template generates no `splits` block, because the path it
 * expects is an AAB that Google Play splits for you. This build has no store
 * release (spec 0001), so the APKs are sideloaded and nobody is splitting
 * anything on our behalf: one universal APK carries four copies of the React
 * Native and Hermes native libraries, and every phone downloads three it can
 * never run.
 *
 * A CONFIG PLUGIN RATHER THAN AN EDIT TO `android/`. The root AGENTS.md rule
 * is that `android/` is generated and never hand edited, and it is a real rule
 * rather than a style preference: the directory is gitignored and the next
 * `expo prebuild` recreates it from scratch, so an edit made there is lost the
 * first time anyone regenerates the project, silently, with no diff to notice.
 * This runs as part of prebuild instead, so the splits survive.
 *
 * `universalApk false` on purpose: a universal APK beside the splits is the
 * thing this exists to avoid, and anyone who genuinely wants one can build
 * with `-PreactNativeArchitectures=<all four>` and no splits.
 *
 * NOT ENOUGH FOR A STORE UPLOAD. Google Play needs each split to carry its own
 * `versionCode`, which is an `applicationVariants` loop this does not write,
 * because an unused loop that nobody has tested against a real upload is worse
 * than its absence. Add it when there is a store to upload to.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

/** Kept in step with `reactNativeArchitectures` in `android/gradle.properties`. */
const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];

const SPLITS_BLOCK = `
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include ${ABIS.map((abi) => `"${abi}"`).join(', ')}
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-abi-splits expects a Groovy build.gradle');
    }

    // Idempotent: prebuild can run repeatedly, and a second copy of the block
    // is a Gradle syntax error rather than a no-op.
    if (cfg.modResults.contents.includes('splits {')) return cfg;

    // Anchored on `android {` at the start of a line, so this cannot match the
    // `android` inside a dependency coordinate or a comment.
    const anchor = /^android \{$/m;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error('with-abi-splits could not find the android { } block');
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(
      anchor,
      `android {\n${SPLITS_BLOCK}`,
    );

    return cfg;
  });
};
