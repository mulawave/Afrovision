import '../../features/auth/models/user_model.dart';

class FeatureGate {
  static bool canUseDigitalTV(UserModel user) {
    return user.hasActiveSubscription && user.subscriptionPlan != null;
  }

  static bool canUseSimLive(UserModel user) {
    return user.hasActiveSubscription &&
        (user.subscriptionPlan == 'premium' || user.subscriptionPlan == 'pro');
  }

  static bool canUseSyncLive(UserModel user) {
    return user.hasActiveSubscription &&
        (user.subscriptionPlan == 'premium' || user.subscriptionPlan == 'pro');
  }

  static bool canUsePrivateChannel(UserModel user) {
    return user.hasActiveSubscription && user.subscriptionPlan == 'premium';
  }

  static bool canUsePremiumStream(UserModel user) {
    return user.hasActiveSubscription && user.subscriptionPlan == 'premium';
  }
}
