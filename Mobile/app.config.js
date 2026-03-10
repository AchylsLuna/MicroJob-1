const { expo } = require('./app.json');

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
