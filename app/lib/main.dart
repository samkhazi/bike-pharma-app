import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'data/app_state.dart';
import 'data/demo_repository.dart';
import 'data/firebase_repository.dart';
import 'data/repository.dart';
import 'firebase_options.dart';
import 'router.dart';

/// Run with `--dart-define=DEMO=true` to use offline sample data (OTP 123456).
/// Without it the app needs Firebase config (see README.md, `flutterfire configure`).
const demoMode = bool.fromEnvironment('DEMO');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Repository repo;
  if (demoMode) {
    repo = DemoRepository();
  } else {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      repo = FirebaseRepository();
    } catch (e) {
      debugPrint('Firebase not configured, falling back to demo data: $e');
      repo = DemoRepository();
    }
  }
  runApp(ChangeNotifierProvider(create: (_) => AppState(repo), child: const BikePharmaApp()));
}

class BikePharmaApp extends StatefulWidget {
  const BikePharmaApp({super.key});

  @override
  State<BikePharmaApp> createState() => _BikePharmaAppState();
}

class _BikePharmaAppState extends State<BikePharmaApp> {
  final _router = buildRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Bike Pharma',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: _router,
    );
  }
}
