import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/shop_widgets.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loading = context.read<AppState>().cart.isEmpty;
    _refresh();
  }

  Future<void> _refresh() async {
    final state = context.read<AppState>();
    try {
      await Future.wait([
        if (state.catalogue.isEmpty) state.refreshCatalogue(),
        state.refreshCart(),
      ]);
    } catch (e) {
      if (mounted) showMessage(context, 'Could not load cart: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setQty(CartLine line, int qty) async {
    try {
      await context.read<AppState>().setQty(line.product.id, qty);
      if (qty == 0 && mounted) showMessage(context, '${line.product.name} removed');
    } catch (e) {
      if (mounted) showMessage(context, 'Could not update cart: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lines = state.cartLines;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          const PageHeader(title: 'My Cart'),
          Expanded(
            child: _loading && lines.isEmpty
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2.5, color: BP.black))
                : lines.isEmpty
                    ? const _EmptyCart()
                    : RefreshIndicator(
                        color: BP.black,
                        backgroundColor: BP.yellow,
                        onRefresh: _refresh,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                          children: [
                            for (final l in lines) ...[
                              _LineCard(line: l, onQty: (q) => _setQty(l, q)),
                              const SizedBox(height: 12),
                            ],
                            const SizedBox(height: 8),
                            _BillDetails(
                              subtotal: state.cartSubtotal,
                              delivery: state.cartDelivery,
                              total: state.cartTotal,
                            ),
                          ],
                        ),
                      ),
          ),
          if (lines.isNotEmpty)
            BottomAction(
              child: Row(children: [
                Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Total', style: TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500)),
                  Text(rupees(state.cartTotal), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                ]),
                const SizedBox(width: 16),
                Expanded(child: PrimaryButton(label: 'CHECKOUT', onPressed: () => context.push('/checkout'))),
              ]),
            ),
        ]),
      ),
    );
  }
}

class _LineCard extends StatelessWidget {
  final CartLine line;
  final ValueChanged<int> onQty;
  const _LineCard({required this.line, required this.onQty});

  @override
  Widget build(BuildContext context) {
    final p = line.product;
    return Material(
      color: BP.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: BP.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/product/${p.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 80, child: PhotoPlaceholder(icon: productIcon(p), height: 80, radius: 12)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                      Text(p.brand, style: const TextStyle(fontSize: 12, color: BP.grey, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => onQty(0),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.delete_outline, size: 22, semanticLabel: 'Remove'),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(rupees(line.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                      if (line.qty > 1)
                        Text('${rupees(line.unitPrice)} each',
                            style: const TextStyle(fontSize: 11, color: BP.grey, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                  QtyStepper(qty: line.qty, max: p.stock > 0 ? p.stock : null, compact: true, onChanged: onQty),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _BillDetails extends StatelessWidget {
  final int subtotal, delivery, total;
  const _BillDetails({required this.subtotal, required this.delivery, required this.total});

  @override
  Widget build(BuildContext context) {
    final more = freeDeliveryFrom - subtotal;
    Widget row(String label, String value, {bool bold = false, Color? valueColor}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: bold ? 17 : 15,
                      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
                      color: bold ? BP.black : BP.grey)),
            ),
            Text(value,
                style: TextStyle(
                    fontSize: bold ? 17 : 15, fontWeight: bold ? FontWeight.w800 : FontWeight.w700, color: valueColor)),
          ]),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Bill details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        row('Item total', rupees(subtotal)),
        row('Delivery fee', delivery == 0 ? 'FREE' : rupees(delivery), valueColor: delivery == 0 ? BP.green : null),
        Text(
          delivery == 0
              ? 'Free delivery unlocked on orders above ${rupees(freeDeliveryFrom)}'
              : 'Add ${rupees(more)} more for free delivery (free above ${rupees(freeDeliveryFrom)})',
          style: const TextStyle(fontSize: 12, color: Color(0xFF8A6A00), fontWeight: FontWeight.w600),
        ),
        const Divider(height: 22, color: BP.border),
        row('To pay', rupees(total), bold: true),
      ]),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 84,
          height: 84,
          decoration: const BoxDecoration(color: BP.softYellow, shape: BoxShape.circle),
          child: const Icon(Icons.shopping_cart_outlined, size: 36),
        ),
        const SizedBox(height: 18),
        const Text('Your cart is empty', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Apni bike ke genuine parts add karo',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 22),
        SizedBox(width: 220, child: PrimaryButton(label: 'SHOP PARTS', onPressed: () => context.go('/shop'))),
      ]),
    );
  }
}
