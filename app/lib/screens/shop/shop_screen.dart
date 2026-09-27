import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/shop_widgets.dart';

enum _Sort { relevance, priceLow, priceHigh, discount }

const _sortLabels = {
  _Sort.relevance: 'Relevance',
  _Sort.priceLow: 'Price: low to high',
  _Sort.priceHigh: 'Price: high to low',
  _Sort.discount: 'Biggest discount',
};

class ShopScreen extends StatefulWidget {
  final String? category;
  const ShopScreen({super.key, this.category});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _search = TextEditingController();
  String? _category; // null = all, 'spares', 'accessories'
  String? _sub;
  _Sort _sort = _Sort.relevance;

  @override
  void initState() {
    super.initState();
    _category = _validCategory(widget.category);
    final state = context.read<AppState>();
    if (state.catalogue.isEmpty) {
      state.refreshCatalogue().catchError((Object e) {
        if (mounted) showMessage(context, 'Could not load parts: $e');
      });
    }
  }

  @override
  void didUpdateWidget(covariant ShopScreen old) {
    super.didUpdateWidget(old);
    if (old.category != widget.category) {
      _category = _validCategory(widget.category);
      _sub = null;
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String? _validCategory(String? c) => const ['spares', 'accessories'].contains(c) ? c : null;

  Future<void> _refresh() async {
    try {
      await context.read<AppState>().refreshCatalogue();
    } catch (e) {
      if (mounted) showMessage(context, 'Refresh failed: $e');
    }
  }

  void _pickSort() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: BP.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Sort by', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            RadioGroup<_Sort>(
              groupValue: _sort,
              onChanged: (v) {
                if (v != null) setState(() => _sort = v);
                Navigator.pop(ctx);
              },
              child: Column(children: [
                for (final s in _Sort.values)
                  RadioListTile<_Sort>(
                    value: s,
                    contentPadding: EdgeInsets.zero,
                    activeColor: BP.black,
                    title: Text(_sortLabels[s]!, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  void _pickVehicle() {
    final state = context.read<AppState>();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: BP.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Choose your bike', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            const Text('Shop sirf aapki bike ke parts dikhata hai',
                style: TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500)),
            const SizedBox(height: 12),
            for (final v in state.vehicles)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _VehicleOption(
                  vehicle: v,
                  selected: v.id == state.activeVehicle?.id,
                  onTap: () async {
                    Navigator.pop(ctx);
                    if (v.id == state.activeVehicle?.id) return;
                    try {
                      await state.switchVehicle(v.id);
                      if (mounted) setState(() => _sub = null);
                    } catch (e) {
                      if (mounted) showMessage(context, 'Could not switch bike: $e');
                    }
                  },
                ),
              ),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                context.push('/vehicle-details');
              },
              icon: const Icon(Icons.add),
              label: const Text('Add new bike'),
              style: OutlinedButton.styleFrom(
                foregroundColor: BP.black,
                minimumSize: const Size.fromHeight(52),
                side: const BorderSide(color: BP.black),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                textStyle: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final vehicle = state.activeVehicle;
    final inCategory = state.productsFor(category: _category);
    final subs = <String>{for (final p in inCategory) if (p.subCategory.isNotEmpty) p.subCategory}.toList()..sort();
    final sub = subs.contains(_sub) ? _sub : null;
    final q = _search.text.trim().toLowerCase();
    final products = inCategory
        .where((p) => sub == null || p.subCategory == sub)
        .where((p) => q.isEmpty || '${p.name} ${p.brand} ${p.subCategory}'.toLowerCase().contains(q))
        .toList();
    switch (_sort) {
      case _Sort.priceLow:
        products.sort((a, b) => a.price.compareTo(b.price));
      case _Sort.priceHigh:
        products.sort((a, b) => b.price.compareTo(a.price));
      case _Sort.discount:
        products.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
      case _Sort.relevance:
        break;
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: BP.black,
          backgroundColor: BP.yellow,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverList.list(children: [
                  const Row(children: [
                    Expanded(child: Text('Shop', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800))),
                    CartIconButton(),
                  ]),
                  const SizedBox(height: 18),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: _search,
                        onChanged: (_) => setState(() {}),
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          hintText: 'Search parts for your ${vehicle?.model ?? 'bike'}',
                          hintStyle: const TextStyle(color: BP.grey, fontWeight: FontWeight.w500),
                          prefixIcon: const Icon(Icons.search, color: BP.grey),
                          suffixIcon: _search.text.isEmpty
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.close, size: 20),
                                  onPressed: () => setState(_search.clear),
                                ),
                          fillColor: BP.surface,
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Material(
                      color: BP.yellow,
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: _pickSort,
                        child: const SizedBox(
                          width: 52,
                          height: 52,
                          child: Icon(Icons.filter_list, semanticLabel: 'Sort'),
                        ),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 16),
                ]),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: BP.pagePadding,
                    children: [
                      for (final (label, value) in const [
                        ('All', null),
                        ('Spare Parts', 'spares'),
                        ('Accessories', 'accessories'),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _TabChip(
                            label: label,
                            selected: _category == value,
                            onTap: () => setState(() {
                              _category = value;
                              _sub = null;
                            }),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverToBoxAdapter(child: _BikeBar(vehicle: vehicle, onChange: _pickVehicle)),
              ),
              if (subs.length > 1)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 52,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                      children: [
                        for (final s in [null, ...subs])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Pill(s ?? 'All types', dark: sub == s, onTap: () => setState(() => _sub = s)),
                          ),
                      ],
                    ),
                  ),
                ),
              if (state.catalogue.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 110),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2.5, color: BP.black)),
                  ),
                )
              else if (products.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyState(
                    searching: q.isNotEmpty,
                    bike: vehicle?.title,
                    onAddBike: vehicle == null ? () => context.push('/vehicle-details') : null,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 110),
                  sliver: SliverGrid.builder(
                    itemCount: products.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      mainAxisExtent: 256,
                    ),
                    itemBuilder: (_, i) => ProductCard(product: products[i]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TabChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BP.black : BP.white,
      shape: StadiumBorder(side: BorderSide(color: selected ? BP.black : BP.border)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Center(
            child: Text(label,
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700, color: selected ? BP.yellow : BP.black)),
          ),
        ),
      ),
    );
  }
}

