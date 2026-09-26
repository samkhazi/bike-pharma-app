import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/brand_logo.dart';
import '../../widgets/runaway_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  String? _error;
  bool _loading = false;
  int _escapes = 0;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  /// A valid Indian mobile number unlocks the button.
  bool get _valid => RegExp(r'^[6-9]\d{9}$').hasMatch(_phone.text.trim());

  static const _escapeHints = [
    'Pehle number daalo, tab tak ye bhaagega!',
    'Arre, itni jaldi? Pehle number daalo.',
    '10 digit ka number chahiye, boss.',
    'Button pakadna hai? Number daalo!',
  ];

  void _escaped() {
    final number = _phone.text.trim();
    setState(() {
      _escapes++;
      _error = number.length == 10 ? 'Yeh mobile number sahi nahi lag raha' : null;
    });
  }

  Future<void> _continue() async {
    if (!_valid) {
      setState(
        () => _error = _phone.text.trim().length != 10
            ? 'Apna 10-digit mobile number daalo'
            : 'Yeh mobile number sahi nahi lag raha',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _loading = true;
    });
    final app = context.read<AppState>();
    try {
      final phone = '+91${_phone.text.trim()}';
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
    final valid = _valid;
    final digits = _phone.text.trim().length;
    final left = 10 - digits;
    final hint = valid
        ? 'Ready! Ab button tap karo.'
        : digits > 0 && left > 0
        ? (left == 1 ? 'Bas 1 digit aur! ($digits/10)' : 'Aur $left digit daalo ($digits/10)')
        : _escapes == 0
        ? 'Enter your number first. Till then it runs away!'
        : _escapeHints[(_escapes - 1) % _escapeHints.length];
    return Scaffold(
      backgroundColor: const Color(0xFF070707),
      body: Stack(
        children: [
          const Positioned.fill(child: _GlowBackground()),
          SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 28, 20, 24 + MediaQuery.of(context).viewInsets.bottom),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    children: [
                      const BrandLogo(width: 210),
                      const SizedBox(height: 34),
                      _GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: BP.yellow, width: 2),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'BIKE PHARMA',
                                  style: TextStyle(
                                    color: BP.yellow,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 2,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const _Divider(),
                            const SizedBox(height: 18),
                            const Text(
                              'Sign in',
                              style: TextStyle(color: BP.white, fontSize: 28, fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Welcome back. Just one number stands between you and your ride.',
                              style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 14, height: 1.45),
                            ),
                            const SizedBox(height: 22),
                            const Text(
                              'Mobile Number',
                              style: TextStyle(color: BP.yellow, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 8),
                            _PhoneField(
                              controller: _phone,
                              error: _error,
                              onSubmit: _continue,
                              onChanged: () {
                                setState(() => _error = null);
                              },
                            ),
                            if (_error != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8, left: 4),
                                child: Text(_error!, style: const TextStyle(color: Color(0xFFFF6B61), fontSize: 13)),
                              ),
                            const SizedBox(height: 22),
                            RunawayButton(
                              key: const Key('getOtpButton'),
                              label: 'GET OTP',
                              unlocked: valid,
                              loading: _loading,
                              onPressed: _continue,
                              onEscape: _escaped,
                            ),
                            const SizedBox(height: 14),
                            Center(
                              child: AnimatedSwitcher(
                                duration: const Duration(milliseconds: 200),
                                child: Row(
                                  key: ValueKey(hint),
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: valid ? const Color(0xFF4CD964) : BP.yellow,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Flexible(
                                      child: Text(
                                        hint,
                                        style: TextStyle(
                                          color: Colors.white.withValues(alpha: 0.55),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            const _Divider(),
                            const SizedBox(height: 16),
                            Center(
                              child: Text.rich(
                                TextSpan(
                                  style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                                  children: const [
                                    TextSpan(text: 'New rider? '),
                                    TextSpan(
                                      text: 'Your account is created automatically.',
                                      style: TextStyle(color: BP.yellow, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 26),
                      Text(
                        'GENUINE PARTS  ·  EXPERT SERVICE  ·  BIKE MODIFY',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.35),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Black page with soft yellow glows (gradients only, no blur, so it stays smooth).
class _GlowBackground extends StatelessWidget {
  const _GlowBackground();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF0D0D0B), Color(0xFF050505)],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.85),
                radius: 0.75,
                colors: [BP.yellow.withValues(alpha: 0.20), BP.yellow.withValues(alpha: 0)],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, 0.3),
                radius: 0.7,
                colors: [BP.yellow.withValues(alpha: 0.07), BP.yellow.withValues(alpha: 0)],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white.withValues(alpha: 0.08), Colors.white.withValues(alpha: 0.03)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 40, offset: const Offset(0, 20))],
      ),
      child: child,
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Container(height: 1, color: Colors.white.withValues(alpha: 0.1));
}

/// Indian flag drawn with boxes (flag emoji does not render on every device).
class _IndiaFlag extends StatelessWidget {
  const _IndiaFlag();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: SizedBox(
        width: 24,
        height: 16,
        child: Column(
          children: [
            Expanded(child: Container(color: const Color(0xFFFF9933))),
            Expanded(
              child: Container(
                color: BP.white,
                alignment: Alignment.center,
                child: Container(
                  width: 4,
                  height: 4,
                  decoration: const BoxDecoration(color: Color(0xFF000080), shape: BoxShape.circle),
                ),
              ),
            ),
            Expanded(child: Container(color: const Color(0xFF138808))),
          ],
        ),
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
    final edge = error != null ? const Color(0xFFFF6B61) : BP.yellow;
    return Container(
      height: 54,
      decoration: BoxDecoration(
        color: const Color(0xCC0A0A0A),
        borderRadius: BorderRadius.circular(BP.radius),
        border: Border.all(color: edge.withValues(alpha: 0.8), width: 1.5),
        boxShadow: [BoxShadow(color: edge.withValues(alpha: 0.28), blurRadius: 14)],
      ),
      child: Row(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _IndiaFlag(),
                SizedBox(width: 10),
                Text(
                  '+91',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: BP.white),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 22, color: Colors.white.withValues(alpha: 0.15)),
          Expanded(
            child: TextField(
              key: const Key('phoneField'),
              controller: controller,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              cursorColor: BP.yellow,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              onChanged: (_) => onChanged(),
              onSubmitted: (_) => onSubmit(),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.5, color: BP.white),
              decoration: InputDecoration(
                hintText: 'Enter mobile number',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontWeight: FontWeight.w400),
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
