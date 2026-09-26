import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';

/// "Runaway" button: while [unlocked] is false it jumps to the other side of
/// its dock whenever a finger (or mouse) comes near it. Once unlocked it
/// stops running, turns yellow and stretches across the dock.
class RunawayButton extends StatefulWidget {
  final String label;
  final bool unlocked;
  final bool loading;
  final VoidCallback onPressed;

  /// Called every time the button runs away (so the screen can show a hint).
  final VoidCallback? onEscape;
  const RunawayButton({
    super.key,
    required this.label,
    required this.unlocked,
    required this.onPressed,
    this.loading = false,
    this.onEscape,
  });

  @override
  State<RunawayButton> createState() => _RunawayButtonState();
}

class _RunawayButtonState extends State<RunawayButton> {
  static const _h = 62.0, _pad = 6.0, _lockedW = 140.0;
  bool _right = false;

  void _flee() {
    if (widget.unlocked) return;
    HapticFeedback.lightImpact();
    setState(() => _right = !_right);
    widget.onEscape?.call();
  }

  @override
  Widget build(BuildContext context) {
    final on = widget.unlocked;
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth;
      final btnW = on ? w - _pad * 2 : _lockedW;
      final btnLeft = on ? _pad : (_right ? w - _pad - _lockedW : _pad);
      final socketLeft = _right ? _pad : w - _pad - _lockedW;
      return Container(
        height: _h,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(_h / 2),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Stack(children: [
          // Dashed socket: where the button will run to next.
          AnimatedPositioned(
            duration: const Duration(milliseconds: 380),
            curve: Curves.easeOutBack,
            left: socketLeft,
            top: _pad - 1,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 250),
              opacity: on ? 0 : 1,
              child: CustomPaint(
                size: const Size(_lockedW, _h - _pad * 2),
                painter: _DashedPillPainter(BP.yellow.withValues(alpha: 0.45)),
              ),
            ),
          ),
          AnimatedPositioned(
            duration: Duration(milliseconds: on ? 450 : 380),
            curve: on ? Curves.easeOutCubic : Curves.easeOutBack,
            left: btnLeft,
            top: _pad - 1,
            width: btnW,
            height: _h - _pad * 2,
            child: MouseRegion(
              onEnter: (_) => _flee(),
              cursor: on ? SystemMouseCursors.click : SystemMouseCursors.basic,
              child: Listener(
                onPointerDown: (_) => _flee(),
                child: GestureDetector(
                  onTap: on && !widget.loading ? widget.onPressed : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    decoration: BoxDecoration(
                      color: on ? BP.yellow : const Color(0xFF383833),
                      borderRadius: BorderRadius.circular(_h / 2),
                      border: Border.all(color: Colors.white.withValues(alpha: on ? 0 : 0.12)),
                      boxShadow: on
                          ? [BoxShadow(color: BP.yellow.withValues(alpha: 0.45), blurRadius: 18)]
                          : const [],
                    ),
                    alignment: Alignment.center,
                    child: widget.loading
                        ? const SizedBox(
                            width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: BP.black))
                        : FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Text(
                                widget.label,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1,
                                  color: on ? BP.black : Colors.white.withValues(alpha: 0.75),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(Icons.arrow_forward,
                                  size: 20, color: on ? BP.black : Colors.white.withValues(alpha: 0.75)),
                            ]),
                          ),
                  ),
                ),
              ),
            ),
          ),
        ]),
      );
    });
  }
}

class _DashedPillPainter extends CustomPainter {
  final Color color;
  _DashedPillPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(size.height / 2));
    canvas.drawRRect(r, Paint()..color = color.withValues(alpha: 0.06));
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final m in (Path()..addRRect(r)).computeMetrics()) {
      for (double d = 0; d < m.length; d += 10) {
        canvas.drawPath(m.extractPath(d, d + 5), stroke);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedPillPainter old) => old.color != color;
}
