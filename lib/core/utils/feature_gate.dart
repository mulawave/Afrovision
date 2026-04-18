import '../../features/auth/models/user_model.dart';

class FeatureGate {
  static bool canUseDigitalTV(UserModel user) {
    return user.isCreatorAccount ||
        (user.hasActiveSubscription && user.subscriptionPlan != null);
  }

  static bool canUseSimLive(UserModel user) {
    if (user.isAdmin) return true;
    return user.hasActiveSubscription &&
        ((user.subscriptionPlanType == 'creator' &&
                (user.subscriptionPlan == 'premium' ||
                    user.subscriptionPlan == 'pro')) ||
            user.subscriptionPlan == 'premium_viewer');
  }

  static bool canUseSyncLive(UserModel user) {
    if (user.isAdmin) return true;
    return user.hasActiveSubscription &&
        ((user.subscriptionPlanType == 'creator' &&
                (user.subscriptionPlan == 'premium' ||
                    user.subscriptionPlan == 'pro')) ||
            user.subscriptionPlan == 'premium_viewer');
  }

  static bool canUsePrivateChannel(UserModel user) {
    return user.isCreatorAccount ||
        (user.hasActiveSubscription &&
            (user.subscriptionPlan == 'basic_viewer' ||
                user.subscriptionPlan == 'pro_viewer' ||
                user.subscriptionPlan == 'premium_viewer'));
  }

  static bool canUsePremiumStream(UserModel user) {
    return user.isCreatorAccount ||
        (user.hasActiveSubscription &&
            (user.subscriptionPlan == 'pro_viewer' ||
                user.subscriptionPlan == 'premium_viewer'));
  }
}
