import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

const _steps = ['Placed', 'Packed', 'On the way', 'Delivered'];

int _stepOf(String status) => switch (status) {
      'packed' => 1,
      'shipped' => 2,
      'delivered' => 3,
      _ => 0,
    };

String _statusLabel(String status) => switch (status) {
      'pending_payment' => 'Payment pending',
      'placed' => 'Placed',
      'packed' => 'Packed',
      'shipped' => 'On the way',
      'delivered' => 'Delivered',
      'cancelled' => 'Cancelled',
      _ => status,
    };

String _bookingLabel(String status) => switch (status) {
      'booked' => 'Booked',
      'in_progress' => 'In progress',
      'done' => 'Done',
      'cancelled' => 'Cancelled',
      _ => status,
    };

bool _bookingActive(ServiceBooking b) => b.status == 'booked' || b.status == 'in_progress';

String _bookingWhen(ServiceBooking b) {
  final d = DateTime.tryParse(b.date);
  final day = d == null ? b.date : DateFormat('EEE, d MMM').format(d);
  return [day, b.slot, if (b.pickup) 'Pickup'].join(' · ');
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  bool _past = false;
  bool _loading = true;
  String? _error;
  List<ShopOrder> _orders = [];
  List<ServiceBooking> _bookings = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<AppState>().repo;
    try {
      final results = await Future.wait([repo.orders(), repo.serviceBookings()]);
      if (!mounted) return;
      setState(() {
        _orders = (results[0] as List<ShopOrder>)..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        _bookings = results[1] as List<ServiceBooking>;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Orders load nahi ho paye';
      });
      showMessage(context, 'Orders load nahi ho paye. Pull down to retry.');
    }
  }

  Future<void> _orderAgain(ShopOrder o) async {
    final app = context.read<AppState>();
    if (app.catalogue.isEmpty) {
      try {
        await app.refreshCatalogue();
      } catch (_) {}
    }
    var added = 0;
    try {
      for (final item in o.items) {
        if (app.productById(item.productId) == null) continue;
        await app.addToCart(item.productId, item.qty);
        added++;
      }
    } catch (e) {
      if (mounted) showMessage(context, 'Cart mein add nahi ho paya. Please try again.');
      return;
    }
    if (!mounted) return;
    if (added == 0) {
      showMessage(context, 'Ye items abhi available nahi hain');
      return;
    }
    if (added < o.items.length) showMessage(context, 'Kuch items available nahi the');
    context.push('/cart');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Text('My Orders', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          ),
          Padding(
            padding: BP.pagePadding,
            child: _Segmented(past: _past, onChanged: (v) => setState(() => _past = v)),
          ),
          const SizedBox(height: 16),
          Expanded(child: _body()),
        ]),
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: BP.black));
    final orders = _orders.where((o) => o.isActive != _past).toList();
    final bookings = _bookings.where((b) => _bookingActive(b) != _past).toList();
    final children = <Widget>[
      for (final o in orders)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: _past ? _PastOrderCard(order: o, onAgain: () => _orderAgain(o)) : _ActiveOrderCard(order: o),
        ),
      for (final b in bookings)
        Padding(padding: const EdgeInsets.only(bottom: 14), child: _BookingCard(booking: b)),
    ];
    return RefreshIndicator(
      color: BP.black,
      onRefresh: _load,
      child: children.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 60, 20, 110),
              children: [_Empty(past: _past, error: _error)],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 110),
              children: children,
            ),
    );
  }
}

class _Segmented extends StatelessWidget {
  final bool past;
  final ValueChanged<bool> onChanged;
  const _Segmented({required this.past, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, bool value) {
      final on = past == value;
      return Expanded(
        child: GestureDetector(
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: on ? BP.black : Colors.transparent, borderRadius: BorderRadius.circular(12)),
            child: Text(label,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: on ? BP.yellow : BP.grey)),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [tab('Active', false), tab('Past', true)]),
    );
  }
}

BoxDecoration _card() => BoxDecoration(
      color: BP.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: BP.border),
    );

class _Badge extends StatelessWidget {
  final String text;
  final Color bg, fg;
  const _Badge(this.text, {this.bg = BP.softYellow, this.fg = const Color(0xFF8A6A00)});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: fg)),
      );
}

