import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/service_widgets.dart';

const serviceTypes = ['General service', 'Oil change', 'Brake check', 'Wash and polish', 'Engine repair', 'Electrical'];
const serviceSlots = ['10 AM', '12 PM', '3 PM', '5 PM'];

class BookServiceScreen extends StatefulWidget {
  const BookServiceScreen({super.key});

  @override
  State<BookServiceScreen> createState() => _BookServiceScreenState();
}

class _BookServiceScreenState extends State<BookServiceScreen> {
  late final List<DateTime> _days;
  String _type = serviceTypes.first;
  int _day = 0;
  String _slot = serviceSlots.first;
  bool _pickup = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Bookings start from tomorrow for the next 7 days.
    _days = [for (var i = 1; i <= 7; i++) today.add(Duration(days: i))];
  }

  Future<void> _book() async {
    final app = context.read<AppState>();
    final vehicle = app.activeVehicle;
    if (vehicle == null) {
      showMessage(context, 'Pehle apni bike add karein');
      context.push('/vehicle-details');
      return;
    }
    setState(() => _busy = true);
    try {
      final date = _days[_day];
      await app.repo.bookService(
        vehicleId: vehicle.id,
        serviceType: _type,
        date: DateFormat('yyyy-MM-dd').format(date),
        slot: _slot,
        pickup: _pickup,
      );
      if (!mounted) return;
      setState(() => _busy = false);
      await showConfirmationSheet(
        context,
        title: 'Service booked!',
        message: '$_type for your ${vehicle.title}\n'
            '${DateFormat('EEE, d MMM').format(date)} · $_slot${_pickup ? ' · Pickup' : ''}',
      );
      if (mounted) context.go('/orders');
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showMessage(context, 'Booking nahi ho payi. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehicle = context.watch<AppState>().activeVehicle;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 110),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(children: [
                CircleBack(onTap: () => context.go('/home')),
                const SizedBox(width: 12),
                const Text('Book Service', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _BikeCard(
                  title: vehicle?.title ?? 'Select bike and model',
                  onTap: () => vehicle == null ? context.push('/vehicle-details') : showVehicleSwitcher(context),
                ),
                const SizedBox(height: 24),
                const _Label('Service type'),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 2.7,
                  children: [
                    for (final t in serviceTypes)
                      _TypeTile(label: t, selected: t == _type, onTap: () => setState(() => _type = t)),
                  ],
                ),
                const SizedBox(height: 24),
                const _Label('Date'),
              ]),
            ),
            SizedBox(
              height: 66,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: BP.pagePadding,
                itemCount: _days.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) => _DateTile(date: _days[i], selected: i == _day, onTap: () => setState(() => _day = i)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _Label('Time'),
                Row(children: [
                  for (var i = 0; i < serviceSlots.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: _SlotTile(
                        label: serviceSlots[i],
                        selected: serviceSlots[i] == _slot,
                        onTap: () => setState(() => _slot = serviceSlots[i]),
                      ),
                    ),
                  ],
                ]),
                const SizedBox(height: 16),
                Material(
                  color: BP.surface,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() => _pickup = !_pickup),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      child: Row(children: [
                        Checkbox(
                          value: _pickup,
                          onChanged: (v) => setState(() => _pickup = v ?? false),
                          activeColor: BP.black,
                          checkColor: BP.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                        ),
                        const SizedBox(width: 6),
                        const Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Pickup and drop from home',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                            SizedBox(height: 2),
                            Text('We collect the bike and bring it back',
                                style: TextStyle(fontSize: 13, color: BP.grey)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                PrimaryButton(label: 'BOOK SERVICE', loading: _busy, onPressed: _book),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
      );
}

class _BikeCard extends StatelessWidget {
  final String title;
  final VoidCallback onTap;
  const _BikeCard({required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BP.black,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(children: [
            const Icon(Icons.pedal_bike, color: BP.yellow, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Your bike', style: TextStyle(fontSize: 12, color: Color(0xFFB5B5B0))),
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: BP.white)),
              ]),
            ),
            const Icon(Icons.chevron_right, color: BP.white),
          ]),
        ),
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeTile({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BP.softYellow : BP.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(BP.radius),
        side: BorderSide(color: selected ? BP.yellow : BP.border, width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(BP.radius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: selected ? BP.black : const Color(0xFFD5D5D0), shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  final DateTime date;
  final bool selected;
  final VoidCallback onTap;
  const _DateTile({required this.date, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 52,
        decoration: BoxDecoration(
          color: selected ? BP.black : BP.white,
          borderRadius: BorderRadius.circular(BP.radius),
          border: Border.all(color: selected ? BP.black : BP.border),
        ),
        alignment: Alignment.center,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(DateFormat('EEE').format(date).toUpperCase(),
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? BP.white : BP.grey)),
          const SizedBox(height: 2),
          Text('${date.day}',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: selected ? BP.yellow : BP.black)),
        ]),
      ),
    );
  }
}

class _SlotTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SlotTile({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? BP.yellow : BP.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? BP.yellow : BP.border),
        ),
        child: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
      ),
    );
  }
}
