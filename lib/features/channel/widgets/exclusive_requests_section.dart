import 'package:flutter/material.dart';

import '../../../core/theme/nocturne_theme.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

/// Requests-tab body for a channel owner/admin.
///
/// - Five filter chips (all + the four terminal/in-flight statuses).
/// - Each row shows requester + note + referral + timestamp and offers
///   Approve / Reject / More info actions.
/// - Reject and More-info inline-expand to a message input (More-info
///   requires a non-empty message per backend rules).
///
/// Presentation only — the actual auth/permission check has already been
/// done by [ChannelViewScreen] (`_canManage && ch.isExclusive`).
class ExclusiveRequestsSection extends StatefulWidget {
  final ChannelModel channel;
  const ExclusiveRequestsSection({super.key, required this.channel});

  @override
  State<ExclusiveRequestsSection> createState() =>
      _ExclusiveRequestsSectionState();
}

class _ExclusiveRequestsSectionState extends State<ExclusiveRequestsSection> {
  static const List<_Filter> _filters = [
    _Filter(label: 'All', value: null),
    _Filter(label: 'Pending', value: 'pending'),
    _Filter(label: 'Approved · pay', value: 'approved_pending_payment'),
    _Filter(label: 'Approved', value: 'approved'),
    _Filter(label: 'More info', value: 'more_info'),
    _Filter(label: 'Rejected', value: 'rejected'),
  ];

