import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/extras/bike_doctor_screen.dart';
import 'package:bike_pharma/screens/extras/mechanic_profile_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

Widget _wrap(Widget child) => ChangeNotifierProvider(
      create: (_) => AppState(DemoRepository()),
      child: MaterialApp(home: child),
    );

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;

  group('computeBikeHealth (estimate)', () {
    final now = DateTime(2026, 9, 26);

    test('returns five parts with sane values', () {
      final h = computeBikeHealth(2022, 18450, DateTime(2026, 8, 12), now: now);
      expect(h.parts.map((p) => p.name), ['Engine oil', 'Brake pads', 'Chain', 'Air filter', 'Tyres']);
      for (final p in h.parts) {
        expect(p.used, inInclusiveRange(0, 1));
      }
      expect(h.score, inInclusiveRange(0, 100));
      expect(h.nextServiceInKm, inInclusiveRange(0, serviceIntervalKm));
      expect(h.summary, isNotEmpty);
    });

    test('engine oil wears with time since service', () {
      final fresh = computeBikeHealth(2022, 18450, now.subtract(const Duration(days: 5)), now: now);
      final old = computeBikeHealth(2022, 18450, now.subtract(const Duration(days: 170)), now: now);
      expect(old.parts.first.used, greaterThan(fresh.parts.first.used));
      expect(old.parts.first.level, WearLevel.replace);
      expect(old.summary, contains('engine oil'));
      expect(old.score, lessThan(fresh.score));
    });

    test('new bike is healthier than an old one', () {
      final newBike = computeBikeHealth(2026, 1500, now.subtract(const Duration(days: 20)), now: now);
      final oldBike = computeBikeHealth(2014, 59000, now.subtract(const Duration(days: 200)), now: now);
      expect(newBike.score, greaterThan(oldBike.score));
      expect(newBike.score, greaterThanOrEqualTo(80));
    });

    test('odometer estimate grows with age', () {
      expect(estimateOdometer(2020, now: now), greaterThan(estimateOdometer(2024, now: now)));
    });
  });

  test('mechanic ids parse from QR text', () {
    expect(parseMechanicId('bikepharma://mechanic/BPM-0231'), 'BPM-0231');
    expect(parseMechanicId('https://example.com/pay?upi=abc'), isNull);
    expect(formatIndianPhone('+919800000000'), '+91 98000 00000');
  });

  testWidgets('Bike Doctor shows score, parts and tools', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_wrap(const BikeDoctorScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Bike Doctor'), findsOneWidget);
    expect(find.text('HEALTH SCORE'), findsOneWidget);
    expect(find.text('Parts ki halat'), findsOneWidget);
    expect(find.text('Engine oil'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Awaaz se problem pakdo'), 200);
    await tester.tap(find.text('Awaaz se problem pakdo'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Coming soon'), findsOneWidget);
  });

  testWidgets('Mechanic profile loads demo mechanic', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_wrap(const MechanicProfileScreen(id: 'BPM-0231')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Ravi Kumar'), findsOneWidget);
    expect(find.text('BIKE PHARMA VERIFIED'), findsOneWidget);
    expect(find.text('RK'), findsOneWidget);
    expect(find.text('Royal Enfield'), findsOneWidget);
    expect(find.text('CALL'), findsOneWidget);
    expect(find.text('WHATSAPP'), findsOneWidget);
  });

  testWidgets('Unknown mechanic shows friendly state', (tester) async {
    await tester.pumpWidget(_wrap(const MechanicProfileScreen(id: 'BPM-9999')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Ye mechanic verified nahi hai ya ID galat hai'), findsOneWidget);
  });
}
