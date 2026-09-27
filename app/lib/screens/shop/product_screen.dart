import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/shop_widgets.dart';

class ProductScreen extends StatefulWidget {
  final String id;
  const ProductScreen({super.key, required this.id});

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  Product? _product;
  bool _loading = false;
  String? _error;
  int _qty = 1;
  bool _saved = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _product = context.read<AppState>().productById(widget.id);
    if (_product == null) {
      _loading = true;
      _load();
    }
  }

  Future<void> _load() async {
    if (_error != null) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final p = await context.read<AppState>().repo.product(widget.id);
      if (!mounted) return;
      setState(() {
        _product = p;
        if (p == null) _error = 'Yeh part nahi mila.';
      });
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this part: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add({required bool buyNow}) async {
    final p = _product!;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().addToCart(p.id, _qty);
      if (!mounted) return;
      if (buyNow) {
        context.push('/cart');
      } else {
        showMessage(context, '$_qty × ${p.name} added to cart');
      }
    } catch (e) {
      if (mounted) showMessage(context, 'Could not add to cart: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _product;
    if (p == null) {
      return Scaffold(
        body: SafeArea(
          child: Column(children: [
            const PageHeader(title: 'Part details'),
            Expanded(
              child: Center(
                child: _loading
                    ? const CircularProgressIndicator(strokeWidth: 2.5, color: BP.black)
                    : Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Text(_error ?? 'Yeh part nahi mila.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          TextButton(onPressed: _load, child: const Text('Try again')),
                        ]),
                      ),
              ),
            ),
          ]),
        ),
      );
    }

    final state = context.watch<AppState>();
    final vehicle = state.activeVehicle;
    final fits = p.fitsVehicle(vehicle);
    final outOfStock = p.stock <= 0;
    final inCart = state.cart[p.id] ?? 0;

    return Scaffold(
      body: Column(children: [
        Expanded(
          child: ListView(padding: EdgeInsets.zero, children: [
            _Gallery(
              product: p,
              saved: _saved,
              onSave: () {
                setState(() => _saved = !_saved);
                showMessage(context, _saved ? 'Saved to wishlist' : 'Removed from wishlist');
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.category == 'accessories' ? 'ACCESSORIES' : 'SPARE PARTS',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF8A6A00), letterSpacing: 1)),
                const SizedBox(height: 6),
                Text(p.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, height: 1.2)),
                const SizedBox(height: 6),
                Row(children: [
                  Text(p.brand, style: const TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w600)),
                  if (p.rating > 0) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.star_rounded, size: 18, color: BP.yellow),
                    const SizedBox(width: 2),
                    Text(p.rating.toStringAsFixed(1),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  ],
                ]),
                const SizedBox(height: 10),
                Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Text(rupees(p.price), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
                  if (p.mrp > p.price) ...[
                    const SizedBox(width: 10),
                    Text(rupees(p.mrp),
                        style: const TextStyle(
                            fontSize: 16, color: BP.grey, decoration: TextDecoration.lineThrough)),
                  ],
                  if (p.discountPercent > 0) ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration:
                          BoxDecoration(color: const Color(0xFFE6F4EA), borderRadius: BorderRadius.circular(6)),
                      child: Text('${p.discountPercent}% OFF',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: BP.green)),
                    ),
                  ],
                ]),
                const SizedBox(height: 18),
                _FitsCard(vehicle: vehicle, fits: fits),
                const SizedBox(height: 10),
                Row(children: [
                  Icon(outOfStock ? Icons.remove_shopping_cart_outlined : Icons.inventory_2_outlined,
                      size: 18, color: outOfStock ? BP.red : BP.grey),
                  const SizedBox(width: 6),
                  Text(
                    outOfStock
                        ? 'Out of stock'
                        : p.stock <= 10
                            ? 'Only ${p.stock} left in stock'
                            : 'In stock',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: outOfStock ? BP.red : (p.stock <= 10 ? const Color(0xFF8A6A00) : BP.green)),
                  ),
                  if (inCart > 0) ...[
                    const Spacer(),
                    Text('$inCart in cart',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: BP.grey)),
                  ],
                ]),
                const SizedBox(height: 20),
                Row(children: [
                  const Expanded(
                    child: Text('Quantity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                  QtyStepper(
                    qty: _qty,
                    max: outOfStock ? 1 : p.stock,
                    onChanged: (v) => setState(() => _qty = v),
                  ),
                ]),
                const SizedBox(height: 24),
                const Text('About this part', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(
                  p.description ??
                      '${p.brand} ${p.name.toLowerCase()} for daily city rides. Fitting is available at the Bike Pharma store.',
                  style: const TextStyle(fontSize: 14, color: BP.grey, height: 1.5, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 16),
                const Wrap(spacing: 10, runSpacing: 10, children: [
                  _CheckChip('Genuine part'),
                  _CheckChip('Fitting at store'),
                ]),
              ]),
            ),
          ]),
        ),
        BottomAction(
          child: Row(children: [
            Expanded(
              child: SizedBox(
                height: 56,
                child: OutlinedButton(
                  onPressed: outOfStock || _busy || !fits ? null : () => _add(buyNow: false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BP.black,
                    side: const BorderSide(color: BP.black, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                  child: const Text('ADD TO CART'),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PrimaryButton(
                label: outOfStock ? 'SOLD OUT' : 'BUY ${rupees(p.price * _qty)}',
                arrow: false,
                loading: _busy,
                onPressed: outOfStock || !fits ? null : () => _add(buyNow: true),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Gallery extends StatelessWidget {
  final Product product;
  final bool saved;
  final VoidCallback onSave;
  const _Gallery({required this.product, required this.saved, required this.onSave});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      height: 300 + top,
      color: BP.surface,
      child: Stack(children: [
        Center(
          child: Padding(
            padding: EdgeInsets.only(top: top),
            child: Icon(productIcon(product), size: 120, color: const Color(0xFFB0B0AA)),
          ),
        ),
        Positioned(left: 16, top: top + 12, child: const CircleBack(filled: true)),
        Positioned(
          right: 16,
          top: top + 12,
          child: Material(
            color: BP.white,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onSave,
              child: SizedBox(
                width: 44,
                height: 44,
                child: Icon(saved ? Icons.favorite : Icons.favorite_border,
                    size: 22, color: saved ? BP.red : BP.black, semanticLabel: 'Save'),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 16,
          left: 0,
          right: 0,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < 3; i++)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == 0 ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == 0 ? BP.black : const Color(0xFFCFCFCB),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

class _FitsCard extends StatelessWidget {
  final Vehicle? vehicle;
  final bool fits;
  const _FitsCard({required this.vehicle, required this.fits});

  @override
  Widget build(BuildContext context) {
    final v = vehicle;
    final bike = v == null ? 'Add your bike' : '${v.title} · ${v.year} · ${v.emission}';
    final bg = fits ? const Color(0xFFE6F4EA) : const Color(0xFFFCE8E6);
    final fg = fits ? BP.green : BP.red;
    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: fg.withValues(alpha: 0.35)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.go('/shop'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          child: Row(children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
              child: Icon(fits ? Icons.check : Icons.close, color: BP.white, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(fits ? 'Fits your bike' : 'Does not fit your bike',
                    style: TextStyle(fontSize: 13, color: fg, fontWeight: FontWeight.w600)),
                Text(bike,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              ]),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}

class _CheckChip extends StatelessWidget {
  final String text;
  const _CheckChip(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(10)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.check, size: 16, color: BP.green),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
