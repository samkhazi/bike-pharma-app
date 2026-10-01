import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// Home for the Bike Pharma team and the owner. Team: verify mechanics (later
/// inventory and billing). Owner: the same, plus team members and mechanic
/// discounts.
class TeamHomeScreen extends StatefulWidget {
  const TeamHomeScreen({super.key});

  @override
  State<TeamHomeScreen> createState() => _TeamHomeScreenState();
}

class _TeamHomeScreenState extends State<TeamHomeScreen> {
  Future<int>? _pending;

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isTeam) _refresh();
  }

  void _refresh() {
    setState(() {
      _pending = context.read<AppState>().repo.pendingMechanicApplications().then((l) => l.length);
    });
  }

  Future<void> _open(String path) async {
    await context.push(path);
    if (mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.isTeam) {
      return const AccessDenied(title: 'Bike Pharma team', message: 'Ye screen sirf Bike Pharma team ke liye hai.');
    }
    final canBack = context.canPop();
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: app.isOwner ? 'Owner' : 'Bike Pharma team',
              subtitle: app.phone.isEmpty ? null : formatPhone(app.phone),
              back: canBack,
              trailing: canBack ? null : const LogoutButton(),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                children: [
                  _Tile(
                    key: const Key('teamVerify'),
                    icon: Icons.verified_user_outlined,
                    title: 'Verify mechanics',
                    subtitle: FutureBuilder<int>(
                      future: _pending,
                      builder: (_, s) => Text(
                        s.hasData ? '${s.data} signup verification ke liye' : 'Naye mechanic signups check karo',
                      ),
                    ),
                    onTap: () => _open('/admin/mechanics'),
                  ),
                  _Tile(
                    key: const Key('teamInventory'),
                    icon: Icons.inventory_2_outlined,
                    title: 'Inventory',
                    subtitle: const Text('Distributor invoice scan karke stock add karo'),
                    onTap: () => _open('/team/inventory'),
                  ),
                  const _Tile(
                    key: Key('teamBilling'),
                    icon: Icons.receipt_long_outlined,
                    title: 'Billing',
                    subtitle: Text('Counter bill aur warranty · jald aa raha hai'),
                  ),
                  if (app.isOwner) ...[
                    const SizedBox(height: 10),
                    const SectionTitle('Sirf owner'),
                    const SizedBox(height: 10),
                    _Tile(
                      key: const Key('ownerTeam'),
                      icon: Icons.groups_outlined,
                      title: 'Team members',
                      subtitle: const Text('Team ke mobile numbers add ya hatao'),
                      onTap: () => _open('/team/members'),
                    ),
                    _Tile(
                      key: const Key('ownerDiscounts'),
                      icon: Icons.percent,
                      title: 'Mechanic discount',
                      subtitle: const Text('Har verified mechanic ka discount %'),
                      onTap: () => _open('/team/discounts'),
                    ),
                  ],
                  if (app.vehicles.isNotEmpty)
                    _Tile(
                      icon: Icons.storefront_outlined,
                      title: 'Shop app kholo',
                      subtitle: const Text('Customer wala app dekho'),
                      onTap: () => context.go('/home'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget subtitle;
  final VoidCallback? onTap;
  const _Tile({super.key, required this.icon, required this.title, required this.subtitle, this.onTap});

  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: on ? BP.white : BP.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: BP.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: on ? BP.yellow : BP.border,
                  child: Icon(icon, color: BP.black),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: on ? BP.black : BP.grey),
                      ),
                      const SizedBox(height: 2),
                      DefaultTextStyle.merge(
                        style: const TextStyle(fontSize: 13, color: BP.grey),
                        child: subtitle,
                      ),
                    ],
                  ),
                ),
                if (on) const Icon(Icons.chevron_right, color: BP.grey),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
