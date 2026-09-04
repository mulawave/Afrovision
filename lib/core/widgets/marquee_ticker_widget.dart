import 'dart:async';
import 'package:flutter/material.dart';
import '../../features/auth/services/home_service.dart';
import '../theme/nocturne_theme.dart';

class MarqueeTickerWidget extends StatefulWidget {
  const MarqueeTickerWidget({super.key});

  @override
  State<MarqueeTickerWidget> createState() => _MarqueeTickerWidgetState();
}

class _MarqueeTickerWidgetState extends State<MarqueeTickerWidget> {
  List<String> _topics = [];
  late ScrollController _controller;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = ScrollController();
    _loadTopics();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadTopics() async {
    try {
      final topics = await HomeService.getMarqueeTopics();
      if (!mounted) return;
      if (topics.isNotEmpty) {
        setState(() => _topics = topics);
        _startScrolling();
      }
    } catch (_) {}
  }

  void _startScrolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (!mounted || !_controller.hasClients) return;
      final max = _controller.position.maxScrollExtent;
      final current = _controller.offset;
      if (current >= max) {
        _controller.jumpTo(0);
      } else {
        _controller.jumpTo(current + 0.8);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_topics.isEmpty) return const SizedBox.shrink();
    final text = _topics.join('     ·     ');
    final fullText = '$text     ·     $text';
    return Container(
      width: double.infinity,
      color: Nocturne.surfaceDeep,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: SingleChildScrollView(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Text(
            fullText,
            style: const TextStyle(
              color: Nocturne.textFaint,
              fontSize: 10.5,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.1,
            ),
            maxLines: 1,
          ),
        ),
      ),
    );
  }
}
