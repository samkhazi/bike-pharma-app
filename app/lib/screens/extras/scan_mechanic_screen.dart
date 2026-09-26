import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/theme.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

const _bg = Color(0xFF121212);
const _card = Color(0xFF1F1F1F);
const _muted = Color(0xFFB5B5B0);

class ScanMechanicScreen extends StatefulWidget {
  const ScanMechanicScreen({super.key});

  @override
  State<ScanMechanicScreen> createState() => _ScanMechanicScreenState();
}

class _ScanMechanicScreenState extends State<ScanMechanicScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  final _idCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  String? _lastInvalid;
  bool _torchOn = false;

  @override
  void dispose() {
    _controller.dispose();
    _idCtrl.dispose();
    super.dispose();
  }

  Future<void> _open(String id) async {
    _busy = true;
    try {
      await _controller.stop();
    } catch (_) {}
    if (!mounted) return;
    await context.push('/mechanic/$id');
    if (!mounted) return;
    _busy = false;
    _lastInvalid = null;
    try {
      await _controller.start();
    } catch (_) {}
  }

  void _onDetect(BarcodeCapture capture) {
    if (_busy) return;
    final raw = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (raw == null) return;
    final id = parseMechanicId(raw);
    if (id != null) {
      _open(id);
    } else if (raw != _lastInvalid) {
      _lastInvalid = raw;
      showMessage(context, 'Ye Bike Pharma ka QR nahi hai');
    }
  }

  void _check() {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    _open(parseMechanicId(_idCtrl.text)!);
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      setState(() => _torchOn = !_torchOn);
    } catch (_) {
      if (mounted) showMessage(context, 'Torch available nahi hai');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        inputDecorationTheme: Theme.of(context).inputDecorationTheme.copyWith(
              fillColor: _card,
              hintStyle: const TextStyle(color: _muted),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(BP.radius),
                borderSide: const BorderSide(color: Color(0xFF3A3A3A)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(BP.radius),
                borderSide: const BorderSide(color: BP.yellow, width: 1.5),
              ),
            ),
      ),
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Row(children: [
                Material(
                  color: const Color(0xFF2A2A2A),
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => context.canPop() ? context.pop() : context.go('/home'),
                    child: const SizedBox(
                        width: 44, height: 44, child: Icon(Icons.arrow_back, color: BP.white, size: 22)),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Genuine Mechanic',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: BP.white)),
                    Text('Scan mechanic QR code', style: TextStyle(fontSize: 13, color: _muted)),
                  ]),
                ),
              ]),
              const SizedBox(height: 22),
              Center(
                child: SizedBox(
                  width: 270,
                  height: 270,
                  child: Stack(fit: StackFit.expand, children: [
                    Padding(
                      padding: const EdgeInsets.all(3),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: ColoredBox(
                          color: const Color(0xFF1F1F1F),
                          child: MobileScanner(
                            controller: _controller,
                            onDetect: _onDetect,
                            errorBuilder: (context, error) => _CameraError(error: error),
                          ),
                        ),
                      ),
                    ),
                    const IgnorePointer(child: CustomPaint(painter: _CornersPainter())),
                    const IgnorePointer(child: _ScanLine()),
                  ]),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Mechanic ki garage pe lage Bike Pharma QR ko box ke andar rakho',
                textAlign: TextAlign.center,
                style: TextStyle(color: BP.white, fontSize: 15, fontWeight: FontWeight.w500, height: 1.35),
              ),
              const SizedBox(height: 18),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _DarkChip(
                  icon: _torchOn ? Icons.flashlight_off_outlined : Icons.flashlight_on_outlined,
                  label: 'Torch',
                  onTap: _toggleTorch,
                ),
                const SizedBox(width: 12),
                _DarkChip(
                  icon: Icons.image_outlined,
                  label: 'Gallery se',
                  onTap: () => showMessage(context, 'Gallery se scan jaldi aa raha hai. Abhi Mechanic ID daalo.'),
                ),
              ]),
              const SizedBox(height: 26),
              const Row(children: [
                Expanded(child: Divider(color: Color(0xFF3A3A3A))),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('ya Mechanic ID daalo', style: TextStyle(color: _muted, fontSize: 13)),
                ),
                Expanded(child: Divider(color: Color(0xFF3A3A3A))),
              ]),
              const SizedBox(height: 18),
              Form(
                key: _formKey,
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: TextFormField(
                      controller: _idCtrl,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.go,
                      onFieldSubmitted: (_) => _check(),
                      style: const TextStyle(color: BP.white, fontSize: 16, fontWeight: FontWeight.w700),
                      decoration: const InputDecoration(
                        hintText: 'BPM-0231',
                        prefixIcon: Icon(Icons.badge_outlined, color: BP.yellow),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Mechanic ID daalo'
                          : parseMechanicId(v) == null
                              ? 'Sahi ID daalo, jaise BPM-0231'
                              : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    height: 56,
                    child: FilledButton(
                      onPressed: _check,
                      style: FilledButton.styleFrom(
                        backgroundColor: BP.yellow,
                        foregroundColor: BP.black,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      child: const Text('CHECK'),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 22),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.verified_user_outlined, color: BP.black, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Sirf Bike Pharma Verified',
                          style: TextStyle(color: BP.white, fontSize: 15, fontWeight: FontWeight.w800)),
                      SizedBox(height: 2),
                      Text('Ye mechanics regular hamari shop se genuine spares lete hain',
                          style: TextStyle(color: _muted, fontSize: 12.5, height: 1.3)),
                    ]),
                  ),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CameraError extends StatelessWidget {
  final MobileScannerException error;
  const _CameraError({required this.error});

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(denied ? Icons.no_photography_outlined : Icons.videocam_off_outlined, color: _muted, size: 36),
          const SizedBox(height: 10),
          Text(
            denied
                ? 'Camera ki permission nahi mili. Settings se allow karo, ya neeche Mechanic ID daalo.'
                : 'Camera shuru nahi ho paya. Neeche Mechanic ID daal ke check karo.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, fontSize: 13, height: 1.35),
          ),
        ]),
      ),
    );
  }
}