  String? _statusFilter;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final res = await ChannelService.listExclusiveRequests(
      widget.channel.id,
      status: _statusFilter,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _rows = List<Map<String, dynamic>>.from(res['requests'] as List);
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _error = res['message'] as String? ?? 'Could not load requests.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _filterChips(),
        const SizedBox(height: 12),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(
                child: CircularProgressIndicator(color: Nocturne.gold)),
          )
        else if (_error != null)
          _errorBlock(_error!)
        else if (_rows.isEmpty)
          _emptyBlock()
        else
          for (final r in _rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RequestCard(
                channelId: widget.channel.id,
                request: r,
                onChanged: _load,
              ),
            ),
      ],
    );
  }

  Widget _filterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final f in _filters) ...[
            _chip(f),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _chip(_Filter f) {
    final active = _statusFilter == f.value;
    return GestureDetector(
      onTap: () {
        setState(() => _statusFilter = f.value);
        _load();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? Nocturne.gold.withValues(alpha: 0.14)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? Nocturne.gold : Nocturne.border,
            width: 1,
          ),
        ),
        child: Text(
          f.label,
          style: TextStyle(
            color: active ? Nocturne.goldLight : Nocturne.textFaint,
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _emptyBlock() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 30),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.inbox_outlined,
                color: Nocturne.textHint, size: 30),
            const SizedBox(height: 10),
            Text(
              _statusFilter == null
                  ? 'No requests yet.'
                  : 'No requests in this filter.',
              style: const TextStyle(color: Nocturne.textFaint, fontSize: 12.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorBlock(String msg) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Nocturne.redSoft, size: 30),
          const SizedBox(height: 10),
          Text(msg,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(color: Nocturne.textMuted, fontSize: 12.5)),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _load,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: Nocturne.gold, width: 1),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: Nocturne.gold,
                  fontSize: 12.5,
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

class _Filter {
  final String label;
  final String? value;
  const _Filter({required this.label, required this.value});
}

class _RequestCard extends StatefulWidget {
  final String channelId;
  final Map<String, dynamic> request;
  final VoidCallback onChanged;
  const _RequestCard({
    required this.channelId,
    required this.request,
    required this.onChanged,
  });

  @override
  State<_RequestCard> createState() => _RequestCardState();
}

enum _PendingAction { none, reject, moreInfo }

class _RequestCardState extends State<_RequestCard> {
  _PendingAction _showing = _PendingAction.none;
  final _msg = TextEditingController();
  bool _acting = false;
  String? _error;

  Map<String, dynamic> get _r => widget.request;
  String get _id => _r['id'] as String? ?? '';
  String get _status => _r['status'] as String? ?? 'pending';
  String get _note => _r['note'] as String? ?? '';
  String get _adminMessage => _r['admin_message'] as String? ?? '';
  String get _userReply => _r['user_reply'] as String? ?? '';
  String get _referral => _r['referral_source'] as String? ?? '';

  bool get _canAct =>
      _status == 'pending' || _status == 'more_info';

  @override
  void dispose() {
    _msg.dispose();
    super.dispose();
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() {
      _acting = true;
      _error = null;
    });
    final res = await call();
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _acting = false;
        _showing = _PendingAction.none;
        _msg.clear();
      });
      widget.onChanged();
    } else {
      setState(() {
        _acting = false;
        _error = res['message'] as String? ?? 'Action failed.';
      });
    }
  }

  void _onApprove() {
    _run(() => ChannelService.approveExclusiveRequest(widget.channelId, _id));
  }

  void _onReject() {
    _run(() => ChannelService.rejectExclusiveRequest(
          widget.channelId,
          _id,
          adminMessage: _msg.text.trim().isEmpty ? null : _msg.text.trim(),
        ));
  }

  void _onMoreInfo() {
    if (_msg.text.trim().isEmpty) {
      setState(
          () => _error = 'A message is required so the applicant knows what to answer.');
      return;
    }
    _run(() => ChannelService.requestMoreInfoExclusiveRequest(
          widget.channelId,
          _id,
          adminMessage: _msg.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Nocturne.surfaceRaised,
        borderRadius: BorderRadius.circular(Nocturne.radiusLg),
        border: Border.all(color: Nocturne.borderCard, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  _requesterLabel(_r),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Nocturne.text,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _statusPill(_status),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_rounded,
                  size: 12, color: Nocturne.textHint),
              const SizedBox(width: 4),
              Text(
                _formatTimestamp(_r['created_at']),
                style: const TextStyle(
                    color: Nocturne.textHint, fontSize: 10.5),
              ),
              if (_referral.isNotEmpty) ...[
                const SizedBox(width: 10),
                const Icon(Icons.person_pin_circle_outlined,
                    size: 12, color: Nocturne.textHint),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    _referral,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Nocturne.textHint, fontSize: 10.5),
                  ),
                ),
              ],
            ],
          ),
          if (_note.isNotEmpty) ...[
            const SizedBox(height: 10),
            _kvBlock('Note', _note),
          ],
          if (_userReply.isNotEmpty) ...[
            const SizedBox(height: 8),
            _kvBlock('Applicant reply', _userReply),
          ],
          if (_adminMessage.isNotEmpty) ...[
            const SizedBox(height: 8),
            _kvBlock('Your last message', _adminMessage),
          ],
          if (_showing != _PendingAction.none) ...[
            const SizedBox(height: 10),
            _messageField(),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(
                    color: Nocturne.redSoft, fontSize: 11.5)),
          ],
          if (_canAct) ...[
            const SizedBox(height: 12),
            _actionRow(),
          ],
        ],
      ),
    );
  }

  Widget _actionRow() {
    if (_showing == _PendingAction.reject) {
      return _twoButtons(
        primaryLabel: 'Send rejection',
        primaryColor: Nocturne.redSoft,
        onPrimary: _onReject,
        onCancel: () {
          setState(() {
            _showing = _PendingAction.none;
            _msg.clear();
            _error = null;
          });
        },
      );
    }
    if (_showing == _PendingAction.moreInfo) {
      return _twoButtons(
        primaryLabel: 'Send request',
        primaryColor: Nocturne.gold,
        onPrimary: _onMoreInfo,
        onCancel: () {
          setState(() {
            _showing = _PendingAction.none;
            _msg.clear();
            _error = null;
          });
        },
      );
    }
    return Row(
      children: [
        Expanded(
          child: _pillButton(
            label: 'Approve',
            fg: Nocturne.green,
            onTap: _acting ? null : _onApprove,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _pillButton(
            label: 'More info',
            fg: Nocturne.gold,
            onTap: _acting
                ? null
                : () => setState(() => _showing = _PendingAction.moreInfo),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _pillButton(
            label: 'Reject',
            fg: Nocturne.redSoft,
            onTap: _acting
                ? null
                : () => setState(() => _showing = _PendingAction.reject),
          ),
        ),
      ],
    );
  }

  Widget _twoButtons({
    required String primaryLabel,
    required Color primaryColor,
    required VoidCallback onPrimary,
    required VoidCallback onCancel,
  }) {
    return Row(
      children: [
        Expanded(
          child: _pillButton(
            label: 'Cancel',
            fg: Nocturne.textMuted,
            onTap: _acting ? null : onCancel,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _pillButton(
            label: _acting ? 'Sending…' : primaryLabel,
            fg: primaryColor,
            filled: true,
            onTap: _acting ? null : onPrimary,
          ),
        ),
      ],
    );
  }

  Widget _pillButton({
    required String label,
    required Color fg,
    required VoidCallback? onTap,
    bool filled = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.45 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: filled ? fg.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: fg, width: 1),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }

  Widget _messageField() {
    return TextField(
      controller: _msg,
      minLines: 2,
      maxLines: 4,
      cursorColor: Nocturne.gold,
      style: const TextStyle(color: Nocturne.text, fontSize: 12.5),
      decoration: InputDecoration(
        hintText: _showing == _PendingAction.moreInfo
            ? 'Ask the applicant a question…'
            : 'Reason (optional)',
        hintStyle: const TextStyle(color: Nocturne.textHint, fontSize: 12.5),
        filled: true,
        fillColor: const Color(0xFF101D43),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
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
      ),
    );
  }

  Widget _kvBlock(String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(11, 8, 11, 10),
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
            style: const TextStyle(
              color: Nocturne.textDim,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String status) {
    Color fg = Nocturne.textMuted;
    Color bg = Nocturne.border;
    String label = status.toUpperCase();
    switch (status) {
      case 'pending':
        fg = Nocturne.blueSoft;
        bg = Nocturne.blue.withValues(alpha: 0.16);
        label = 'PENDING';
        break;
      case 'approved_pending_payment':
        fg = Nocturne.goldLight;
        bg = Nocturne.gold.withValues(alpha: 0.14);
        label = 'APPROVED · PAY';
        break;
      case 'approved':
        fg = Nocturne.green;
        bg = Nocturne.greenWash;
        label = 'APPROVED';
        break;
      case 'rejected':
        fg = Nocturne.redSoft;
        bg = Nocturne.red.withValues(alpha: 0.14);
        label = 'REJECTED';
        break;
      case 'more_info':
        fg = Nocturne.goldSoft;
        bg = const Color(0xFF4A3A1A);
        label = 'MORE INFO';
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

String _requesterLabel(Map<String, dynamic> r) {
  // Backend enriches with requester_name / requester_email (Phase 3). Fall
  // back to a short uid if neither is present, so the row is always
  // uniquely identifiable.
  final name = (r['requester_name'] as String?)?.trim();
  if (name != null && name.isNotEmpty) return name;
  final email = (r['requester_email'] as String?)?.trim();
  if (email != null && email.isNotEmpty) return email;
  final uid = r['user_uid'] as String? ?? '—';
  final short = uid.length > 8 ? '${uid.substring(0, 8)}…' : uid;
  return 'Applicant $short';
}

String _formatTimestamp(dynamic tsMillis) {
  final n = (tsMillis is num) ? tsMillis.toInt() : 0;
  if (n <= 0) return '—';
  final d = DateTime.fromMillisecondsSinceEpoch(n);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final h = d.hour.toString().padLeft(2, '0');
  final m = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${months[d.month - 1]} ${d.year} · $h:$m';
}
