import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// Team: type in a distributor's invoice (distributor, invoice number and the
/// parts billed). Saving opens the checklist to scan against.
class NewInvoiceScreen extends StatefulWidget {
  const NewInvoiceScreen({super.key});

  @override
  State<NewInvoiceScreen> createState() => _NewInvoiceScreenState();
}

class _NewInvoiceScreenState extends State<NewInvoiceScreen> {
  final _distributor = TextEditingController();
  final _invoiceNo = TextEditingController();
  final _qty = <String, int>{}; // productId -> billed qty
  List<Product> _products = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isTeam) _loadProducts();
  }

  @override
  void dispose() {
    _distributor.dispose();
    _invoiceNo.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final list = await context.read<AppState>().repo.products();
      if (mounted) setState(() => _products = list);
    } catch (_) {
      if (mounted) showMessage(context, 'Parts load nahi ho paye');
    }
  }

  Product? _product(String id) => _products.where((p) => p.id == id).firstOrNull;

  Future<void> _addPart() async {
    final picked = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PartPicker(_products),
    );
    if (picked != null) setState(() => _qty[picked.id] = (_qty[picked.id] ?? 0) + 1);
  }

  Future<void> _save() async {
    final distributor = _distributor.text.trim();
    final invoiceNo = _invoiceNo.text.trim();
    if (distributor.isEmpty || invoiceNo.isEmpty) {
      showMessage(context, 'Distributor ka naam aur invoice number daalo');
      return;
    }
    if (_qty.isEmpty) {
      showMessage(context, 'Kam se kam ek part jodo');
      return;
    }
    setState(() => _saving = true);
    try {
      final lines = [
        for (final e in _qty.entries) PurchaseLine(productId: e.key, name: _product(e.key)?.name ?? e.key, qty: e.value),
      ];
      final inv = await context.read<AppState>().repo.createPurchaseInvoice(
            distributor: distributor,
            invoiceNo: invoiceNo,
            lines: lines,
          );
      if (mounted) context.pushReplacement('/team/inventory/${inv.id}');
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showMessage(context, e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!context.watch<AppState>().isTeam) {
      return const AccessDenied(title: 'Naya invoice', message: 'Ye screen sirf Bike Pharma team ke liye hai.');
    }
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const PageHeader(title: 'Naya invoice', subtitle: 'Distributor ka bill'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  TextField(
                    key: const Key('distributorInput'),
                    controller: _distributor,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Distributor'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    key: const Key('invoiceNoInput'),
                    controller: _invoiceNo,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: 'Invoice number'),
                  ),
                  const SizedBox(height: 18),
                  const SectionTitle('Bill ke parts'),
                  const SizedBox(height: 8),
                  for (final e in _qty.entries)
                    ListTile(
                      key: Key('line-${e.key}'),
                      contentPadding: EdgeInsets.zero,
                      title: Text(_product(e.key)?.name ?? e.key, style: const TextStyle(fontWeight: FontWeight.w700)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () => setState(() {
                              if (e.value <= 1) {
                                _qty.remove(e.key);
                              } else {
                                _qty[e.key] = e.value - 1;
                              }
                            }),
                          ),
                          Text('${e.value}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => setState(() => _qty[e.key] = e.value + 1),
                          ),
                        ],
                      ),
                    ),
                  OutlinedButton.icon(
                    key: const Key('addPart'),
                    onPressed: _products.isEmpty ? null : _addPart,
                    icon: const Icon(Icons.add),
                    label: const Text('Part jodo'),
                  ),
                ],
              ),
            ),
            BottomAction(
              child: PrimaryButton(
                key: const Key('saveInvoice'),
                label: 'Save karke check shuru karo',
                loading: _saving,
                onPressed: _save,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PartPicker extends StatefulWidget {
  final List<Product> products;
  const _PartPicker(this.products);

  @override
  State<_PartPicker> createState() => _PartPickerState();
}

class _PartPickerState extends State<_PartPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final q = _q.toLowerCase();
    final shown = widget.products.where((p) => '${p.name} ${p.brand}'.toLowerCase().contains(q)).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                key: const Key('partSearch'),
                autofocus: true,
                onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'Part ka naam ya brand', prefixIcon: Icon(Icons.search)),
              ),
            ),
            Expanded(
              child: ListView(
                children: [
                  for (final p in shown)
                    ListTile(
                      key: Key('pick-${p.id}'),
                      title: Text(p.name),
                      subtitle: Text('${p.brand} · stock ${p.stock}'),
                      onTap: () => Navigator.pop(context, p),
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
