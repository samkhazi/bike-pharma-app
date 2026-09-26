import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'screens/account/orders_screen.dart';
import 'screens/account/profile_screen.dart';
import 'screens/extras/bike_doctor_screen.dart';
import 'screens/extras/mechanic_profile_screen.dart';
import 'screens/extras/scan_mechanic_screen.dart';
import 'screens/onboarding/create_profile_screen.dart';
import 'screens/onboarding/login_screen.dart';
import 'screens/onboarding/otp_screen.dart';
import 'screens/onboarding/splash_screen.dart';
import 'screens/onboarding/vehicle_details_screen.dart';
import 'screens/service/book_service_screen.dart';
import 'screens/service/modify_screen.dart';
import 'screens/shop/cart_screen.dart';
import 'screens/shop/checkout_screen.dart';
import 'screens/shop/home_screen.dart';
import 'screens/shop/product_screen.dart';
import 'screens/shop/shop_screen.dart';
import 'widgets/bubble_nav.dart';

const tabPaths = ['/home', '/shop', '/service', '/orders', '/profile'];

GoRouter buildRouter() => GoRouter(
      initialLocation: '/splash',
      routes: [
        GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
        GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
        GoRoute(path: '/otp', builder: (_, _) => const OtpScreen()),
        GoRoute(path: '/create-profile', builder: (_, _) => const CreateProfileScreen()),
        GoRoute(path: '/vehicle-details', builder: (_, _) => const VehicleDetailsScreen()),
        ShellRoute(
          builder: (context, state, child) => _TabShell(location: state.uri.path, child: child),
          routes: [
            GoRoute(path: '/home', pageBuilder: (_, _) => const NoTransitionPage(child: HomeScreen())),
            GoRoute(
              path: '/shop',
              pageBuilder: (_, s) => NoTransitionPage(child: ShopScreen(category: s.uri.queryParameters['category'])),
            ),
            GoRoute(path: '/service', pageBuilder: (_, _) => const NoTransitionPage(child: BookServiceScreen())),
            GoRoute(path: '/orders', pageBuilder: (_, _) => const NoTransitionPage(child: OrdersScreen())),
            GoRoute(path: '/profile', pageBuilder: (_, _) => const NoTransitionPage(child: ProfileScreen())),
          ],
        ),
        GoRoute(path: '/product/:id', builder: (_, s) => ProductScreen(id: s.pathParameters['id']!)),
        GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
        GoRoute(path: '/checkout', builder: (_, _) => const CheckoutScreen()),
        GoRoute(path: '/modify', builder: (_, _) => const ModifyScreen()),
        GoRoute(path: '/bike-doctor', builder: (_, _) => const BikeDoctorScreen()),
        GoRoute(path: '/scan', builder: (_, _) => const ScanMechanicScreen()),
        GoRoute(path: '/mechanic/:id', builder: (_, s) => MechanicProfileScreen(id: s.pathParameters['id']!)),
      ],
    );

class _TabShell extends StatelessWidget {
  final String location;
  final Widget child;
  const _TabShell({required this.location, required this.child});

  @override
  Widget build(BuildContext context) {
    final index = tabPaths.indexWhere((p) => location.startsWith(p)).clamp(0, 4);
    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: BubbleNav(index: index, onTap: (i) => context.go(tabPaths[i])),
    );
  }
}
