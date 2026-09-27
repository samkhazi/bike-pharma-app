import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../widgets/common.dart';
import '../../widgets/service_widgets.dart';

const modifyOptions = <(String, IconData)>[
  ('Paint and wrap', Icons.water_drop_outlined),
  ('LED lights', Icons.light_mode_outlined),
  ('Exhaust', Icons.air),
  ('Seat cover', Icons.event_seat_outlined),
  ('Alloy wheels', Icons.trip_origin),
  ('Crash guard', Icons.shield_outlined),
];

class ModifyScreen extends StatefulWidget {
  const ModifyScreen({super.key});

  @override
  State<ModifyScreen> createState() => _ModifyScreenState();
}

class _ModifyScreenState extends State<ModifyScreen> {
  final _selected = <String>[];
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _toggle(String item) => setState(() => _selected.contains(item) ? _selected.remove(item) : _selected.add(item));

  Future<void> _quote() async {
    if (_selected.isEmpty) {
      showMessage(context, 'Kam se kam ek option chunein');
      return;
    }
    final app = context.read<AppState>();
    final vehicle = app.activeVehicle;
    if (vehicle == null) {
      showMessage(context, 'Pehle apni bike add karein');
      context.push('/vehicle-details');
      return;
    }
    setState(() => _busy = true);
    try {
      final note = _note.text.trim();
      await app.repo.requestModify(
        vehicleId: vehicle.id,
        items: [
          for (final o in modifyOptions)
            if (_selected.contains(o.$1)) o.$1,
        ],
        note: note.isEmpty ? null : note,
      );
      if (!mounted) return;
      setState(() => _busy = false);
      await showConfirmationSheet(
        context,
        title: 'Quote request sent!',
        message: 'Hamari team jald hi aapko ${vehicle.title} ke liye quote ke saath call karegi.',
      );
      if (mounted) context.go('/orders');
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showMessage(context, 'Request nahi bheji ja saki. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordered = [
      for (final o in modifyOptions)
        if (_selected.contains(o.$1)) o.$1,
    ];
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          const _Hero(),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('What do you want to modify?', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 14),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.15,
                children: [
                  for (final o in modifyOptions)
                    _OptionTile(
                      label: o.$1,
                      icon: o.$2,
                      selected: _selected.contains(o.$1),
                      onTap: () => _toggle(o.$1),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                ordered.isEmpty ? 'Ek ya zyada options chunein' : '${ordered.length} selected: ${ordered.join(', ')}',
                style: const TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _note,
                maxLines: 3,
                minLines: 2,
                maxLength: 300,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Kuch aur batana hai? (optional) e.g. matte black wrap',
                  counterText: '',
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.location_on_outlined, color: BP.yellow),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Visit the store for a free look', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                      SizedBox(height: 2),
                      Text('Our team will show options for your bike', style: TextStyle(fontSize: 13, color: BP.grey)),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
        ],
      ),
      bottomNavigationBar: BottomAction(
        child: PrimaryButton(label: 'GET A QUOTE', loading: _busy, onPressed: _quote),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      height: 250 + top,
      color: BP.black,
      child: Stack(children: [
        const Positioned.fill(child: CustomPaint(painter: _StripePainter())),
        Positioned(top: top + 12, left: 16, child: const CircleBack(filled: true)),
        const Positioned(
          left: 20,
          right: 80,
          bottom: 20,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('BIKE MODIFY',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: BP.yellow, letterSpacing: 1.6)),
            SizedBox(height: 6),
            Text('Apni bike ko do naya look',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: BP.white, height: 1.15)),
          ]),
        ),
      ]),
    );
  }
}

/// Diagonal yellow stripes from the design (stand-in for the store photo).
class _StripePainter extends CustomPainter {
  const _StripePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final thick = Paint()
      ..color = BP.yellow
      ..strokeWidth = 5;
    final thin = Paint()
      ..color = BP.yellow.withValues(alpha: 0.6)
      ..strokeWidth = 1.5;
    canvas.drawLine(Offset(size.width * 0.64, size.height), Offset(size.width, size.height * 0.4), thick);
    canvas.drawLine(Offset(size.width * 0.74, size.height), Offset(size.width, size.height * 0.56), thin);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _OptionTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _OptionTile({required this.label, required this.icon, required this.selected, required this.onTap});

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
          padding: const EdgeInsets.all(8),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 20, color: BP.black),
            ),
            const SizedBox(height: 8),
            Text(label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}
