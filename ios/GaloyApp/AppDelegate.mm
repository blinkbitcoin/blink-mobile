#import "AppDelegate.h"
#import "Firebase.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

#import "RNBootSplash.h"

#import <React/RCTBridgeModule.h>

/**
 * Automatic crash collection under the telemetry boundary's rule (AD-13, NFR-P1). The
 * Android twin is CrashCollectionPolicy.kt / CrashCollection.kt; the reasoning lives
 * there. In short: Crashlytics uploads a crash at the *next* launch and records one even
 * while collection is off, so each launch decides by the disposition the previous session
 * ended in — "permitted" lets the held reports go, anything else deletes them — and resets
 * the provenance to "unresolved" until the JavaScript boundary resolves this session.
 *
 * Kept in this translation unit rather than a file of its own so the module needs no
 * project-file registration; RCT_EXPORT_MODULE registers it at load.
 */
static NSString *const kCrashProvenanceKey = @"blink.crash_collection.provenance";
static NSString *const kProvenancePermitted = @"permitted";
static NSString *const kProvenanceDenied = @"denied";
static NSString *const kProvenanceUnresolved = @"unresolved";

static void applyCrashCollection(BOOL collect, BOOL deleteUnsent, NSString *provenance)
{
  // Provenance first: a death between here and the SDK calls errs on the side of not sending.
  [[NSUserDefaults standardUserDefaults] setObject:provenance forKey:kCrashProvenanceKey];
  [[NSUserDefaults standardUserDefaults] synchronize];
  [[FIRCrashlytics crashlytics] setCrashlyticsCollectionEnabled:collect];
  if (deleteUnsent) {
    [[FIRCrashlytics crashlytics] deleteUnsentReports];
  }
}

static void applyCrashCollectionAtLaunch(void)
{
  NSString *previous = [[NSUserDefaults standardUserDefaults] stringForKey:kCrashProvenanceKey];
  BOOL permitted = [previous isEqualToString:kProvenancePermitted];
  applyCrashCollection(permitted, !permitted, kProvenanceUnresolved);
}

@interface CrashCollection : NSObject <RCTBridgeModule>
@end

@implementation CrashCollection

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(setCrashCollectionDisposition:(BOOL)permitted)
{
  applyCrashCollection(permitted, !permitted, permitted ? kProvenancePermitted : kProvenanceDenied);
}

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  // Analytics collection starts every process OFF, whatever the previous run left
  // persisted. Firebase keeps the last setAnalyticsCollectionEnabled: value across
  // launches and it overrides the plist default, so a device that ended a custodial
  // session collecting would otherwise log session_start natively — before any
  // JavaScript runs — even if that device has since become incognito. The telemetry
  // boundary (app/telemetry/mode.ts) re-enables collection only once the mode has
  // positively resolved as custodial. This runs before the app becomes active, which
  // is where the automatic session events are logged.
  [FIRAnalytics setAnalyticsCollectionEnabled:NO];
  // Crash collection follows the same rule, one launch behind by the SDK's nature; see
  // the CrashCollection module above. Immediately after configure, the way Firebase's own
  // opt-in guidance places it: the SDK's upload of held reports waits on a settings fetch,
  // so this lands long before any upload could.
  applyCrashCollectionAtLaunch();

  self.moduleName = @"GaloyApp";
  self.dependencyProvider = [RCTAppDependencyProvider new];
  self.initialProps = @{};

  [super application:application didFinishLaunchingWithOptions:launchOptions];

  [RNBootSplash initWithStoryboard:@"BootSplash" rootView:self.window.rootViewController.view];

  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}
 
- (NSURL *)bundleURL
{
  #if DEBUG
    return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
  #else
    return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  #endif
}

- (BOOL)application:(UIApplication *)application
   openURL:(NSURL *)url
   options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity
 restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
 return [RCTLinkingManager application:application
                  continueUserActivity:userActivity
                    restorationHandler:restorationHandler];
}

@end
