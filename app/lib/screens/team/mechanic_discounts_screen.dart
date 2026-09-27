import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// Owner only: discount percent for each verified mechanic. The server applies
/// it when that mechanic orders; customers never get it.
class MechanicDiscountsScreen extends StatefulWidget {
  const MechanicDiscountsScreen({super.key});

  @override
  State<MechanicDiscountsScreen> createState() => _MechanicDiscountsScreenState();
}

class _MechanicDiscountsScreenState extends State<MechanicDiscountsScreen> {
  List<MechanicDiscount>? _items;

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isOwner) _load();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<AppState>().repo.mechanicDiscounts();
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) {
        setState(() => _items = []);
        showMessage(context, 'Mechanics load nahi ho paye');
      }
    }
  }

  Future<void> _edit(MechanicDiscount d) async {
    final percent = await showDialog<int>(context: context, builder: (_) => _DiscountDialog(d));
    if (percent == null || !mounted) return;
    if (percent < 0 || percent > maxMechanicDiscount) {
      showMessage(context, 'Discount 0 se $maxMechanicDiscount% ke beech rakho');
      return;
    }
    try {
      await context.read<AppState>().repo.setMechanicDiscount(
        MechanicDiscount(
          mechanicId: d.mechanicId,
          garageName: d.garageName,
          name: d.name,
          uid: d.uid,
          percent: percent,
        ),
      );
      if (!mounted) return;
      showMessage(context, '${d.garageName}: $percent% discount set');
      await _load();
    } catch (e) {
      if (mounted) showMessage(context, e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.isOwner) {
      return const AccessDenied(title: 'Mechanic discount', message: 'Ye screen sirf owner ke liye hai.');
    }
    final items = _items;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: 'Mechanic discount',
              subtitle: items == null ? null : '${items.length} verified mechanics',
            ),
            Expanded(
              child: items == null
                  ? const Center(child: CircularProgressIndicator(color: BP.black))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: BP.softYellow,
                            borderRadius: BorderRadius.circular(BP.radius),
                          ),
                          child: const Text(
                            'Ye discount sirf us verified mechanic ko milega jab woh apne login se order karega. '
                            'Customers ko kabhi nahi milega, kyunki price server pe lagta hai.',
                            style: TextStyle(fontSize: 13.5, height: 1.4),
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (items.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Abhi koi verified mechanic nahi hai.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: BP.grey),
                            ),
                          ),
                        for (final d in items)
                          Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: BP.border),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: ListTile(
                              key: Key('discount-${d.mechanicId}'),
                              title: Text(d.garageName, style: const TextStyle(fontWeight: FontWeight.w800)),
                              subtitle: Text('${d.name} · ${d.mechanicId}'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${d.percent}%',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: d.percent > 0 ? BP.black : BP.grey,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.edit_outlined, size: 20),
                                ],
                              ),
                              onTap: () => _edit(d),
                            ),
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

class _DiscountDialog extends StatefulWidget {
  final MechanicDiscount d;
  const _DiscountDialog(this.d);

  @override
  State<_DiscountDialog> createState() => _DiscountDialogState();
}

class _DiscountDialogState extends State<_DiscountDialog> {
  late final _c = TextEditingController(text: '${widget.d.percent}');

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.d;
    return AlertDialog(
      title: Text(d.garageName),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${d.name} · ${d.mechanicId}', style: const TextStyle(color: BP.grey)),
          const SizedBox(height: 12),
          TextField(
            key: const Key('discountInput'),
            controller: _c,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(2)],
            decoration: const InputDecoration(
              labelText: 'Discount',
              suffixText: '%',
              helperText: '0 se $maxMechanicDiscount% tak',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          key: const Key('discountSave'),
          onPressed: () => Navigator.pop(context, int.tryParse(_c.text.trim())),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
