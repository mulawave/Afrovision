import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../../channel/services/channel_service.dart';
import '../../notifications/services/notification_inbox_service.dart';

/// Status screen for an in-flight exclusive-channel membership request.
///
/// Rendered from notifications, from the Send-Request confirmation, and
/// from the channel admin tab. Shows the current status, the admin's last
/// message (if any), and — when status is `more_info` — a reply field
/// that posts back to the same request.
///
/// Route: `/exclusive-request-status`. Expects a
/// `{channelId: String, requestId: String, channelName: String}` map as
/// `settings.arguments`.
class ExclusiveRequestStatusScreen extends StatefulWidget {
  final String channelId;
  final String requestId;
  final String channelName;

  /// Optional inbox id — when present, the screen marks it read on load so
  /// the app-icon badge and the inbox row reflect that the user has seen
  /// the update.
  final String? notificationId;

  const ExclusiveRequestStatusScreen({
    super.key,
    required this.channelId,
    required this.requestId,
    required this.channelName,
    this.notificationId,
  });

  /// Convenience constructor from named-route arguments.
  static ExclusiveRequestStatusScreen fromArgs(Object? args) {
    final map = (args as Map<String, dynamic>?) ?? const {};
    return ExclusiveRequestStatusScreen(
      channelId: (map['channelId'] as String?) ?? '',
      requestId: (map['requestId'] as String?) ?? '',
      channelName: (map['channelName'] as String?) ?? 'Channel',
      notificationId: map['notificationId'] as String?,
    );
  }

  @override
  State<ExclusiveRequestStatusScreen> createState() =>
      _ExclusiveRequestStatusScreenState();
}

class _ExclusiveRequestStatusScreenState
    extends State<ExclusiveRequestStatusScreen> {
  Map<String, dynamic>? _request;
  bool _loading = true;
  String? _error;

  final _reply = TextEditingController();
  bool _replying = false;

  @override
  void initState() {
    super.initState();
    _load();
    _markNotificationRead();
  }

  Future<void> _markNotificationRead() async {
    final nid = widget.notificationId;
    if (nid == null || nid.isEmpty) return;
    try {
      await NotificationInboxService.markRead(nid);
    } catch (_) {
      // Non-critical — the badge just doesn't decrement.
    }
  }

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.channelId.isEmpty || widget.requestId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing request context.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final res = await ChannelService.fetchExclusiveRequest(
      widget.channelId,
      widget.requestId,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _request = res['request'] as Map<String, dynamic>?;
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _error = res['message'] as String? ?? 'Could not load request.';
      });
    }
  }

  Future<void> _sendReply() async {
    final text = _reply.text.trim();
    if (text.isEmpty) return;
    setState(() => _replying = true);
    final res = await ChannelService.replyToExclusiveRequest(
      widget.channelId,
      widget.requestId,
      reply: text,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      _reply.clear();
      await _load();
    } else {
      setState(() {
        _replying = false;
        _error = res['message'] as String? ?? 'Could not send reply.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Nocturne.bg,
      appBar: AppBar(
        backgroundColor: Nocturne.bg,
        foregroundColor: Nocturne.text,
        elevation: 0,
        title: const Text('Membership request',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Nocturne.gold))
            : _error != null
                ? _buildError(_error!)
                : _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final r = _request ?? const <String, dynamic>{};
    final status = (r['status'] as String?) ?? 'pending';
    final note = (r['note'] as String?) ?? '';
    final adminMessage = (r['admin_message'] as String?) ?? '';
    final userReply = (r['user_reply'] as String?) ?? '';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.channelName,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 20,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          _statusPill(status),
          const SizedBox(height: 18),
          _kvSection('Your note', note.isEmpty ? '—' : note),
          if (adminMessage.isNotEmpty) ...[
            const SizedBox(height: 14),
            _kvSection('Admin message', adminMessage),
          ],
          if (userReply.isNotEmpty && status != 'more_info') ...[
            const SizedBox(height: 14),
            _kvSection('Your last reply', userReply),
          ],
          if (status == 'more_info') ...[
            const SizedBox(height: 18),
            const Text(
              'Reply to admin',
              style: TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _reply,
              minLines: 3,
              maxLines: 6,
              cursorColor: Nocturne.gold,
              style: const TextStyle(color: Nocturne.text, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Answer the admin\'s question…',
                hintStyle:
                    const TextStyle(color: Nocturne.textHint, fontSize: 13),
                filled: true,
                fillColor: const Color(0xFF101D43),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 11, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(9),
                  borderSide:
                      const BorderSide(color: Nocturne.border, width: 1),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(9),
                  borderSide:
                      const BorderSide(color: Nocturne.border, width: 1),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(9),
                  borderSide: const BorderSide(color: Nocturne.gold, width: 1),
                ),
              ),
            ),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _replying ? null : _sendReply,
              child: Opacity(
                opacity: _replying ? 0.45 : 1,
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
                    _replying ? 'Sending…' : 'Send reply',
                    style: const TextStyle(
                      color: Nocturne.goldLight,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusPill(String status) {
    Color fg = Nocturne.textMuted;
    Color bg = Nocturne.border;
    String label = status;
    switch (status) {
      case 'pending':
        fg = Nocturne.blueSoft;
        bg = Nocturne.blue.withValues(alpha: 0.16);
        label = 'PENDING · awaiting review';
        break;
      case 'approved_pending_payment':
        fg = Nocturne.goldLight;
        bg = Nocturne.gold.withValues(alpha: 0.14);
        label = 'APPROVED · pay to activate';
        break;
      case 'approved':
        fg = Nocturne.green;
        bg = Nocturne.greenWash;
        label = 'APPROVED · access active';
        break;
      case 'rejected':
        fg = Nocturne.redSoft;
        bg = Nocturne.red.withValues(alpha: 0.14);
        label = 'REJECTED';
        break;
      case 'more_info':
        fg = Nocturne.goldSoft;
        bg = const Color(0xFF4A3A1A);
        label = 'MORE INFO REQUESTED';
        break;
    }
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.7,
          ),
        ),
      ),
    );
  }

  Widget _kvSection(String label, String value) {
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 13),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(Nocturne.radiusLg),
        border: Border.all(color: Nocturne.borderCard, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 13,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String msg) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Nocturne.redSoft, size: 40),
          const SizedBox(height: 12),
          Text(
            msg,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Nocturne.textMuted, fontSize: 12.5),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: _load,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Nocturne.gold, width: 1),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: Nocturne.gold,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
