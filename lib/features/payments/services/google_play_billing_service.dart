import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../../../core/api/api_service.dart';

/// Service that wraps Google Play Billing via the in_app_purchase plugin.
///
/// Product ID conventions (must match the Play Console and backend PRODUCT_MAP):
///   wallet_topup_500, wallet_topup_1000, wallet_topup_2000, wallet_topup_5000, wallet_topup_10000
///   viewer_basic_monthly, viewer_basic_yearly, viewer_pro_monthly, viewer_pro_yearly,
///   viewer_premium_monthly, viewer_premium_yearly
///   creator_basic_monthly, creator_pro_monthly, creator_premium_monthly
///   creator_sub_{creatorUid}   (subscription to a specific creator)
///   channel_sub_{channelId}    (subscription to a specific premium channel)
class GooglePlayBillingService {
  static final InAppPurchase _iap = InAppPurchase.instance;

  /// Verify a completed Google Play purchase with the backend.
  /// Returns the server response containing updated user/wallet/plan data.
  static Future<Map<String, dynamic>> verifyPurchase({
    required String productId,
    required String purchaseToken,
    required bool isSubscription,
    String? channelId,
    String? creatorUid,
  }) async {
    return ApiService.post('/payments/google-play/verify', {
      'productId': productId,
      'purchaseToken': purchaseToken,
      'isSubscription': isSubscription,
      if (channelId != null) 'channelId': channelId,
      if (creatorUid != null) 'creatorUid': creatorUid,
    });
  }

  /// Query product details for a set of Google Play product IDs.
  static Future<List<ProductDetails>> queryProductDetails(
    Set<String> productIds,
  ) async {
    final response = await _iap.queryProductDetails(productIds);
    if (response.error != null) {
      throw Exception(
        'Failed to load Google Play products: ${response.error!.message}',
      );
    }
    return response.productDetails.toList();
  }

  /// Initiate a purchase for a single product.
  /// For subscriptions, the product must be set up as a subscription in the Play Console.
  static Future<void> initiatePurchase({
    required String productId,
    bool isSubscription = false,
  }) async {
    final param = PurchaseParam(
      productDetails: await _getProductDetails(productId),
    );

    if (isSubscription) {
      await _iap.buyNonConsumable(purchaseParam: param);
    } else {
      await _iap.buyConsumable(purchaseParam: param);
    }
  }

  /// Initiate a creator subscription purchase.
  /// The productId follows the pattern `creator_sub_<creatorUid>`.
  static Future<void> initiateCreatorSubscription({
    required String creatorUid,
  }) async {
    final productId = 'creator_sub_$creatorUid';
    await initiatePurchase(productId: productId, isSubscription: true);
  }

  /// Initiate a channel subscription purchase.
  /// The productId follows the pattern `channel_sub_<channelId>`.
  static Future<void> initiateChannelSubscription({
    required String channelId,
  }) async {
    final productId = 'channel_sub_$channelId';
    await initiatePurchase(productId: productId, isSubscription: true);
  }

  /// Complete a pending purchase by acknowledging it (for non-consumables)
  /// or consuming it (for consumables), then verifying with the backend.
  static Future<Map<String, dynamic>> completeAndVerify({
    required PurchaseDetails purchase,
    required bool isSubscription,
    String? channelId,
    String? creatorUid,
  }) async {
    // Verify with backend first so entitlement is granted
    final result = await verifyPurchase(
      productId: purchase.productID,
      purchaseToken: purchase.verificationData.serverVerificationData,
      isSubscription: isSubscription,
      channelId: channelId,
      creatorUid: creatorUid,
    );

    // Then acknowledge/complete the purchase on the Google Play side
    if (purchase.pendingCompletePurchase) {
      await _iap.completePurchase(purchase);
    }

    return result;
  }

  /// Restore previous purchases (subscriptions only — Google Play auto-restores
  /// on app install, but this can be called explicitly).
  static Future<void> restorePurchases() async {
    await _iap.restorePurchases();
  }

  static Future<ProductDetails> _getProductDetails(String productId) async {
    final details = await queryProductDetails({productId});
    if (details.isEmpty) {
      throw Exception(
        'Google Play product "$productId" not found. Ensure it is configured in the Play Console.',
      );
    }
    return details.first;
  }

  /// Check whether Google Play billing is available on this device.
  static Future<bool> isAvailable() async {
    return await _iap.isAvailable();
  }
}
