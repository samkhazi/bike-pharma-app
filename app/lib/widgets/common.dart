import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';

/// Big yellow call-to-action button used at the bottom of most screens.
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool arrow;
  const PrimaryButton({super.key, required this.label, this.onPressed, this.loading = false, this.arrow = true});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      width: double.infinity,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: BP.yellow,
          foregroundColor: BP.black,
          disabledBackgroundColor: BP.yellow.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: 0.6),
        ),
        child: loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: BP.black))
            : Row(mainAxisSize: MainAxisSize.min, children: [
                Flexible(child: FittedBox(fit: BoxFit.scaleDown, child: Text(label, maxLines: 1))),
                if (arrow) ...[const SizedBox(width: 10), const Icon(Icons.arrow_forward, size: 20)],
              ]),
      ),
    );
  }
}

/// White bar pinned to the bottom with a primary button.
class BottomAction extends StatelessWidget {
  final Widget child;
  const BottomAction({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(color: BP.white, border: Border(top: BorderSide(color: BP.border))),
      child: child,
    );
  }
}

/// Round back button from the design.
class CircleBack extends StatelessWidget {
  final VoidCallback? onTap;
  final bool filled;
  const CircleBack({super.key, this.onTap, this.filled = false});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? BP.white : Colors.transparent,
      shape: CircleBorder(side: filled ? BorderSide.none : const BorderSide(color: BP.border)),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap ?? () => context.canPop() ? context.pop() : context.go('/home'),
        child: const SizedBox(width: 44, height: 44, child: Icon(Icons.arrow_back, size: 22, color: BP.black)),
      ),
    );
  }
}

/// Header row: back button + title (+ optional trailing widget).
class PageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool back;
  const PageHeader({super.key, required this.title, this.subtitle, this.trailing, this.back = true});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(children: [
        if (back) ...[const CircleBack(), const SizedBox(width: 12)],
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            if (subtitle != null)
              Text(subtitle!, style: const TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500)),
          ]),
        ),
        ?trailing,
      ]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final String? action;
  final VoidCallback? onAction;
  const SectionTitle(this.text, {super.key, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
      if (action != null)
        GestureDetector(
          onTap: onAction,
          child: Text(action!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF8A6A00))),
        ),
    ]);
  }
}

/// Small rounded chip (black/yellow when highlighted).
class Pill extends StatelessWidget {
  final String text;
  final bool dark;
  final VoidCallback? onTap;
  const Pill(this.text, {super.key, this.dark = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: dark ? BP.black : BP.surface, borderRadius: BorderRadius.circular(10)),
        child: Text(text,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: dark ? BP.yellow : BP.black)),
      ),
    );
  }
}

/// Grey placeholder for product / garage photos until real images exist.
class PhotoPlaceholder extends StatelessWidget {
  final IconData icon;
  final double height;
  final double radius;
  const PhotoPlaceholder({super.key, this.icon = Icons.image_outlined, this.height = 120, this.radius = 14});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(radius)),
      alignment: Alignment.center,
      child: Icon(icon, size: 40, color: const Color(0xFFB0B0AA)),
    );
  }
}

void showMessage(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
