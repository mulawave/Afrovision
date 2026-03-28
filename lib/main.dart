import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/theme/app_colors.dart';
import 'features/auth/screens/splash_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/auth/screens/forgot_password_screen.dart';
import 'features/auth/screens/reset_password_screen.dart';
import 'features/auth/screens/home_screen.dart';
import 'features/auth/screens/terms_screen.dart';
import 'features/auth/screens/privacy_policy_screen.dart';
import 'features/profile/screens/profile_screen.dart';
import 'features/profile/screens/edit_profile_screen.dart';
import 'features/subscription/screens/plans_screen.dart';
import 'features/channel/screens/channel_list_screen.dart';
import 'features/channel/screens/create_channel_screen.dart';
import 'features/channel/screens/channel_view_screen.dart';
import 'features/channel/screens/channel_number_access_screen.dart';
import 'features/channel/screens/creator_studio_screen.dart';
import 'features/channel/screens/edit_channel_screen.dart';
import 'features/wallet/screens/digital_assets_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AfroVision',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.darkBlue,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.orange,
          secondary: AppColors.lightOrange,
          surface: AppColors.darkBlue,
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
        '/plans': (_) => const PlansScreen(),
        '/channels': (_) => const ChannelListScreen(),
        '/create-channel': (_) => const CreateChannelScreen(),
        '/channel-view': (_) => const ChannelViewScreen(),
        '/channel-access': (_) => const ChannelNumberAccessScreen(),
        '/creator-studio': (_) => const CreatorStudioScreen(),
        '/edit-channel': (_) => const EditChannelScreen(),
        '/digital-assets': (_) => const DigitalAssetsScreen(),
      },
    );
  }
}
