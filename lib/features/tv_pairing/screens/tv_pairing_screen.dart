import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';

/// Scans the QR code the Android TV app shows on its activation/pairing
/// screen (a link like https://afrovision.online/tv-link?session=SESSION_ID) and
/// confirms the pairing against this account via
/// POST /auth/tv/session/:id/confirm. That endpoint requires this app's own
/// auth token - ApiService.post already attaches it - so whichever account
/// is signed in here becomes the one linked to the TV.
class TvPairingScreen extends StatefulWidget {
  const TvPairingScreen({super.key});

  @override
  State<TvPairingScreen> createState() => _TvPairingScreenState();
}

enum _PairingStatus { scanning, confirming, success, error }

class _TvPairingScreenState extends State<TvPairingScreen> {
  final MobileScannerController _controller = MobileScannerController();
  _PairingStatus _status = _PairingStatus.scanning;
  String? _deviceName;
  String? _errorMessage;
  bool _handledDetection = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _extractSessionId(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;
    final fromQuery = uri.queryParameters['session'];
    if (fromQuery != null && fromQuery.isNotEmpty) return fromQuery;
    // Fallback: if the QR just encodes the bare session id (no URL wrapper).
    if (!raw.contains('/') && !raw.contains('?') && raw.trim().isNotEmpty) {
      return raw.trim();
    }
    return null;
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handledDetection) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    final sessionId = _extractSessionId(raw);
    if (sessionId == null) return;

    _handledDetection = true;
    setState(() => _status = _PairingStatus.confirming);

    try {
      final data = await ApiService.post(
        '/auth/tv/session/$sessionId/confirm',
        const {},
      );
      if (!mounted) return;
      setState(() {
        _status = _PairingStatus.success;
        _deviceName = data['device_name'] as String?;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _status = _PairingStatus.error;
        _errorMessage = e.message == 'QR_PAIRING_RESTRICTED'
            ? 'QR pairing is no longer available. Please use an activation code from an authorized AfroVision distributor.'
            : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = _PairingStatus.error;
        _errorMessage = 'Something went wrong. Please try again.';
      });
    }
  }

  void _reset() {
    setState(() {
      _status = _PairingStatus.scanning;
      _errorMessage = null;
      _deviceName = null;
      _handledDetection = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      appBar: AppBar(
        backgroundColor: AppColors.darkBlue,
        elevation: 0,
        title: const Text('Connect TV', style: TextStyle(color: AppColors.white)),
        iconTheme: const IconThemeData(color: AppColors.white),
      ),
      body: SafeArea(
        child: switch (_status) {
          _PairingStatus.scanning => _ScannerView(controller: _controller, onDetect: _onDetect),
          _PairingStatus.confirming => const _CenteredMessage(
              icon: null,
              showSpinner: true,
              title: 'Linking your TV…',
              subtitle: 'Hold on a moment.',
            ),
          _PairingStatus.success => _CenteredMessage(
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.successGreen,
              title: 'TV linked successfully',
              subtitle: _deviceName != null
                  ? '"$_deviceName" is now connected to your account.'
                  : 'Your TV is now connected to your account.',
              actionLabel: 'Done',
              onAction: () => Navigator.of(context).pop(true),
            ),
          _PairingStatus.error => _CenteredMessage(
              icon: Icons.error_rounded,
              iconColor: AppColors.errorRed,
              title: 'Couldn\'t link this TV',
              subtitle: _errorMessage ?? 'Something went wrong. Please try again.',
              actionLabel: 'Scan again',
              onAction: _reset,
            ),
        },
      ),
    );
  }
}

class _ScannerView extends StatelessWidget {
  final MobileScannerController controller;
  final void Function(BarcodeCapture) onDetect;

  const _ScannerView({required this.controller, required this.onDetect});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(controller: controller, onDetect: onDetect),
        // Simple viewfinder frame - purely visual, scanning works anywhere
        // in the camera view regardless of where the QR falls inside it.
        Center(
          child: Container(
            width: 260,
            height: 260,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.orange, width: 3),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        Positioned(
          left: 24,
          right: 24,
          bottom: 40,
          child: Text(
            'Point your camera at the QR code on your TV\'s pairing screen.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.9),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  final IconData? icon;
  final Color? iconColor;
  final bool showSpinner;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _CenteredMessage({
    this.icon,
    this.iconColor,
    this.showSpinner = false,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showSpinner)
              const CircularProgressIndicator(color: AppColors.orange)
            else if (icon != null)
              Icon(icon, color: iconColor ?? AppColors.white, size: 64),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.white.withValues(alpha: 0.75), fontSize: 14),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 28),
              GestureDetector(
                onTap: onAction,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 32),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    actionLabel!,
                    style: const TextStyle(
                      color: AppColors.darkBlue,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
