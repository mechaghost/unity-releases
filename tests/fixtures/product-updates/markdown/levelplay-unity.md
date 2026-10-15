# LevelPlay SDK Changelog

> Review the latest updates and improvements in the Unity SDK, including initialization flow changes and support for adaptive banners.

> **Tip:**
>
> **AI-assisted integration:** The LevelPlay Unity Integration Skill gives AI coding agents step-by-step guidance for integrating, updating, or migrating to this package. It's built into Unity AI Assistant and available for Claude Code, GitHub Copilot, Cursor, and other agents from the [Unity Skills repository](https://github.com/Unity-Technologies/skills/tree/main/skills/levelplay-unity-integration). To provide feedback, [complete the survey](https://docs.google.com/forms/d/e/1FAIpQLSe7WvWozJ67KjgOLglSBvLug8JdgEYk895nn_BHZs0HS_bWJA/viewform).

| Unity Package | LevelPlay SDK | Release Date | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 9.5.1         | 9.6.0         | 2026/08/19   | * Wraps Android 9.6.0 SDK and iOS 9.6.0 SDK.
* (Android) Fixed an Application Not Responding (ANR) error that could occur when banner, interstitial, or rewarded ad callbacks were delivered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9.5.0         | 9.6.0         | 2026/08/13   | - Wraps Android 9.6.0 SDK and iOS 9.6.0 SDK.
- Improved the SDK initialization functionality for greater resilience under poor network conditions.
- Reduced SDK initialization time.
- (Android) Updated the SDK to Kotlin 2.1.21 to align with current toolchain requirements.
- (Android) Fixed an issue that prevented loading Yandex’s banner ad format.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9.5.0         | 9.5.0         | 2026/07/01   | * Wraps Android 9.5.0 SDK and iOS 9.5.0 SDK.

* Introduced important updates to the Impression-Level Revenue (ILR) API to strengthen data governance and standardize access to sensitive revenue data:
  * Deprecated: `ImpressionDataReadyEvent(LevelPlayImpressionData impressionData)`
  * Replaced with: `OnInterstitialImpressionDataReady(LevelPlayImpressionData impressionData)`

* Updated the GDPR consent API to accept a boolean value applied across all networks. Passing a per-network map is now deprecated.

* Apple: Now requires build with xCode 26+ and min iOS version 13.

* Crash fixes: related to `ConcurrentModificationException` in `AdUnitEventsWrapper.sendEvent` and `NullPointerException` during WebController initialization `(iAdsInitThreadOptimization)`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9.4.1         | 9.4.4 / 9.4.2 | 2026/06/22   | - Wraps Android 9.4.4 SDK and iOS 9.4.2 SDK.

- Improved iSX (ironSource Exchange) SDK reliability to prevent edge-case failures and ensure correct behavior across supported mediation and privacy workflows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9.4.1         | 9.4.4 / 9.4.1 | 2026/06/17   | * Wraps Android 9.4.4 SDK and iOS 9.4.1 SDK.

* Improved iSX (ironSource Exchange) SDK reliability to prevent edge-case failures and ensure correct behavior across supported mediation and privacy workflows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9.4.1         | 9.4.3         | 2026/05/25   | - Wraps Android 9.4.3 SDK and iOS 9.4.1 SDK.

- Fixed a Google Play upload blocker issue caused by `PackageManager.getInstalledApplications(0)`.

- Fixed a fullscreen ad issue where some ad networks trigger `onAdClosed` before `onAdDisplayed`. In affected cases, the ad instance could remain stuck for the remainder of the app session, which caused the following issues:
  * `isAdReady()` returned `NotReady("ad is showing")`
  * `show()` returned `ERROR_CODE_SHOW_WHILE_SHOW`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9.4.1         | 9.4.2         | 2026/05/06   | * Wraps Android 9.4.2 SDK and iOS 9.4.1 SDK.
* Fixed a threading issue that could lead to increased ANR (Application Not Responding) rates during SDK initialization and ad loading caused by `IronSourceThreadManager.postOnUiThreadTask`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9.4.1         | 9.4.1         | 2026/04/30   | - Wraps Android 9.4.1 SDK and iOS 9.4.1 SDK.

- Fixed first-install timing so native dependencies install automatically without needing the LevelPlay Network Manager to be opened first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 9.4.0         | 9.4.1         | 2026/04/28   | * Wraps Android 9.4.1 SDK and iOS 9.4.1 SDK.

* Fixed a `java.lang.ArrayIndexOutOfBoundsException` crash caused by a mismatch between the networks configured on the LevelPlay platform and the adapters integrated in the app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9.4.0         | 9.4.0         | 2026/04/08   | - Wraps Android 9.4.0 SDK and iOS 9.4.0 SDK.

- Introduced a new `LevelPlayPrivacySettings` class and dedicated APIs to simplify the management of privacy settings, including `setGDPRConsents`, `setCCPA`, `setCOPPA`. Refer to the [Regulation advanced settings for Unity](/grow/levelplay/sdk/unity/regulation-advanced-settings.md) for updated information on implementing GDPR, CCPA, and child-directed app privacy consent.

- Deprecated the use of `LevelPlay.setMetaData` for `do_not_sell`, `is_child_directed`, and `LevelPlay.setConsent` in favor of the new privacy APIs.

- Added support for Meta testing within the [Integration Testing Suite](/grow/levelplay/sdk/unity/integration-test-suite.md).

- Fixed a crash in the Banner view caused by an `IllegalStateException` in Android.

- Fixed JavaDoc not working for LevelPlay APIs in Android.

- Fixed a crash related to `NSInvalidArgumentException` in iOS.                                                                                                                                                                                                                                                                       |
| 9.3.2         | 9.6.0         | 2026/09/25   | * Wraps Android 9.6.0 SDK and iOS 9.6.0 SDK.

* (iOS) Fixed the `LevelPlay.SetNetworkData` API so the network key is now passed correctly to the native SDK. This completes the fix released in 9.3.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9.3.1         | 9.6.0         | 2026/09/10   | - Wraps Android 9.6.0 SDK and iOS 9.6.0 SDK.

