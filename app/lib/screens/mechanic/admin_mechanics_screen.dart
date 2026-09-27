import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../team/team_widgets.dart';

/// Bike Pharma team only: new mechanic signups waiting for verification.
/// Customers and mechanics never see this (and the backend refuses them).
class AdminMechanicsScreen extends StatefulWidget {
  const AdminMechanicsScreen({super.key});

  @override
  State<AdminMechanicsScreen> createState() => _AdminMechanicsScreenState();
}

class _AdminMechanicsScreenState extends State<AdminMechanicsScreen> {
  List<MechanicApplication>? _items;
  String? _busy; // uid being reviewed

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isTeam) _load();
  }

  Future<void> _load() async {
    try {
      final items = await context.read<AppState>().repo.pendingMechanicApplications();
      if (mounted) setState(() => _items = items);
    } catch (_) {
      if (mounted) {
        setState(() => _items = []);
        showMessage(context, 'Signups load nahi ho paye');
      }
    }
  }

  Future<void> _approve(MechanicApplication a) async {
    var geo = parseLatLng(a.mapsLink);
    if (geo == null) {
      final typed = await _ask(
        title: 'Garage ki location',
        hint: '18.5204, 73.8567',
        help: 'Maps link me location nahi mili. Google Maps me garage pe long-press karke lat, lng copy karo.',
      );
      if (typed == null) return;
      geo = parseLatLng(typed);
      if (geo == null) {
        if (mounted) showMessage(context, 'Location samajh nahi aayi. Jaise 18.5204, 73.8567 likho');
        return;
      }
    }
    await _review(a, approve: true, lat: geo.lat, lng: geo.lng);
  }

  Future<void> _reject(MechanicApplication a) async {
    final reason = await _ask(
      title: 'Kyun reject kar rahe ho?',
      hint: 'Jaise: garage address match nahi hua',
      help: 'Ye message mechanic ko dikhega, taaki woh theek karke dobara bhej sake.',
    );
    if (reason == null) return;
    await _review(a, approve: false, reason: reason);
  }

  Future<void> _review(MechanicApplication a, {required bool approve, String? reason, double? lat, double? lng}) async {
    setState(() => _busy = a.uid);
    try {
      final id = await context.read<AppState>().repo.reviewMechanicApplication(
        a.uid,
        approve: approve,
        reason: reason,
        lat: lat,
        lng: lng,
      );
      if (!mounted) return;
      showMessage(context, approve ? '${a.garageName} verified: $id' : '${a.garageName} reject ho gaya');
      await _load();
    } catch (e) {
      if (mounted) showMessage(context, e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<String?> _ask({required String title, required String hint, required String help}) {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(help, style: const TextStyle(fontSize: 13, color: BP.grey)),
            const SizedBox(height: 10),
            TextField(
              key: const Key('reviewInput'),
              controller: c,
              autofocus: true,
              decoration: InputDecoration(hintText: hint),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')),
          FilledButton(
            key: const Key('reviewConfirm'),
            onPressed: () => Navigator.pop(d, c.text.trim()),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.isTeam) {
      return const AccessDenied(title: 'Verify mechanics', message: 'Ye screen sirf Bike Pharma team ke liye hai.');
    }
    final items = _items;
    // Opened from the team home; a direct link has nothing to go back to.
    final canBack = context.canPop();
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: 'Verify mechanics',
              subtitle: items == null
                  ? 'Bike Pharma team'
                  : 'Bike Pharma team · ${items.length} signup verification ke liye',
              back: canBack,
              trailing: canBack ? null : const LogoutButton(),
            ),
            Expanded(
              child: items == null
                  ? const Center(child: CircularProgressIndicator(color: BP.black))
                  : items.isEmpty
                  ? const Center(
                      child: Text('Koi naya signup nahi. Sab check ho chuke hain.', style: TextStyle(color: BP.grey)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 14),
                      itemBuilder: (_, i) => _ApplicationCard(
                        a: items[i],
                        busy: _busy == items[i].uid,
                        onApprove: () => _approve(items[i]),
                        onReject: () => _reject(items[i]),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ApplicationCard extends StatelessWidget {
  final MechanicApplication a;
  final bool busy;
  final VoidCallback onApprove, onReject;
  const _ApplicationCard({required this.a, required this.busy, required this.onApprove, required this.onReject});

  @override
  Widget build(BuildContext context) {
    Future<void> call() async {
      try {
        await launchUrl(
          Uri(scheme: 'tel', path: a.phone),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {
        if (context.mounted) showMessage(context, 'Call nahi ho paya');
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: BP.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.garageName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    Text('${a.name} · ${a.experienceYears} saal experience', style: const TextStyle(color: BP.grey)),
                  ],
                ),
              ),
              if (a.createdAt != null)
                Text(DateFormat('d MMM').format(a.createdAt!), style: const TextStyle(fontSize: 12, color: BP.grey)),
            ],
          ),
          const SizedBox(height: 10),
          _Line(Icons.call_outlined, a.phone),
          _Line(Icons.location_on_outlined, a.address),
          if (a.openHours.isNotEmpty) _Line(Icons.schedule, a.openHours),
          _Line(Icons.map_outlined, parseLatLng(a.mapsLink) != null ? 'Maps location mili' : 'Maps location nahi di'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final b in a.specialistBrands) Pill(b, dark: true),
              for (final t in a.vehicleTypes) Pill(t),
              for (final s in a.services) Pill(s),
            ],
          ),
          const SizedBox(height: 14),
          if (busy)
            const Center(child: CircularProgressIndicator(color: BP.black))
          else
            Row(
              children: [
                IconButton.outlined(onPressed: call, icon: const Icon(Icons.call), tooltip: 'Call'),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    key: Key('reject-${a.uid}'),
                    onPressed: onReject,
                    style: OutlinedButton.styleFrom(foregroundColor: BP.red),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    key: Key('approve-${a.uid}'),
                    onPressed: onApprove,
                    style: FilledButton.styleFrom(backgroundColor: BP.yellow, foregroundColor: BP.black),
                    child: const Text('Verify', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Line(this.icon, this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: BP.grey),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13.5))),
      ],
    ),
  );
}
