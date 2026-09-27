import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';

/// "+919999999999" -> "+91 99999 99999".
String formatPhone(String p) => RegExp(r'^\+91\d{10}$').hasMatch(p) ? '+91 ${p.substring(3, 8)} ${p.substring(8)}' : p;

/// Shown instead of a team or owner screen to anyone without that access.
class AccessDenied extends StatelessWidget {
  final String title, message;
  const AccessDenied({super.key, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(title: title),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: BP.grey, fontSize: 15),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Log out button for screens a team member or mechanic lands on directly
/// after sign in (nothing to go back to).
class LogoutButton extends StatelessWidget {
  const LogoutButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      key: const Key('logout'),
      tooltip: 'Log out',
      icon: const Icon(Icons.logout),
      onPressed: () async {
        await context.read<AppState>().signOut();
        if (context.mounted) context.go('/login');
      },
    );
  }
}
