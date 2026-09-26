import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/shop/cart_screen.dart';
import 'package:bike_pharma/screens/shop/checkout_screen.dart';
import 'package:bike_pharma/screens/shop/home_screen.dart';
import 'package:bike_pharma/screens/shop/product_screen.dart';
import 'package:bike_pharma/screens/shop/shop_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

AppState _state() {
  final s = AppState(DemoRepository())
    ..profile = const UserProfile(uid: 'u', name: 'Sam Khazi', phone: '+919876543210', activeVehicleId: 'v1')
    ..vehicles = [const Vehicle(id: 'v1', brand: 'Honda', model: 'Shine 125', year: 2022, regNo: 'MH12AB1234')]
    ..catalogue = List.of(demoProducts);
  return s;
}

void _tallView(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.5; // 720 x 1600 logical; test font is wider than Plus Jakarta Sans
  addTearDown(tester.view.reset);
}

Widget _app(AppState state, String initial) {
  final router = GoRouter(initialLocation: initial, routes: [
    GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
    GoRoute(path: '/shop', builder: (_, s) => ShopScreen(category: s.uri.queryParameters['category'])),
    GoRoute(path: '/product/:id', builder: (_, s) => ProductScreen(id: s.pathParameters['id']!)),
    GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
    GoRoute(path: '/checkout', builder: (_, _) => const CheckoutScreen()),
    GoRoute(path: '/orders', builder: (_, _) => const Scaffold(body: Text('ORDERS PAGE'))),
    for (final p in ['/scan', '/bike-doctor', '/service', '/modify', '/vehicle-details'])
      GoRoute(path: p, builder: (_, _) => Scaffold(body: Text(p))),
  ]);
  return ChangeNotifierProvider.value(value: state, child: MaterialApp.router(routerConfig: router));
}

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;

  testWidgets('home greets the rider and shows offers + parts', (tester) async {
    _tallView(tester);
    await tester.pumpWidget(_app(_state(), '/home'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Hello, Sam'), findsOneWidget);
    expect(find.text('Search parts for your Shine 125'), findsOneWidget);
    expect(find.text('What do you need?'), findsOneWidget);
    expect(find.text('Apni bike ki service ab app se book karo'), findsOneWidget);
    expect(find.text('82'), findsOneWidget);
    // banner auto-slides after 3s
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Genuine spare parts par 10% off'), findsOneWidget);
  });

  testWidgets('shop shows only parts that fit the active bike', (tester) async {
    _tallView(tester);
    await tester.pumpWidget(_app(_state(), '/shop?category=accessories'));
    await tester.pumpAndSettle();
    expect(find.text('Honda Shine 125 · 2022 · BS6'), findsOneWidget);
    expect(find.text('Full Face Helmet'), findsOneWidget);
    expect(find.text('Brake Pad Set'), findsNothing); // spares filtered out by category
    await tester.tap(find.text('All').first);
    await tester.pumpAndSettle();
    expect(find.text('Brake Pad Set'), findsOneWidget);
  });

  testWidgets('pulsar owner never sees shine-only parts', (tester) async {
    _tallView(tester);
    final state = _state()
      ..vehicles = [const Vehicle(id: 'v1', brand: 'Bajaj', model: 'Pulsar 150', year: 2020)];
    await tester.pumpWidget(_app(state, '/shop?category=spares'));
    await tester.pumpAndSettle();
    expect(find.text('Air Filter'), findsNothing);
    expect(find.text('Spark Plug'), findsOneWidget);
  });

  testWidgets('product -> cart -> checkout places a COD order', (tester) async {
    _tallView(tester);
    final state = _state();
    await tester.pumpWidget(_app(state, '/product/p1'));
    await tester.pumpAndSettle();
    expect(find.text('Fits your bike'), findsOneWidget);
    await tester.tap(find.text('BUY ₹449'));
    await tester.pumpAndSettle();
    expect(find.text('My Cart'), findsOneWidget);
    expect(state.cartCount, 1);
    expect(find.text('Bill details'), findsOneWidget);
    await tester.tap(find.text('CHECKOUT'));
    await tester.pumpAndSettle();

    // missing address -> validation
    await tester.tap(find.text('PLACE ORDER'));
    await tester.pumpAndSettle();
    expect(find.text('Enter 6-digit pincode'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'House no, building, street'), '12 MG Road');
    await tester.enterText(find.widgetWithText(TextFormField, 'City'), 'Pune');
    await tester.enterText(find.widgetWithText(TextFormField, 'Pincode'), '411001');
    await tester.tap(find.text('PLACE ORDER'));
    await tester.pumpAndSettle();
    expect(find.text('Order placed!'), findsOneWidget);
    expect(find.textContaining('Order ID: BP'), findsOneWidget);
    await tester.tap(find.text('VIEW MY ORDERS'));
    await tester.pumpAndSettle();
    expect(find.text('ORDERS PAGE'), findsOneWidget);
    expect(state.cartCount, 0);
  });
}
