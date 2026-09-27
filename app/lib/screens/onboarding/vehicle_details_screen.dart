import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/onboarding_widgets.dart';

/// Common models per brand, split by vehicle type.
const _models = <String, Map<String, List<String>>>{
  'Honda': {
    'bike': ['Shine 125', 'SP 125', 'Unicorn', 'Livo', 'CB350'],
    'scooter': ['Activa 6G', 'Activa 125', 'Dio'],
  },
  'Hero': {
    'bike': ['Splendor Plus', 'HF Deluxe', 'Passion Pro', 'Glamour', 'Xtreme 160R'],
    'scooter': ['Pleasure Plus', 'Destini 125', 'Xoom'],
  },
  'Bajaj': {
    'bike': ['Pulsar 150', 'Pulsar NS200', 'Platina 110', 'CT 110X', 'Avenger 220'],
    'scooter': ['Chetak'],
  },
  'TVS': {
    'bike': ['Apache RTR 160', 'Raider 125', 'Star City Plus', 'Radeon', 'Sport'],
    'scooter': ['Jupiter', 'Ntorq 125', 'Scooty Pep Plus'],
  },
  'Royal Enfield': {
    'bike': ['Classic 350', 'Bullet 350', 'Hunter 350', 'Meteor 350', 'Himalayan'],
    'scooter': [],
  },
  'Yamaha': {
    'bike': ['FZ-S V3', 'R15 V4', 'MT-15', 'FZ-X'],
    'scooter': ['Fascino 125', 'RayZR 125'],
  },
  'Suzuki': {
    'bike': ['Gixxer', 'Gixxer SF', 'V-Strom SX'],
    'scooter': ['Access 125', 'Burgman Street'],
  },
};

class VehicleDetailsScreen extends StatefulWidget {
  const VehicleDetailsScreen({super.key});

  @override
  State<VehicleDetailsScreen> createState() => _VehicleDetailsScreenState();
}

class _VehicleDetailsScreenState extends State<VehicleDetailsScreen> {
  final _name = TextEditingController();
  final _reg = TextEditingController();
  String _type = 'bike';
  String _brand = 'Honda';
  late String _model = _modelsFor('Honda', 'bike').first;
  int _year = DateTime.now().year;
  String _colour = 'Black';
  String _emission = 'BS6';
  bool _saving = false;
  bool _needsName = false;
  String? _nameError;
  String? _regError;

  @override
  void initState() {
    super.initState();
    final name = context.read<AppState>().profile?.name.trim() ?? '';
    _needsName = name.isEmpty;
  }

  @override
  void dispose() {
    _name.dispose();
    _reg.dispose();
    super.dispose();
  }

  List<String> _modelsFor(String brand, String type) => _models[brand]?[type] ?? const [];

  List<String> get _brands => [for (final b in _models.keys) if (_modelsFor(b, _type).isNotEmpty) b];

  void _setType(String t) {
    setState(() {
      _type = t;
      if (_modelsFor(_brand, t).isEmpty) _brand = _brands.first;
      _model = _modelsFor(_brand, t).first;
    });
  }

  void _setBrand(String b) => setState(() {
        _brand = b;
        _model = _modelsFor(b, _type).first;
      });

  void _setYear(int y) => setState(() {
        _year = y;
        // BS6 became mandatory from April 2020.
        if (y >= 2021) _emission = 'BS6';
        if (y <= 2019) _emission = 'BS4';
      });

  void _back() => context.canPop() ? context.pop() : context.go('/create-profile');

