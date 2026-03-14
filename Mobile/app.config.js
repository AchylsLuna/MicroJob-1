const expo = {
  name: 'mobile',
  slug: 'mobile',
  version: '1.0.0',
  platforms: ['ios', 'android', 'web'],
  extra: {
    eas: {
      projectId: 'd1b2d617-2132-4db6-828e-92b06ae42e6f',
    },
  },
  android: {
    package: 'com.bananas1.mobile',
  },
  plugins: [
    '@react-native-community/datetimepicker',
    'expo-notifications',
    'expo-font',
  ],
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
