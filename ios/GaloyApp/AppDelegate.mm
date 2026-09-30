#import "AppDelegate.h"
#import "Firebase.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

#import "RNBootSplash.h"

#import <React/RCTBridgeModule.h>

/**
 * When automatic crash collection may run, and what to do with reports the crash SDK is
 * still holding on disk. The Android twin is CrashCollectionPolicy.kt and
 * CrashCollection.kt, and the two must agree.
 *
 * Two facts about Crashlytics shape this. It writes a crash report when the crash happens
 * and uploads it at the *next* launch, so the decision about any report is taken one
 * process later than the crash itself. And it records a crash even while collection is
 * switched off — it only holds the upload back — so "collection was off" does not tell us
 * whether a report already on disk is one we are allowed to send.
 *
 * So the device remembers one word: what the previous session was allowed to do when it
 * ended, which is also what any crash in that session was allowed to do, because a crash
 * ends its session. Every launch reads the word, decides, and resets it to "unresolved" for
 * the session now starting; JavaScript overwrites it as soon as it knows.
 *
 * These classes live in this file so the module needs no project-file entry;
 * RCT_EXPORT_MODULE registers it when the binary loads.
 */
static NSString *const kCrashProvenanceKey = @"blink.crash_collection.provenance";
static NSString *const kProvenancePermitted = @"permitted";
static NSString *const kProvenanceDenied = @"denied";
static NSString *const kProvenanceUnresolved = @"unresolved";

/** What a launch or a disposition change should do. The Kotlin twin is a data class. */
typedef struct {
  BOOL collect;
  BOOL deleteUnsent;
  NSString *provenance;
} CrashCollectionDecision;

/** Pure, and the whole of the rule. */
@interface CrashCollectionPolicy : NSObject
+ (CrashCollectionDecision)decisionAtLaunch:(NSString *)previous;
+ (CrashCollectionDecision)decisionForPermitted:(BOOL)permitted;
@end

@implementation CrashCollectionPolicy

+ (CrashCollectionDecision)decisionAtLaunch:(NSString *)previous
{
  BOOL permitted = [previous isEqualToString:kProvenancePermitted];
  return (CrashCollectionDecision){permitted, !permitted, kProvenanceUnresolved};
}

+ (CrashCollectionDecision)decisionForPermitted:(BOOL)permitted
{
  return (CrashCollectionDecision){
      permitted, !permitted, permitted ? kProvenancePermitted : kProvenanceDenied};
}

@end

/** Applies a decision to the crash SDK and to the word the device remembers. */
@interface CrashCollection : NSObject <RCTBridgeModule>
+ (void)applyLaunch;
+ (void)applyPermitted:(BOOL)permitted;
@end

@implementation CrashCollection

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

+ (void)apply:(CrashCollectionDecision)decision
{
  // The word goes down first. If the process dies between here and the SDK calls, the next
  // launch errs on the side of not sending.
  [[NSUserDefaults standardUserDefaults] setObject:decision.provenance
                                           forKey:kCrashProvenanceKey];
  [[NSUserDefaults standardUserDefaults] synchronize];
  [[FIRCrashlytics crashlytics] setCrashlyticsCollectionEnabled:decision.collect];
  if (decision.deleteUnsent) {
    [[FIRCrashlytics crashlytics] deleteUnsentReports];
  }
}

+ (void)applyLaunch
{
  NSString *previous =
      [[NSUserDefaults standardUserDefaults] stringForKey:kCrashProvenanceKey];
  [self apply:[CrashCollectionPolicy decisionAtLaunch:previous]];
}

+ (void)applyPermitted:(BOOL)permitted
{
  [self apply:[CrashCollectionPolicy decisionForPermitted:permitted]];
}

/**
 * The one runtime switch, driven from app/utils/error-reporting.ts once it knows what this
 * session may send. React Native Firebase has its own setter, but that only stores a
 * preference the next launch reads; this changes the running process.
 */
RCT_EXPORT_METHOD(setCrashCollectionDisposition:(BOOL)permitted)
{
  [CrashCollection applyPermitted:permitted];
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
  // the CrashCollection module above. Immediately after configure, where Firebase's own
  // opt-in guidance puts it: the SDK waits on a settings fetch before it uploads anything,
  // so this lands well before an upload could.
  [CrashCollection applyLaunch];

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
