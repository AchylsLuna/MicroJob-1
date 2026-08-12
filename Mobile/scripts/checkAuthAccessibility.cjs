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

const signedInHeader = fs.readFileSync(path.join(projectRoot, 'components/TabTopNav.tsx'), 'utf8');
const logoSource = fs.readFileSync(path.join(projectRoot, 'components/auth/MicroJobsLogo.tsx'), 'utf8');
if (!/AnimatedMicroJobsLogoBadge/.test(signedInHeader) || !/useReducedMotion/.test(logoSource)) {
  failures.push('Signed-in header: animated reduced-motion-aware MicroJobs branding is missing');
}

const dashboardSource = fs.readFileSync(path.join(projectRoot, 'pages/pages1/dashboard.tsx'), 'utf8');
if (!/onSelectCategory/.test(dashboardSource) || !/onUploadResume/.test(dashboardSource)) {
  failures.push('dashboard.tsx: category and resume cards are not connected to focused actions');
}

for (const file of ['components/navigation.tsx', 'components/employerNavigation.tsx']) {
  const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
  if (/profileInitials\s*=\s*['"]JD['"]/.test(source)) {
    failures.push(`${file}: uses a hard-coded profile identity`);
  }
  if (!/useAppSession/.test(source) || !/getUserInitials/.test(source) || !/isNavigationTabActive/.test(source)) {
    failures.push(`${file}: authenticated identity or normalized active-tab state is missing`);
  }
}

const sessionSource = fs.readFileSync(path.join(projectRoot, 'contexts/AppSessionContext.tsx'), 'utf8');
if (!/refreshUnreadMessages/.test(sessionSource) || !/messages\/conversations/.test(sessionSource)) {
  failures.push('AppSessionContext.tsx: database-backed unread message reconciliation is missing');
}

const tabNavigationSource = fs.readFileSync(path.join(projectRoot, 'components/tabNavigation.ts'), 'utf8');
if (!/WORKER_TABS/.test(tabNavigationSource) || !/EMPLOYER_TABS/.test(tabNavigationSource) || !/getParent/.test(tabNavigationSource)) {
  failures.push('tabNavigation.ts: canonical role tabs or parent-aware routing is missing');
}
if (!/navigateToRoleTab/.test(appSource) || /onTabPress=\{\(tab\)\s*=>\s*navigation\.navigate\(['"](?:Worker|Employer)Tabs['"]/.test(appSource)) {
  failures.push('app.jsx: tab presses bypass the canonical role-aware navigator');
}

for (const file of [
  'pages/pages1/dashboard.tsx',
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
