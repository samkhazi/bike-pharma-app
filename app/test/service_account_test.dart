import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/account/orders_screen.dart';
import 'package:bike_pharma/screens/account/profile_screen.dart';
import 'package:bike_pharma/screens/service/book_service_screen.dart';
import 'package:bike_pharma/screens/service/modify_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

Future<AppState> _signedIn() async {
  final state = AppState(DemoRepository());
  await state.repo.verifyOtp('123456');
  await state.repo.saveProfile(name: 'Sam Khazi', phone: '+919812345678');
  await state.addVehicle(const Vehicle(id: '', brand: 'Honda', model: 'Shine 125', year: 2022, regNo: 'MH12AB1234'));
  await state.loadSession();
  return state;
}

Widget _app(AppState state, String initial) {
  final router = GoRouter(initialLocation: initial, routes: [
    GoRoute(path: '/service', builder: (_, _) => const BookServiceScreen()),
    GoRoute(path: '/modify', builder: (_, _) => const ModifyScreen()),
    GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
    GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    GoRoute(path: '/login', builder: (_, _) => const Scaffold(body: Text('LOGIN'))),
    GoRoute(path: '/home', builder: (_, _) => const Scaffold(body: Text('HOME'))),
  ]);
  return ChangeNotifierProvider.value(value: state, child: MaterialApp.router(routerConfig: router));
}

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;

  testWidgets('book service books a slot and lands on orders', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    late AppState state;
    await tester.runAsync(() async => state = await _signedIn());
    await tester.pumpWidget(_app(state, '/service'));
    await tester.pumpAndSettle();

    expect(find.text('Book Service'), findsOneWidget);
    expect(find.text('Honda Shine 125'), findsOneWidget);
    expect(find.text('Wash and polish'), findsOneWidget);
    expect(find.text('12 PM'), findsOneWidget);

    await tester.tap(find.text('Oil change'));
    await tester.tap(find.text('3 PM'));
    await tester.pump();
    await tester.scrollUntilVisible(find.text('BOOK SERVICE'), 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('BOOK SERVICE'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Service booked!'), findsOneWidget);

    await tester.tap(find.text('VIEW MY ORDERS'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('My Orders'), findsOneWidget);
    expect(find.text('Oil change'), findsOneWidget);
    expect(find.text('Booked'), findsOneWidget);

    await tester.tap(find.text('Past'));
    await tester.pumpAndSettle();
    expect(find.text('Order again'), findsWidgets);
  });

  testWidgets('modify needs a selection before quoting', (tester) async {
    late AppState state;
    await tester.runAsync(() async => state = await _signedIn());
    await tester.pumpWidget(_app(state, '/modify'));
    await tester.pumpAndSettle();
    expect(find.text('Apni bike ko do naya look'), findsOneWidget);
    await tester.tap(find.text('GET A QUOTE'));
    await tester.pump();
    expect(find.text('Kam se kam ek option chunein'), findsOneWidget);
    await tester.tap(find.text('Exhaust'));
    await tester.tap(find.text('LED lights'));
    await tester.pump();
    expect(find.text('2 selected: LED lights, Exhaust'), findsOneWidget);
  });

  testWidgets('profile shows name, bike and menu', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    late AppState state;
    await tester.runAsync(() async => state = await _signedIn());
    await tester.pumpWidget(_app(state, '/profile'));
    await tester.pumpAndSettle();
    expect(find.text('Sam Khazi'), findsOneWidget);
    expect(find.text('+91 98123 45678'), findsOneWidget);
    expect(find.text('My bikes'), findsOneWidget);
    expect(find.textContaining('Honda Shine 125 · 2022 · BS6 · MH 12 AB 1234'), findsOneWidget);
    expect(find.text('Help and support'), findsOneWidget);
    expect(find.text('Log out'), findsOneWidget);
  });
}
