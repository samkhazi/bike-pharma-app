import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'profile_screen.dart' show shopSupportPhone;

const _orange = Color(0xFFC2410C);

/// Warranty tracker: every warranty-covered part from the customer's bills,
/// with days left and a one-tap WhatsApp claim.
class WarrantyScreen extends StatefulWidget {
  const WarrantyScreen({super.key});

  @override
  State<WarrantyScreen> createState() => _WarrantyScreenState();
}

class _WarrantyScreenState extends State<WarrantyScreen> {
  List<WarrantyItem>? _items;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _failed = false);
    try {
      final items = await context.read<AppState>().repo.warranties();
      if (!mounted) return;
      // Parts still covered first (soonest to end on top), expired ones last.
      int rank(WarrantyItem w) => w.daysLeft() < 0 ? 1 : 0;
      setState(
        () =>
            _items = items
              ..sort((a, b) => rank(a) != rank(b) ? rank(a) - rank(b) : a.daysLeft().compareTo(b.daysLeft())),
      );
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const PageHeader(title: 'Warranty tracker', subtitle: 'Aapke parts ki warranty, bill ke saath'),
            Expanded(
              child: _failed
                  ? _Message(
                      icon: Icons.wifi_off,
                      title: 'Load nahi ho paya',
                      body: 'Internet check karke dobara try karo.',
                      action: ('DOBARA TRY KARO', _load),
                    )
                  : items == null
                  ? const Center(child: CircularProgressIndicator(color: BP.black))
                  : items.isEmpty
                  ? const _Message(
                      icon: Icons.verified_user_outlined,
                      title: 'Abhi koi warranty nahi',
                      body: 'Battery jaise warranty wale parts kharidne par woh yahan apne aap dikhenge.',
                    )
                  : _List(items: items),
            ),
          ],
        ),
      ),
    );
  }
}

class _List extends StatelessWidget {
  final List<WarrantyItem> items;
  const _List({required this.items});

  @override
  Widget build(BuildContext context) {
    int count(WarrantyStatus s) => items.where((i) => i.status() == s).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        Row(
          children: [
            _Stat(value: count(WarrantyStatus.active), label: 'Active', color: BP.green),
            const SizedBox(width: 10),
            _Stat(value: count(WarrantyStatus.endingSoon), label: '30 din me khatam', color: _orange),
            const SizedBox(width: 10),
            _Stat(value: count(WarrantyStatus.expired), label: 'Expired', color: BP.grey),
          ],
        ),
        const SizedBox(height: 18),
        for (final w in items) ...[_WarrantyCard(w: w), const SizedBox(height: 12)],
        const SizedBox(height: 4),
        const Text(
          'Claim ke liye part aur bill shop pe laayein. Hum check karke replace ya repair karte hain.',
          style: TextStyle(fontSize: 12.5, color: BP.grey),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final int value;
  final String label;
  final Color color;
  const _Stat({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: BP.border),
          borderRadius: BorderRadius.circular(BP.radius),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$value',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: BP.grey),
            ),
          ],
        ),
      ),
    );
  }
}

class _WarrantyCard extends StatelessWidget {
  final WarrantyItem w;
  const _WarrantyCard({required this.w});

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('d MMM yyyy');
    final status = w.status();
    final left = w.daysLeft();
    final (label, color) = switch (status) {
      WarrantyStatus.active => ('ACTIVE', BP.green),
      WarrantyStatus.endingSoon => ('ENDING SOON', _orange),
      WarrantyStatus.expired => ('EXPIRED', BP.grey),
    };
    final length = w.months >= 12 && w.months % 12 == 0 ? '${w.months ~/ 12} saal' : '${w.months} mahine';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BP.white,
        border: Border.all(color: status == WarrantyStatus.endingSoon ? _orange.withValues(alpha: 0.4) : BP.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.verified_user_outlined, color: BP.black),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(w.productName, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text('${w.brand} · $length warranty', style: const TextStyle(fontSize: 12.5, color: BP.grey)),
                    Text(
                      'Bill ${w.billNo}${w.serial != null ? ' · Serial ${w.serial}' : ''}',
                      style: const TextStyle(fontSize: 12.5, color: BP.grey),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: color.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      label,
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(left < 0 ? '—' : '$left', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(left < 0 ? 'khatam' : 'din baaki', style: const TextStyle(fontSize: 11, color: BP.grey)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(value: w.used(), minHeight: 6, backgroundColor: BP.surface, color: color),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(date.format(w.purchasedAt), style: const TextStyle(fontSize: 11.5, color: BP.grey)),
              const Spacer(),
              Text('Ends ${date.format(w.endsAt)}', style: const TextStyle(fontSize: 11.5, color: BP.grey)),
            ],
          ),
          if (status != WarrantyStatus.expired) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: FilledButton.icon(
                key: Key('claim-${w.id}'),
                onPressed: () => _claim(context),
                style: FilledButton.styleFrom(
                  backgroundColor: BP.yellow,
                  foregroundColor: BP.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.chat_outlined, size: 18),
                label: const Text('CLAIM WARRANTY', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _claim(BuildContext context) async {
    final text = [
      'Hi Bike Pharma, mujhe warranty claim karni hai.',
      'Bill: ${w.billNo} (${DateFormat('d MMM yyyy').format(w.purchasedAt)})',
      'Part: ${w.productName} (${w.brand})',
      if (w.serial != null) 'Serial: ${w.serial}',
      if (w.vehicle != null) 'Bike: ${w.vehicle}',
      'Problem: ',
    ].join('\n');
    final uri = Uri.parse('https://wa.me/$shopSupportPhone?text=${Uri.encodeComponent(text)}');
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && context.mounted) showMessage(context, 'WhatsApp open nahi ho paya');
    } catch (_) {
      if (context.mounted) showMessage(context, 'WhatsApp open nahi ho paya');
    }
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title, body;
  final (String, VoidCallback)? action;
  const _Message({required this.icon, required this.title, required this.body, this.action});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: BP.grey),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(color: BP.grey),
            ),
            if (action != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: action!.$2, child: Text(action!.$1)),
            ],
          ],
        ),
      ),
    );
  }
}
