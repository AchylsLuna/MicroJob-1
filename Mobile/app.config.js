const expo = {
  name: 'MicroJobs',
  slug: 'mobile',
  version: '1.0.0',
  splash: {
    image: './assets/microjobs-launch-logo.png',
    resizeMode: 'contain',
    backgroundColor: '#F7F8FA',
  },
  scheme: 'microjobs',
  plugins: [
    '@react-native-community/datetimepicker',
    'expo-font',
    'expo-secure-store',
    'expo-status-bar',
  ],
  platforms: ['ios', 'android', 'web'],
  android: {
    package: 'com.bananas1.mobile',
    versionCode: 1,
  },
  ios: {
    bundleIdentifier: 'com.bananas1.mobile',
    buildNumber: '1',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  extra: {
    eas: {
      projectId: 'd1b2d617-2132-4db6-828e-92b06ae42e6f',
    },
  },
};

module.exports = () => {
  if (process.env.EXPO_NO_IOS_SIMCTL_CHECK !== '1') {
    return expo;
  }

  const platforms = Array.isArray(expo.platforms) ? expo.platforms : [];

  return {
    ...expo,
    platforms: platforms.filter((platform) => platform !== 'ios'),
  };
};
