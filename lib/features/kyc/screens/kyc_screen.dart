import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  final _nameCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  String _idType = 'national_id';
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  // Existing KYC record
  Map<String, dynamic>? _existing;

  // Uploaded file URLs
  String? _idFrontUrl;
  String? _idBackUrl;
  String? _selfieUrl;
  String? _uploadingField;

  final _idTypes = const [
    {'value': 'national_id', 'label': 'National ID Card'},
    {'value': 'passport', 'label': 'International Passport'},
    {'value': 'drivers_license', 'label': "Driver's License"},
    {'value': 'voters_card', 'label': "Voter's Card"},
    {'value': 'nin_slip', 'label': 'NIN Slip'},
  ];

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fade = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _loadKycStatus();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _nameCtrl.dispose();
    _idNumberCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadKycStatus() async {
    try {
      final data = await ApiService.get('/kyc/me');
      if (data['id'] != null) {
        if (mounted) setState(() => _existing = data);
      }
    } catch (_) {
      // No existing KYC — show the form
    }
    if (mounted) {
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _uploadFile(String fieldName) async {
    final picker = ImagePicker();
    final XFile? file;
    if (fieldName == 'selfie') {
      file = await picker.pickImage(source: ImageSource.camera);
    } else {
      file = await picker.pickImage(source: ImageSource.gallery);
    }
    if (file == null) return;

    setState(() {
      _uploadingField = fieldName;
      _error = null;
    });

    try {
      final data = await ApiService.uploadFile(
        '/kyc/upload-doc',
        File(file.path),
        fieldName: 'file',
      );
      if (!mounted) return;
      final url = data['url'] as String?;
      if (url != null) {
        setState(() {
          if (fieldName == 'id_front') _idFrontUrl = url;
          if (fieldName == 'id_back') _idBackUrl = url;
          if (fieldName == 'selfie') _selfieUrl = url;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed');
    } finally {
      if (mounted) setState(() => _uploadingField = null);
    }
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final idNum = _idNumberCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Full name is required');
      return;
    }
    if (idNum.isEmpty) {
      setState(() => _error = 'ID number is required');
      return;
    }
    if (_idFrontUrl == null) {
      setState(() => _error = 'ID front image is required');
      return;
    }
    if (_selfieUrl == null) {
      setState(() => _error = 'Selfie photo is required');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        'full_name': name,
        'id_type': _idType,
        'id_number': idNum,
        'id_front_url': _idFrontUrl,
        'selfie_url': _selfieUrl,
      };
      if (_phoneCtrl.text.trim().isNotEmpty) {
        body['phone'] = _phoneCtrl.text.trim();
      }
      if (_addressCtrl.text.trim().isNotEmpty) {
        body['address'] = _addressCtrl.text.trim();
      }
      if (_idBackUrl != null) body['id_back_url'] = _idBackUrl;

      await ApiService.post('/kyc/submit', body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('KYC submitted successfully!'),
          backgroundColor: Color(0xFF4CAF50),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : FadeTransition(
                        opacity: _fade,
                        child: SlideTransition(
                          position: _slide,
                          child: _buildContent(),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_rounded,
                color: AppColors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Text(
              'KYC Verification',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    // Already submitted and pending/verified
    final status = _existing?['status'] as String?;
    if (status != null &&
        ['pending', 'under_review', 'verified'].contains(status)) {
      return _buildStatusView(status);
    }
    return _buildForm();
  }

  Widget _buildStatusView(String status) {
    final colors = {
      'pending': AppColors.lightOrange,
      'under_review': Colors.blue[400]!,
      'verified': const Color(0xFF4CAF50),
    };
    final labels = {
      'pending': 'Pending Review',
      'under_review': 'Under Review',
      'verified': 'Verified',
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (colors[status] ?? AppColors.orange).withValues(
                  alpha: 0.15,
                ),
              ),
              child: Icon(
                status == 'verified'
                    ? Icons.verified_rounded
                    : Icons.hourglass_top_rounded,
                color: colors[status] ?? AppColors.orange,
                size: 48,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              labels[status] ?? status.toUpperCase(),
              style: TextStyle(
                color: colors[status] ?? AppColors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              status == 'verified'
                  ? 'Your identity has been verified.'
                  : 'Your documents are under review.\nThis usually takes 1-2 business days.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.7),
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_existing?['status'] == 'rejected') ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: Colors.red.withValues(alpha: 0.1),
                border: Border.all(color: Colors.red.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Previous submission rejected',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (_existing?['rejection_reason'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _existing!['rejection_reason'],
                      style: TextStyle(color: Colors.red[300], fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (_error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Colors.red.withValues(alpha: 0.1),
                border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 12),
              ),
            ),
            const SizedBox(height: 16),
          ],
          _sectionCard('Personal Information', [
            _field('Full Legal Name *', _nameCtrl, 'As on your ID'),
            _field('Phone Number', _phoneCtrl, '+234...'),
            _field('Address', _addressCtrl, 'Residential address'),
          ]),
          const SizedBox(height: 16),
          _sectionCard('Identity Document', [
            _idTypeSelector(),
            _field('ID Number *', _idNumberCtrl, 'Your ID number'),
          ]),
          const SizedBox(height: 16),
          _sectionCard('Upload Documents', [
            _uploadBox('ID Front *', 'id_front', _idFrontUrl),
            _uploadBox('ID Back (optional)', 'id_back', _idBackUrl),
            _uploadBox(
              'Selfie Photo *',
              'selfie',
              _selfieUrl,
              hint: 'Take a clear selfie matching your ID',
            ),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting || _uploadingField != null
                  ? null
                  : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.orange,
                foregroundColor: AppColors.darkBlue,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.darkBlue,
                        ),
                      ),
                    )
                  : const Text(
                      'Submit KYC',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: AppColors.inputFill.withValues(alpha: 0.3),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, String placeholder) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.7),
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: ctrl,
            style: const TextStyle(color: AppColors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.4),
                fontSize: 13,
              ),
              filled: true,
              fillColor: AppColors.inputFill.withValues(alpha: 0.5),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.inputBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.inputBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: AppColors.orange.withValues(alpha: 0.5),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _idTypeSelector() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ID Type *',
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.7),
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: AppColors.inputFill.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _idType,
                isExpanded: true,
                dropdownColor: AppColors.darkBlue,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                items: _idTypes
                    .map(
                      (t) => DropdownMenuItem(
                        value: t['value'],
                        child: Text(t['label']!),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _idType = val);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _uploadBox(
    String label,
    String fieldName,
    String? uploadedUrl, {
    String? hint,
  }) {
    final isUploading = _uploadingField == fieldName;
    final isUploaded = uploadedUrl != null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: isUploading ? null : () => _uploadFile(fieldName),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isUploaded
                  ? const Color(0xFF4CAF50).withValues(alpha: 0.3)
                  : AppColors.inputBorder,
              style: BorderStyle.solid,
              width: isUploaded ? 1 : 1,
            ),
            color: isUploaded
                ? const Color(0xFF4CAF50).withValues(alpha: 0.05)
                : AppColors.inputFill.withValues(alpha: 0.2),
          ),
          child: isUploading
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.orange.withValues(alpha: 0.7),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Uploading...',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.6),
                        fontSize: 11,
                      ),
                    ),
                  ],
                )
              : isUploaded
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.check_circle,
                      color: Color(0xFF4CAF50),
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '$label — Uploaded',
                      style: const TextStyle(
                        color: Color(0xFF4CAF50),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                )
              : Column(
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (hint != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        hint,
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.5),
                          fontSize: 10,
                        ),
                      ),
                    ],
                    const SizedBox(height: 2),
                    Text(
                      'Tap to select',
                      style: TextStyle(
                        color: AppColors.hintText.withValues(alpha: 0.4),
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
