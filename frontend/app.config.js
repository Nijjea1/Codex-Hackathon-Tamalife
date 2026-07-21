module.exports = ({ config }) => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const notificationMode =
    !buildProfile || buildProfile === "development" ? "development" : "production";

  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICE_INFO_PLIST ?? "./GoogleService-Info.plist",
    },
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
    plugins: config.plugins?.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== "expo-notifications") return plugin;
      return [plugin[0], { ...plugin[1], mode: notificationMode }];
    }),
  };
};
