import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/account/profile_screen.dart';
import 'package:bike_pharma/screens/mechanic/admin_mechanics_screen.dart';
import 'package:bike_pharma/screens/mechanic/mechanic_home_screen.dart';
import 'package:bike_pharma/screens/mechanic/mechanic_signup_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

/// Signs [repo] in with [phone] (demo OTP) outside the fake-async zone.
Future<void> _signIn(WidgetTester tester, DemoRepository repo, String phone) => tester.runAsync(() async {
  await repo.signOut();
  await repo.sendOtp(phone);
  await repo.verifyOtp('123456');
});

Future<void> _as(DemoRepository repo, String phone) async {
  await repo.signOut();
  await repo.sendOtp(phone);
  await repo.verifyOtp('123456');
}

/// Pumps [start] with the demo repo. With [phone], signs in with that test
/// number first and loads the session, so the role comes from the repo.
Future<(AppState, GoRouter)> _pump(WidgetTester tester, String start, {DemoRepository? repo, String? phone}) async {
  tester.view.physicalSize = const Size(720, 4000); // 360 wide, a small phone
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final r = repo ?? DemoRepository();
  final app = AppState(r);
  if (phone != null) {
    await _signIn(tester, r, phone);
    await tester.runAsync(app.loadSession);
  }
  final router = GoRouter(
    initialLocation: start,
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const Text('login screen')),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/mechanic', builder: (_, _) => const MechanicHomeScreen()),
      GoRoute(path: '/mechanic-signup', builder: (_, _) => const MechanicSignupScreen()),
      GoRoute(path: '/admin/mechanics', builder: (_, _) => const AdminMechanicsScreen()),
      GoRoute(path: '/mechanic/:id', builder: (_, s) => Text('profile ${s.pathParameters['id']}')),
    ],
  );
  await tester.pumpWidget(
    ChangeNotifierProvider.value(
      value: app,
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
  return (app, router);
}

void main() {
  test('parseLatLng reads maps links and typed coordinates', () {
    expect(parseLatLng('https://maps.google.com/?q=18.5310,73.8740'), (lat: 18.531, lng: 73.874));
    expect(parseLatLng('18.52, 73.85'), (lat: 18.52, lng: 73.85));
    expect(parseLatLng('https://maps.app.goo.gl/abc'), isNull);
  });

  testWidgets('new mechanic sees signup; form needs brand and service', (tester) async {
    final (_, router) = await _pump(tester, '/mechanic');
    expect(find.text('Bike Pharma verified mechanic bano'), findsOneWidget);
    await tester.tap(find.byKey(const Key('startMechanicSignup')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('mechName')), 'Salim Khan');
    await tester.enterText(find.byKey(const Key('mechPhone')), '9876543210');
    await tester.enterText(find.byKey(const Key('mechGarage')), 'Salim Motors');
    await tester.enterText(find.byKey(const Key('mechAddress')), 'Near market');
    await tester.tap(find.byKey(const Key('mechSubmit')));
    await tester.pump();
    expect(find.text('Kam se kam ek brand chuno'), findsWidgets);

    await tester.tap(find.widgetWithText(FilterChip, 'Honda'));
    await tester.tap(find.widgetWithText(FilterChip, 'General service'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('mechSubmit')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(router.state.uri.path, '/mechanic');
    expect(find.text('Verification chal raha hai'), findsOneWidget);
    expect(find.text('Salim Motors'), findsOneWidget);
  });

  const salim = MechanicApplication(
    uid: '',
    name: 'Salim Khan',
    garageName: 'Salim Motors',
    phone: '+919876543210',
    address: 'Near market',
    mapsLink: '18.52, 73.85',
    specialistBrands: ['Honda'],
    services: ['General service'],
  );

  test('demo repo: mechanic signs up, only the team can verify, then the mechanic gets a BPM id', () async {
    final repo = DemoRepository();
    await _as(repo, demoMechanicPhone);
    await repo.submitMechanicApplication(salim);
    final mine = (await repo.myMechanicApplication())!;
    expect(mine.isPending, isTrue);
    expect(await repo.staffRole(), isNull);
    expect(() => repo.pendingMechanicApplications(), throwsException);
    expect(() => repo.reviewMechanicApplication(mine.uid, approve: true, lat: 18.52, lng: 73.85), throwsException);

    await _as(repo, demoCustomerPhone);
    expect(await repo.staffRole(), isNull);
    expect(await repo.myMechanicApplication(), isNull); // accounts are separate
    expect(() => repo.pendingMechanicApplications(), throwsException);

    await _as(repo, demoTeamPhone);
    expect(await repo.staffRole(), StaffRole.staff);
    expect((await repo.pendingMechanicApplications()).length, 2);
    final id = await repo.reviewMechanicApplication(mine.uid, approve: true, lat: 18.52, lng: 73.85);
    expect(id, 'BPM-0416');
    expect(() => repo.reviewMechanicApplication(mine.uid, approve: false), throwsException);

    await _as(repo, demoMechanicPhone);
    expect((await repo.myMechanicApplication())!.isApproved, isTrue);
    await repo.signOut();
    expect(await repo.staffRole(), isNull);
  });

  test('each test number lands on its own side after sign in', () async {
    final repo = DemoRepository();
    final app = AppState(repo);
    Future<String> land(String phone) async {
      await app.signOut();
      await _as(repo, phone);
      return app.landingRoute();
    }

    expect(await land(demoCustomerPhone), '/create-profile');
    expect(app.role, UserRole.customer);
    expect(await land(demoMechanicPhone), '/mechanic');
    expect(app.role, UserRole.mechanic);
    expect(await land(demoTeamPhone), '/team');
    expect(app.role, UserRole.team);
    expect(await land(demoOwnerPhone), '/team');
    expect(app.role, UserRole.owner);
    await app.signOut();
    expect(app.role, UserRole.customer);
    expect(app.isTeam, isFalse);
    // Any other number is a customer; the login toggle sends a new mechanic to their section.
    expect(await land('+919812345678'), '/create-profile');
    app.signingInAsMechanic = true;
    expect(await app.landingRoute(), '/mechanic');
  });

  testWidgets('a mechanic never sees the verify option', (tester) async {
    final repo = DemoRepository();
    await _pump(tester, '/mechanic', repo: repo, phone: demoMechanicPhone);
    expect(find.text('Bike Pharma verified mechanic bano'), findsOneWidget);
    expect(find.textContaining('Verify mechanics'), findsNothing);
    expect(find.byKey(const Key('openVerify')), findsNothing);
    // Nothing to go back to, so the mechanic can log out from here.
    expect(find.byKey(const Key('mechanicLogout')), findsOneWidget);
  });

  testWidgets('verify screen refuses anyone outside the team', (tester) async {
    final repo = DemoRepository();
    await _pump(tester, '/admin/mechanics', repo: repo, phone: demoMechanicPhone);
    expect(find.text('Ye screen sirf Bike Pharma team ke liye hai.'), findsOneWidget);
    expect(find.text('Speed Point Garage'), findsNothing);
    expect(find.byKey(const Key('approve-m-imran')), findsNothing);
  });

  testWidgets('profile menu shows team tools only to the team and owner', (tester) async {
    await _pump(tester, '/profile', phone: demoCustomerPhone);
    expect(find.text('Mechanic section'), findsOneWidget);
    expect(find.text('Team tools'), findsNothing);
    expect(find.text('Owner tools'), findsNothing);
    await _pump(tester, '/profile', phone: demoTeamPhone);
    expect(find.text('Team tools'), findsOneWidget);
    await _pump(tester, '/profile', phone: demoOwnerPhone);
    expect(find.text('Owner tools'), findsOneWidget);
  });

  testWidgets('team verifies a signup from the list', (tester) async {
    await _pump(tester, '/admin/mechanics', phone: demoTeamPhone);
    expect(find.text('Speed Point Garage'), findsOneWidget);
    await tester.tap(find.byKey(const Key('approve-m-imran')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Speed Point Garage'), findsNothing);
    expect(find.textContaining('verified: BPM-'), findsOneWidget);
  });

  testWidgets('rejected signup shows the team reason', (tester) async {
    await _pump(tester, '/admin/mechanics', phone: demoTeamPhone);
    await tester.tap(find.byKey(const Key('reject-m-imran')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('reviewInput')), 'Address match nahi hua');
    await tester.tap(find.byKey(const Key('reviewConfirm')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Koi naya signup nahi. Sab check ho chuke hain.'), findsOneWidget);
  });

  testWidgets('approved mechanic sees ID card and QR', (tester) async {
    final repo = DemoRepository();
    await tester.runAsync(() async {
      await _as(repo, demoMechanicPhone);
      await repo.submitMechanicApplication(salim);
      final me = (await repo.myMechanicApplication())!;
      await _as(repo, demoTeamPhone);
      await repo.reviewMechanicApplication(me.uid, approve: true, lat: 18.5, lng: 73.8);
      await _as(repo, demoMechanicPhone);
    });
    await _pump(tester, '/mechanic', repo: repo);
    await tester.pump(const Duration(milliseconds: 300)); // signup, then discount
    expect(find.text('BIKE PHARMA VERIFIED'), findsOneWidget);
    expect(find.byKey(const Key('mechanicQr')), findsOneWidget);
    expect(find.text('BPM-0416'), findsOneWidget);
  });
}