class _DarkChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _DarkChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF262626),
      shape: const StadiumBorder(),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: BP.white, size: 20),
            const SizedBox(width: 10),
            Text(label, style: const TextStyle(color: BP.white, fontSize: 15, fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}

/// Yellow corner brackets around the scan box.
class _CornersPainter extends CustomPainter {
  const _CornersPainter();

  @override
  void paint(Canvas canvas, Size size) {
    const len = 42.0;
    final p = Paint()
      ..color = BP.yellow
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final w = size.width, h = size.height;
    const o = 2.5;
    final path = Path()
      ..moveTo(o, len)
      ..lineTo(o, o)
      ..lineTo(len, o)
      ..moveTo(w - len, o)
      ..lineTo(w - o, o)
      ..lineTo(w - o, len)
      ..moveTo(o, h - len)
      ..lineTo(o, h - o)
      ..lineTo(len, h - o)
      ..moveTo(w - len, h - o)
      ..lineTo(w - o, h - o)
      ..lineTo(w - o, h - len);
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ScanLine extends StatefulWidget {
  const _ScanLine();

  @override
  State<_ScanLine> createState() => _ScanLineState();
}

class _ScanLineState extends State<_ScanLine> with SingleTickerProviderStateMixin {
  late final _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) => Align(
        alignment: Alignment(0, -0.8 + 1.6 * _anim.value),
        child: Container(
          height: 3,
          margin: const EdgeInsets.symmetric(horizontal: 22),
          decoration: BoxDecoration(
            color: BP.yellow,
            borderRadius: BorderRadius.circular(2),
            boxShadow: [BoxShadow(color: BP.yellow.withValues(alpha: 0.5), blurRadius: 12, spreadRadius: 1)],
          ),
        ),
      ),
    );
  }
}
