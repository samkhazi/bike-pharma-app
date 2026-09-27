import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/mechanic/admin_mechanics_screen.dart';
import 'package:bike_pharma/screens/mechanic/mechanic_home_screen.dart';
import 'package:bike_pharma/screens/mechanic/mechanic_signup_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

Future<(AppState, GoRouter)> _pump(WidgetTester tester, String start, {DemoRepository? repo}) async {
  tester.view.physicalSize = const Size(720, 4000); // 360 wide, a small phone
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final app = AppState(repo ?? DemoRepository())..isAdmin = true;
  final router = GoRouter(
    initialLocation: start,
    routes: [
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

  test('demo repo: signup goes pending, shop approval issues a BPM id', () async {
    final repo = DemoRepository();
    await repo.submitMechanicApplication(salim);
    final mine = (await repo.myMechanicApplication())!;
    expect(mine.isPending, isTrue);
    expect((await repo.pendingMechanicApplications()).length, 2);
    final id = await repo.reviewMechanicApplication(mine.uid, approve: true, lat: 18.52, lng: 73.85);
    expect(id, 'BPM-0416');
    expect((await repo.myMechanicApplication())!.isApproved, isTrue);
    expect(() => repo.reviewMechanicApplication(mine.uid, approve: false), throwsException);
  });

  testWidgets('shop verifies a signup from the list', (tester) async {
    await _pump(tester, '/admin/mechanics');
    expect(find.text('Speed Point Garage'), findsOneWidget);
    await tester.tap(find.byKey(const Key('approve-m-imran')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Speed Point Garage'), findsNothing);
    expect(find.textContaining('verified: BPM-'), findsOneWidget);
  });

  testWidgets('rejected signup shows the shop reason', (tester) async {
    await _pump(tester, '/admin/mechanics');
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
      await repo.submitMechanicApplication(salim);
      final me = (await repo.myMechanicApplication())!;
      await repo.reviewMechanicApplication(me.uid, approve: true, lat: 18.5, lng: 73.8);
    });
    await _pump(tester, '/mechanic', repo: repo);
    expect(find.text('BIKE PHARMA VERIFIED'), findsOneWidget);
    expect(find.byKey(const Key('mechanicQr')), findsOneWidget);
    expect(find.text('BPM-0416'), findsOneWidget);
  });
}
