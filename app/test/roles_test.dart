import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/mechanic/admin_mechanics_screen.dart';
import 'package:bike_pharma/screens/team/mechanic_discounts_screen.dart';
import 'package:bike_pharma/screens/team/team_home_screen.dart';
import 'package:bike_pharma/screens/team/team_members_screen.dart';
import 'package:bike_pharma/widgets/shop_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

Future<void> _as(DemoRepository repo, String phone) async {
  await repo.signOut();
  await repo.sendOtp(phone);
  await repo.verifyOtp('123456');
}

const _address = Address(name: 'Salim', phone: '+919008948080', line1: 'Near market', city: 'Pune', pincode: '411001');

const _salim = MechanicApplication(
  uid: '',
  name: 'Salim Khan',
  garageName: 'Salim Motors',
  phone: '+919008948080',
  address: 'Near market',
  mapsLink: '18.52, 73.85',
  specialistBrands: ['Honda'],
  services: ['General service'],
);

/// Signs the demo mechanic number up and has the team verify it. Returns the
/// new BPM id. Leaves the repo signed out.
Future<String> _verifiedMechanic(DemoRepository repo) async {
  await _as(repo, demoMechanicPhone);
  await repo.submitMechanicApplication(_salim);
  final uid = (await repo.myMechanicApplication())!.uid;
  await _as(repo, demoTeamPhone);
  final id = await repo.reviewMechanicApplication(uid, approve: true, lat: 18.52, lng: 73.85);
  await repo.signOut();
  return id!;
}

/// Pumps [start] signed in as [phone] with the session loaded, at 360dp wide.
Future<(AppState, GoRouter)> _pump(
  WidgetTester tester,
  String start, {
  required String phone,
  DemoRepository? repo,
}) async {
  tester.view.physicalSize = const Size(720, 4000);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final r = repo ?? DemoRepository();
  final app = AppState(r);
  await tester.runAsync(() async {
    await _as(r, phone);
    await app.loadSession();
  });
  final router = GoRouter(
    initialLocation: start,
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const Text('login screen')),
      GoRoute(path: '/home', builder: (_, _) => const Text('home screen')),
      GoRoute(path: '/team', builder: (_, _) => const TeamHomeScreen()),
      GoRoute(path: '/team/members', builder: (_, _) => const TeamMembersScreen()),
      GoRoute(path: '/team/discounts', builder: (_, _) => const MechanicDiscountsScreen()),
      GoRoute(path: '/admin/mechanics', builder: (_, _) => const AdminMechanicsScreen()),
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
  await tester.pumpAndSettle();
  return (app, router);
}

