import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand colours from the Bike Pharma brand guide and the Figma design.
class BP {
  static const yellow = Color(0xFFFFC20E);
  static const brandYellow = Color(0xFFFEBE10); // logo yellow
  static const black = Color(0xFF121212);
  static const white = Colors.white;
  static const grey = Color(0xFF5F6368);
  static const border = Color(0xFFE7E7E3);
  static const surface = Color(0xFFF5F5F2);
  static const softYellow = Color(0xFFFFF8DC);
  static const green = Color(0xFF1B6B34);
  static const red = Color(0xFFB3261E);

  static const radius = 14.0;
  static const pagePadding = EdgeInsets.symmetric(horizontal: 20);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: BP.yellow,
      primary: BP.black,
      secondary: BP.yellow,
      surface: BP.white,
    ),
    scaffoldBackgroundColor: BP.white,
  );
  final text = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
    bodyColor: BP.black,
    displayColor: BP.black,
  );
  return base.copyWith(
    textTheme: text,
    appBarTheme: const AppBarTheme(
      backgroundColor: BP.white,
      foregroundColor: BP.black,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BP.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(BP.radius),
        borderSide: const BorderSide(color: BP.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(BP.radius),
        borderSide: const BorderSide(color: BP.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(BP.radius),
        borderSide: const BorderSide(color: BP.black, width: 1.5),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: BP.black,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
