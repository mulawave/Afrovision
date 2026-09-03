import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';
import 'package:afrovision_marketer/core/widgets/app_button.dart';
import 'package:afrovision_marketer/core/services/api_service.dart';

class RequestCodeScreen extends StatefulWidget {
  const RequestCodeScreen({super.key});

  @override
  State<RequestCodeScreen> createState() => _RequestCodeScreenState();
}

class _RequestCodeScreenState extends State<RequestCodeScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _result;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: Duration(milliseconds: 400));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _result = null;
    });
    try {
      final data = await ApiService.requestCode();
      if (data['success'] == true) {
        setState(() {
          _result = data;
          _isLoading = false;
        });
        _animController.forward();
      } else {
        setState(() {
          _error = (data['message'] as String?) ?? (data['error'] as String?) ?? 'Failed to request code';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error. Try again.';
        _isLoading = false;
      });
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Code copied to clipboard'),
        backgroundColor: AppColors.successGreen,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: _isLoading
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(color: AppColors.orange),
                            SizedBox(height: 16),
                            Text('Minting fresh code...', style: TextStyle(color: AppColors.lightOrange, fontSize: 13)),
                          ],
                        ),
                      )
                    : _result != null
                        ? _buildCodeDisplay()
                        : _buildRequestView(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: Icon(Icons.arrow_back, color: AppColors.white, size: 24),
          ),
          Text('Request Activation Code', style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildRequestView() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              gradient: AppColors.buttonGradient,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: AppColors.orange.withValues(alpha: 0.3), blurRadius: 20, offset: Offset(0, 8)),
              ],
            ),
            child: Icon(Icons.qr_code_2, color: AppColors.darkBlue, size: 48),
          ),
          SizedBox(height: 32),
          Text(
            'Generate Activation Code',
            style: TextStyle(color: AppColors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 12),
          Text(
            'Tap below to mint a fresh, single-use activation code. The code will be validated against your distributor\'s license and quota in real time.',
            style: TextStyle(color: AppColors.lightOrange.withValues(alpha: 0.7), fontSize: 13),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: 40),
          if (_error != null) ...[
            Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.errorRed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
              ),
              child: Text(_error!, style: TextStyle(color: AppColors.errorRed, fontSize: 12), textAlign: TextAlign.center),
            ),
            SizedBox(height: 16),
          ],
          AppButton(
            label: 'Generate Code',
            onPressed: _requestCode,
            icon: Icons.bolt,
          ),
        ],
      ),
    );
  }

  Widget _buildCodeDisplay() {
    final code = _result!['code'] as String? ?? '—';
    final quotaRemaining = _result!['quota_remaining'];
    final issuedAt = _result!['issued_at'] as String?;

    return FadeTransition(
      opacity: _fadeAnim,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle, color: AppColors.successGreen, size: 56),
            SizedBox(height: 16),
            Text('Code Generated!', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            SizedBox(height: 32),
            Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: 36, horizontal: 24),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.orange.withValues(alpha: 0.4), width: 1.5),
                boxShadow: [
                  BoxShadow(color: AppColors.orange.withValues(alpha: 0.15), blurRadius: 24, offset: Offset(0, 8)),
                ],
              ),
              child: Column(
                children: [
                  Text('Activation Code', style: TextStyle(color: AppColors.lightOrange.withValues(alpha: 0.7), fontSize: 12, fontWeight: FontWeight.w600)),
                  SizedBox(height: 12),
                  Text(
                    code,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                      fontFamily: 'monospace',
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (quotaRemaining != null)
                        Text(
                          'Quota remaining: $quotaRemaining',
                          style: TextStyle(color: AppColors.lightOrange, fontSize: 12),
                        ),
                      if (quotaRemaining != null && issuedAt != null) SizedBox(width: 16),
                      if (issuedAt != null)
                        Text(
                          'Issued: ${_formatTime(issuedAt)}',
                          style: TextStyle(color: AppColors.hintText, fontSize: 11),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Copy Code',
                    onPressed: () => _copyCode(code),
                    icon: Icons.copy,
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: AppButton(
                    label: 'Done',
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            Text(
              'This code is bound to one TV device permanently.\nGive it to the customer for activation.',
              style: TextStyle(color: AppColors.hintText, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.hour}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