class _ActiveOrderCard extends StatelessWidget {
  final ShopOrder order;
  const _ActiveOrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _card(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Order #${order.id}', style: const TextStyle(fontSize: 12, color: BP.grey)),
              const SizedBox(height: 2),
              Text(order.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(width: 8),
          _Badge(_statusLabel(order.status)),
        ]),
        const SizedBox(height: 16),
        _Stepper(step: _stepOf(order.status)),
        const Divider(height: 28, color: BP.border),
        Row(children: [
          Expanded(child: Text(rupees(order.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
          OutlinedButton(
            onPressed: () => _showTracking(context, order),
            style: OutlinedButton.styleFrom(
              foregroundColor: BP.black,
              side: const BorderSide(color: BP.black, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            child: const Text('Track order', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ]),
      ]),
    );
  }
}

void _showTracking(BuildContext context, ShopOrder o) {
  final step = _stepOf(o.status);
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: BP.white,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Order #${o.id}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          Text('Placed on ${DateFormat('d MMM yyyy').format(o.createdAt)} · ${o.paymentMethod == 'cod' ? 'Cash on delivery' : o.paid ? 'Paid online' : 'Payment pending'}',
              style: const TextStyle(fontSize: 13, color: BP.grey)),
          const SizedBox(height: 16),
          for (var i = 0; i < _steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Icon(i <= step ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: i < step ? BP.black : i == step ? BP.yellow : BP.border),
                const SizedBox(width: 10),
                Text(_steps[i], style: TextStyle(fontWeight: i == step ? FontWeight.w800 : FontWeight.w500)),
              ]),
            ),
          const Divider(height: 24, color: BP.border),
          for (final it in o.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Expanded(child: Text('${it.name} × ${it.qty}')),
                Text(rupees(it.price * it.qty), style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
          if (o.deliveryFee > 0)
            Row(children: [const Expanded(child: Text('Delivery')), Text(rupees(o.deliveryFee))]),
          const SizedBox(height: 6),
          Row(children: [
            const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w800))),
            Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w800)),
          ]),
        ]),
      ),
    ),
  );
}

class _Stepper extends StatelessWidget {
  final int step;
  const _Stepper({required this.step});

  @override
  Widget build(BuildContext context) {
    Widget dot(int i) {
      final current = i == step;
      return Container(
        width: current ? 20 : 14,
        height: current ? 20 : 14,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: current ? BP.yellow : i < step ? BP.black : const Color(0xFFDCDCD8),
          border: current ? Border.all(color: BP.softYellow, width: 3) : null,
        ),
      );
    }

    return Column(children: [
      SizedBox(
        height: 20,
        child: Row(children: [
          for (var i = 0; i < _steps.length; i++) ...[
            dot(i),
            if (i < _steps.length - 1)
              Expanded(child: Container(height: 3, color: i < step ? BP.black : const Color(0xFFDCDCD8))),
          ],
        ]),
      ),
      const SizedBox(height: 8),
      Row(children: [
        for (var i = 0; i < _steps.length; i++)
          Expanded(
            child: Text(
              _steps[i],
              textAlign: i == 0 ? TextAlign.left : i == _steps.length - 1 ? TextAlign.right : TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: i == step ? BP.black : BP.grey,
                fontWeight: i == step ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
      ]),
    ]);
  }
}

class _PastOrderCard extends StatelessWidget {
  final ShopOrder order;
  final VoidCallback onAgain;
  const _PastOrderCard({required this.order, required this.onAgain});

  @override
  Widget build(BuildContext context) {
    final cancelled = order.status == 'cancelled';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _card(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Order #${order.id} · ${DateFormat('d MMM yyyy').format(order.createdAt)}',
                  style: const TextStyle(fontSize: 12, color: BP.grey)),
              const SizedBox(height: 2),
              Text(order.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(width: 8),
          cancelled
              ? const _Badge('Cancelled', bg: Color(0xFFFBE9E7), fg: BP.red)
              : const _Badge('Delivered', bg: Color(0xFFE6F4EA), fg: BP.green),
        ]),
        const Divider(height: 28, color: BP.border),
        Row(children: [
          Expanded(child: Text(rupees(order.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
          FilledButton.icon(
            onPressed: onAgain,
            style: FilledButton.styleFrom(
              backgroundColor: BP.yellow,
              foregroundColor: BP.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.replay, size: 18),
            label: const Text('Order again', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ]),
      ]),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final ServiceBooking booking;
  const _BookingCard({required this.booking});

  @override
  Widget build(BuildContext context) {
    final label = _bookingLabel(booking.status);
    final (bg, fg) = switch (booking.status) {
      'cancelled' => (const Color(0xFFFBE9E7), BP.red),
      'in_progress' => (BP.softYellow, const Color(0xFF8A6A00)),
      _ => (const Color(0xFFE6F4EA), BP.green),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _card(),
      child: Row(children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(14)),
          child: const Icon(Icons.build_outlined, color: BP.yellow),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(booking.serviceType, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(_bookingWhen(booking), style: const TextStyle(fontSize: 13, color: BP.grey)),
          ]),
        ),
        const SizedBox(width: 8),
        _Badge(label, bg: bg, fg: fg),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  final bool past;
  final String? error;
  const _Empty({required this.past, this.error});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        width: 80,
        height: 80,
        decoration: const BoxDecoration(color: BP.softYellow, shape: BoxShape.circle),
        child: Icon(error != null ? Icons.cloud_off_outlined : Icons.inventory_2_outlined, size: 36, color: BP.black),
      ),
      const SizedBox(height: 16),
      Text(
        error ?? (past ? 'Koi purana order nahi' : 'Abhi koi active order nahi'),
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 6),
      Text(
        error != null ? 'Neeche kheench kar dobara try karein' : 'Spare parts order karein ya service book karein',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13, color: BP.grey),
      ),
      if (error == null) ...[
        const SizedBox(height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Pill('Shop parts', dark: true, onTap: () => context.go('/shop')),
          const SizedBox(width: 10),
          Pill('Book service', onTap: () => context.go('/service')),
        ]),
      ],
    ]);
  }
}
