import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/services/notification_service.dart';
import 'core/services/deep_link_service.dart';
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
import 'features/channel/screens/channel_list_screen.dart';
import 'features/channel/screens/create_channel_screen.dart';
import 'features/channel/screens/channel_view_screen.dart';
import 'features/channel/screens/channel_number_access_screen.dart';
import 'features/channel/screens/creator_studio_screen.dart';
import 'features/channel/screens/edit_channel_screen.dart';
import 'features/wallet/screens/digital_assets_screen.dart';
import 'features/wallet/screens/gift_wallet_screen.dart';
import 'features/wallet/screens/withdrawal_screen.dart';
import 'features/wallet/screens/withdrawal_history_screen.dart';
import 'features/wallet/screens/add_bank_account_screen.dart';
import 'features/broadcast/screens/video_upload_screen.dart';
import 'features/broadcast/screens/schedule_screen.dart';
import 'features/broadcast/screens/channel_player_screen.dart';
import 'features/admin/screens/admin_dashboard_screen.dart';
import 'features/notifications/screens/notifications_screen.dart';
import 'features/channel/screens/premium_stream_paywall_screen.dart';
import 'features/subscription/screens/creator_subscription_screen.dart';
import 'features/referral/screens/referral_screen.dart';
import 'features/auth/screens/pak_login_screen.dart';
import 'features/ads/screens/advertiser_screen.dart';
import 'features/broadcast/screens/reminders_screen.dart';
import 'features/kyc/screens/kyc_screen.dart';
import 'features/channel/screens/channel_analytics_screen.dart';
import 'features/payments/screens/checkout_screen.dart';
import 'features/reputation/screens/reputation_screen.dart';
import 'features/reputation/screens/leaderboard_screen.dart';
import 'features/challenge/screens/challenge_screen.dart';
import 'features/challenge/screens/challenge_audition_screen.dart';

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
        '/channels': (_) => const ChannelListScreen(),
        '/create-channel': (_) => const CreateChannelScreen(),
        '/channel-view': (_) => const ChannelViewScreen(),
        '/channel-access': (_) => const ChannelNumberAccessScreen(),
        '/creator-studio': (_) => const CreatorStudioScreen(),
        '/edit-channel': (_) => const EditChannelScreen(),
        '/digital-assets': (_) => const DigitalAssetsScreen(),
        '/gift-wallet': (_) => const GiftWalletScreen(),
        '/withdrawals': (_) => const WithdrawalScreen(),
        '/withdrawal-history': (_) => const WithdrawalHistoryScreen(),
        '/add-bank-account': (_) => const AddBankAccountScreen(),
        '/video-upload': (_) => const VideoUploadScreen(),
        '/schedule': (_) => const ScheduleScreen(),
        '/channel-player': (_) => const ChannelPlayerScreen(),
        '/admin-panel': (_) => const AdminDashboardScreen(),
        '/notifications': (_) => const NotificationsScreen(),
        '/premium-stream': (_) => const PremiumStreamPaywallScreen(),
        '/creator-subscription': (_) => const CreatorSubscriptionScreen(),
        '/my-subscriptions': (_) => const MySubscriptionsScreen(),
        '/referral': (_) => const ReferralScreen(),
        '/pak-login': (_) => const PakLoginScreen(),
        '/advertiser': (_) => const AdvertiserScreen(),
        '/reminders': (_) => const RemindersScreen(),
        '/kyc': (_) => const KycScreen(),
        '/channel-analytics': (_) => const ChannelAnalyticsScreen(),
        '/checkout': (_) => const CheckoutScreen(),
        '/reputation': (_) => const ReputationScreen(),
        '/reputation/leaderboard': (_) => const LeaderboardScreen(),
        '/challenge': (_) => const ChallengeEntryScreen(),
        '/challenge/audition': (_) => const ChallengeAuditionScreen(),
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