class _BikeBar extends StatelessWidget {
  final Vehicle? vehicle;
  final VoidCallback onChange;
  const _BikeBar({required this.vehicle, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final v = vehicle;
    return Material(
      color: BP.black,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onChange,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 16, 12),
          child: Row(children: [
            const Icon(Icons.pedal_bike, color: BP.yellow, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Your bike · showing parts that fit',
                    style: TextStyle(fontSize: 12, color: Color(0xFFBDBDBD), fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(
                  v == null ? 'Add your bike' : '${v.title} · ${v.year} · ${v.emission}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: BP.white),
                ),
              ]),
            ),
            const SizedBox(width: 8),
            Text(v == null ? 'Add' : 'Change',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: BP.yellow)),
          ]),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool searching;
  final String? bike;
  final VoidCallback? onAddBike;
  const _EmptyState({required this.searching, this.bike, this.onAddBike});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 32, 32, 130),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(color: BP.softYellow, shape: BoxShape.circle),
          child: const Icon(Icons.search_off, size: 32),
        ),
        const SizedBox(height: 16),
        Text(
          searching ? 'Koi part nahi mila' : 'Is bike ke liye abhi parts nahi hain',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          searching
              ? 'Doosra naam try karo ya category badlo.'
              : bike == null
                  ? 'Apni bike add karo, hum sirf uske parts dikhayenge.'
                  : 'Hum sirf woh parts dikhate hain jo $bike par fit hote hain. Jaldi aur parts aa rahe hain.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500),
        ),
        if (onAddBike != null) ...[
          const SizedBox(height: 18),
          SizedBox(width: 200, child: PrimaryButton(label: 'ADD BIKE', onPressed: onAddBike)),
        ],
      ]),
    );
  }
}

class _VehicleOption extends StatelessWidget {
  final Vehicle vehicle;
  final bool selected;
  final VoidCallback onTap;
  const _VehicleOption({required this.vehicle, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BP.softYellow : BP.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(BP.radius),
        side: BorderSide(color: selected ? BP.yellow : BP.border, width: selected ? 1.5 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(BP.radius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Icon(vehicle.type == 'scooter' ? Icons.electric_scooter : Icons.two_wheeler, size: 26),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(vehicle.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                Text(vehicle.subtitle,
                    style: const TextStyle(fontSize: 12, color: BP.grey, fontWeight: FontWeight.w500)),
              ]),
            ),
            if (selected) const Icon(Icons.check_circle, color: BP.black),
          ]),
        ),
      ),
    );
  }
}