- (Android) Fixed an Application Not Responding (ANR) error that could occur when banner, interstitial, or rewarded ad callbacks were delivered.

- (iOS) Fixed the `LevelPlay.SetNetworkData` API so the network key is now passed correctly to the native SDK. Previously, network data set through this API had no effect on iOS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9.3.0         | 9.3.0         | 2026/01/20   | * Wraps Android 9.3.0 SDK and iOS 9.3.0 SDK.

* Publishers can now use a new API to easily get rewarded ad details (value/type) before the ad loads or shows. This improves the user experience by enabling accurate pre-display of reward info (for example, on "Get Reward" buttons). The API prioritizes placement-level rewards, falling back to ad unit-level rewards. This replaces the removed `IronSource.getRewardedVideoPlacementInfo` API.

* Enhanced fallback logic to optimize fill rate.

* Updated targetSdkVersion and compileSdkVersion in the SDK to 36 (Android).

* Fixed an issue where using iOS 26 would write logs as \<private> (iOS).

* Implemented various bug fixes, improved overall SDK performance, and reduced the SDK's footprint.

* **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                       |
| 9.2.0         | 9.2.0         | 2025/11/26   | - Wraps Android 9.2.0 SDK and iOS 9.2.0 SDK.

- Show Recovery – New fallback logic to optimize fill rate. This improvement provides a backup ad in the rare case where the first ad attempted to be shown fails.

- Fixed ANR when networks were running on UI thread (Android).

- Fixed crash on IronSourceThreadManager (Android).

- **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9.2.0         | 9.1.0         | 2025/11/19   | * Wraps Android 9.1.0 SDK and iOS 9.1.0 SDK.

* Added the ability to remove an uninstalled partner network adapter in Network Manager.

* A new “update all” button in Network Manager performs all available partner network adapter updates at a time.

* Partner networks with adapters installed are now displayed above uninstalled networks in Network Manager.

* Addressed an issue where the AdMob Android App ID entered into Developer Settings > Mediated Network Settings in versions 9.0.0-9.1.0 would not be successfully applied.

* **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9.1.0         | 9.1.0         | 2025/11/05   | - Wraps Android 9.1.0 SDK and iOS 9.1.0 SDK.

- Support creative ID enrichment from ad networks adapters.

- Fixed app hanging issue related to setBrowserUserAgent (iOS).

- Resolved banner auto-refresh issue with SwiftUI (iOS).

- Fixed crash during banner load failure (iOS).

- Resolved memory leaks in full screen ads (iOS).

- Fixed ANR issue with setMetaData on main thread (Android).

- **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9.1.0         | 9.0.0         | 2025/11/03   | * Wraps Android 9.0.0 SDK and iOS 9.0.0 SDK.

* iOS SKAdNetwork ID automation is now enabled by default for all fresh installs of the Unity package.

* The Ads Mediation menu has been organized for easier access to tools and guidance.

* **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9.0.1         | 9.0.0         | 2025/10/22   | - Wraps Android 9.0.0 SDK and iOS 9.0.0 SDK.

- Addressed an issue where values entered into Developer Settings > LevelPlay Mediation Settings in version 9.0.0 would not be successfully applied.

- **Important:** Upgrading to this version from a Unity package version lower than 9.0.0 requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 9.0.0         | 9.0.0         | 2025/09/22   | * Wraps Android 9.0.0 SDK and iOS 9.0.0 SDK.

* All public-facing APIs have been refactored from IronSource to LevelPlay for enhanced clarity and consistency.

* Deprecated APIs have been removed. For more info, refer to the full list of API changes.

* Automatic update of the Unity Ads adapter version when the LevelPlay Unity package is updated.

* The LevelPlay.Init method has been simplified, removing ad format parameters.

* Ad units are now created using new config classes.

* The OnAdDisplayFailed event now provides distinct LevelPlayAdInfo and LevelPlayAdError parameters.

* **Important:** Upgrading to this version requires additional steps to migrate smoothly. Refer to the Migration Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8.10.2        | 8.12.0        | 2025/10/28   | - Wraps Android 8.12.0 SDK and iOS 8.12.0 SDK.

- Restored support for the Server-to-Server API; setRewardedVideoServerParameters.

- Multiple bug fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 8.10.2        | 8.11.1        | 2025/10/15   | * Wraps Android 8.11.1 SDK and iOS 8.11.1 SDK.

* Fixed an issue where the AdInfo callback for iOS banners always returned a size of 320×50 regardless of actual size.

* Resolved an error in Config, where building and passing a config using LevelPlayBannerAd default settings could result in a crash.

* Addressed an issue where onImpressionDataReadyEvent could run on the main thread instead of a background thread as intended.

* Updated the deprecation message for IronSource.Agent.SetPauseGame to clarify how to use the API successfully when initializing with legacy IronSource APIs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8.10.1        | 8.11.1        | 2025/09/03   | - Wraps Android 8.11.1 SDK and iOS 8.11.0 SDK.

- Added support for Rewarded Server-to-Server parameters in setMetaData. This new functionality replaces the previously deprecated setRewardedVideoServerParams. (iOS, Android)

- AdInfo Constructor Deprecation: The constructor of the AdInfo class is now deprecated. Adjust your implementations accordingly. (iOS, Android)

- AdInfo callback now returns “Placement” for Banners. (iOS, Android)

- Fix the increase at Banner Load Failed callback with empty error message, started on SDK 8.8.0. (iOS, Android)

