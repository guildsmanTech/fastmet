// Adds Chucker (Android HTTP inspector) to the native build.
// Only included from app.config.js when APP_VARIANT === "preview".
const {
  withAppBuildGradle,
  withMainApplication,
} = require("expo/config-plugins");

const CHUCKER_VERSION = "4.1.0";
const MARKER = "// @chucker";

const withChuckerGradle = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      `dependencies {
    ${MARKER}
    implementation("com.github.chuckerteam.chucker:library:${CHUCKER_VERSION}")`,
    );
    return cfg;
  });

const withChuckerInterceptor = (config) =>
  withMainApplication(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    if (cfg.modResults.language !== "kt") {
      throw new Error("withChucker: MainApplication must be Kotlin");
    }
    const anchor = /super\.onCreate\(\)/;
    if (!anchor.test(cfg.modResults.contents)) {
      throw new Error("withChucker: super.onCreate() not found in MainApplication");
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      anchor,
      `super.onCreate()
    ${MARKER}
    val chuckerContext = applicationContext
    val chucker = com.chuckerteam.chucker.api.ChuckerInterceptor.Builder(chuckerContext).build()
    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory(
      object : com.facebook.react.modules.network.OkHttpClientFactory {
        override fun createNewNetworkModuleClient(): okhttp3.OkHttpClient =
          com.facebook.react.modules.network.OkHttpClientProvider
            .createClientBuilder(chuckerContext)
            .addInterceptor(okhttp3.Interceptor { chain ->
              // Chucker reads the body to log it, but RN's multipart file parts
              // are one-shot streams, so the real upload would go out empty.
              if (chain.request().body?.contentType()?.type == "multipart") {
                chain.proceed(chain.request())
              } else {
                chucker.intercept(chain)
              }
            })
            .build()
      }
    )`,
    );
    return cfg;
  });

module.exports = (config) => withChuckerInterceptor(withChuckerGradle(config));
