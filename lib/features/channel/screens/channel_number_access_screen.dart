import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/nocturne_theme.dart';
import '../models/channel_model.dart';
import '../services/channel_service.dart';
import '../utils/channels_gate.dart';
import '../widgets/channels_header.dart';

class ChannelNumberAccessScreen extends StatefulWidget {
  const ChannelNumberAccessScreen({super.key});

  @override
  State<ChannelNumberAccessScreen> createState() =>
      _ChannelNumberAccessScreenState();
}

class _ChannelNumberAccessScreenState extends State<ChannelNumberAccessScreen>
    with SingleTickerProviderStateMixin {
  final List<String> _keys = const [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '⌫',
    '0',
    '✓',
  ];

  String _dial = '';
  String? _dialError;
  bool _loading = false;
  String? _recentNumber;
  String? _recentName;

  // Real, native text input for the channel number. The on-screen keypad
  // below is a convenience — it just writes into this same controller — but
  // the field itself is what guarantees entry actually works: it goes
  // through Android's normal IME/text-input path, which is unaffected by
  // the gesture-arena/touch-dispatch issue that made the on-screen keypad
  // alone unreliable on at least one real device (confirmed: neither
  // InkWell.onTap nor a raw Listener.onPointerDown on the keypad buttons
  // registered taps there, while ordinary widgets elsewhere on screen did).
  late final TextEditingController _dialController;
  final FocusNode _dialFocusNode = FocusNode();

  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _dialController = TextEditingController();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadRecent();
    _animController.forward();
  }

  @override
  void dispose() {
    _dialController.dispose();
    _dialFocusNode.dispose();
    _animController.dispose();
    super.dispose();
  }

  void _setDial(String value) {
    final allDigits = value.replaceAll(RegExp(r'[^0-9]'), '');
    final digitsOnly =
        allDigits.length > 6 ? allDigits.substring(0, 6) : allDigits;
    setState(() {
      _dialError = null;
      _dial = digitsOnly;
    });
    if (_dialController.text != digitsOnly) {
      _dialController.value = TextEditingValue(
        text: digitsOnly,
        selection: TextSelection.collapsed(offset: digitsOnly.length),
      );
    }
  }

  Future<void> _loadRecent() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _recentNumber = prefs.getString('recent_channel_number');
      _recentName = prefs.getString('recent_channel_name');
    });
  }

  Future<void> _saveRecent(ChannelModel channel) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('recent_channel_number', channel.channelNumber);
    await prefs.setString('recent_channel_name', channel.name);
    setState(() {
      _recentNumber = channel.channelNumber;
      _recentName = channel.name;
    });
  }

  void _pressKey(String key) {
    if (key == '⌫') {
      if (_dial.isNotEmpty) {
        _setDial(_dial.substring(0, _dial.length - 1));
      }
    } else if (key == '✓') {
      // The check/submit key actually tunes in to the currently entered number.
      _access();
    } else {
      _setDial(_dial + key);
    }
  }

  Future<void> _access() async {
    final number = _dial.trim();
    if (number.isEmpty) {
      setState(() => _dialError = 'Enter a channel number to continue.');
      return;
    }

    setState(() {
      _dialError = null;
      _loading = true;
    });

    try {
      final channel = await ChannelService.getChannelByNumber(number);
      if (!mounted) return;

      if (channel.isExclusive) {
        final canWatch = await ChannelsGate.canWatchByNumber(channel);
        if (!mounted) return;
        if (!canWatch) {
          setState(() {
            _loading = false;
            _dialError =
                '${channel.name} is an Exclusive Channel with Private Membership — membership is verified before watch.';
          });
          return;
        }
      }

      await _saveRecent(channel);
      if (!mounted) return;

      setState(() => _loading = false);
      await Navigator.pushNamed(
        context,
        '/channel-view',
        arguments: channel,
      );
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().toLowerCase();
      setState(() {
        _loading = false;
        if (message.contains('not found') || message.contains('404')) {
          _dialError = 'No channel found on #$number. Check the number and try again.';
        } else {
          _dialError = 'No channel found on #$number. Check the number and try again.';
        }
      });
    }
  }

  /// Wraps [child] in a tap target that works reliably on Android when
  /// nested inside a scrollable + GridView.
  ///
  /// A prior version relied on `InkWell`'s `onTap` (a `TapGestureRecognizer`)
  /// to win the gesture arena against the ancestor `SingleChildScrollView`.
  /// On at least one confirmed budget Android device that recognizer loses
  /// the arena even for a stationary tap — the scroll view's drag recognizer
  /// wins the tie — so `onTap` silently never fires for any button on this
  /// screen, including the keypad and "Access Channel". `Listener.onPointerDown`
  /// bypasses gesture-arena negotiation entirely by firing on the raw pointer
  /// event, so it can't lose that race. `InkWell` is kept only for the visual
  /// ripple; its own `onTap` is a no-op so the action isn't invoked twice.
  Widget _tappable({
    required Widget child,
    required VoidCallback? onTap,
    BorderRadius? borderRadius,
  }) {
    if (onTap == null) return child;
    return Listener(
      onPointerDown: (_) => onTap(),
      child: Material(
        type: MaterialType.transparency,
        borderRadius: borderRadius,
        child: InkWell(
          onTap: () {},
          borderRadius: borderRadius,
          child: child,
        ),
      ),
    );
  }

  void _openPaywall() {
    // Requires a loaded exclusive channel. If the user has typed an
    // exclusive number but has no access, the paywall is the next step.
    // The number itself is enough to identify the channel; the paywall
    // will resolve the channel and its access status again.
    Navigator.pushNamed(context, '/exclusive-access', arguments: _dial);
  }

  @override
  Widget build(BuildContext context) {
    final hasDial = _dial.isNotEmpty;
    final hasRecent = _recentNumber != null && _recentNumber!.isNotEmpty;

    return Scaffold(
      backgroundColor: Nocturne.bg,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Column(
            children: [
              const ChannelsHeader(
                title: 'Access Channel',
                subtitle: 'Tune in by number',
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 24),
                  child: Column(
                    children: [
                      // Hero
                      Container(
                        width: 84,
                        height: 84,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.03),
                          border: Border.all(
                            color: const Color(0xFFA8761F),
                            width: 1.5,
                          ),
                        ),
                        child: const Icon(
                          Icons.apps_rounded,
                          color: Nocturne.gold,
                          size: 32,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Enter Channel Number',
                        style: TextStyle(
                          color: Nocturne.text,
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Access private and public channels by number',
                        style: TextStyle(
                          color: Nocturne.goldSoft,
                          fontSize: 12.5,
                        ),
                      ),
                      const SizedBox(height: 26),

                      // Number field
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Channel number',
                            style: TextStyle(
                              color: Nocturne.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 14,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0E1A3D),
                              borderRadius: BorderRadius.circular(13),
                              border: Border.all(color: Nocturne.borderCard),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.tag_rounded,
                                  color: Nocturne.textHint,
                                  size: 17,
                                ),
                                const SizedBox(width: 10),
                                // Real text input — the on-screen keypad below
                                // also writes into this same controller, but
                                // this field is what makes typing actually
                                // work: it uses Android's normal IME/keyboard
                                // path, not a synthetic tap target.
                                Expanded(
                                  child: TextField(
                                    controller: _dialController,
                                    focusNode: _dialFocusNode,
                                    onChanged: _setDial,
                                    onSubmitted: (_) => _access(),
                                    keyboardType: TextInputType.number,
                                    textInputAction: TextInputAction.done,
                                    maxLength: 6,
                                    maxLines: 1,
                                    style: const TextStyle(
                                      color: Nocturne.text,
                                      fontSize: 19,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.1,
                                    ),
                                    cursorColor: Nocturne.gold,
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      isCollapsed: true,
                                      border: InputBorder.none,
                                      counterText: '',
                                      hintText: 'e.g. 839271',
                                      hintStyle: TextStyle(
                                        color: Color(0xFF5D6A92),
                                        fontSize: 19,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                if (hasDial)
                                  _tappable(
                                    borderRadius: BorderRadius.circular(8),
                                    onTap: () => _setDial(''),
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
                          if (_dialError != null) ...[
                            const SizedBox(height: 9),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFF17224A),
                                borderRadius: BorderRadius.circular(11),
                                border: Border.all(
                                  color: const Color(0xFFA8761F),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.warning_amber_rounded,
                                        color: Nocturne.goldLight,
                                        size: 16,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _dialError!,
                                          style: const TextStyle(
                                            color: Nocturne.goldSoft,
                                            fontSize: 11.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (_dialError!.contains('Exclusive Channel'))
                                    Padding(
                                      padding: const EdgeInsets.only(top: 10),
                                      child: _tappable(
                                        borderRadius: BorderRadius.circular(10),
                                        onTap: _openPaywall,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            vertical: 9,
                                          ),
                                          decoration: BoxDecoration(
                                            borderRadius:
                                                BorderRadius.circular(10),
                                            border: Border.all(
                                                color: Nocturne.gold),
                                          ),
                                          alignment: Alignment.center,
                                          child: const Text(
                                            'Open membership paywall',
                                            style: TextStyle(
                                              color: Nocturne.goldLight,
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),

                      const SizedBox(height: 18),

                      // Keypad
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _keys.length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          childAspectRatio: 1.6,
                          crossAxisSpacing: 9,
                          mainAxisSpacing: 9,
                        ),
                        itemBuilder: (context, index) {
                          final key = _keys[index];
                          final special = key == '⌫' || key == '✓';

                          return _tappable(
                            borderRadius: BorderRadius.circular(13),
                            onTap: () => _pressKey(key),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.02),
                                borderRadius: BorderRadius.circular(13),
                                border: Border.all(color: Nocturne.border),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                key,
                                style: TextStyle(
                                  color: special
                                      ? Nocturne.goldLight
                                      : Nocturne.text,
                                  fontSize: special ? 17 : 19,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 16),

                      // Access Channel
                      _tappable(
                        borderRadius: BorderRadius.circular(13),
                        onTap: _loading ? null : _access,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            gradient: Nocturne.goldCta,
                            borderRadius: BorderRadius.circular(13),
                            boxShadow: [
                              BoxShadow(
                                color: Nocturne.gold.withValues(alpha: 0.2),
                                blurRadius: 22,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: _loading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Color(0xFF26170A),
                                    ),
                                  ),
                                )
                              : const Text(
                                  'Access Channel',
                                  style: TextStyle(
                                    color: Color(0xFF26170A),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),

                      const SizedBox(height: 14),

                      // Recent recall
                      if (hasRecent)
                        _tappable(
                          onTap: () => _setDial(_recentNumber!),
                          child: RichText(
                            text: TextSpan(
                              style: const TextStyle(
                                color: Nocturne.textFaint,
                                fontSize: 11,
                              ),
                              children: [
                                const TextSpan(text: 'Recent · '),
                                TextSpan(
                                  text: '#${_recentNumber!} ${_recentName ?? ''}',
                                  style: const TextStyle(
                                    color: Nocturne.goldLight,
                                    decoration: TextDecoration.underline,
                                    decorationColor: Nocturne.goldLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
