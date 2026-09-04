import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../models/channel_subscription_model.dart';
import '../screens/channel_subscription_screen.dart';
import '../services/channel_subscription_service.dart';

/// Bottom sheets for exclusive-channel membership flows.
///
/// Four sheets in one module, all sharing the Nocturne dark ground and a
/// gold-brown border. They're pure presentation — callers pass the copy
/// (channel name, plan, expiry, etc.) and callbacks.
///
/// Design source: Media Center Exclusive Access.dc.html — sheets `isRenewSheet`,
/// `isRequestSheet`, `isAboutSheet`, `isGateSheet`.

// ─── Renew ───────────────────────────────────────────────────────────────

/// Renew-membership sheet. Fires [onConfirm] when the user taps
/// "Renew for {planPrice}". Returns true if the user confirmed, false /
/// null if they dismissed.
Future<bool?> showRenewSheet(
  BuildContext context, {
  required String channelName,
  required String channelTag,
  required String planName,
  required String planPrice,
  required String expiryDate,
  required bool expired,
  required VoidCallback onConfirm,
}) {
  return _showSheet<bool>(
    context,
    child: (ctx) => _RenewSheet(
      channelName: channelName,
      channelTag: channelTag,
      planName: planName,
      planPrice: planPrice,
      expiryDate: expiryDate,
      expired: expired,
      onConfirm: () {
        Navigator.of(ctx).pop(true);
        onConfirm();
      },
      onDismiss: () => Navigator.of(ctx).pop(false),
    ),
  );
}

// ─── Request membership ─────────────────────────────────────────────────

typedef RequestMembershipSubmit = Future<void> Function(
    String note, String referralCode);

/// Request-membership sheet. Fires [onSubmit] with the note + optional
/// referral code when the user taps "Send request".
Future<void> showRequestMembershipSheet(
  BuildContext context, {
  required String channelName,
  required RequestMembershipSubmit onSubmit,
}) {
  return _showSheet<void>(
    context,
    child: (ctx) => _RequestSheet(
      channelName: channelName,
      onSubmit: onSubmit,
      onDone: () => Navigator.of(ctx).pop(),
    ),
  );
}

// ─── About channel ──────────────────────────────────────────────────────

/// About-channel sheet. Read-only summary used from the "Learn more" CTA
/// and any Media-Center info card.
Future<void> showAboutChannelSheet(
  BuildContext context, {
  required String channelName,
  required String channelNumber,
  String? description,
}) {
  return _showSheet<void>(
    context,
    child: (ctx) => _AboutSheet(
      channelName: channelName,
      channelNumber: channelNumber,
      description: description,
    ),
  );
}

// ─── Playback gate ──────────────────────────────────────────────────────

/// Gate sheet shown when playback is blocked mid-session because membership
/// lapsed. Offers Renew or Back.
Future<void> showMembershipGateSheet(
  BuildContext context, {
  required String channelName,
  required String expiryDate,
  required VoidCallback onRenew,
}) {
  return _showSheet<void>(
    context,
    child: (ctx) => _GateSheet(
      channelName: channelName,
      expiryDate: expiryDate,
      onRenew: () {
        Navigator.of(ctx).pop();
        onRenew();
      },
      onBack: () => Navigator.of(ctx).pop(),
    ),
  );
}

// ─── Shared shell ───────────────────────────────────────────────────────

Future<T?> _showSheet<T>(
  BuildContext context, {
  required Widget Function(BuildContext) child,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0xA8040814),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(ctx).viewInsets.bottom,
      ),
      child: _SheetShell(child: child(ctx)),
    ),
  );
}

class _SheetShell extends StatelessWidget {
  final Widget child;
  const _SheetShell({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0E1A3D),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(22),
          topRight: Radius.circular(22),
        ),
        border: Border(
          top: BorderSide(color: Color(0xFF4A3A1A), width: 1),
          left: BorderSide(color: Color(0xFF4A3A1A), width: 1),
          right: BorderSide(color: Color(0xFF4A3A1A), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x8C000000),
            blurRadius: 50,
            offset: Offset(0, -20),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: Nocturne.borderStrong,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            child,
          ],
        ),
      ),
    );
  }
}

Widget _channelHeader(String tag, String name, String kicker) {
  return Row(
    children: [
      Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: const Color(0xFF4A3A1A),
          borderRadius: BorderRadius.circular(9),
        ),
        alignment: Alignment.center,
        child: Text(
          tag,
          style: const TextStyle(
            color: Color(0xFFF7DCAE),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              kicker,
              style: const TextStyle(
                color: Nocturne.gold,
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 1,
              ),
            ),
            Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Nocturne.text,
                fontSize: 17,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget _goldButton({
  required String label,
  required VoidCallback onTap,
}) {
  return GestureDetector(
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: Nocturne.gold.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Nocturne.gold, width: 1),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Nocturne.goldLight,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    ),
  );
}

Widget _ghostButton({
  required String label,
  required VoidCallback onTap,
}) {
  return GestureDetector(
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Nocturne.border, width: 1),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Nocturne.textMuted,
          fontSize: 13,
        ),
      ),
    ),
  );
}

// ─── Renew ───────────────────────────────────────────────────────────────

class _RenewSheet extends StatelessWidget {
  final String channelName;
  final String channelTag;
  final String planName;
  final String planPrice;
  final String expiryDate;
  final bool expired;
  final VoidCallback onConfirm;
  final VoidCallback onDismiss;

