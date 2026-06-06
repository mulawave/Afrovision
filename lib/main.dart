import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/services/notification_service.dart';
import 'core/services/deep_link_service.dart';
import 'core/services/floating_player_service.dart';
import 'core/theme/app_colors.dart';
import 'firebase_options.dart';
import 'features/auth/screens/splash_screen.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/auth/screens/forgot_password_screen.dart';
import 'features/auth/screens/reset_password_screen.dart';
import 'features/auth/screens/home_screen.dart';
import 'features/auth/screens/terms_screen.dart';
import 'features/auth/screens/privacy_policy_screen.dart';
import 'features/profile/screens/profile_screen.dart';
import 'features/profile/screens/edit_profile_screen.dart';
import 'features/profile/screens/delete_account_screen.dart';
import 'features/subscription/screens/plans_screen.dart';
import 'features/subscription/screens/my_subscriptions_screen.dart';
import 'features/subscription/screens/subscription_entry_screens.dart';
import 'features/channel/screens/channel_list_screen.dart';
import 'features/channel/screens/create_channel_screen.dart';
import 'features/channel/screens/channel_view_screen.dart';
import 'features/channel/screens/channel_grid_screen.dart';
import 'features/channel/screens/channel_number_access_screen.dart';
import 'features/channel/screens/creator_studio_screen.dart';
import 'features/channel/screens/edit_channel_screen.dart';
import 'features/wallet/screens/digital_assets_screen.dart';
import 'features/wallet/screens/gift_wallet_screen.dart';
import 'features/wallet/screens/ravens_to_vpt_screen.dart';
import 'features/wallet/screens/wallet_transactions_screen.dart';
import 'features/wallet/screens/withdrawal_screen.dart';
import 'features/wallet/screens/withdrawal_history_screen.dart';
import 'features/wallet/screens/add_bank_account_screen.dart';
import 'features/broadcast/screens/video_upload_screen.dart';
import 'features/broadcast/screens/schedule_screen.dart';
import 'features/broadcast/screens/channel_player_screen.dart';
import 'features/broadcast/screens/live_channels_screen.dart';
import 'features/admin/screens/admin_dashboard_screen.dart';
import 'features/notifications/screens/notifications_screen.dart';
import 'features/channel/screens/premium_stream_paywall_screen.dart';
import 'features/channel/screens/exclusive_access_paywall_screen.dart';
import 'features/subscription/screens/creator_subscription_screen.dart';
import 'features/referral/screens/referral_screen.dart';
import 'features/auth/screens/pak_login_screen.dart';
import 'features/ads/screens/advertiser_screen.dart';
import 'features/broadcast/screens/reminders_screen.dart';
import 'features/kyc/screens/kyc_screen.dart';
import 'features/channel/screens/channel_analytics_screen.dart';
import 'features/payments/screens/checkout_screen.dart';
import 'features/payments/screens/checkout_result_screen.dart';
import 'features/reputation/screens/reputation_screen.dart';
import 'features/reputation/screens/leaderboard_screen.dart';
import 'features/challenge/screens/challenge_screen.dart';
import 'features/challenge/screens/challenge_audition_screen.dart';
import 'features/challenge/screens/challenge_rules_screen.dart';
import 'features/ai_video/screens/ai_video_generator_screen.dart';
import 'features/static_pages/screens/static_page_viewer_screen.dart';
import 'features/static_pages/screens/static_pages_catalog_screen.dart';
import 'features/static_pages/screens/external_static_handoff_screen.dart';
import 'features/wave/screens/wave_screen.dart';
import 'features/wave/screens/wave_edit_screen.dart';
import 'features/wave/screens/wave_upload_screen.dart';
import 'features/broadcast/screens/channel_library_screen.dart';
import 'features/broadcast/screens/channel_library_item_screen.dart';
import 'features/broadcast/screens/channel_library_reader_screen.dart';
import 'features/broadcast/screens/creator_library_management_screen.dart';
import 'features/announcements/screens/announcements_screen.dart';
import 'features/updates/screens/updates_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase and FCM
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await NotificationService.initialize();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.darkBlue,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const AfroVisionApp());
}

class AfroVisionApp extends StatelessWidget {
  const AfroVisionApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    // Wire the navigator key so notification taps can navigate
    NotificationService.navigatorKey = navigatorKey;
    FloatingPlayerService.navigatorKey = navigatorKey;

    // Initialize deep-link handling for inbound app/universal links
    DeepLinkService.initialize(navigatorKey);

