# Mobile build-tool advisory exception

Last reviewed: 2026-08-11
Next review: on every Expo patch upgrade, or by 2026-09-11

Expo SDK 54 currently resolves Metro's `image-size` dependency to a release affected by
GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq. It also resolves `postcss` to 8.4.49 through
`@expo/metro-config`, which is affected by GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q,
GHSA-r28c-9q8g-f849, and GHSA-fxqj-rqcc-2cmp. npm expands these findings across Expo,
React Native, Metro, and their build-time dependency paths, producing 11 high entries.

The parsers run in local/CI asset processing; they are not shipped as an application server
or reachable mobile runtime endpoint. MicroJobs uses repository-controlled image assets, and
untrusted uploads are validated by the server rather than processed by Metro.

There is no patched version compatible with the requested Expo SDK 54 at this review date.
`postcss` is constrained by Expo to `~8.4.32`, while its fixes are in newer release lines;
`npm audit fix --force` proposes incompatible Expo or React Native changes. Transitive
overrides are prohibited until Expo/Metro publishes a compatible resolution or the app moves
to a newer SDK.

`npm run check:security` keeps the exception visible and allows only advisory IDs 1117015,
1124252, 1124288, 1130709, 1138808, and 1138809 through the exact known Expo/Metro package
paths. Any new critical advisory, high runtime finding, package path, or advisory ID fails CI.
