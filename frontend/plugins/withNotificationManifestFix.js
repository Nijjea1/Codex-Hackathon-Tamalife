const { withAndroidManifest } = require("@expo/config-plugins");

// expo-notifications and @react-native-firebase/messaging both declare these
// Firebase meta-data with different values, which fails manifest merging. Adding
// tools:replace lets the app-level (expo-notifications) values win.
const TOOLS_REPLACE_BY_META = {
  "com.google.firebase.messaging.default_notification_channel_id": "android:value",
  "com.google.firebase.messaging.default_notification_color": "android:resource",
};

module.exports = function withNotificationManifestFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    const metaData = application?.["meta-data"];
    if (!metaData) return cfg;
    for (const meta of metaData) {
      const name = meta.$?.["android:name"];
      const attribute = TOOLS_REPLACE_BY_META[name];
      if (attribute) meta.$["tools:replace"] = attribute;
    }
    return cfg;
  });
};
