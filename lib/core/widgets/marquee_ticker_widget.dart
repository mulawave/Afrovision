import 'dart:async';
import 'package:flutter/material.dart';
import '../../features/auth/services/home_service.dart';

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
    final text = _topics.join('   •   ');
    final fullText = '$text   •   $text';
    return Container(
      width: double.infinity,
      height: 32,
      margin: const EdgeInsets.symmetric(vertical: 10),
      color: Colors.black,
      child: SingleChildScrollView(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            fullText,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
            maxLines: 1,
          ),
        ),
      ),
    );
  }
}
