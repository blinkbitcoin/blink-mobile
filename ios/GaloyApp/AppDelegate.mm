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
 * Three facts about Crashlytics shape this. It records a crash even while collection is off
 * and only holds the upload back, so "collection was off" says nothing about whether a
 * report on disk may go. It decides what to do with the reports on disk once per launch,
 * from whatever its collection switch says at that moment: switched on, it sends them
 * straight away; switched off, it waits for an explicit send or delete. And the switch it
 * starts from is the previous process's: the SDK persists the last value it was given, and
 * React Native Firebase re-applies its own stored copy at start-up.
 *
 * So two things are kept true at all times. The switch is on only while the session is
 * known to be permitted — never at launch, never while unresolved — so whatever the SDK
 * reads at the next launch is what the previous session was allowed to do when it ended.
 * And the device remembers that same answer as one word, which the launch reads to send or
 * delete what was left. A crash ends its session, so the word is also what any crash in
 * that session was allowed to do.
 *
 * React Native Firebase applies its stored preference to the switch during configure, and
 * app/utils/error-reporting.ts keeps that preference equal to "this session is permitted",
 * so a launch starts from the previous session's answer and applyLaunch turns it off
 * straight after. One window is left: a native crash in a launch that follows a permitted
 * session, before JavaScript has run, is sent by the launch after. Closing it would mean
 * resetting the preference here, which also switches off React Native Firebase's
 * JavaScript crash handler for the session, because that handler reads it once at start-up.
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
  BOOL sendUnsent;
  BOOL deleteUnsent;
  NSString *provenance;
} CrashCollectionDecision;

/** Pure, and the whole of the rule. */
@interface CrashCollectionPolicy : NSObject
+ (CrashCollectionDecision)decisionAtLaunch:(NSString *)previous;
+ (CrashCollectionDecision)decisionForDisposition:(NSString *)disposition;
@end

@implementation CrashCollectionPolicy

+ (CrashCollectionDecision)decisionAtLaunch:(NSString *)previous
{
  BOOL permitted = [previous isEqualToString:kProvenancePermitted];
  return (CrashCollectionDecision){NO, permitted, !permitted, kProvenanceUnresolved};
}

/**
 * "unresolved" turns collection off and keeps what is on disk: the session may still turn
 * out permitted, and if it never does the next launch deletes it. Anything unrecognised is
 * treated as unresolved, which collects nothing.
 */
+ (CrashCollectionDecision)decisionForDisposition:(NSString *)disposition
{
  if ([disposition isEqualToString:kProvenancePermitted]) {
    return (CrashCollectionDecision){YES, NO, NO, kProvenancePermitted};
  }
  if ([disposition isEqualToString:kProvenanceDenied]) {
    return (CrashCollectionDecision){NO, NO, YES, kProvenanceDenied};
  }
  return (CrashCollectionDecision){NO, NO, NO, kProvenanceUnresolved};
}

@end

/** Applies a decision to the crash SDK and to the word the device remembers. */
@interface CrashCollection : NSObject <RCTBridgeModule>
+ (void)applyLaunch;
+ (void)applyDisposition:(NSString *)disposition;
@end

@implementation CrashCollection

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/**
 * The word goes down first: if the process dies part-way, the next launch errs on the side
 * of not sending. Then collection goes off before reports are sent or deleted, because the
 * SDK honours an explicit send or delete only while its own collection is off; and on last,
 * so a report kept for this session is not sent by the switch before it is decided.
 */
+ (void)apply:(CrashCollectionDecision)decision
{
  [[NSUserDefaults standardUserDefaults] setObject:decision.provenance
                                           forKey:kCrashProvenanceKey];
  [[NSUserDefaults standardUserDefaults] synchronize];
  FIRCrashlytics *crashlytics = [FIRCrashlytics crashlytics];
  if (!decision.collect) {
    [crashlytics setCrashlyticsCollectionEnabled:NO];
  }
  if (decision.sendUnsent) {
    [crashlytics sendUnsentReports];
  }
  if (decision.deleteUnsent) {
    [crashlytics deleteUnsentReports];
  }
  if (decision.collect) {
    [crashlytics setCrashlyticsCollectionEnabled:YES];
  }
}

+ (void)applyLaunch
{
  NSString *previous =
      [[NSUserDefaults standardUserDefaults] stringForKey:kCrashProvenanceKey];
  [self apply:[CrashCollectionPolicy decisionAtLaunch:previous]];
}

+ (void)applyDisposition:(NSString *)disposition
{
  [self apply:[CrashCollectionPolicy decisionForDisposition:disposition]];
}

/**
 * The one runtime switch, driven from app/utils/error-reporting.ts with the session's
 * disposition: "permitted", "denied" or "unresolved". React Native Firebase has its own
 * setter, but it only stores a preference; this changes the running process, and records
 * the word the next launch decides by.
 */
RCT_EXPORT_METHOD(setCrashCollectionDisposition:(NSString *)disposition)
{
  [CrashCollection applyDisposition:disposition];
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
  // positively resolved as one that may collect. This runs before the app becomes active,
  // which is where the automatic session events are logged.
  [FIRAnalytics setAnalyticsCollectionEnabled:NO];
  // Crash collection starts off too, and the reports the previous session left are sent or
  // deleted by what that session was allowed to do; see the CrashCollection module above.
  // Immediately after configure, where Firebase's opt-in guidance puts it.
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
