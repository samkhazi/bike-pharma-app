import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/shop_widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Offer> _offers = [];
  bool _offersLoading = true;

  @override
  void initState() {
    super.initState();
    _loadOffers();
    final state = context.read<AppState>();
    if (state.catalogue.isEmpty) {
      state.refreshCatalogue().catchError((Object e) {
        if (mounted) showMessage(context, 'Could not load parts: $e');
      });
    }
  }

  Future<void> _loadOffers() async {
    try {
      final offers = await context.read<AppState>().repo.offers();
      if (mounted) setState(() => _offers = offers);
    } catch (e) {
      if (mounted) showMessage(context, 'Could not load offers: $e');
    } finally {
      if (mounted) setState(() => _offersLoading = false);
    }
  }

  Future<void> _refresh() async {
    final state = context.read<AppState>();
    try {
      await Future.wait([state.refreshCatalogue(), state.refreshCart(), _loadOffers()]);
    } catch (e) {
      if (mounted) showMessage(context, 'Refresh failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final model = state.activeVehicle?.model ?? 'bike';
    final popular = state.productsFor();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: BP.black,
          backgroundColor: BP.yellow,
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 110),
            children: [
              Padding(padding: BP.pagePadding, child: _Header(name: state.firstName)),
              const SizedBox(height: 20),
              Padding(padding: BP.pagePadding, child: _SearchBar(model: model)),
              const SizedBox(height: 18),
              Padding(
                padding: BP.pagePadding,
                child: _offersLoading && _offers.isEmpty
                    ? Container(
                        height: 148,
                        decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(20)),
                        alignment: Alignment.center,
                        child: const CircularProgressIndicator(strokeWidth: 2.5, color: BP.black),
                      )
                    : _offers.isEmpty
                        ? const SizedBox.shrink()
                        : _OfferCarousel(offers: _offers),
              ),
              const SizedBox(height: 26),
              const Padding(
                padding: BP.pagePadding,
                child: Text('What do you need?', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 14),
              const Padding(padding: BP.pagePadding, child: _NeedTiles()),
              const SizedBox(height: 24),
              const Padding(padding: BP.pagePadding, child: _ScanCard()),
              const SizedBox(height: 26),
              Padding(
                padding: BP.pagePadding,
                child: SectionTitle('Popular parts', action: 'See all', onAction: () => context.go('/shop')),
              ),
              const SizedBox(height: 14),
              if (popular.isEmpty)
                Padding(
                  padding: BP.pagePadding,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(16)),
                    child: Text(
                      state.catalogue.isEmpty
                          ? 'Parts load ho rahe hain…'
                          : 'Aapki bike ke liye abhi koi part nahi mila.',
                      style: const TextStyle(color: BP.grey, fontWeight: FontWeight.w600),
                    ),
                  ),
                )
              else
                SizedBox(
                  height: 256,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: BP.pagePadding,
                    itemCount: popular.length.clamp(0, 8),
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => ProductCard(product: popular[i], width: 166),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String name;
  const _Header({required this.name});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Hello, $name',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500)),
          const SizedBox(height: 2),
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () => showMessage(context, 'Delivery address checkout par add karo'),
            child: const Row(children: [
              Icon(Icons.location_on_outlined, size: 20),
              SizedBox(width: 4),
              Flexible(
                child: Text('Select your address',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
              Icon(Icons.keyboard_arrow_down, size: 20),
            ]),
          ),
        ]),
      ),
      const SizedBox(width: 8),
      Material(
        color: BP.black,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => context.push('/scan'),
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.qr_code_scanner, color: BP.white, size: 22, semanticLabel: 'Scan mechanic QR'),
          ),
        ),
      ),
      const SizedBox(width: 10),
      GestureDetector(
        onTap: () => context.push('/bike-doctor'),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(alignment: Alignment.center, children: [
            const SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(
                value: 0.82,
                strokeWidth: 4,
                strokeCap: StrokeCap.round,
                color: BP.yellow,
                backgroundColor: Color(0xFFEDEDEA),
              ),
            ),
            Semantics(
              label: 'Bike health 82',
              child: const Text('82', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
            ),
          ]),
        ),
      ),
      const SizedBox(width: 10),
      const CartIconButton(),
    ]);
  }
}