void main() {
  test('mechanicPrice takes the percent off and rounds to the rupee', () {
    expect(mechanicPrice(44900, 10), 40400); // ₹449 -> ₹404.10 -> ₹404
    expect(mechanicPrice(5000, 50), 2500);
    expect(mechanicPrice(14900, 15), 12700); // ₹126.65 -> ₹127
    expect(mechanicPrice(10000, 80), 5000, reason: 'capped at $maxMechanicDiscount%');
    expect(mechanicPrice(44900, 0), 44900);
    expect(mechanicPrice(44900, -5), 44900);
    expect(mechanicPrice(99, 1), 99, reason: 'never above the list price');
  });

  group('demo repo roles', () {
    test('only the owner manages the team list', () async {
      final repo = DemoRepository();
      const helper = TeamMember(phone: '+919812345678', name: 'Ravi', role: StaffRole.staff);

      await _as(repo, demoCustomerPhone);
      expect(() => repo.teamMembers(), throwsException);
      expect(() => repo.saveTeamMember(helper), throwsException);

      await _as(repo, demoTeamPhone);
      expect((await repo.teamMembers()).length, 2);
      expect(() => repo.saveTeamMember(helper), throwsException);
      expect(() => repo.removeTeamMember(demoOwnerPhone), throwsException);

      await _as(repo, demoOwnerPhone);
      await repo.saveTeamMember(helper);
      expect((await repo.teamMembers()).map((m) => m.phone), contains('+919812345678'));
      expect(
        () => repo.saveTeamMember(const TeamMember(phone: '98123', name: 'Bad', role: StaffRole.staff)),
        throwsException,
      );
      expect(() => repo.removeTeamMember(demoOwnerPhone), throwsException, reason: 'cannot remove yourself');
      expect(
        () => repo.saveTeamMember(const TeamMember(phone: demoOwnerPhone, name: 'Me', role: StaffRole.staff)),
        throwsException,
        reason: 'cannot drop your own owner access',
      );

      // The new number is team on its next login; removing it takes that away.
      await _as(repo, '+919812345678');
      expect(await repo.staffRole(), StaffRole.staff);
      await _as(repo, demoOwnerPhone);
      await repo.removeTeamMember('+919812345678');
      await _as(repo, '+919812345678');
      expect(await repo.staffRole(), isNull);
      expect(() => repo.pendingMechanicApplications(), throwsException);
    });

    test('only the owner sets mechanic discounts; only that mechanic gets them', () async {
      final repo = DemoRepository();
      final id = await _verifiedMechanic(repo);

      await _as(repo, demoTeamPhone);
      expect(() => repo.mechanicDiscounts(), throwsException);
      expect(
        () => repo.setMechanicDiscount(MechanicDiscount(mechanicId: id, garageName: '', name: '', percent: 20)),
        throwsException,
      );

      await _as(repo, demoOwnerPhone);
      final list = await repo.mechanicDiscounts();
      expect(list.map((d) => d.mechanicId), containsAll([demoMechanic.id, id]));
      expect(list.firstWhere((d) => d.mechanicId == id).percent, 0);
      expect(
        () => repo.setMechanicDiscount(MechanicDiscount(mechanicId: id, garageName: '', name: '', percent: 51)),
        throwsException,
      );
      await repo.setMechanicDiscount(MechanicDiscount(mechanicId: id, garageName: '', name: '', percent: 15));

      await _as(repo, demoMechanicPhone);
      expect(await repo.myMechanicDiscount(), 15);
      final mechOrder = await repo.placeOrder(items: {'p1': 2}, address: _address, paymentMethod: 'cod');
      expect(mechOrder.total, 2 * 38200); // ₹449 less 15% = ₹381.65 -> ₹382, free delivery

      await _as(repo, demoCustomerPhone);
      expect(await repo.myMechanicDiscount(), 0);
      final custOrder = await repo.placeOrder(items: {'p1': 2}, address: _address, paymentMethod: 'cod');
      expect(custOrder.total, 2 * 44900);
    });

    test('a pending or rejected mechanic gets no discount', () async {
      final repo = DemoRepository();
      await _as(repo, demoMechanicPhone);
      await repo.submitMechanicApplication(_salim);
      expect(await repo.myMechanicDiscount(), 0);
      final uid = (await repo.myMechanicApplication())!.uid;
      await _as(repo, demoTeamPhone);
      await repo.reviewMechanicApplication(uid, approve: false, reason: 'Address match nahi hua');
      await _as(repo, demoMechanicPhone);
      expect(await repo.myMechanicDiscount(), 0);
      final order = await repo.placeOrder(items: {'p1': 1}, address: _address, paymentMethod: 'cod');
      expect(order.total, 44900 + 4900); // full price plus delivery
    });
  });

  test('AppState: a mechanic sees every part at their price, a customer sees full price', () async {
    final repo = DemoRepository();
    final id = await _verifiedMechanic(repo);
    await _as(repo, demoOwnerPhone);
    await repo.setMechanicDiscount(MechanicDiscount(mechanicId: id, garageName: '', name: '', percent: 10));

    final app = AppState(repo);
    await _as(repo, demoMechanicPhone);
    expect(await app.landingRoute(), '/mechanic');
    expect(app.isMechanic, isTrue);
    expect(app.mechanicDiscount, 10);
    await app.refreshCatalogue();
    final pads = app.productById('p1')!;
    expect(app.priceFor(pads), 40400);
    expect(app.productsFor().length, demoProducts.length, reason: 'mechanics are not filtered to one bike');

    await app.signOut();
    expect(app.mechanicDiscount, 0);
    await _as(repo, demoCustomerPhone);
    await app.landingRoute();
    expect(app.isMechanic, isFalse);
    expect(app.priceFor(pads), 44900);
  });

  testWidgets('team home: staff sees team tiles, owner also sees owner tiles', (tester) async {
    await _pump(tester, '/team', phone: demoTeamPhone);
    expect(find.text('Bike Pharma team'), findsOneWidget);
    expect(find.byKey(const Key('teamVerify')), findsOneWidget);
    expect(find.text('1 signup verification ke liye'), findsOneWidget);
    expect(find.byKey(const Key('teamInventory')), findsOneWidget);
    expect(find.byKey(const Key('teamBilling')), findsOneWidget);
    expect(find.byKey(const Key('ownerTeam')), findsNothing);
    expect(find.byKey(const Key('ownerDiscounts')), findsNothing);
    expect(find.byKey(const Key('logout')), findsOneWidget);

    await _pump(tester, '/team', phone: demoOwnerPhone);
    expect(find.text('Owner'), findsOneWidget);
    expect(find.byKey(const Key('teamVerify')), findsOneWidget);
    expect(find.byKey(const Key('ownerTeam')), findsOneWidget);
    expect(find.byKey(const Key('ownerDiscounts')), findsOneWidget);
  });

  for (final (who, phone) in [('customer', demoCustomerPhone), ('mechanic', demoMechanicPhone)]) {
    testWidgets('a $who is refused every team and owner screen', (tester) async {
      for (final path in ['/team', '/team/members', '/team/discounts', '/admin/mechanics']) {
        await _pump(tester, path, phone: phone);
        expect(find.textContaining('sirf'), findsOneWidget, reason: path);
        expect(find.byKey(const Key('teamVerify')), findsNothing);
        expect(find.byKey(const Key('addMember')), findsNothing);
        expect(find.byKey(Key('discount-${demoMechanic.id}')), findsNothing);
        expect(find.text('Speed Point Garage'), findsNothing);
      }
    });
  }

  testWidgets('team (not owner) is refused the owner screens', (tester) async {
    await _pump(tester, '/team/members', phone: demoTeamPhone);
    expect(find.text('Ye screen sirf owner ke liye hai.'), findsOneWidget);
    expect(find.byKey(const Key('addMember')), findsNothing);
    await _pump(tester, '/team/discounts', phone: demoTeamPhone);
    expect(find.text('Ye screen sirf owner ke liye hai.'), findsOneWidget);
    expect(find.byKey(Key('discount-${demoMechanic.id}')), findsNothing);
  });

  testWidgets('owner adds a team member and removes them', (tester) async {
    final repo = DemoRepository();
    await _pump(tester, '/team/members', phone: demoOwnerPhone, repo: repo);
    expect(find.text('Owner (demo)'), findsOneWidget);
    expect(find.text('Team member (demo)'), findsOneWidget);
    expect(find.byKey(const Key('remove-$demoOwnerPhone')), findsNothing, reason: 'no remove button on yourself');

    await tester.tap(find.byKey(const Key('addMember')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('memberName')), 'Ravi');
    await tester.enterText(find.byKey(const Key('memberPhone')), '12345');
    await tester.tap(find.byKey(const Key('memberSave')));
    await tester.pump();
    expect(find.text('10 digit mobile number daalo'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('memberPhone')), '9812345678');
    await tester.tap(find.byKey(const Key('memberSave')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Ravi'), findsOneWidget);
    expect(find.text('+91 98123 45678'), findsOneWidget);

    await tester.tap(find.byKey(const Key('remove-+919812345678')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('removeConfirm')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Ravi'), findsNothing);
  });

  testWidgets('owner sets a mechanic discount', (tester) async {
    final repo = DemoRepository();
    await _pump(tester, '/team/discounts', phone: demoOwnerPhone, repo: repo);
    final tile = find.byKey(Key('discount-${demoMechanic.id}'));
    expect(find.descendant(of: tile, matching: find.text('10%')), findsOneWidget);
    await tester.tap(tile);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('discountInput')), '12');
    await tester.tap(find.byKey(const Key('discountSave')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.descendant(of: tile, matching: find.text('12%')), findsOneWidget);
    expect(
      (await tester.runAsync(repo.mechanicDiscounts))!.firstWhere((d) => d.mechanicId == demoMechanic.id).percent,
      12,
    );
  });

  testWidgets('product card shows mechanic price only to a verified mechanic', (tester) async {
    const pads = Product(
      id: 'p1',
      name: 'Brake Pad Set',
      category: 'spares',
      subCategory: 'Brakes',
      brand: 'Bosch',
      price: 44900,
      mrp: 54900,
      stock: 5,
      fitsAll: true,
    );
    Future<void> show(AppState app) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        ChangeNotifierProvider.value(
          value: app,
          child: const MaterialApp(
            home: Scaffold(
              body: Center(
                child: SizedBox(width: 180, height: 280, child: ProductCard(product: pads)),
              ),
            ),
          ),
        ),
      );
    }

    final customer = AppState(DemoRepository());
    await show(customer);
    expect(find.text('FITS YOUR BIKE'), findsOneWidget);
    expect(find.text('₹449'), findsOneWidget);

    final mechanic = AppState(DemoRepository())
      ..role = UserRole.mechanic
      ..mechanicDiscount = 10;
    await show(mechanic);
    expect(find.text('MECHANIC PRICE'), findsOneWidget);
    expect(find.text('₹404'), findsOneWidget);
    expect(find.text('₹549'), findsOneWidget, reason: 'MRP still shown struck through');

    final noDiscount = AppState(DemoRepository())..role = UserRole.mechanic;
    await show(noDiscount);
    expect(find.text('ALL BIKES'), findsOneWidget);
    expect(find.text('₹449'), findsOneWidget);
  });
}
