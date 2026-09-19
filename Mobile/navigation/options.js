/**
 * Screen options shared by every navigator.
 *
 * Extracted from app.jsx so the stacks can live in their own files without
 * each redefining the app's motion contract.
 */
export const hiddenTabs = {
  headerShown: false,
  tabBarStyle: { display: 'none' },
  animation: 'fade',
};

export const stackMotion = {
  headerShown: false,
  animation: 'slide_from_right',
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};