  const _RenewSheet({
    required this.channelName,
    required this.channelTag,
    required this.planName,
    required this.planPrice,
    required this.expiryDate,
    required this.expired,
    required this.onConfirm,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _channelHeader(channelTag, channelName, 'RENEW MEMBERSHIP'),
        const SizedBox(height: 13),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Nocturne.border, width: 1),
          ),
          child: Column(
            children: [
              _kv('Plan', planName),
              _rowDivider(),
              _kv('Price', planPrice),
              _rowDivider(),
              _kv(expired ? 'Expired' : 'Renews from', expiryDate),
            ],
          ),
        ),
        const SizedBox(height: 13),
        const Text(
          'Renewing restores exclusive movies, series, your saved library and the channel watch immediately.',
          style: TextStyle(color: Nocturne.textFaint, fontSize: 11.5),
        ),
        const SizedBox(height: 14),
        _goldButton(label: 'Renew for $planPrice', onTap: onConfirm),
        const SizedBox(height: 8),
        _ghostButton(label: 'Not now', onTap: onDismiss),
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Container(
      color: const Color(0xFF101D43),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k,
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 12.5,
              )),
          Flexible(
            child: Text(
              v,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Nocturne.text, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _rowDivider() =>
      Container(height: 1, color: Nocturne.border);
}

// ─── Request ────────────────────────────────────────────────────────────

class _RequestSheet extends StatefulWidget {
  final String channelName;
  final RequestMembershipSubmit onSubmit;
  final VoidCallback onDone;

  const _RequestSheet({
    required this.channelName,
    required this.onSubmit,
    required this.onDone,
  });

  @override
  State<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<_RequestSheet> {
  final _note = TextEditingController();
  final _ref = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    _ref.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.onSubmit(_note.text.trim(), _ref.text.trim());
      if (!mounted) return;
      widget.onDone();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'REQUEST MEMBERSHIP',
          style: TextStyle(
            color: Nocturne.gold,
            fontSize: 9.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          widget.channelName,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 3),
        const Text(
          'Private membership — the channel reviews every request.',
          style: TextStyle(color: Nocturne.textFaint, fontSize: 12),
        ),
        const SizedBox(height: 14),
        _fieldLabel('Why do you want to join?'),
        _textArea(_note, 'A short note to the channel owner'),
        const SizedBox(height: 12),
        _fieldLabel('Referral code (optional)'),
        _textField(_ref, 'e.g. NG-4821'),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(
            _error!,
            style: const TextStyle(color: Nocturne.redSoft, fontSize: 11.5),
          ),
        ],
        const SizedBox(height: 14),
        _goldButton(
          label: _sending ? 'Sending…' : 'Send request',
          onTap: _sending ? () {} : _send,
        ),
      ],
    );
  }

  Widget _fieldLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Text(
          text,
          style: const TextStyle(color: Nocturne.textMuted, fontSize: 12),
        ),
      );

  Widget _textArea(TextEditingController c, String hint) {
    return TextField(
      controller: c,
      minLines: 3,
      maxLines: 4,
      cursorColor: Nocturne.gold,
      style: const TextStyle(color: Nocturne.text, fontSize: 13),
      decoration: _fieldDecoration(hint),
    );
  }

  Widget _textField(TextEditingController c, String hint) {
    return TextField(
      controller: c,
      cursorColor: Nocturne.gold,
      style: const TextStyle(color: Nocturne.text, fontSize: 13),
      decoration: _fieldDecoration(hint),
    );
  }

  InputDecoration _fieldDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Nocturne.textHint, fontSize: 13),
        filled: true,
        fillColor: const Color(0xFF101D43),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Nocturne.border, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Nocturne.border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Nocturne.gold, width: 1),
        ),
      );
}

// ─── About ──────────────────────────────────────────────────────────────

class _AboutSheet extends StatelessWidget {
  final String channelName;
  final String channelNumber;
  final String? description;

  const _AboutSheet({
    required this.channelName,
    required this.channelNumber,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    final body = (description ?? '').trim().isEmpty
        ? 'An Exclusive Channel with Private Membership on AfroVision, carrying original films and series for its members. Membership is approved by the channel and includes the exclusive library and channel $channelNumber watch.'
        : description!.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'About $channelName',
          style: const TextStyle(
            color: Nocturne.text,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          body,
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 13,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _factCell('Access', 'Members only')),
            const SizedBox(width: 10),
            Expanded(child: _factCell('Requires', 'KYC verified')),
          ],
        ),
        const SizedBox(height: 14),
        _ghostButton(label: 'Close', onTap: () => Navigator.of(context).pop()),
      ],
    );
  }

  Widget _factCell(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: const Color(0xFF101D43),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(color: Nocturne.text, fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}

// ─── Gate ───────────────────────────────────────────────────────────────

class _GateSheet extends StatelessWidget {
  final String channelName;
  final String expiryDate;
  final VoidCallback onRenew;
  final VoidCallback onBack;

  const _GateSheet({
    required this.channelName,
    required this.expiryDate,
    required this.onRenew,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'ACCESS RE-CHECKED',
          style: TextStyle(
            color: Nocturne.goldSoft,
            fontSize: 9.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Membership expired',
          style: TextStyle(
            color: Nocturne.text,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'This title belongs to $channelName, an Exclusive Channel. Your membership ended on $expiryDate, so playback is blocked until you renew.',
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 13,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 14),
        _goldButton(label: 'Renew membership', onTap: onRenew),
        const SizedBox(height: 8),
        _ghostButton(label: 'Back', onTap: onBack),
      ],
    );
  }
}
