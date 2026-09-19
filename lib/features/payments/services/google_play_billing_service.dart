import 'dart:async';
import 'dart:convert';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  // Durable queue for purchases that were charged by Google Play but whose
  // backend verification failed transiently (network blip, backend hiccup).
  // Without this, a failed verify leaves the purchase un-acknowledged and
  // un-retried — Google auto-refunds it after 3 days, but the user was
  // already charged and got no entitlement in the meantime.
  static const _pendingVerificationsKey = 'gp_pending_verifications_v1';

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

  /// Complete a pending purchase by verifying it with the backend, then
  /// always acknowledging/consuming it on the Google Play side — even if
  /// verification failed — so Google never auto-refunds a charge we're
  /// still able to retry. A failed verify is queued for retry instead of
  /// being silently dropped.
  static Future<Map<String, dynamic>> completeAndVerify({
    required PurchaseDetails purchase,
    required bool isSubscription,
    String? channelId,
    String? creatorUid,
  }) async {
    try {
      final result = await verifyPurchase(
        productId: purchase.productID,
        purchaseToken: purchase.verificationData.serverVerificationData,
        isSubscription: isSubscription,
        channelId: channelId,
        creatorUid: creatorUid,
      );
      await _removePendingVerification(purchase.verificationData.serverVerificationData);
      return result;
    } catch (e) {
      await _queuePendingVerification(
        productId: purchase.productID,
        purchaseToken: purchase.verificationData.serverVerificationData,
        isSubscription: isSubscription,
        channelId: channelId,
        creatorUid: creatorUid,
      );
      rethrow;
    } finally {
      // Acknowledge/complete regardless of verify outcome — the purchase
      // token is durably queued above, so we can retry the backend call
      // without risking a Google-side auto-refund in the meantime.
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  static Future<void> _queuePendingVerification({
    required String productId,
    required String purchaseToken,
    required bool isSubscription,
    String? channelId,
    String? creatorUid,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_pendingVerificationsKey) ?? <String>[];
    final entries = raw.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();
    entries.removeWhere((e) => e['purchaseToken'] == purchaseToken);
    entries.add({
      'productId': productId,
      'purchaseToken': purchaseToken,
      'isSubscription': isSubscription,
      if (channelId != null) 'channelId': channelId,
      if (creatorUid != null) 'creatorUid': creatorUid,
    });
    await prefs.setStringList(
      _pendingVerificationsKey,
      entries.map((e) => jsonEncode(e)).toList(),
    );
  }

  static Future<void> _removePendingVerification(String purchaseToken) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_pendingVerificationsKey) ?? <String>[];
    if (raw.isEmpty) return;
    final entries = raw.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();
    entries.removeWhere((e) => e['purchaseToken'] == purchaseToken);
    await prefs.setStringList(
      _pendingVerificationsKey,
      entries.map((e) => jsonEncode(e)).toList(),
    );
  }

  /// Retry any purchases that were charged by Google Play but never
  /// successfully verified with the backend. Call this on app start
  /// (e.g. from the home screen or splash flow) so a transient failure
  /// doesn't strand a paying user without entitlement.
  static Future<void> retryPendingVerifications() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_pendingVerificationsKey) ?? <String>[];
    if (raw.isEmpty) return;

    for (final entryStr in List<String>.from(raw)) {
      final entry = jsonDecode(entryStr) as Map<String, dynamic>;
      try {
        await verifyPurchase(
          productId: entry['productId'] as String,
          purchaseToken: entry['purchaseToken'] as String,
          isSubscription: entry['isSubscription'] as bool,
          channelId: entry['channelId'] as String?,
          creatorUid: entry['creatorUid'] as String?,
        );
        await _removePendingVerification(entry['purchaseToken'] as String);
      } catch (_) {
        // Still failing — leave queued for the next retry attempt.
      }
    }
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
