import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';

/// Channel search bottom sheet.
///
/// - 74 % viewport height, 22 px rounded top, gold-tinted hairline border.
/// - 180 ms debounce on the search input.
/// - Filters exclusive channels out of every result.
/// - Empty state offers a hand-off to the channel-number dial.
class ChannelSearchSheet extends StatefulWidget {
  const ChannelSearchSheet({
    super.key,
    this.channels,
  });

  final List<ChannelModel>? channels;

  static Future<void> show(
    BuildContext context, {
    List<ChannelModel>? channels,
  }) async {
    List<ChannelModel> all = channels ?? [];
    if (all.isEmpty) {
      try {
        all = await ChannelService.getPublicChannels();
      } catch (_) {
        all = [];
      }
    }
    if (!context.mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0xA8040814),
      builder: (_) => ChannelSearchSheet(channels: all),
    );
  }

  @override
  State<ChannelSearchSheet> createState() => _ChannelSearchSheetState();
}

class _ChannelSearchSheetState extends State<ChannelSearchSheet> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();
  List<ChannelModel> _all = [];
  List<ChannelModel> _results = [];
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _all = (widget.channels ?? []).where((c) => !c.isExclusive).toList();
    _results = _all.take(6).toList();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onQuery(String q) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 180), () => _search(q));
  }

  void _search(String q) {
    final query = q.trim().toLowerCase();
    if (query.isEmpty) {
      setState(() => _results = _all.take(6).toList());
      return;
    }

    setState(() {
      _results = _all.where((c) {
        return c.name.toLowerCase().contains(query) ||
            (c.ownerName ?? '').toLowerCase().contains(query) ||
            (c.category ?? '').toLowerCase().contains(query) ||
            c.channelNumber.toLowerCase().contains(query);
      }).toList();
    });
  }

  void _clear() {
    _controller.clear();
    _search('');
  }

  void _openDial() {
    Navigator.pop(context);
    Navigator.pushNamed(context, '/channel-access');
  }

  void _openChannel(ChannelModel ch) {
    Navigator.pop(context);
    Navigator.pushNamed(context, '/channel-view', arguments: ch.id);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final hasQuery = _controller.text.trim().isNotEmpty;

    return Container(
      height: MediaQuery.of(context).size.height * 0.74,
      padding: EdgeInsets.only(bottom: bottom),
      decoration: const BoxDecoration(
        color: Nocturne.surface,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(22),
          topRight: Radius.circular(22),
        ),
        border: Border(
          top: BorderSide(color: Color(0xFFA8761F), width: 1),
          left: BorderSide(color: Color(0xFFA8761F), width: 1),
          right: BorderSide(color: Color(0xFFA8761F), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x8C000000),
            blurRadius: 50,
            offset: Offset(0, -20),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            const SizedBox(height: 10),
            // Grabber
            Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: Nocturne.gold,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Search input
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0E1A3D),
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: const Color(0xFFA8761F)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.search_rounded,
                      color: Nocturne.gold,
                      size: 19,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        onChanged: _onQuery,
                        cursorColor: Nocturne.gold,
                        style: const TextStyle(
                          color: Nocturne.text,
                          fontSize: 14,
                        ),
                        decoration: const InputDecoration(
                          hintText: 'Search channels...',
                          hintStyle: TextStyle(
                            color: Nocturne.textHint,
                            fontSize: 14,
                          ),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    if (hasQuery)
                      GestureDetector(
                        onTap: _clear,
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            color: Nocturne.textMuted,
                            size: 14,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Label
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 9),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  hasQuery
                      ? '${_results.length} result${_results.length == 1 ? '' : 's'}'
                      : 'Suggested',
                  style: const TextStyle(
                    color: Nocturne.textFaint,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ),
            // Results
            Expanded(
              child: _results.isEmpty
                  ? _buildEmpty(hasQuery ? _controller.text.trim() : '')
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _results.length,
                      itemBuilder: (context, i) => _buildRow(_results[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(ChannelModel ch) {
    return GestureDetector(
      onTap: () => _openChannel(ch),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Nocturne.surfaceRaised,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: Nocturne.borderCard),
        ),
        child: Row(
          children: [
            _initialsMark(ch),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ch.name,
                    style: const TextStyle(
                      color: Nocturne.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  _metaRow(ch),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Nocturne.gold,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(String query) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.search_rounded,
            color: Color(0xFF3D4D7D),
            size: 32,
          ),
          const SizedBox(height: 10),
          Text(
            query.isEmpty ? 'No channels yet' : 'No channel matches "$query"',
            style: const TextStyle(
              color: Nocturne.text,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 3),
          const Text(
            'Try a channel number instead.',
            style: TextStyle(
              color: Nocturne.textFaint,
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _openDial,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Nocturne.gold),
              ),
              child: const Text(
                'Enter channel number',
                style: TextStyle(
                  color: Nocturne.goldLight,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaRow(ChannelModel ch) {
    return Row(
      children: [
        if (ch.ownerName != null && ch.ownerName!.trim().isNotEmpty) ...[
          Flexible(
            child: Text(
              'By ${ch.ownerName!}',
              style: const TextStyle(
                color: Nocturne.textFaint,
                fontSize: 10.5,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _dot(),
        ],
        if (ch.category != null && ch.category!.isNotEmpty) ...[
          Text(
            ch.category!,
            style: const TextStyle(
              color: Nocturne.goldLight,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          _dot(),
        ],
        const Icon(
          Icons.people_alt_rounded,
          color: Nocturne.textFaint,
          size: 11,
        ),
        const SizedBox(width: 3),
        Text(
          '${ch.subscriberCount}',
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
          ),
        ),
        _dot(),
        Text(
          '#${ch.channelNumber}',
          style: const TextStyle(
            color: Nocturne.textFaint,
            fontSize: 10.5,
          ),
        ),
      ],
    );
  }

  Widget _dot() {
    return Container(
      width: 3,
      height: 3,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: const BoxDecoration(
        color: Nocturne.textHint,
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _initialsMark(ChannelModel ch) {
    final hasLogo = ch.logoUrl != null && ch.logoUrl!.isNotEmpty;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: hasLogo ? null : _markColor(ch.name),
        border: Border.all(color: Nocturne.borderStrong),
        image: hasLogo
            ? DecorationImage(
                image: NetworkImage(AppConfig.mediaUrl(ch.logoUrl!)),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: hasLogo
          ? null
          : Center(
              child: Text(
                _initials(ch.name),
                style: const TextStyle(
                  color: Nocturne.text,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
    );
  }

  Color _markColor(String name) {
    final palette = [
      const Color(0xFF8A2FBE),
      const Color(0xFF1B63C4),
      const Color(0xFFC0271F),
      const Color(0xFF2F9E6B),
      const Color(0xFFC9721F),
      const Color(0xFF38507F),
      const Color(0xFF7A4A9C),
      const Color(0xFFA8306F),
    ];
    final i = name.hashCode.abs() % palette.length;
    return palette[i];
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts[0].take(2).toUpperCase();
    }
    return (parts[0].take(1) + parts[1].take(1)).toUpperCase();
  }
}

extension _StringX on String {
  String take(int n) => length <= n ? this : substring(0, n);
}
