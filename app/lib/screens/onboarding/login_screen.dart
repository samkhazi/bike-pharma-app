import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/onboarding_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final number = _phone.text.trim();
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(number)) {
      setState(() => _error = number.length != 10
          ? 'Apna 10-digit mobile number daalo'
          : 'Yeh mobile number sahi nahi lag raha');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _loading = true;
    });
    final app = context.read<AppState>();
    try {
      final phone = '+91$number';
      await app.repo.sendOtp(phone);
      app.phone = phone;
      if (mounted) context.push('/otp');
    } catch (e) {
      if (mounted) showMessage(context, 'OTP nahi bhej paye: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final heroH = (MediaQuery.of(context).size.height * 0.44).clamp(240.0, 400.0);
    return Scaffold(
      backgroundColor: BP.white,
      body: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: 24 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          StorePhotoHero(height: heroH, showLogo: true),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Welcome to', style: TextStyle(fontSize: 20, color: BP.grey, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              const Text('Bike Pharma\nAutomobiles',
                  style: TextStyle(fontSize: 32, height: 1.15, fontWeight: FontWeight.w800, color: BP.black)),
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 3,
                decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 14),
              const Text('Your trusted automobile spare parts partner',
                  style: TextStyle(fontSize: 15, color: BP.grey, fontWeight: FontWeight.w500)),
              const SizedBox(height: 26),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: BP.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, 8)),
                  ],
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const FieldLabel('Mobile Number'),
                  _PhoneField(controller: _phone, error: _error, onSubmit: _continue, onChanged: () {
                    if (_error != null) setState(() => _error = null);
                  }),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8, left: 4),
                      child: Text(_error!, style: const TextStyle(color: BP.red, fontSize: 13)),
                    ),
                  const SizedBox(height: 16),
                  PrimaryButton(label: 'CONTINUE', loading: _loading, onPressed: _continue),
                ]),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  final TextEditingController controller;
  final String? error;
  final VoidCallback onSubmit;
  final VoidCallback onChanged;
  const _PhoneField({required this.controller, required this.error, required this.onSubmit, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(BP.radius),
        border: Border.all(color: error != null ? BP.red : BP.border, width: error != null ? 1.5 : 1),
      ),
      child: Row(children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('🇮🇳', style: TextStyle(fontSize: 20)),
            SizedBox(width: 8),
            Text('+91', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: BP.black)),
            SizedBox(width: 4),
            Icon(Icons.keyboard_arrow_down, size: 18, color: BP.black),
          ]),
        ),
        Container(width: 1, height: double.infinity, color: BP.border),
        Expanded(
          child: TextField(
            key: const Key('phoneField'),
            controller: controller,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
            onChanged: (_) => onChanged(),
            onSubmitted: (_) => onSubmit(),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.5),
            decoration: const InputDecoration(
              hintText: 'Enter mobile number',
              hintStyle: TextStyle(color: Color(0xFFA0A09A), fontWeight: FontWeight.w500),
              filled: false,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            ),
          ),
        ),
      ]),
    );
  }
}
