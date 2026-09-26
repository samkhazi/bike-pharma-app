import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/screens/onboarding/create_profile_screen.dart';
import 'package:bike_pharma/screens/onboarding/login_screen.dart';
import 'package:bike_pharma/screens/onboarding/otp_screen.dart';
import 'package:bike_pharma/screens/onboarding/splash_screen.dart';
import 'package:bike_pharma/screens/onboarding/vehicle_details_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

Future<void> _tap(WidgetTester t, String text) async {
  await t.ensureVisible(find.text(text));
  await t.pump();
  await t.tap(find.text(text));
}

Widget _app(AppState state, String initial) {
  final router = GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/otp', builder: (_, _) => const OtpScreen()),
      GoRoute(path: '/create-profile', builder: (_, _) => const CreateProfileScreen()),
      GoRoute(path: '/vehicle-details', builder: (_, _) => const VehicleDetailsScreen()),
      GoRoute(
        path: '/home',
        builder: (_, _) => const Scaffold(body: Text('HOME')),
      ),
    ],
  );
  return ChangeNotifierProvider<AppState>.value(
    value: state,
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  testWidgets('splash plays then goes to login when signed out', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(AppState(DemoRepository()), '/splash'));
    await tester.pump(const Duration(milliseconds: 3400));
    expect(find.text('SPARE PARTS · ACCESSORIES · SERVICE'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('login -> otp -> create profile -> fetch -> home', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final state = AppState(DemoRepository());
    await tester.pumpWidget(_app(state, '/login'));

    // Locked button runs away instead of submitting.
    expect(find.text('10 digit daalo, tab ye rukega.'), findsOneWidget);
    final before = tester.getCenter(find.text('GET OTP'));
    await tester.tap(find.text('GET OTP'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.getCenter(find.text('GET OTP')).dx, isNot(closeTo(before.dx, 20)));
    expect(state.phone, '');
    await tester.pump(const Duration(milliseconds: 1500)); // springs back home
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.text('GET OTP')).dx, closeTo(before.dx, 1));

    await tester.enterText(find.byKey(const Key('phoneField')), '987654321');
    await tester.pumpAndSettle();
    expect(find.text('Bas 1 digit aur. Ab ye dheema ho gaya.'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('phoneField')), '9876543210');
    await tester.pumpAndSettle();
    expect(find.text('Locked in. Ab tap karo!'), findsOneWidget);
    await _tap(tester, 'GET OTP');
    await tester.pumpAndSettle();
    expect(state.phone, '+919876543210');
    expect(find.text('Verification Code'), findsOneWidget);
    expect(find.text('Demo OTP: 123456'), findsOneWidget);
    expect(find.textContaining('Resend code in', findRichText: true), findsOneWidget);

    await tester.enterText(find.byKey(const Key('otpField')), '123456');
    await tester.pumpAndSettle();
    expect(find.text('Create your profile'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('nameField')), 'Ravi Kumar');
    await tester.enterText(find.byKey(const Key('regField')), 'MH12AB1234');
    await _tap(tester, 'FETCH');
    await tester.pumpAndSettle();
    expect(find.text('Vehicle details mil gayi'), findsOneWidget);
    expect(find.text('Shine 125'), findsOneWidget);
    expect(find.text('ME4JC65XXXXXX4521'), findsOneWidget);

    await _tap(tester, 'SAVE & CONTINUE');
    await tester.pumpAndSettle();
    expect(find.text('HOME'), findsOneWidget);
    expect(state.profile?.name, 'Ravi Kumar');
    expect(state.activeVehicle?.model, 'Shine 125');
  });

  testWidgets('manual vehicle details asks for name and saves', (tester) async {
    tester.view.physicalSize = const Size(390, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final state = AppState(DemoRepository());
    await tester.pumpWidget(_app(state, '/vehicle-details'));
    await tester.pumpAndSettle();

    expect(find.text('Vehicle details'), findsOneWidget);
    expect(find.text('Royal Enfield'), findsOneWidget);
    expect(find.textContaining('April 2020'), findsOneWidget);

    await _tap(tester, 'Bajaj');
    await tester.pump();
    expect(find.text('Pulsar 150'), findsOneWidget);

    await _tap(tester, 'SAVE VEHICLE');
    await tester.pump();
    expect(find.text('Apna naam daalo'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('vdNameField')), 'Sam');
    await _tap(tester, 'SAVE VEHICLE');
    await tester.pumpAndSettle();
    expect(find.text('HOME'), findsOneWidget);
    expect(state.activeVehicle?.title, 'Bajaj Pulsar 150');
    expect(state.activeVehicle?.source, 'manual');
  });
}