- Updated targetSdkVersion and compiledSdkVersion in the SDK and adapters to 35. (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8.10.1        | 8.10.0        | 2025/07/30   | * Wraps Android 8.10.0 SDK and iOS 8.10.0 SDK.

* Resolved an issue impacting Unity package versions 8.9.0 and 8.10.0, related to LevelPlayImpressionData API postbacks returning an incorrect revenue value.

* Added ironSource Ads StoreKit ad network identifiers to the SKAdNetwork ID automation feature.

* Added a deprecation notice for LevelPlayAdFormat, which will be removed in the next major version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8.10.0        | 8.10.0        | 2025/07/07   | - Wraps Android 8.10.0 SDK and iOS 8.10.0 SDK.

- Updated the Mobile Dependency Resolver to improve the functionality of dependency resolution in newer Editor versions.

- Resolved an issue impacting Unity iOS applications using the LevelPlay Rewarded API, to ensure the correct amount is rewarded when an ad is shown.

- Resolved an ANR issue. (Android)

- Fixed an issue related to missing ad close callbacks (received after video completions). (Android)

- Fixed a crash related to LPMFullscreenAdUnit.didFailToDisplayAd. (iOS)

- Fixed a crash related to ISAuctionHandler. (iOS)

- Fixed a crash occurring in iOS Webview. (iAds, iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8.9.0         | 8.9.1         | 2025/06/16   | • Wraps Android 8.9.1 SDK and iOS 8.9.1 SDK.&#xA;• Added the ability to preview how banner, interstitial, and rewarded ads will appear in the application without leaving the project, using mock ads. Learn more&#xA;• Decreased the minimum iOS deployment version from iOS 13 to iOS 12.&#xA;• Added support for setting price limits when using the new LevelPlay APIs.&#xA;• Marked legacy ironSource APIs for deprecation in a future version and introduced new LevelPlay APIs.&#xA;• Updated the Unity Demo Scene/Sample with the latest API changes.&#xA;• Resolved an issue with legacy rewarded ads, where callbacks would not be triggered and the test log would not be printed when the manual configuration was set to false.**Important:** As part of SDK 9.0.0 some APIs will be deprecated. Learn more                                                                                                                                                                                                                                                                                                                                                                                           |
| 8.8.1         | 8.8.0         | 2025/04/08   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 8.8.0 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.8.0 SDK

* Improve banner refresh rate accuracy when using Multiple Ad Units APIs.

* **Note**: This may change the refresh rate as experienced by users today.

* Fix AdInfo callbacks alignment with ILR postbacks for banners in Multiple Ad Units APIs

* Fix duplicate callbacks for rewarded ads in Multiple Ad Units APIs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 8.8.1         | 8.7.0         | 2025/04/03   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.7.0 SDK

- The Unity Ads network is now part of LevelPlay and will be installed by default when integrating or updating the LevelPlay Unity package.

- Introduced a new feature to automatically add the SKAdNetwork IDs for installed networks into the application's Info.plist file.

- Added additional positions for banner ads (all types), as well as the ability to specify the position as a custom (x,y) coordinate.

- Added support for determining the width and height of an adaptive banner before loading the banner using LevelPlayAdSize.

- Updated the initialization flow of Developer Settings (LevelPlay Mediation Settings and Mediated Network Settings) to use the new LevelPlay.Init method.

- Updated the Unity Demo App and Sample to include additional & custom banner positions.                                                                                                                                                                                                                                                           |
| 8.7.0         | 8.7.0         | 2025/02/24   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.7.0 SDK

* Added deprecation notices to legacy APIs, classes under /Runtime/Platforms, and com.unity3d.levelplay namespace.

* Updated the Unity Demo Scene and Demo App with the latest API changes.

* Added an identifier to each ad object created under Ad Unit API integration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8.6.0         | 8.7.0         | 2025/02/12   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.7.0 SDK

- Add an identifier to each ad object created under Ad Unit API integration

- Improve performance for rewarded ads under Ad Units APIs

- Add Xcode 16.1 support (iOS)

- Change the minimum supported iOS version to iOS 13

- Fix crashes for iOS 17 users

- Fix a bug related to custom networks display in Test Suite (iOS)

- Add support for Target SDK Version 34 on Android

- Reduce memory leaks after viewing interstitial ads (Android)

- Fix crash after using payer segment with Ad Unit APIs (Android)

- Fix reporting of warning message airplane\_mode\_on (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8.6.0         | 8.6.2         | 2025/01/28   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.6.1 SDK

* Fix banner refresh logic when using short intervals for Ad Units APIs

* Fix missing LevelPlayAdInfo data when loading the first banner using Ad Units APIs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8.6.0         | 8.6.1         | 2025/01/17   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.6.1 SDK

- Add Creative ID as part of ILR callbacks

- Fix an issue related to incorrect banner position                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8.5.1         | 8.6.1         | 2025/01/13   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.6.1 SDK

* Bug fix related to Multiple Ad Units support for full screen ads (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8.5.1         | 8.6.0         | 2025/01/06   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.6.0 SDK

- Performance improvements for Rewarded Ads when using the Ad Units APIs

- Reduce load time of banner and interstitial ads when using the Ad Units APIs

- Add Creative ID as part of ILR callbacks

- Fix Pause API to be supported before and after Load (prevent auto refresh of banner ads)

- Prevent banner automatic refresh in Test Suite

- Support Kotlin version 1.8.22 (Android)

- SDK requires min Xcode 16 (iOS)

- Improve release memory logic (Android)

- Fix a bug, allow Account and App Level Info to be shared correctly with custom adapters (iOS)

- Fix a bug, related to duplicate NURL reporting, when using the Ad Unit APIs (iOS)

- Resolved an issue where a banner could be loaded but not visible in the Test Suite (iOS)                                                                                                                                                                                                                                                                                                        |
| 8.5.1         | 8.5.1         | 2024/12/11   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.5.0 SDK

* Fix a potential bug that might degrade performance when using Multiple Ad Unit APIs on SDK 8.3.0+ (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8.5.1         | 8.5.0         | 2024/12/02   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.5.0 SDK

- Removed deprecation message from OnInitSuccess and OnInitFailed events.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8.5.0         | 8.5.0         | 2024/11/21   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.5.0 SDK

* Rewarded support for multiple ad units (alpha)

* Integration test suite support for Rewarded multiple ad units

* LevelPlay Ad Info callbacks will support estimated CPM for the Google network. The Impression data callback (ILR) will continue to include the exact bid

* Add setPauseGame API support for Multiple Ad Units flow

* Update Unity demo app to support the Multiple Ad Unit APIs for banner and interstitial ads

* Update Open Measurement SDK version to 1.5.2 (iOS)

* Xcode 16 support

* Android Maven Central repository will include all LevelPlay versions 7.9.0+, Ad Quality versions 7.19.2+. [Learn more](/grow/levelplay/sdk/unity/maven-central-migration-guide.md)

* Update Google Play services ads identifier to 18.1.0, to resolve AndroidX fragment problem (Android)

* Add deprecation notice to the Age and Gender segment APIs

* Add deprecation notice to interstitial APIs without Ad Unit param

* Fix potential crashes related to Test Suite (Android)                                                           |
| 8.4.1         | 8.4.0         | 2024/10/08   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.4.0 SDK

- Fix a bug experienced in LevelPlay Network Manager, when upgrading the SDK to 8.4.0

- **Important**: For Windows users: if you integrated Unity Plugin version 8.4.0 and you are unable to update your Unity package from the LevelPlay Network Manager, update to the latest version by downloading it [here](/grow/levelplay/sdk/unity/package-integration.md) and importing it into your project                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8.4.0         | 8.4.0         | 2024/09/26   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.4.0 SDK

* Support for adapter ranges: each ad network adapter will now be compatible with a range of ironSource SDK versions. Learn more [here](/grow/levelplay/sdk/unity/adapter-range-support.md)

* Improve the LevelPlay Network Manager experience

* Impression data API will include ad\_format, ad\_unit\_name and ad\_unit\_id, add deprecation to ad\_unit parameter (replaced by ad\_format)

* LevelPlayAdInfo update to include getAdUnitName

* Improve interstitial loading when using LevelPlay with Ad Unit API

* Add Deprecation to banner APIs without Ad Unit param (ironSource package)

* Added iOS support for Xcode 15.4.

* Android SDK artifacts will be hosted on MavenCentral and eventually fully migrate from IS.com. [Learn more](/grow/levelplay/sdk/unity/maven-central-migration-guide.md)

* Fixed a bug preventing Banner iOS for being refreshed when using LevelPlay with Ad Unit API

* Fixed a bug related to event reporting on iOS when using LevelPlay with Ad Unit API

* Improve ANRs related to SDK initialization (Android) |
| 8.3.0         | 8.3.0         | 2024/08/22   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.3.0 SDK

- Bug fix related to loading MREC when using LevelPlay Banner API (with Ad Unit ID) for Android

- Introduce new APIs for LevelPlay interstitial ads supporting multiple ad units (Alpha)

- Introduce a new API **SetNetworkData** to share key-value information directly with networks' adapters.

- Added Android display cutout support for banners when using multiple ad units (Android)

- Eliminated a potential crash that could occur when invoking virtual method 'void android.view\.View\.requestLayout()' on a null object reference (Android)

- Resolved an issue where exiting the Test Suite on iOS could lead to a crash (iOS)

- Resolved an issue that could cause a Google Bidding adaptive banner to briefly appear in the incorrect position on an iPhone. Problem started from SDK 8.0.0 (iOS)

- **Important**: This version has a known issue with banner refresh for iOS apps and is not supported for Multiple Ad Units banners                                                                                                       |
| 8.2.0         | 8.2.1         | 2024/07/18   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.2.1 SDK

* Bug fix related to loading MREC when using LevelPlay Banner API (with Ad Unit ID) for Android                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8.2.0         | 8.2.0         | 2024/07/11   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.2.0 SDK

- Improve adaptive banner integration

- Fixed a potential crash in IronSourceBannerEvents caused by a NullReferenceException.

- Resolved an issue where changing the Android banner position mid-session did not change as necessary.

- Fixed the RewardedVideoAdOpenedEvent incorrectly firing for RewardedVideoOnAdShowFailedEvent in the LevelPlay Sample.

- Fixed potential wrong log values related to TCF consent configuration

- Resolved an issue that could cause a Google Bidding adaptive banner to briefly appear in the incorrect position on an iPhone.

- Resolved an issue where building a unity project from CLI could result in an ArgumentNullException

- Added adaptive banner support for Levelplay Banner API (with Ad Unit ID)

- **Important**: If you've integrated Unity Plugin version 8.0.0, update to the latest version by downloading and importing it from [here](/grow/levelplay/sdk/unity/package-integration/.md).                                                                                                        |
| 8.1.0         | 8.1.1         | 2024/06/18   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.1.0 SDK

* CMP related bug fix (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8.1.0         | 8.1.0         | 2024/05/23   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.1.0 SDK

- Introduce new APIs for LevelPlay initialization and banner ads supporting Ad Unit (Alpha)

- Change the minimum supported iOS version to iOS 12

- Resolved embedding and signing issues with XCFramework caused by missing values in the Info.plist file (iOS)

- Resolved WebView vulnerability warning message related to the Test Suite (Android)

- **Important**: If you've integrated Unity Plugin version 8.0.0, update to the latest version by downloading and importing it from [here](/grow/levelplay/sdk/unity/package-integration/.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8.0.0         | 8.0.0         | 2024/04/08   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 8.0.0 SDK

* The Ads Mediation package for LevelPlay is now an officially supported Unity Package Manager package

* The ironSource SDK and Unity package have been decoupled so it's now easier to pick up SDK updates from the Network Manager (formerly Integration Manager) without always needing to update the Unity package

* New dependency on the Unity Services Core package (com.unity.services.core)

* The main Assets/IronSource folder for LevelPlay is now Assets/LevelPlay

* Improve banner refresh mechanism beta (Android)

* The minimum supported Android OS version is now 4.4 (API level 19)

* The minimum compatible Ad Quality SDK version is 7.19.0

* Removed Tapjoy from the Network Manager

* Fyber ad network adapter is now "DT Exchange” in the Network Manager

* The minimum compatible HyperMX adapter version is now 4.3.8

* Fix potential crashes                                                                                                                                                                                    |
| 7.9.1         | 7.9.1         | 2024/03/20   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.9.0 SDK

- Add NSPrivacyCollectedDataTypes to the privacy manifest (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.9.0         | 7.9.0         | 2024/03/10   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.9.0 SDK

* Support Ad Privacy Manifest (iOS)

* Added crash protection while destroying banners (raised in 7.8.0+)

* Support display cutouts for Android apps

* Improve memory management (iOS)

* Resolve potential crashes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7.8.1         | 7.8.1         | 2024/02/22   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.8.1 SDK

- Fix bug related to display ironSource ads when using adaptive banners                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7.8.0         | 7.8.0         | 2024/02/19   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.8.0 SDK

* Improving the banner adaptive support of Google Ad Manager and AdMob through the introduction of a new API

* Improve consent visibility for publishers using Google CMP (Consent management platform)

* Bug fix related to complete callback reporting (Android)

* Resolved an issue where rotating the display using the Unity API could cause a banner to disappear. (iOS)

* Remove AdColony from the Integration Manager                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7.7.0         | 7.7.0         | 2024/01/03   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.7.0 SDK

- Support for Google CMP (Consent management platform)

- Updated IronSource.androidlib to strictly compile for the Android platform

- Resolved an issue where IronSourceEvents.onSegmentReceivedEvent was not firing for iOS

- Resolved a potential crash related to the WaterfallConfiguration API (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.6.1         | 7.6.1         | 2023/12/20   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.6.1 SDK

* Fix reward and click callbacks for Android apps (raised as part of 7.6.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.6.0         | 7.6.0         | 2023/12/05   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.6.0 SDK

- Optimized loading for interstitial ads.

- The ironSource SDK now auto initializes the Ad Quality SDK

- Minimum Kotlin version 1.7.0

- Support Android API level 33

- Crash fix on Android apps related to Unity Java proxy thread synchronization

- Resolved missing Ad Info content on Load Success Callbacks

- Resolve hidden X button on ironSource full screen ads (Android)

- Resolve build issues to ensure compatibility with an XCode project including Swift files (iOS)

- Add crash protections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7.5.2         | 7.5.2         | 2023/10/19   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.5.2 SDK

* Fix LURL error codes sent to publishers (iOS)

* Bug fix related to APS integration (Banners, Interstitial and Rewarded Video)

* Crash fix (ISAdapterRepository: NSInvalidArgumentException) for publishers using custom adapters (iOS)

* Crash fix for (ISProgIsManager: NSInvalidArgumentException) when using Google Bidding (iOS)

* Bug fix for using interstitial under external mediations (Android)

* Bug fix related to banner integration under external mediations (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.5.1         | 7.5.1         | 2023/09/07   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.5.1 SDK

- Bug fix related to the Ad Quality single init activation

- Fix potential crash when banner is destroyed for the ironSource network

- Test suite bug fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.5.0         | 7.5.0         | 2023/08/28   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.5.0 SDK

* Custom adapter support for banners iOS

* Interstitial ad upgrades that improve loading and reduce latency

* Add protection to avoid crashes related to miss configuration issues in Ad Quality (Android)

* Changes in the LURL notifications error code Ids sent to bidding networks

* Support for XCode 14.3.1 for iOS

* Remove Yahoo network from LevelPlay, following Yahoo's network sunset

* Remove Liftoff adapter, use Liftoff Monetize network instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7.4.0         | 7.4.0         | 2023/08/02   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.4.0 SDK

- Ad Quality SDK activation via ironSource SDK using single init (beta), [Learn more](/grow/ad-quality/ad-quality-unity-plugin.md)

- New SetMetaData API to allow opt-in [Families Self-Certified Ads SDK](/grow/levelplay/sdk/unity/regulation-advanced-settings.md)

- Change the minimum supported iOS version to iOS 11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.3.1.1       | 7.3.1.1       | 2023/06/29   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.3.1.1 SDK

* Fix banner not clickable bug (experienced on 7.3.1)

* Fix bug related to custom adapter integration (experienced on 7.3.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.3.1         | 7.3.1         | 2023/06/08   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.3.1 SDK

- Support price limitations using SetWaterfallConfiguration API (beta)

- Remove Liftoff and update Vungle to "Liftoff Monetize" in the Integration Manager

- Bug fix related to Unity integration manager error in Turkish locale

- Improve ad availability and the ad experience when monetizing with ironSource Ads through third party mediations

- **Note:** When upgrading to 7.3.1 it is important to delete the plugin extension in path Assets/IronSource/Plugins/Android/IronSource.plugin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7.3.0.1       | 7.3.0.1       | 2023/03/23   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.3.0.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7.3.0         | 7.3.0         | 2023/03/16   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.3.0 SDK

- Test suite (beta) support. [Learn more](/grow/levelplay/sdk/unity/integration-test-suite.md)

- Custom adapter support for banners (Android)

- Support XCode 14.2 for iOS

- Change the minimum supported iOS version to iOS 10

- Remove core location framework from ironSourceSDK podspec

- Add APS to the integration helper

- Add crash protections and bug fixes

- Adapters Compatibility Breakage

- Minimum Kotlin version 1.5.0

- **Important**: This SDK version requires you to update all your network adapters to the latest version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.2.7         | 7.2.7         | 2023/01/19   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.7 SDK

* Support for banner callbacks per instance which will allow multiple loads of different instances under third party mediations (iOS)

* Bug fix for banner display under third party mediations (iOS)

* Add the ability to support async token for mediated networks (iOS and Android)

* Fixed potential conflict for Unity developers using MDR resolver                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.2.6         | 7.2.6         | 2022/12/08   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.6 SDK

- Unity LevelPlay name changes reflected in Integration Manager. This includes the new menu entry name of “Ads Mediation” instead of “IronSource”.

- Fix OnApplicationPause duplicated reporting

- Add support for M1 and arm 64 simulator, and deprecation of simulator i386 (iOS)

- Support CSJ and Pangle as separate adapters. Make sure to integrate the new CSJ adapter to support your traffic (iOS)

- Fix AUCTION\_MBR param value, sent as part of LURL reporting for networks (iOS)

- Bug fix remove mediation logs that were reported under other mediations (iOS)

- Bug fix for banner ads, prevent banner refresh when app in background (Android)                                                                                                                                                                                                                                                                                                                                                                                               |
| 7.2.5.1       | 7.2.5.1       | 2022/10/20   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.5 SDK

* Performance improvements for non bidding flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7.2.4.1       | 7.2.4.1       | 2022/08/24   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.4.1 SDK

- Improve security in the Android Ad Player modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7.2.4         | 7.2.4         | 2022/08/11   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.4 SDK

* Support PauseGame API to be called before displaying Rewarded Video and Interstitial ads, for iOS Apps

* Bug fix related to Unity integration manager error in Turkish locale

* Add protection when context is missing for rewarded video ads (Android)

* Fix open source category collisions with UnityAds iOS SDK 4.1.0+ (iOS)

* Remove Snap network from LevelPlay, following Snap Audience network sunset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7.2.3.1       | 7.2.3.1       | 2022/07/05   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.3.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7.2.3         | 7.2.3         | 2022/06/30   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.3 SDK

* Add support for new LevelPlay listeners for rewarded video, interstitial, and banner ads. These new listeners include AdInfo object that allow to receive data as part of the callback, including network, segment, and A/B indication (beta).

* Support new banner load success callback, that are sent when banners refresh

* Support for CocoaPods CDN (iOS)

* Fix open source category collisions with UnityAds iOS SDK 4.1.0+ (iOS)

* Fix Android Manifest.XML build, issue raised as part of ironSource SDK 7.2.2 (Android)

* Resolve potential crashes due to NullReferenceException events for Amazon devices (Android)

* Reduce ANRs (Android)                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.2.2.1       | 7.2.2.1       | 2022/06/02   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.2 SDK

- Bug fix related to display of non-bidding ads, when bidding server is not available, experienced on Android SDK 7.2.2

- Bug fix related to reporting of RV Manual callbacks, experienced on iOS SDK 7.2.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.2.2         | 7.2.2         | 2022/05/25   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.2 SDK

* Unity Integration Manager prevents incompatible adapter updates, for this version on

* AD\_ID permission option in Unity developer settings

* Fix banner refresh when watching ads (iOS)

* ILR callback fix to improve data integrity (iOS)

* Bug fixes to reduce ANR rates (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.2.1.2       | 7.2.1.2       | 2022/04/04   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.1.1 SDK

- Crash fix for apps implementing TCF 2.0, using ironSource 7.2.1+ (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.2.1.1       | 7.2.1.1       | 2022/03/21   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.1.1 SDK

* Offerwall bug fix (Android)

* Add protections to reduce ANR rates (Android)

* Crash fixes, related to ISNProductViewController (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.2.1         | 7.2.1         | 2022/03/06   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.1 SDK

- Init Success callback for ironSource SDK

- Support Google Play's updated Families Policy requirements (Android)

- Improve SMART banner logic recognizing small tablets (Android)

- Bug fixes to reduce ANR rates (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.2.0         | 7.2.0         | 2022/02/14   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.2.0 SDK

* Custom Adapters Support for Rewarded Video

* Rewarded Video manual loading

* Dynamic segmentation support

* Support iOS OS version 9+. Make sure to update your pod file accordingly (iOS)

* bannerDidShow callback was deprecated (iOS)

* Bug fixes and crash protections were added (iOS)

* **Important**: Ensure that you upgrade your Chartboost, UnityAds and Vungle adapters to the latest versions. If you're using custom adapters, make sure to upgrade all your iOS adapters to a version that is compatible with ironSource SDK 7.2.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.1.14.1      | 7.1.14.1      | 2022/01/19   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.14 SDK

- Support for hiding banners before and during load

- Support for receiving ILR callbacks while an ad is displayed, using a new callback **onImpressionDataReadyEvent** (Android and iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.1.14        | 7.1.14        | 2022/01/06   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.14 SDK

* Adaptive banner support

* Ad unit capping and pacing support

* Introducing new API setNetworkData                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7.1.13        | 7.1.13        | 2021/12/16   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.13 SDK

- ironSource SDK released as XCFramework

- Supports Open Measurement for Banners

- Add crash protections and bug fixes

- Min CocoaPods version required 1.9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.1.12.2      | 7.1.12.2      | 2021/11/24   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.12.2 SDK

* Resolve potential memory leaks (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7.1.12.1      | 7.1.12.1      | 2021/11/03   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.12.1 SDK

- Bug fix related to custom adapters, experienced on Android SDK 7.1.12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.1.12        | 7.1.12        | 2021/10/28   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.12 SDK

* ironSource network support Rectangle/MREC banner size (Android & iOS)

* Performance enhancements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7.1.11.1      | 7.1.11.1      | 2021/10/13   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.11.1 SDK

- Resolve deadlock upon SDK initialization (iOS)

- Fix potential bug on interstitials                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7.1.11        | 7.1.11        | 2021/09/26   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.11 SDK

* Performance enhancements and bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7.1.10        | 7.1.10        | 2021/09/01   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.10 SDK

- Bidding tech improvements

- **Important**: This SDK version requires you to update all your network adapters to the latest version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7.1.9         | 7.1.9         | 2021/08/24   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.9 SDK

* Performance improvements and bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.1.8         | 7.1.8         | 2021/08/04   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.8 SDK

- Fix RV ad availability reporting logic (Android and iOS)

- Improving the accuracy of banner impression reporting

- Fix banner re-loading mechanism when app is in on background (Android)

- Bug and crash fixes (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7.1.7         | 7.1.7         | 2021/07/07   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.7 SDK

* New ironSource SDK data security features

* Improve Unity integration manager user experience

* Improve user experience for ironSource banners (Android)

* Update Kotlin supported version to 1.4.32 (Android)

* Reduce ironSource SDK size footprint (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7.1.6.2       | 7.1.6.2       | 2021/06/28   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.6.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7.1.6.1       | 7.1.6.1       | 2021/06/01   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.6 SDK

* Fix bug in Offerwall (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.1.6         | 7.1.6         | 2021/05/26   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.6 SDK

- Performance improvements and bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7.1.5.2       | 7.1.5.2       | 2021/05/18   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.5.1 SDK

* Fix potential memory leaks for iOS SDK (related to Banners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.1.5.1       | 7.1.5.1       | 2021/04/18   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.5.1 SDK

- Performance enhancements for ironSource Network                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7.1.5         | 7.1.5         | 2021/04/07   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.5 SDK

* WebView crash fix (Android)

* Stability improvements (iOS)

* Improve banner logs and no fill indications (Android & iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.1.4.1       | 7.1.4.1       | 2021/03/25   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.4.1 SDK

- Fix a decrease in ironSource banner fill rate for Android (experienced on 7.1.3, 7.1.4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.1.4         | 7.1.4         | 2021/03/22   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.4 SDK

* Fix memory leaks for Android SDK (Banner and RV)

* Fix bug in Offerwall

* Banner performance improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7.1.3         | 7.1.3         | 2021/03/17   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.3 SDK

- Performance improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.1.2         | 7.1.2         | 2021/03/10   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.2 SDK

* Banner bidding support

* Support SKAN 2.2

* Bug fix related to Open Measurement SDK (iOS )

* Bug fix related to SKOverlay Support (iOS)

* Banner improvements and bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7.1.1         | 7.1.1         | 2021/02/24   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.1 SDK

- Supports Open Measurement SDK v1.3 (iOS and Android)

- SDK requires Xcode 12 (iOS)

- SKOverlay Support (iOS)

- Init API changes for 3rd parties mediations (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7.1.0.2       | 7.1.0.2       | 2021/01/25   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.0.2 SDK

* Crash fix related to ironSource banners (ISNAdView)

* Crash fixes for Unity Dev Tools                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.1.0.1       | 7.1.0.1       | 2021/01/19   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.0.1 SDK

- Crash fix related to banner events (raised on 7.1.0 Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7.1.0         | 7.1.0         | 2021/01/18   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.1.0 SDK

* Set COPPA flag via API

* Unity Integration Manager improvements

* Unity Developer Tools support

* New API for ARM Postbacks, allow multiple services to register to the listeners

* Bug fixes and performance improvements

* iOS 14 and SKAdNetwork Id support bidding flow when using 3rd party mediations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7.0.4.1       | 7.0.4.1       | 2020/12/07   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.4.1 SDK

- Android bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7.0.4         | 7.0.4         | 2020/12/02   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.4 SDK

* ARM numeric value fix

* Crash protections, Android & iOS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.0.3.1       | 7.0.3.1       | 2020/10/22   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.3.1 SDK

- ANR fix, related to Browser User Agent

- bug fix, resolves ironSource ShowFail increase (raised on 7.0.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7.0.3         | 7.0.3         | 2020/10/14   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.3 SDK

* Support LevelPlay Ad Revenue Measurements SDK API (ARM)

* Banner bidding support

* Bug fix

* [Segmentation](/grow/levelplay/sdk/unity/additional-settings.md) functionality for Age and Gender returned (removed on 7.0.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.0.2         | 7.0.2         | 2020/09/30   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.2 SDK

- Fix crash in init process using 3rd party mediations

- Supports Xcode 12 (iOS)

- Deprecate setAge and setGender APIs. For reporting UnderAge, use setMetaData functionality as described in the [AdMob](/grow/levelplay/sdk/unity/networks/guides/google-admob.md) and [Applovin](/grow/levelplay/sdk/unity/networks/guides/applovin.md) integration guides.

- Unity Integration Manager improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7.0.1.1       | 7.0.1.1       | 2020/09/02   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.1.1 SDK

* Adjustments in core modules (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7.0.1         | 7.0.1         | 2020/09/01   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.1 SDK

- Support tracking authorization status (iOS)

- Crash fix (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7.0.0         | 7.0.0         | 2020/08/13   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 7.0.0 SDK

* iOS 14 compatible version

* Support SKAdNetwork (iOS)

* Remove default User ID logic from supported networks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6.18.0.2      | 6.18.0.2      | 2020/08/05   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.18.0 SDK

- Crash fix for NSInvalidArgumentException (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6.18.0.1      | 6.18.0.1      | 2020/07/31   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.18.0 SDK

* Remove all UIWebView references (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6.18.0        | 6.18.0        | 2020/07/29   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.18.0 SDK

- Improve bidding performances of ironSource network

- Improve security in Android core modules

- Bug fix related to upper /lower case changes in Turkish locale (Android)

- Resolve crashes related to UpdateConsentInfo (iOS)

- Fix hide & display functionality for banners. To enable this fix, ensure that you download the SDK unitypackage manually

- Add support for Target SDK Version 30 (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6.17.1.1      | 6.17.1.1      | 2020/07/21   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.17.0 SDK

* Bug fix for duplicate symbol error (iOS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6.17.1        | 6.17.1        | 2020/06/28   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.17.0 SDK

- Rewarded Video caching improvements for bidding flow for iOS

- Crash fixes related to updateConsentInfo (iOS)

- From this version on, all iOS adapters will not bundle the network SDKs

- **Important**: This SDK version requires you to update all your network adapters to the latest version (or any version compatible with SDK Version 6.17.1). This will ensure your configuration in up-to-date.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.17.0        | 6.17.0        | 2020/06/10   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.17.0 SDK

* Rewarded Video caching improvements for bidding flow for Android

* ANR fix when using ironSource setConsent in 3rd party mediations (Android)

* Crash fixes related to ISNNativeController loadTimer (iOS)

* From this version on, all Android adapters will be released as AAR, and will not bundle the network SDKs

* ironSource Integration Manager json and bridge changes. This requires you to download Unity SDK 6.17.0 unitypackage manually

* **Important**: This SDK version requires you to update all your network adapters to the latest version (or any version compatible with SDK Version 6.17.0). This will ensure your configuration in up-to-date.                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.16.2        | 6.16.2        | 2020/06/01   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.16.2 SDK

- Bug fix in cross promotion for bidding instances                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6.16.1        | 6.16.1        | 2020/04/30   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.16.1 SDK

* Rewarded Video caching improvements for bidding flow

* Bug Fix: VPN problems (Android)

* Fixed Track Network State behaviour when connectivity changes (Android)

* Bug Fix: Init events reporting (iOS)

* Crash protection in case of auction response decryption exception (iOS)

* Removed redundant AppReceiver dependency. Download the 6.16.1 unitypackage to make sure AndoridManifest.XML is updated for your Unity project

* Support ExternalDependencyManager, instead of PlayServicesResolver.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6.16.0        | 6.16.0        | 2020/04/13   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.16.0 SDK

- **Unity Integration Manager**

- from this version on, ironSource SDK and adapters can be downloaded directly from the Unity Development Platform.

- Caching improvements

- Improved internet connection tracking

- Improved fill rate accuracy

- ANR fix when using ironSource in 3rd party mediations (Android)

- Fixed crash when banner is destroyed after load (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6.15.0.1      | 6.15.0.1      | 2020/03/12   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.15.0.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6.15.0        | 6.15.0        | 2020/03/03   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.15.0 SDK

- **Banner Boost!** Enhance the architecture for banner support on ironSource mediation. This will be followed by adding new networks supporting banners.

- Bug fix

- allow to compile on Unity 2019.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6.14.0.1      | 6.14.0.1      | 2020/02/18   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.14.0.1 SDK

* Crash fixes (for Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.14.0        | 6.14.0        | 2020/02/05   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.14.0 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.13.0.1      | 6.13.0.1      | 2020/01/13   | * Bug fix in event mechanism which caused a drop in app fill rate&#xA;reporting.
* Crash fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.13.0        | 6.13.0        | 2020/01/07   | - Support Open Measurement SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.12.0        | 6.12.0        | 2019/12/29   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.12.0 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.11.1        | 6.11.1        | 2019/12/11   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.11.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.11.0        | 6.11.0        | 2019/12/09   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.11.0 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.10.2        | 6.10.2        | 2019/11/11   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.10.2 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.10.1        | 6.10.1        | 2019/10/06   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.10.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6.10.0        | 6.10.0        | 2019/09/19   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.10.0 SDK and iOS 6.8.5 SDK

* Fixed ANR that originated in scenarios in which callbacks are not being called from the Main Thread                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6.9.1.1       | 6.9.1.1       | 2019/08/22   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.9.1 SDK

- Unnecessary service, receiver and activity removal from the manifest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6.9.1         | 6.9.1         | 2019/08/13   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.9.1 SDK

* Deprecation of the use of `IronSourceEventsPrefab`

* This prefab is no longer required for the integration.

* Redundant WRITE\_EXTERNAL\_STORAGE permission removal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6.8.4.1       | 6.8.4.1       | 2019/07/17   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.4 SDK

- Fixing events sending when going-to-background scenarios crash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6.8.4         | 6.8.4         | 2019/06/24   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.4 SDK

* Improved Rewarded Video logic for ironSource network within third-party party mediation

* CoreLocation requirement exclusion

* Fixing going-to-background scenario crash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.8.3.1       | 6.8.3.1       | 2019/05/01   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.3 SDK

- Manifest file adjustments to new requirements

- Fixing an edge case that could lead to synchronization issues                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6.8.3         | 6.8.3         | 2019/04/08   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.3 SDK

* InApp Bidding improvements

* ironSource network improvements

* *no internet connectivity* & *application goes to background* scenarios optimizations with the SDK performance

* Various bug fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6.8.2         | 6.8.2         | 2019/02/21   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.2 SDK

- Interstitial In-app bidding improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6.8.1.1       | 6.8.1.1       | 2019/02/14   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.1 SDK

* Banner's position is top instead of bottom minor bug fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6.8.1         | 6.8.1         | 2019/01/10   | - Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.1 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.8.0.1       | 6.8.0.1       | 2018/12/03   | * Wraps Android [Android](/grow/levelplay/sdk/android/changelog.md) 6.8.0.1 SDK and iOS [iOS](/grow/levelplay/sdk/ios/changelog.md) 6.8.0 SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6.8.0         | 6.8.0         | 2018/11/26   | - Wrap Android & iOS 6.8.0
- Note that **UnityAds** **SDK** **V3.0.0 is&#xA;using additional activities,** therefor its manifest is different,&#xA;**UnityAds** **Adapter 4.1.3 is only compatible with ironSource Unity&#xA;SDK V6.8.0 and onwards.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6.7.12        | 6.7.12        | 2018/10/15   | * Wrap Android & iOS 6.7.12
* Note that **SDK** **is not backward&#xA;compatible, in case using banners**
* IronSource.Agent.reportAppStarted&#xA;was removed from API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6.7.11.1      | 6.7.11.1      | 2018/09/26   | - Missing Macro for iOS in the build process bug fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6.7.11        | 6.7.11        | 2018/09/06   | - Wrap Android & iOS 6.7.11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6.7.10        | 6.7.10        | 2018/07/20   | - Wrap Android & iOS 6.7.10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6.7.9.3       | 6.7.9.3       | 2018/06/13   | - Wrap Android 6.7.9.1 & iOS 6.7.9.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6.7.9.2       | 6.7.9.2       | 2018/06/04   | - Wrap Android 6.7.9 & iOS 6.7.9.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6.7.9.1       | 6.7.9.1       | 2018/05/18   | - Wrap Android 6.7.9 & iOS 6.7.9.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6.7.9         | 6.7.9         | 2018/05/11   | * Wrap Android & iOS 6.7.9
* Add consent API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.7.8         | 6.7.8         | 2018/03/29   | - Wrap Android & iOS 6.7.8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6.7.7         | 6.7.7         | 2018/03/01   | - Wrap Android & iOS 6.7.7
- Adjust Banner mediation core logic – banner&#xA;refresh rate is now enforced by the mediation layer (Developers should&#xA;turn off refresh rate at the networks dashboard)
- Integration Helper&#xA;improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