  Future<void> _save() async {
    final name = _name.text.trim();
    final reg = normalizeRegNo(_reg.text);
    setState(() {
      _nameError = _needsName && name.length < 2 ? 'Apna naam daalo' : null;
      _regError = reg.isNotEmpty && !RegExp(r'^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$').hasMatch(reg)
          ? 'Sahi number daalo, jaise MH 12 AB 1234'
          : null;
    });
    if (_nameError != null || _regError != null) return;

    setState(() => _saving = true);
    final app = context.read<AppState>();
    try {
      if (_needsName) await app.saveProfile(name);
      await app.addVehicle(Vehicle(
        id: '',
        type: _type,
        regNo: reg.isEmpty ? null : reg,
        brand: _brand,
        model: _model,
        year: _year,
        colour: _colour,
        emission: _emission,
        source: 'manual',
      ));
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) showMessage(context, 'Save nahi ho paya: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().year;
    return Scaffold(
      backgroundColor: BP.white,
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            child: Row(children: [
              CircleBack(onTap: _back),
              const SizedBox(width: 14),
              const Expanded(
                child: Text('Vehicle details', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
              ),
            ]),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (_needsName) ...[
                  const FieldLabel('Your name'),
                  TextField(
                    key: const Key('vdNameField'),
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    onChanged: (_) {
                      if (_nameError != null) setState(() => _nameError = null);
                    },
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    decoration: InputDecoration(
                      hintText: 'Enter your full name',
                      prefixIcon: const Icon(Icons.person_outline, color: BP.grey),
                      errorText: _nameError,
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Row(children: [
                  Expanded(child: _typeButton('bike', 'Bike', Icons.two_wheeler)),
                  const SizedBox(width: 10),
                  Expanded(child: _typeButton('scooter', 'Scooter', Icons.moped)),
                ]),
                const SizedBox(height: 22),
                const FieldLabel('Brand'),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  child: Row(children: [
                    for (final b in _brands) ...[
                      _brandChip(b),
                      const SizedBox(width: 8),
                    ],
                  ]),
                ),
                const SizedBox(height: 22),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const FieldLabel('Model'),
                      _dropdown<String>(
                        key: const Key('modelDropdown'),
                        value: _model,
                        items: _modelsFor(_brand, _type),
                        label: (m) => m,
                        onChanged: (m) => setState(() => _model = m),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const FieldLabel('Year'),
                      _dropdown<int>(
                        key: const Key('yearDropdown'),
                        value: _year,
                        items: [for (var y = now; y >= 2005; y--) y],
                        label: (y) => '$y',
                        onChanged: _setYear,
                      ),
                    ]),
                  ),
                ]),
                const SizedBox(height: 22),
                const FieldLabel('Colour'),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  for (final c in vehicleColours.entries) _swatch(c.key, c.value),
                ]),
                const SizedBox(height: 22),
                const FieldLabel('Emission type'),
                Row(children: [
                  Expanded(child: _emissionButton('BS4')),
                  const SizedBox(width: 10),
                  Expanded(child: _emissionButton('BS6')),
                ]),
                const SizedBox(height: 10),
                const Text('Pata nahi? April 2020 ke baad ki nayi bike BS6 hoti hai. Yeh RC par bhi likha hota hai.',
                    style: TextStyle(fontSize: 13, color: BP.grey, height: 1.4, fontWeight: FontWeight.w500)),
                const SizedBox(height: 22),
                const FieldLabel('Registration number (optional)'),
                TextField(
                  key: const Key('vdRegField'),
                  controller: _reg,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9 -]')),
                    LengthLimitingTextInputFormatter(14),
                  ],
                  onChanged: (_) {
                    if (_regError != null) setState(() => _regError = null);
                  },
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.5),
                  decoration: InputDecoration(
                    hintText: 'MH 12 AB 1234',
                    hintStyle: const TextStyle(color: Color(0xFFB5B5AE)),
                    prefixIcon: const Icon(Icons.credit_card, color: BP.grey),
                    errorText: _regError,
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
      bottomNavigationBar: BottomAction(
        child: PrimaryButton(label: 'SAVE VEHICLE', loading: _saving, onPressed: _save),
      ),
    );
  }

  Widget _typeButton(String value, String label, IconData icon) {
    final on = _type == value;
    return _Tap(
      onTap: () => _setType(value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 50,
        decoration: BoxDecoration(
          color: on ? BP.black : BP.white,
          borderRadius: BorderRadius.circular(BP.radius),
          border: Border.all(color: on ? BP.black : BP.border),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 22, color: on ? BP.yellow : BP.black),
          const SizedBox(width: 10),
          Text(label,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: on ? BP.yellow : BP.black)),
        ]),
      ),
    );
  }

  Widget _brandChip(String brand) {
    final on = _brand == brand;
    return _Tap(
      onTap: () => _setBrand(brand),
      radius: 40,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: on ? BP.softYellow : BP.white,
          borderRadius: BorderRadius.circular(40),
          border: Border.all(color: on ? BP.yellow : BP.border, width: on ? 1.5 : 1.2),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (on) ...[const Icon(Icons.check, size: 16, color: BP.black), const SizedBox(width: 6)],
          Text(brand, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }

  Widget _dropdown<T>({
    required Key key,
    required T value,
    required List<T> items,
    required String Function(T) label,
    required ValueChanged<T> onChanged,
  }) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(BP.radius),
        border: Border.all(color: BP.border, width: 1.2),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          key: key,
          value: value,
          isExpanded: true,
          borderRadius: BorderRadius.circular(BP.radius),
          icon: const Icon(Icons.keyboard_arrow_down, color: BP.black),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: BP.black),
          items: [
            for (final i in items)
              DropdownMenuItem(value: i, child: Text(label(i), overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }

  Widget _swatch(String name, Color color) {
    final on = _colour == name;
    return _Tap(
      onTap: () => setState(() => _colour = name),
      radius: 30,
      child: Column(children: [
        Container(
          width: 44,
          height: 44,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: on ? BP.black : Colors.transparent, width: 2),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFDADAD5)),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(name,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: on ? FontWeight.w800 : FontWeight.w500,
              color: on ? BP.black : BP.grey,
            )),
      ]),
    );
  }

  Widget _emissionButton(String value) {
    final on = _emission == value;
    return _Tap(
      onTap: () => setState(() => _emission = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? BP.black : BP.white,
          borderRadius: BorderRadius.circular(BP.radius),
          border: Border.all(color: on ? BP.black : BP.border),
        ),
        child: Text(value,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: on ? BP.yellow : BP.black)),
      ),
    );
  }
}

class _Tap extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  final double radius;
  const _Tap({required this.child, required this.onTap, this.radius = BP.radius});

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(radius), child: child),
      );
}
