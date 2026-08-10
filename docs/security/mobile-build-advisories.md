# Mobile build-tool advisory exception

Last reviewed: 2026-08-11  
Next review: on every Expo patch upgrade, or by 2026-09-11

Expo SDK 57 currently resolves Metro's `image-size` dependency to a release affected by
GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq. npm expands these two findings across Expo,
React Native, Metro, and their build-time dependency paths, producing 11 high entries.

The parsers run in local/CI asset processing; they are not shipped as an application server
or reachable mobile runtime endpoint. MicroJobs uses repository-controlled image assets, and
untrusted uploads are validated by the server rather than processed by Metro.

There is no patched version compatible with the supported Expo SDK at this review date.
`npm audit fix --force` proposes downgrading to Expo 53 and React Native 0.72, which is not a
safe or supported fix. Transitive overrides are prohibited until Expo/Metro publishes a
compatible resolution.

`npm run check:security` keeps the exception visible and allows only advisory IDs 1138808 and
1138809 through the exact known Expo/Metro package paths. Any new critical advisory, high
runtime finding, package path, or advisory ID fails CI.
