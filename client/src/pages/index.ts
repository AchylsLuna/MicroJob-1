// Main pages index - organized by user type
export * from './worker';
export * from './employer';
export * from './shared';

// Re-export commonly used pages for easier access
export { default as Dashboard } from './Dashboard';
export { default as FindJobs } from './FindJobs';
export { default as Settings } from './Settings';
export { default as Home } from './Home';
export { default as SignIn } from './signIn';
export { default as SignUp } from './signUp';
export { default as JobDetails } from './JobDetails';
export { default as EWallet } from './EWallet';
export { default as TopupSuccess } from './topupSuccess';
