import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Bike Pharma stacked logo: yellow gear with white piston above the
/// "BIKE PHARMA AUTOMOBILES" wordmark. Meant for dark backgrounds, since the
/// piston and wordmark are white.
class BrandLogo extends StatelessWidget {
  final double width;
  const BrandLogo({super.key, this.width = 240});

  // Geometry of the lockup in logo units (from the brand's source PDF).
  static const _w = 369.43, _h = 189.24;

  @override
  Widget build(BuildContext context) {
    final k = width / _w;
    Widget svg(String name, double x, double y, double w, double h) => Positioned(
          left: x * k,
          top: y * k,
          width: w * k,
          height: h * k,
          child: SvgPicture.asset('assets/logo/$name.svg', fit: BoxFit.fill),
        );
    return Semantics(
      label: 'Bike Pharma Automobiles',
      image: true,
      child: SizedBox(
        width: width,
        height: _h * k,
        child: Stack(children: [
          svg('gear', 140.22, 28.91, 80.02, 80.02),
          svg('piston', 156.46, 0, 47.56, 92.70),
          svg('letters', 0, 136.31, 369.43, 52.93),
          svg('stripes', 0, 136.31, 369.43, 52.93),
        ]),
      ),
    );
  }
}
