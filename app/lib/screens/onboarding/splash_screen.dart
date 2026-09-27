import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';

/// Animated brand intro. Plays once (~3.5s), then routes the user based on
/// their session: home, create profile, or login.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 3500));

  // Timeline (fractions of the 3.5s controller).
  late final _lines = CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.16, curve: Curves.easeOutCubic));
  late final _glow = CurvedAnimation(parent: _c, curve: const Interval(0.05, 0.32, curve: Curves.easeOut));
  late final _gearSpin = CurvedAnimation(parent: _c, curve: const Interval(0.05, 0.30, curve: Curves.easeOutBack));
  late final _gearFade = CurvedAnimation(parent: _c, curve: const Interval(0.05, 0.16, curve: Curves.easeOut));
  late final _ringFade = CurvedAnimation(parent: _c, curve: const Interval(0.14, 0.30, curve: Curves.easeOut));
  late final _pistonDrop = CurvedAnimation(parent: _c, curve: const Interval(0.26, 0.42, curve: Curves.bounceOut));
  late final _pistonFade = CurvedAnimation(parent: _c, curve: const Interval(0.26, 0.32));
  late final _pump = CurvedAnimation(parent: _c, curve: const Interval(0.43, 0.60));
  late final _move = CurvedAnimation(parent: _c, curve: const Interval(0.60, 0.76, curve: Curves.easeInOutCubic));
  late final _word = CurvedAnimation(parent: _c, curve: const Interval(0.70, 0.86, curve: Curves.easeOutCubic));
  late final _stripes = CurvedAnimation(parent: _c, curve: const Interval(0.80, 0.92, curve: Curves.easeOutCubic));
  late final _tagline = CurvedAnimation(parent: _c, curve: const Interval(0.82, 0.95, curve: Curves.easeOut));
  late final _loader = CurvedAnimation(parent: _c, curve: const Interval(0.62, 1.0, curve: Curves.easeInOut));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  Future<void> _run() async {
    if (!mounted) return;
    final destination = _destination(context.read<AppState>());
    try {
      await _c.forward().orCancel;
    } on TickerCanceled {
      return;
    }
    final to = await destination;
    if (mounted) context.go(to);
  }

  Future<String> _destination(AppState app) async {
    if (app.repo.currentUid == null) return '/login';
    try {
      return await app.landingRoute();
    } catch (_) {
      return '/login';
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: LayoutBuilder(builder: (context, box) {
        return AnimatedBuilder(animation: _c, builder: (context, _) => _frame(box.biggest));
      }),
    );
  }

  // Logo geometry, in logo units (from the 369.43 x 52.93 wordmark artboard).
  static const _s = 0.85; // final lockup scale -> wordmark ~314px
  static const _wordW = 369.43, _wordH = 52.93, _wordTop = 136.31;
  static const _gearSize = 80.02;
  static const _gearCenter = Offset(140.22 + 40.01, 28.91 + 40.01);
  static const _pistonW = 47.56, _pistonH = 92.70;
  static const _pistonPivot = Offset(23.78, 68.92); // piston ring centre (sits on gear centre)
  static const _ringRadius = 59.0;
  static const _stripesStart = 200.6 / _wordW;

  Widget _frame(Size size) {
    final w = size.width, h = size.height;
    final lockupW = _wordW * _s, lockupH = (_wordTop + _wordH) * _s;
    final x0 = (w - lockupW) / 2;
    final y0 = h * 0.474 - lockupH / 2;

    // Mark (gear + piston) centre and scale: big in the middle, then into the lockup.
    final introCenter = Offset(w / 2, h * 0.45);
    final finalCenter = Offset(x0 + _gearCenter.dx * _s, y0 + _gearCenter.dy * _s);
    final m = lerpDouble(1.9, _s, _move.value)!;
    final c = Offset.lerp(introCenter, finalCenter, _move.value)!;

    final gearAngle = (1 - _gearSpin.value) * -200 * math.pi / 180;
    final ringAngle = _c.value * math.pi * 3;
    final pistonY = -(1 - _pistonDrop.value) * 420 + math.sin(_pump.value * 4 * math.pi).abs() * 9;

    final gear = _gearSize * m;
    return Stack(clipBehavior: Clip.hardEdge, children: [
      Positioned.fill(child: CustomPaint(painter: _SpeedLines(_lines.value))),
      // Soft yellow glow
      Positioned(
        left: c.dx - 110 * m,
        top: c.dy - 110 * m,
        width: 220 * m,
        height: 220 * m,
        child: Transform.scale(
          scale: _glow.value,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(colors: [
                BP.yellow.withValues(alpha: 0.38),
                BP.yellow.withValues(alpha: 0.10),
                BP.yellow.withValues(alpha: 0),
              ], stops: const [0, 0.45, 1]),
            ),
          ),
        ),
      ),
      // Dashed ring
      Positioned(
        left: c.dx - (_ringRadius + 2) * m,
        top: c.dy - (_ringRadius + 2) * m,
        width: (_ringRadius + 2) * 2 * m,
        height: (_ringRadius + 2) * 2 * m,
        child: Opacity(
          opacity: _ringFade.value,
          child: Transform.rotate(
            angle: ringAngle,
            child: CustomPaint(painter: _DashedRing(radius: _ringRadius * m, stroke: 2.4 * m / _s)),
          ),
        ),
      ),
      // Gear
      Positioned(
        left: c.dx - gear / 2,
        top: c.dy - gear / 2,
        width: gear,
        height: gear,
        child: Opacity(
          opacity: _gearFade.value,
          child: Transform.rotate(angle: gearAngle, child: SvgPicture.asset('assets/logo/gear.svg')),
        ),
      ),
      // Piston
      Positioned(
        left: c.dx - _pistonPivot.dx * m,
        top: c.dy - _pistonPivot.dy * m + pistonY * m,
        width: _pistonW * m,
        height: _pistonH * m,
        child: Opacity(opacity: _pistonFade.value, child: SvgPicture.asset('assets/logo/piston.svg')),
      ),
      // Wordmark + stripes
      Positioned(
        left: x0,
        top: y0 + _wordTop * _s,
        width: _wordW * _s,
        height: _wordH * _s,
        child: Stack(children: [
          Positioned.fill(
            child: ClipRect(
              clipper: _RevealClipper(_word.value),
              child: SvgPicture.asset('assets/logo/letters.svg'),
            ),
          ),
          Positioned.fill(
            child: ClipRect(
              clipper: _RevealClipper(_stripesStart + (1 - _stripesStart) * _stripes.value),
              child: SvgPicture.asset('assets/logo/stripes.svg'),
            ),
          ),
        ]),
      ),
      // Loader bar
      Positioned(
        left: (w - 160) / 2,
        bottom: 112,
        width: 160,
        height: 3,
        child: Opacity(
          opacity: _loader.value > 0 ? 1 : 0,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: Stack(children: [
              Container(color: Colors.white.withValues(alpha: 0.12)),
              FractionallySizedBox(widthFactor: _loader.value, child: Container(color: BP.yellow)),
            ]),
          ),
        ),
      ),
      // Tagline
      Positioned(
        left: 16,
        right: 16,
        bottom: 58,
        child: Opacity(
          opacity: _tagline.value,
          child: Transform.translate(
            offset: Offset(0, 8 * (1 - _tagline.value)),
            child: const Text(
              'SPARE PARTS · ACCESSORIES · SERVICE',
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.fade,
              softWrap: false,
              style: TextStyle(
                color: Color(0xFF9A9A96),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 3,
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}

/// Clips a child to the left [fraction] of its width.
class _RevealClipper extends CustomClipper<Rect> {
  final double fraction;
  const _RevealClipper(this.fraction);

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * fraction.clamp(0.0, 1.0), size.height);

  @override
  bool shouldReclip(_RevealClipper old) => old.fraction != fraction;
}

class _DashedRing extends CustomPainter {
  final double radius;
  final double stroke;
  const _DashedRing({required this.radius, required this.stroke});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BP.yellow.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    const dashes = 18;
    const sweep = 2 * math.pi / dashes;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: radius);
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(rect, i * sweep, sweep * 0.55, false, paint);
    }
  }

  @override
  bool shouldRepaint(_DashedRing old) => old.radius != radius || old.stroke != stroke;
}

/// Diagonal yellow speed lines that slide in from the top-left and
/// bottom-right corners.
class _SpeedLines extends CustomPainter {
  final double t;
  const _SpeedLines(this.t);

  void _line(Canvas canvas, Offset a, Offset b, double width, double alpha) {
    final dir = (b - a);
    final paint = Paint()
      ..color = BP.yellow.withValues(alpha: alpha)
      ..strokeWidth = width
      ..strokeCap = StrokeCap.butt;
    // Extend past the screen edges so no end is ever visible.
    canvas.drawLine(a - dir, b + dir, paint);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0) return;
    final w = size.width, h = size.height;
    final slide = 180 * (1 - t);

    canvas.save();
    canvas.translate(-slide, -slide);
    _line(canvas, const Offset(0, 100), const Offset(113, 0), 5, t);
    _line(canvas, const Offset(0, 156), const Offset(173, 0), 2, 0.6 * t);
    canvas.restore();

    canvas.save();
    canvas.translate(slide, slide);
    _line(canvas, Offset(w - 208, h), Offset(w, h - 186), 5, t);
    _line(canvas, Offset(w - 145, h), Offset(w, h - 132), 2, 0.6 * t);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SpeedLines old) => old.t != t;
}
