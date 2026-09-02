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

const signedInHeader = fs.readFileSync(path.join(projectRoot, 'components/TabTopNav.tsx'), 'utf8');
const logoSource = fs.readFileSync(path.join(projectRoot, 'components/auth/MicroJobsLogo.tsx'), 'utf8');
if (!/AnimatedMicroJobsLogoBadge/.test(signedInHeader) || !/useReducedMotion/.test(logoSource)) {
  failures.push('Signed-in header: animated reduced-motion-aware MicroJobs branding is missing');
}
if (!/subtitleIcon/.test(signedInHeader) || !/onSubtitlePress/.test(signedInHeader) || !/homeContext/.test(signedInHeader)) {
  failures.push('Signed-in header: local Home context and location action are missing');
}

for (const file of ['components/navigation.tsx', 'components/employerNavigation.tsx']) {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  if (/profileInitials\s*=\s*['"]JD['"]/.test(source)) {
    failures.push(`${file}: uses a hard-coded profile identity`);
  }
  if (!/useAppSession/.test(source) || !/session\.navigationProfileInitials/.test(source) || !/isNavigationTabActive/.test(source)) {
    failures.push(`${file}: authenticated identity or normalized active-tab state is missing`);
  }
  if (/profileInitials\?:/.test(source)) {
    failures.push(`${file}: allows a screen to override the authenticated navigation identity`);
  }
}

const sessionSource = fs.readFileSync(path.join(projectRoot, 'contexts/AppSessionContext.tsx'), 'utf8');
if (!/refreshUnreadMessages/.test(sessionSource) || !/messages\/conversations/.test(sessionSource)) {
  failures.push('AppSessionContext.tsx: database-backed unread message reconciliation is missing');
}
if (!/role === 'employer' \|\| role === 'both'/.test(sessionSource) || !/canSwitchAccountMode = normalizeRole\(userRole\) === 'both'/.test(sessionSource)) {
  failures.push('AppSessionContext.tsx: worker, employer, and Both account-mode eligibility is inconsistent');
}
if (!/setNavigationProfileInitials\(getUserInitials\(nextUser\)\)/.test(sessionSource)
  || !/currentToken !== token/.test(sessionSource)
  || !/authenticatedUserId !== nextUserId/.test(sessionSource)) {
  failures.push('AppSessionContext.tsx: authenticated navigation identity is not stable across tabs and stale profile responses');
}

const signUpSource = fs.readFileSync(path.join(projectRoot, 'pages/signUp.tsx'), 'utf8');
if (!/value:\s*['"]work['"]/.test(signUpSource)
  || !/value:\s*['"]hire['"]/.test(signUpSource)
  || !/value:\s*['"]both['"]/.test(signUpSource)) {
  failures.push('signUp.tsx: worker, employer, and Both choices are required');
}
const settingsSource = fs.readFileSync(path.join(projectRoot, 'pages/pages1/Settings.tsx'), 'utf8');
if (!/canSwitchAccountMode/.test(settingsSource) || !/settings\.modeCard\.sectionLabel/.test(settingsSource)) {
  failures.push('Settings.tsx: Both-account mode switching is missing');
}
for (const file of ['pages/pages1/Profile.tsx', 'pages/employer/EmployerProfile.tsx']) {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  if (/showModeSwitch|canSwitchRole|onSwitchRole/.test(source)) failures.push(`${file}: account-mode switching must remain in Settings only`);
}

const tabNavigationSource = fs.readFileSync(path.join(projectRoot, 'components/tabNavigation.ts'), 'utf8');
if (!/WORKER_TABS/.test(tabNavigationSource) || !/EMPLOYER_TABS/.test(tabNavigationSource) || !/getParent/.test(tabNavigationSource)) {
  failures.push('tabNavigation.ts: canonical role tabs or parent-aware routing is missing');
}
if (!/navigateToRoleTab/.test(appSource) || /onTabPress=\{\(tab\)\s*=>\s*navigation\.navigate\(['"](?:Worker|Employer)Tabs['"]/.test(appSource)) {
  failures.push('app.jsx: tab presses bypass the canonical role-aware navigator');
}

for (const file of [
  'pages/pages1/Jobs.tsx',
  'pages/pages1/AppliedJobs.tsx',
  'pages/pages1/SavedJobs.tsx',
  'pages/pages1/Profile.tsx',
]) {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  if (/useState\(externalActiveTab|useState\(activeTab\s*\|\|/.test(source)) {
    failures.push(`${file}: duplicates navigator-owned active-tab state`);
  }
}

if (failures.length) {
  console.error(`Auth accessibility checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Auth accessibility checks passed across ${files.length} responsive screens and components.`);
