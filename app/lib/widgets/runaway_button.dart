import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';

/// "Runaway" button, tethered to its home slot in the middle of the dock.
///
/// While locked it dodges away from the finger (or mouse), tilting as it goes
/// and trailing a glowing tether back to a dashed "home" outline. [calm] (0..1)
/// is how close the form is to done: the closer, the less it runs. Once
/// [unlocked] it sits still at home, turns yellow and can be tapped.
class RunawayButton extends StatefulWidget {
  final String label;
  final bool unlocked;
  final bool loading;
  final double calm;
  final VoidCallback onPressed;

  /// Called every time the button dodges.
  final VoidCallback? onEscape;
  const RunawayButton({
    super.key,
    required this.label,
    required this.unlocked,
    required this.onPressed,
    this.calm = 0,
    this.loading = false,
    this.onEscape,
  });

  @override
  State<RunawayButton> createState() => _RunawayButtonState();
}

class _RunawayButtonState extends State<RunawayButton> {
  static const _h = 62.0, _pad = 6.0, _btnW = 132.0;
  double _dx = 0; // target offset from home
  Timer? _home;

  @override
  void didUpdateWidget(RunawayButton old) {
    super.didUpdateWidget(old);
    if (widget.unlocked && _dx != 0) _goHome();
  }

  @override
  void dispose() {
    _home?.cancel();
    super.dispose();
  }

  void _goHome() {
    _home?.cancel();
    if (mounted) setState(() => _dx = 0);
  }

  /// Moves away from a pointer at [px] (dock coordinates).
  void _dodge(double px, double width) {
    if (widget.unlocked) return;
    final maxDx = (width - _btnW) / 2 - _pad;
    final reach = maxDx * (1 - widget.calm.clamp(0.0, 0.85));
    final centre = width / 2 + _dx;
    var dir = px < centre ? 1.0 : -1.0;
    // Pinned against a wall: jump across instead.
    if (_dx.sign == dir && _dx.abs() > reach * 0.6) dir = -dir;
    final next = dir * reach;
    if ((next - _dx).abs() < 1) return;
    HapticFeedback.lightImpact();
    setState(() => _dx = next);
    widget.onEscape?.call();
    _home?.cancel();
    _home = Timer(const Duration(milliseconds: 1400), _goHome);
  }

  @override
  Widget build(BuildContext context) {
    final on = widget.unlocked;
    return LayoutBuilder(
      builder: (context, c) {
        final w = c.maxWidth;
        final homeLeft = (w - _btnW) / 2;
        final maxDx = homeLeft - _pad;
        return MouseRegion(
          onHover: (e) {
            final centre = w / 2 + _dx;
            if ((e.localPosition.dx - centre).abs() < _btnW / 2 + 24) _dodge(e.localPosition.dx, w);
          },
          onExit: (_) => _goHome(),
          child: Listener(
            behavior: HitTestBehavior.opaque,
            onPointerDown: (e) {
              final centre = w / 2 + _dx;
              if ((e.localPosition.dx - centre).abs() < _btnW / 2 + 16) _dodge(e.localPosition.dx, w);
            },
            child: Container(
              height: _h,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(_h / 2),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: _dx),
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeOutBack,
                builder: (context, dx, _) {
                  final away = (dx.abs() / (maxDx <= 0 ? 1 : maxDx)).clamp(0.0, 1.0);
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Home slot + tether, only visible once the button has left.
                      Positioned.fill(
                        child: IgnorePointer(
                          child: CustomPaint(
                            painter: _TetherPainter(
                              homeLeft: homeLeft,
                              btnW: _btnW,
                              pad: _pad,
                              dx: dx,
                              opacity: on ? 0 : math.min(1, dx.abs() / 12),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: homeLeft + dx,
                        top: _pad - 1,
                        width: _btnW,
                        height: _h - _pad * 2,
                        child: Transform.rotate(
                          angle: -dx.sign * away * 0.12,
                          child: GestureDetector(
                            onTap: on && !widget.loading ? widget.onPressed : null,
                            child: MouseRegion(
                              cursor: on ? SystemMouseCursors.click : SystemMouseCursors.basic,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 300),
                                decoration: BoxDecoration(
                                  color: on ? BP.yellow : const Color(0xFF383833),
                                  borderRadius: BorderRadius.circular(_h / 2),
                                  border: Border.all(color: Colors.white.withValues(alpha: on ? 0 : 0.12)),
                                  boxShadow: on
                                      ? [BoxShadow(color: BP.yellow.withValues(alpha: 0.5), blurRadius: 20)]
                                      : const [],
                                ),
                                alignment: Alignment.center,
                                child: widget.loading
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2.5, color: BP.black),
                                      )
                                    : FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Text(
                                          widget.label,
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 1,
                                            color: on ? BP.black : Colors.white.withValues(alpha: 0.75),
                                          ),
                                        ),
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Dashed outline of the button's home slot plus a glowing, slightly sagging
/// tether from the slot to wherever the button ran.
class _TetherPainter extends CustomPainter {
  final double homeLeft, btnW, pad, dx, opacity;
  _TetherPainter({
    required this.homeLeft,
    required this.btnW,
    required this.pad,
    required this.dx,
    required this.opacity,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0) return;
    final h = size.height - pad * 2;
    final slot = RRect.fromRectAndRadius(Rect.fromLTWH(homeLeft, pad - 1, btnW, h), Radius.circular(h / 2));
    final dash = Paint()
      ..color = BP.yellow.withValues(alpha: 0.45 * opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawRRect(slot, Paint()..color = BP.yellow.withValues(alpha: 0.05 * opacity));
    for (final m in (Path()..addRRect(slot)).computeMetrics()) {
      for (double d = 0; d < m.length; d += 10) {
        canvas.drawPath(m.extractPath(d, d + 5), dash);
      }
    }
    // Tether: from the slot's centre to the button's centre.
    final cy = size.height / 2;
    final from = Offset(homeLeft + btnW / 2, cy);
    final to = Offset(homeLeft + btnW / 2 + dx, cy);
    final sag = math.min(10.0, dx.abs() * 0.08);
    final path = Path()
      ..moveTo(from.dx, from.dy)
      ..quadraticBezierTo((from.dx + to.dx) / 2, cy + sag, to.dx, to.dy);
    canvas.drawPath(
      path,
      Paint()
        ..color = BP.yellow.withValues(alpha: 0.25 * opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = BP.yellow.withValues(alpha: 0.9 * opacity)
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 2,
    );
    canvas.drawCircle(from, 3, Paint()..color = BP.yellow.withValues(alpha: opacity));
  }

  @override
  bool shouldRepaint(_TetherPainter o) => o.dx != dx || o.opacity != opacity || o.homeLeft != homeLeft;
}