class _SearchBar extends StatelessWidget {
  final String model;
  const _SearchBar({required this.model});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BP.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.go('/shop'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 6, 6),
          child: Row(children: [
            const Icon(Icons.search, color: BP.grey),
            const SizedBox(width: 10),
            Expanded(
              child: Text('Search parts for your $model',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500)),
            ),
            Material(
              color: BP.white,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => context.push('/bike-doctor'),
                child: const SizedBox(
                  width: 38,
                  height: 38,
                  child: Icon(Icons.photo_camera_outlined, size: 20, semanticLabel: 'Bike doctor camera'),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _OfferCarousel extends StatefulWidget {
  final List<Offer> offers;
  const _OfferCarousel({required this.offers});

  @override
  State<_OfferCarousel> createState() => _OfferCarouselState();
}

class _OfferCarouselState extends State<_OfferCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted || widget.offers.length < 2 || !_controller.hasClients) return;
      final next = (_page + 1) % widget.offers.length;
      _controller.animateToPage(next, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _open(Offer o) {
    switch (o.target) {
      case 'service':
        context.go('/service');
      case 'accessories':
        context.go('/shop?category=accessories');
      default:
        context.go('/shop?category=spares');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 148,
        color: BP.black,
        child: Stack(children: [
          const Positioned.fill(child: CustomPaint(painter: _StripePainter())),
          PageView.builder(
            controller: _controller,
            itemCount: widget.offers.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (_, i) {
              final o = widget.offers[i];
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 70, 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.tag.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w800, color: BP.yellow, letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text(o.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800, color: BP.white, height: 1.2)),
                  if (o.subtitle.isNotEmpty)
                    Text(o.subtitle,
                        maxLines: 1,
                        style: const TextStyle(fontSize: 12, color: Color(0xFFBDBDBD), fontWeight: FontWeight.w600)),
                  const Spacer(),
                  SizedBox(
                    height: 36,
                    child: FilledButton(
                      onPressed: () => _open(o),
                      style: FilledButton.styleFrom(
                        backgroundColor: BP.yellow,
                        foregroundColor: BP.black,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(o.cta.isEmpty ? 'OPEN' : o.cta),
                        const SizedBox(width: 6),
                        const Icon(Icons.arrow_forward, size: 16),
                      ]),
                    ),
                  ),
                ]),
              );
            },
          ),
          if (widget.offers.length > 1)
            Positioned(
              right: 18,
              bottom: 16,
              child: Row(children: [
                for (var i = 0; i < widget.offers.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.only(left: 4),
                    width: i == _page ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _page ? BP.yellow : const Color(0xFF6B6B6B),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
              ]),
            ),
        ]),
      ),
    );
  }
}

/// Two yellow diagonal stripes in the top-right corner of the offer banner.
class _StripePainter extends CustomPainter {
  const _StripePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BP.yellow
      ..strokeCap = StrokeCap.butt;
    final w = size.width;
    canvas.drawLine(Offset(w - 78, -6), Offset(w + 6, size.height * 0.62), paint..strokeWidth = 9);
    canvas.drawLine(Offset(w - 42, -6), Offset(w + 6, size.height * 0.34), paint..strokeWidth = 3);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _NeedTiles extends StatelessWidget {
  const _NeedTiles();

  @override
  Widget build(BuildContext context) {
    final tiles = [
      ('Spare Parts', Icons.settings_outlined, () => context.go('/shop?category=spares')),
      ('Accessories', Icons.sports_motorsports_outlined, () => context.go('/shop?category=accessories')),
      ('Service', Icons.build_outlined, () => context.go('/service')),
      ('Bike Modify', Icons.bolt_outlined, () => context.push('/modify')),
    ];
    return Row(children: [
      for (final (label, icon, onTap) in tiles)
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: Column(children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(color: BP.softYellow, borderRadius: BorderRadius.circular(18)),
                child: Icon(icon, size: 28),
              ),
              const SizedBox(height: 8),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ]),
          ),
        ),
    ]);
  }
}

class _ScanCard extends StatelessWidget {
  const _ScanCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(18)),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.qr_code_2, color: BP.black),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Genuine mechanic chahiye?',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: BP.white)),
            SizedBox(height: 2),
            Text('QR scan karo, Bike Pharma verified mechanic dekho',
                style: TextStyle(fontSize: 12, color: Color(0xFFBDBDBD), fontWeight: FontWeight.w500)),
          ]),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 36,
          child: FilledButton(
            onPressed: () => context.push('/scan'),
            style: FilledButton.styleFrom(
              backgroundColor: BP.yellow,
              foregroundColor: BP.black,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            child: const Text('SCAN'),
          ),
        ),
      ]),
    );
  }
}
