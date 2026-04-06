import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../models/interaction_models.dart';
import '../services/interaction_service.dart';
import '../services/live_chat_service.dart';

class LiveChatPanel extends StatefulWidget {
  final String channelId;

  const LiveChatPanel({super.key, required this.channelId});

  @override
  State<LiveChatPanel> createState() => _LiveChatPanelState();
}

class _LiveChatPanelState extends State<LiveChatPanel> {
  final _service = LiveChatService();
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final List<LiveChatMessageModel> _messages = [];

  StreamSubscription<LiveChatMessageModel>? _messageSub;
  StreamSubscription<int>? _viewerSub;
  StreamSubscription<LiveChatStatus>? _statusSub;

  bool _loading = true;
  bool _connected = false;
  bool _sending = false;
  int _viewerCount = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _messageSub?.cancel();
    _viewerSub?.cancel();
    _statusSub?.cancel();
    _service.dispose();
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    _messageSub = _service.messages.listen((message) {
      if (!mounted) return;
      setState(() {
        if (_messages.any((item) => item.id == message.id)) return;
        _messages.add(message);
        if (_messages.length > 100) {
          _messages.removeRange(0, _messages.length - 100);
        }
      });
      _scrollToBottom();
    });

    _viewerSub = _service.viewerCounts.listen((viewerCount) {
      if (!mounted) return;
      setState(() => _viewerCount = viewerCount);
    });

    _statusSub = _service.statuses.listen((status) {
      if (!mounted) return;
      setState(() {
        _connected = status.connected;
        if (status.connected) {
          _error = null;
        }
        if (status.error != null && status.error!.isNotEmpty) {
          _error = status.error;
        }
      });
    });

    try {
      final history = await InteractionService.getChatMessages(
        widget.channelId,
      );
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(history);
      });
      await _service.connect(widget.channelId);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        _scrollToBottom();
      }
    }
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() {
      _sending = true;
      _error = null;
    });

    final error = await _service.sendMessage(text);
    if (!mounted) return;

    setState(() => _sending = false);
    if (error != null) {
      setState(() => _error = error);
      return;
    }

    _inputController.clear();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Color _nameColor(String name) {
    const palette = [
      AppColors.orange,
      AppColors.lightOrange,
      AppColors.successGreen,
      AppColors.infoBlue,
      AppColors.softBlue,
    ];
    final hash = name.codeUnits.fold<int>(0, (sum, unit) => sum + unit);
    return palette[hash % palette.length];
  }

  Color _badgeColor(String? badge) {
    switch (badge) {
      case 'mod':
        return AppColors.successGreen;
      case 'vip':
        return AppColors.infoBlue;
      case 'sub':
        return AppColors.lightOrange;
      default:
        return AppColors.hintText;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.24),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Live Chat',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color:
                      (_connected ? AppColors.successGreen : AppColors.hintText)
                          .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color:
                        (_connected
                                ? AppColors.successGreen
                                : AppColors.hintText)
                            .withValues(alpha: 0.24),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _connected
                            ? AppColors.successGreen
                            : AppColors.hintText,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _connected ? 'Connected' : 'Connecting',
                      style: TextStyle(
                        color: _connected
                            ? AppColors.successGreen
                            : AppColors.hintText,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                '$_viewerCount watching',
                style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: 0.85),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.errorRed.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.errorRed.withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                _error!,
                style: const TextStyle(
                  color: AppColors.errorRed,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Container(
            height: 260,
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.inputBorder.withValues(alpha: 0.24),
              ),
            ),
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.orange),
                  )
                : _messages.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        'Chat is live. Be the first viewer to say something.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.85),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final message = _messages[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: message.isOwn
                              ? AppColors.orange.withValues(alpha: 0.08)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (message.badge != null) ...[
                              Container(
                                margin: const EdgeInsets.only(top: 2, right: 8),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: _badgeColor(
                                    message.badge,
                                  ).withValues(alpha: 0.16),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  message.badge!.toUpperCase(),
                                  style: TextStyle(
                                    color: _badgeColor(message.badge),
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                            Expanded(
                              child: RichText(
                                text: TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '${message.senderName} ',
                                      style: TextStyle(
                                        color: _nameColor(message.senderName),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    TextSpan(
                                      text: message.text,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _inputController,
                  maxLength: 200,
                  style: const TextStyle(color: AppColors.white),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: 'Send a message...',
                    hintStyle: TextStyle(
                      color: AppColors.hintText.withValues(alpha: 0.7),
                    ),
                    filled: true,
                    fillColor: AppColors.inputFill,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: AppColors.inputBorder.withValues(alpha: 0.3),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppColors.orange),
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: (!_connected || _sending) ? null : _sendMessage,
                child: AnimatedOpacity(
                  opacity: (!_connected || _sending) ? 0.5 : 1,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppColors.buttonGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: _sending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              color: AppColors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'Send',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${_inputController.text.length}/200 · Be respectful. Chat rules apply.',
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.75),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
