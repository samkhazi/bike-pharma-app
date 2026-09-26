import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'brand_logo.dart';

/// Dark "store photo" hero used at the top of login and OTP, fading into the
/// white page. Placeholder until the real store photo is added.
class StorePhotoHero extends StatelessWidget {
  final double height;
  final Widget? overlay;

  /// Shows the Bike Pharma logo over the photo instead of the placeholder label.
  final bool showLogo;
  const StorePhotoHero({super.key, required this.height, this.overlay, this.showLogo = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(children: [
        const Positioned.fill(child: ColoredBox(color: Color(0xFF2D2D29))),
        Positioned.fill(
          bottom: height * 0.18,
          child: showLogo
              ? Center(child: BrandLogo(width: (height * 0.62).clamp(180.0, 260.0)))
              : const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.image_outlined, size: 40, color: Color(0xFF8E8E88)),
                  SizedBox(height: 8),
                  Text('Store photo',
                      style: TextStyle(color: Color(0xFFB5B5AE), fontSize: 14, fontWeight: FontWeight.w600)),
                ]),
        ),
        // Fade to white at the bottom.
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.22,
          child: const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x002D2D29), BP.white],
              ),
            ),
          ),
        ),
        ?overlay,
      ]),
    );
  }
}

/// Small bold label above a form field.
class FieldLabel extends StatelessWidget {
  final String text;
  const FieldLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: BP.black)),
      );
}

/// Colour swatches offered for vehicles (name -> swatch).
const vehicleColours = <String, Color>{
  'Black': Color(0xFF1C1C1C),
  'Red': Color(0xFFC62828),
  'Blue': Color(0xFF1F4FA3),
  'White': Color(0xFFF3F3F1),
  'Grey': Color(0xFF8A8A85),
  'Silver': Color(0xFFC9CCD1),
};

Color swatchFor(String? name) {
  if (name == null) return BP.grey;
  for (final e in vehicleColours.entries) {
    if (e.key.toLowerCase() == name.trim().toLowerCase()) return e.value;
  }
  return BP.grey;
}
