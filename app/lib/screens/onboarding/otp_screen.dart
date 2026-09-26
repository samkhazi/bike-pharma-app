import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../data/demo_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/onboarding_widgets.dart';

const _otpLength = 6;
const _resendSeconds = 30;

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  int _secondsLeft = _resendSeconds;
  bool _verifying = false;
  bool _resending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startTimer();
    _code.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 1) t.cancel();
      setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_verifying) return;
    if (_code.text.length != _otpLength) {
      setState(() => _error = 'Poora $_otpLength-digit code daalo');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _verifying = true;
    });
    final app = context.read<AppState>();
    try {
      await app.repo.verifyOtp(_code.text);
      final complete = await app.loadSession();
      if (!mounted) return;
      context.go(complete ? '/home' : '/create-profile');
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      setState(() => _error = 'Code galat hai. Dobara try karo.');
      showMessage(context, msg);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resend() async {
    final app = context.read<AppState>();
    setState(() => _resending = true);
    try {
      await app.repo.sendOtp(app.phone);
      if (!mounted) return;
      _code.clear();
      _startTimer();
      showMessage(context, 'Naya code bhej diya');
    } catch (e) {
      if (mounted) showMessage(context, 'Code nahi bhej paye: $e');
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  String get _maskedPhone {
    final p = context.read<AppState>().phone;
    if (p.length < 13) return p.isEmpty ? 'your mobile number' : p;
    return '+91 ${p.substring(3, 8)} ${p.substring(8)}';
  }

  @override
  Widget build(BuildContext context) {
    final isDemo = context.read<AppState>().repo is DemoRepository;
    final heroH = (MediaQuery.of(context).size.height * 0.46).clamp(240.0, 400.0);
    final topPad = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: BP.white,
      body: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: 24 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          StorePhotoHero(
            height: heroH,
            overlay: Positioned(
              left: 16,
              top: topPad + 12,
              child: CircleBack(filled: true, onTap: () => context.canPop() ? context.pop() : context.go('/login')),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Verification Code',
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: BP.black)),
              const SizedBox(height: 10),
              Text('Enter the $_otpLength-digit code sent to $_maskedPhone',
                  style: const TextStyle(fontSize: 15, color: BP.grey, height: 1.45, fontWeight: FontWeight.w500)),
              if (isDemo) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: BP.softYellow, borderRadius: BorderRadius.circular(8)),
                  child: const Text('Demo OTP: 123456',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF8A6A00))),
                ),
              ],
              const SizedBox(height: 26),
              _OtpBoxes(controller: _code, focus: _focus, hasError: _error != null, onComplete: _verify),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(_error!, style: const TextStyle(color: BP.red, fontSize: 13)),
                ),
              const SizedBox(height: 26),
              PrimaryButton(label: 'VERIFY', loading: _verifying, onPressed: _verify),
              const SizedBox(height: 26),
              Center(child: _resendRow()),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _resendRow() {
    if (_secondsLeft > 0) {
      final s = _secondsLeft.toString().padLeft(2, '0');
      return Text.rich(TextSpan(
        style: const TextStyle(fontSize: 15, color: BP.grey, fontWeight: FontWeight.w500),
        children: [
          const TextSpan(text: 'Resend code in '),
          TextSpan(text: '00:$s', style: const TextStyle(color: Color(0xFF8A6A00), fontWeight: FontWeight.w800)),
        ],
      ));
    }
    return TextButton(
      onPressed: _resending ? null : _resend,
      child: Text(_resending ? 'Bhej rahe hain…' : 'Resend code',
          style: const TextStyle(fontSize: 15, color: Color(0xFF8A6A00), fontWeight: FontWeight.w800)),
    );
  }
}

/// Six boxes backed by one hidden text field (works with paste + SMS autofill).
class _OtpBoxes extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focus;
  final bool hasError;
  final VoidCallback onComplete;
  const _OtpBoxes({required this.controller, required this.focus, required this.hasError, required this.onComplete});

  @override
  Widget build(BuildContext context) {
    final code = controller.text;
    return GestureDetector(
      onTap: () => focus.requestFocus(),
      child: SizedBox(
        height: 60,
        child: Stack(children: [
          Row(children: [
            for (var i = 0; i < _otpLength; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(child: _box(i, code)),
            ],
          ]),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                key: const Key('otpField'),
                controller: controller,
                focusNode: focus,
                autofocus: true,
                showCursor: false,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(_otpLength)],
                onChanged: (v) {
                  if (v.length == _otpLength) onComplete();
                },
                decoration: const InputDecoration(border: InputBorder.none, counterText: ''),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _box(int i, String code) {
    final filled = i < code.length;
    final active = focus.hasFocus && (i == code.length || (i == _otpLength - 1 && code.length == _otpLength));
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: BP.white,
        borderRadius: BorderRadius.circular(BP.radius),
        border: Border.all(
          color: hasError ? BP.red : active ? BP.black : BP.border,
          width: active || hasError ? 1.5 : 1,
        ),
      ),
      child: filled
          ? Text(code[i], style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: BP.black))
          : Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(color: Color(0xFFB8B8B2), shape: BoxShape.circle),
            ),
    );
  }
}
