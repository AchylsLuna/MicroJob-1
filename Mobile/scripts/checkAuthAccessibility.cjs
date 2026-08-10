'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const files = [
  'components/auth/AuthControls.tsx',
  'components/auth/AuthScreenLayout.tsx',
  'components/auth/AuthStepCard.tsx',
  'pages/OnboardingCarouselScreen.tsx',
  'pages/signIn.tsx',
  'pages/signUp.tsx',
  'pages/verifyEmail.tsx',
  'pages/forgotPass.tsx',
  'pages/createPass.tsx',
  'pages/passChanged.tsx',
  'pages/signSuccess.tsx',
];

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  if (/maxFontSizeMultiplier\s*=/.test(source)) failures.push(`${file}: caps system text scaling`);
  if (/numberOfLines\s*=/.test(source)) failures.push(`${file}: truncates authentication text`);
}

const appSource = fs.readFileSync(path.join(projectRoot, 'app.jsx'), 'utf8');
if (!/gestureEnabled:\s*true/.test(appSource) || !/fullScreenGestureEnabled:\s*true/.test(appSource)) {
  failures.push('app.jsx: native stack back gestures are not enabled');
}

const onboarding = fs.readFileSync(path.join(projectRoot, 'pages/OnboardingCarouselScreen.tsx'), 'utf8');
if (!/horizontal[\s\S]*pagingEnabled/.test(onboarding) || !/handlePrevious/.test(onboarding)) {
  failures.push('OnboardingCarouselScreen.tsx: two-way paging/back behavior is missing');
}

if (failures.length) {
  console.error(`Auth accessibility checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Auth accessibility checks passed across ${files.length} responsive screens and components.`);
