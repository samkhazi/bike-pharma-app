import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/money.dart';
import '../core/theme.dart';
import '../data/app_state.dart';
import '../models/models.dart';
import 'common.dart';

/// Placeholder icon for a product, picked from its sub-category.
IconData productIcon(Product p) {
  final s = '${p.subCategory} ${p.name}'.toLowerCase();
  if (s.contains('oil')) return Icons.water_drop_outlined;
  if (s.contains('helmet')) return Icons.sports_motorsports_outlined;
  if (s.contains('glove') || s.contains('gear')) return Icons.back_hand_outlined;
  if (s.contains('filter')) return Icons.air;
  if (s.contains('light') || s.contains('electrical')) return Icons.lightbulb_outline;
  if (s.contains('plug') || s.contains('engine')) return Icons.bolt_outlined;
  if (s.contains('cover')) return Icons.umbrella_outlined;
  if (s.contains('mobile') || s.contains('gadget')) return Icons.smartphone_outlined;
  if (s.contains('seat')) return Icons.event_seat_outlined;
  if (s.contains('chain') || s.contains('clutch')) return Icons.settings_outlined;
  return Icons.track_changes;
}

/// Round black button with a yellow cart icon and a count badge.
class CartIconButton extends StatelessWidget {
  const CartIconButton({super.key});

  @override
  Widget build(BuildContext context) {
    final count = context.watch<AppState>().cartCount;
    return Stack(clipBehavior: Clip.none, children: [
      Material(
        color: BP.black,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => context.push('/cart'),
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.shopping_cart_outlined, color: BP.yellow, size: 22, semanticLabel: 'Cart'),
          ),
        ),
      ),
      if (count > 0)
        Positioned(
          right: -4,
          top: -6,
          child: Container(
            constraints: const BoxConstraints(minWidth: 20),
            height: 20,
            padding: const EdgeInsets.symmetric(horizontal: 5),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: BP.yellow,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: BP.white, width: 1.5),
            ),
            child: Text('$count', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: BP.black)),
          ),
        ),
    ]);
  }
}

/// − qty + stepper used on product and cart.
class QtyStepper extends StatelessWidget {
  final int qty;
  final ValueChanged<int> onChanged;
  final int min;
  final int? max;
  final bool compact;
  const QtyStepper({super.key, required this.qty, required this.onChanged, this.min = 1, this.max, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final size = compact ? 30.0 : 36.0;
    Widget btn(IconData icon, bool yellow, VoidCallback? onTap, String label) => Material(
          color: yellow ? BP.yellow : BP.surface,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onTap,
            child: SizedBox(
              width: size,
              height: size,
              child: Icon(icon, size: 18, color: onTap == null ? BP.grey : BP.black, semanticLabel: label),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(border: Border.all(color: BP.border), borderRadius: BorderRadius.circular(12)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        btn(Icons.remove, false, qty > min ? () => onChanged(qty - 1) : null, 'Decrease'),
        SizedBox(
          width: compact ? 30 : 38,
          child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ),
        btn(Icons.add, true, max == null || qty < max! ? () => onChanged(qty + 1) : null, 'Increase'),
      ]),
    );
  }
}

/// Product card with "FITS YOUR BIKE" tag, price, MRP strike and add button.
class ProductCard extends StatelessWidget {
  final Product product;
  final double? width;
  const ProductCard({super.key, required this.product, this.width});

  @override
  Widget build(BuildContext context) {
    final p = product;
    final state = context.read<AppState>();
    final price = state.priceFor(p);
    final mechanicDeal = price < p.price;
    return SizedBox(
      width: width,
      child: Material(
        color: BP.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: BP.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/product/${p.id}'),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Stack(children: [
                PhotoPlaceholder(icon: productIcon(p), height: 100, radius: 12),
                if (p.discountPercent > 0)
                  Positioned(
                    left: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(6)),
                      child: Text('${p.discountPercent}% OFF',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: BP.yellow)),
                    ),
                  ),
              ]),
              const SizedBox(height: 10),
              Text(
                mechanicDeal
                    ? 'MECHANIC PRICE'
                    : state.isMechanic
                    ? 'ALL BIKES'
                    : 'FITS YOUR BIKE',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: BP.green, letterSpacing: 0.4),
              ),
              const SizedBox(height: 4),
              Text(p.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, height: 1.25)),
              const Spacer(),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (p.mrp > price)
                      Text(rupees(p.mrp),
                          style: const TextStyle(
                              fontSize: 11, color: BP.grey, decoration: TextDecoration.lineThrough)),
                    Text(rupees(price), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  ]),
                ),
                Material(
                  color: p.stock > 0 ? BP.yellow : BP.surface,
                  borderRadius: BorderRadius.circular(8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: p.stock <= 0
                        ? null
                        : () async {
                            try {
                              await state.addToCart(p.id);
                              if (context.mounted) showMessage(context, '${p.name} added to cart');
                            } catch (e) {
                              if (context.mounted) showMessage(context, 'Could not add to cart: $e');
                            }
                          },
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: Icon(Icons.add, size: 20, color: p.stock > 0 ? BP.black : BP.grey, semanticLabel: 'Add'),
                    ),
                  ),
                ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