    return MaterialApp(
      title: 'AfroVision',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.darkBlue,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.orange,
          secondary: AppColors.lightOrange,
          surface: AppColors.darkBlue,
        ),
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: AppColors.cardBg,
          contentTextStyle: TextStyle(
            color: AppColors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          actionTextColor: AppColors.lightOrange,
          behavior: SnackBarBehavior.floating,
        ),
        fontFamily: 'SF Pro Display',
      ),
      initialRoute: '/splash',
      routes: {
        '/splash': (_) => const SplashScreen(),
        '/login': (_) => const LoginScreen(),
        '/register': (_) => const RegisterScreen(),
        '/forgot-password': (_) => const ForgotPasswordScreen(),
        '/reset-password': (_) => const ResetPasswordScreen(),
        '/home': (_) => const HomeScreen(),
        '/terms': (_) => const TermsScreen(),
        '/privacy-policy': (_) => const PrivacyPolicyScreen(),
        '/profile': (_) => const ProfileScreen(),
        '/edit-profile': (_) => const EditProfileScreen(),
        '/delete-account': (_) => const DeleteAccountScreen(),
        '/plans': (_) => const PlansScreen(),
        '/my-plan': (_) => const MyPlanDetailsScreen(),
        '/choose-options': (_) => const ChooseYourOptionsScreen(),
        '/channels': (_) => const ChannelListScreen(),
        '/channel-grid': (_) => const ChannelGridScreen(),
        '/wave': (_) => const WaveScreen(),
        '/wave-edit': (_) => const WaveEditScreen(),
        '/channel-library': (_) => const ChannelLibraryScreen(),
        '/channel-library/item': (_) => const ChannelLibraryItemScreen(),
        '/channel-library/reader': (_) => const ChannelLibraryReaderScreen(),
        '/creator-studio/library': (_) =>
            const CreatorLibraryManagementScreen(),
        '/create-channel': (_) => const CreateChannelScreen(),
        '/channel-view': (_) => const ChannelViewScreen(),
        '/channel-access': (_) => const ChannelNumberAccessScreen(),
        '/creator-studio': (_) => const CreatorStudioScreen(),
        '/ai-video': (_) => const AiVideoGeneratorScreen(),
        '/edit-channel': (_) => const EditChannelScreen(),
        '/wave-upload': (_) => const WaveUploadScreen(),
        '/digital-assets': (_) => const DigitalAssetsScreen(),
        '/wallet/convert': (_) => const RavensToVptScreen(),
        '/wallet/transactions': (_) => const WalletTransactionsScreen(),
        '/gift-wallet': (_) => const GiftWalletScreen(),
        '/withdrawals': (_) => const WithdrawalScreen(),
        '/withdrawal-history': (_) => const WithdrawalHistoryScreen(),
        '/add-bank-account': (_) => const AddBankAccountScreen(),
        '/video-upload': (_) => const VideoUploadScreen(),
        '/schedule': (_) => const ScheduleScreen(),
        '/live': (_) => const LiveChannelsScreen(),
        '/channel-player': (_) => const ChannelPlayerScreen(),
        '/admin-panel': (_) => const AdminDashboardScreen(),
        '/notifications': (_) => const NotificationsScreen(),
        '/premium-stream': (_) => const PremiumStreamPaywallScreen(),
        '/exclusive-access': (_) => const ExclusiveAccessPaywallScreen(),
        '/creator-subscription': (_) => const CreatorSubscriptionScreen(),
        '/my-subscriptions': (_) => const MySubscriptionsScreen(),
        '/referral': (_) => const ReferralScreen(),
        '/pak-login': (_) => const PakLoginScreen(),
        '/advertiser': (_) => const AdvertiserScreen(),
        '/reminders': (_) => const RemindersScreen(),
        '/kyc': (_) => const KycScreen(),
        '/channel-analytics': (_) => const ChannelAnalyticsScreen(),
        '/checkout': (_) => const CheckoutScreen(),
        '/checkout/result': (_) => const CheckoutResultScreen(),
        '/reputation': (_) => const ReputationScreen(),
        '/reputation/leaderboard': (_) => const LeaderboardScreen(),
        '/legal': (_) => const StaticPagesCatalogScreen(),
        '/about': (_) => const StaticPageViewerScreen(routeName: '/about'),
        '/contact': (_) => const StaticPageViewerScreen(routeName: '/contact'),
        '/cookies': (_) => const StaticPageViewerScreen(routeName: '/cookies'),
        '/copyright': (_) =>
            const StaticPageViewerScreen(routeName: '/copyright'),
        '/download': (_) =>
            const StaticPageViewerScreen(routeName: '/download'),
        '/pricing': (_) => const StaticPageViewerScreen(routeName: '/pricing'),
        '/refund': (_) => const StaticPageViewerScreen(routeName: '/refund'),
        '/report-copyright': (_) =>
            const StaticPageViewerScreen(routeName: '/report-copyright'),
        '/updates': (_) => const StaticPageViewerScreen(routeName: '/updates'),
        '/aml': (_) => const StaticPageViewerScreen(routeName: '/aml'),
        '/careers': (_) =>
            const ExternalStaticHandoffScreen(routeName: '/careers'),
        '/press': (_) => const ExternalStaticHandoffScreen(routeName: '/press'),
        '/challenge': (_) => const ChallengeEntryScreen(),
        '/challenge/audition': (_) => const ChallengeAuditionScreen(),
        '/challenge/rules': (_) => const ChallengeRulesScreen(),
        '/announcements': (_) => const AnnouncementsScreen(),
        '/updates-list': (_) => const UpdatesScreen(),
      },
    );
  }
}

class ChallengeEntryScreen extends StatefulWidget {
  const ChallengeEntryScreen({super.key});

  @override
  State<ChallengeEntryScreen> createState() => _ChallengeEntryScreenState();
}

class _ChallengeEntryScreenState extends State<ChallengeEntryScreen> {
  late final Future<bool> _authCheck;

  @override
  void initState() {
    super.initState();
    _authCheck = _isAuthenticated();
  }

  Future<bool> _isAuthenticated() async {
    try {
      await AuthService.getCurrentUser();
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _authCheck,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: DecoratedBox(
              decoration: BoxDecoration(gradient: AppColors.primaryGradient),
              child: Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
                ),
              ),
            ),
          );
        }

        if (snapshot.data == true) {
          return const ChallengeAuditionScreen();
        }

        return const ChallengeScreen();
      },
    );
  }
}
