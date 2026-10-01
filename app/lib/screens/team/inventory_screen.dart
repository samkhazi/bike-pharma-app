import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// Team: distributor invoices. Open one to check the parts in by scanning, or
/// start a new one when a distributor's parcel arrives.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<PurchaseInvoice>? _items;

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isTeam) _load();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<AppState>().repo.purchaseInvoices();
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) {
        setState(() => _items = []);
        showMessage(context, 'Invoices load nahi ho paye');
      }
    }
  }

  Future<void> _open(String path) async {
    await context.push(path);
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (!context.watch<AppState>().isTeam) {
      return const AccessDenied(title: 'Inventory', message: 'Ye screen sirf Bike Pharma team ke liye hai.');
    }
    final items = _items;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('newInvoice'),
        backgroundColor: BP.yellow,
        foregroundColor: BP.black,
        onPressed: () => _open('/team/inventory/new'),
        icon: const Icon(Icons.add),
        label: const Text('Naya invoice', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const PageHeader(title: 'Inventory', subtitle: 'Distributor invoices'),
            Expanded(
              child: items == null
                  ? const Center(child: CircularProgressIndicator(color: BP.black))
                  : items.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32),
                            child: Text(
                              'Abhi koi invoice nahi. Distributor ka maal aaye to "Naya invoice" dabao.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: BP.grey),
                            ),
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
                          children: [for (final inv in items) _InvoiceCard(inv, onTap: () => _open('/team/inventory/${inv.id}'))],
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  final PurchaseInvoice inv;
  final VoidCallback onTap;
  const _InvoiceCard(this.inv, {required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(border: Border.all(color: BP.border), borderRadius: BorderRadius.circular(14)),
      child: ListTile(
        key: Key('invoice-${inv.id}'),
        title: Text('${inv.distributor} · ${inv.invoiceNo}', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(inv.received
            ? 'Inventory me add ho gaya · ${inv.totalReceived}/${inv.totalQty} pieces'
            : '${inv.lines.length} parts · ${inv.totalQty} pieces check karne baaki'),
        trailing: Icon(inv.received ? Icons.check_circle : Icons.chevron_right, color: inv.received ? Colors.green : BP.grey),
        onTap: onTap,
      ),
    );
  }
}
