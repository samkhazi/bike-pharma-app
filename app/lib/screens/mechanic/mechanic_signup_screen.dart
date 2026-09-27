import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

const mechanicBrands = ['Honda', 'Hero', 'Bajaj', 'TVS', 'Yamaha', 'Royal Enfield', 'Suzuki', 'KTM', 'Jawa'];
const mechanicVehicleTypes = ['Commuter bikes', 'Scooters', 'Sports bikes', 'Cruisers', 'Mopeds'];
const mechanicServices = [
  'General service',
  'Engine overhaul',
  'Brakes and clutch',
  'Electrical wiring',
  'Fuel injection',
  'Carburettor tuning',
  'Tyre and puncture',
  'Body and paint',
  'Modification',
];

/// Mechanic signup form. Goes to the shop for verification; nothing is public
/// until the shop approves it and a BPM id is issued.
class MechanicSignupScreen extends StatefulWidget {
  const MechanicSignupScreen({super.key});

  @override
  State<MechanicSignupScreen> createState() => _MechanicSignupScreenState();
}

class _MechanicSignupScreenState extends State<MechanicSignupScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _garage = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _maps = TextEditingController();
  final _hours = TextEditingController(text: '9 AM to 8 PM');
  final _brands = <String>{};
  final _types = <String>{};
  final _services = <String>{};
  int _experience = 5;
  bool _saving = false;
  String? _chipError;

  @override
  void initState() {
    super.initState();
    final app = context.read<AppState>();
    _phone.text = app.phone.replaceFirst('+91', '');
    _load();
  }

  /// Pre-fills the form when the mechanic is editing a pending or rejected signup.
  Future<void> _load() async {
    final a = await context.read<AppState>().repo.myMechanicApplication().catchError((_) => null);
    if (a == null || !mounted) return;
    setState(() {
      _name.text = a.name;
      _garage.text = a.garageName;
      _phone.text = a.phone.replaceFirst('+91', '');
      _address.text = a.address;
      _maps.text = a.mapsLink;
      _hours.text = a.openHours;
      _brands.addAll(a.specialistBrands);
      _types.addAll(a.vehicleTypes);
      _services.addAll(a.services);
      _experience = a.experienceYears;
    });
  }

  @override
  void dispose() {
    for (final c in [_name, _garage, _phone, _address, _maps, _hours]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final ok = _form.currentState!.validate();
    setState(
      () => _chipError = _brands.isEmpty
          ? 'Kam se kam ek brand chuno'
          : _services.isEmpty
          ? 'Kam se kam ek kaam chuno'
          : null,
    );
    if (_chipError != null) showMessage(context, _chipError!);
    if (!ok || _chipError != null) return;
    setState(() => _saving = true);
    final app = context.read<AppState>();
    try {
      await app.repo.submitMechanicApplication(
        MechanicApplication(
          uid: app.repo.currentUid ?? '',
          name: _name.text.trim(),
          garageName: _garage.text.trim(),
          phone: '+91${_phone.text.trim()}',
          address: _address.text.trim(),
          mapsLink: _maps.text.trim(),
          openHours: _hours.text.trim(),
          specialistBrands: mechanicBrands.where(_brands.contains).toList(),
          vehicleTypes: mechanicVehicleTypes.where(_types.contains).toList(),
          services: mechanicServices.where(_services.contains).toList(),
          experienceYears: _experience,
        ),
      );
      if (!mounted) return;
      showMessage(context, 'Signup bhej diya. Shop verify karegi.');
      context.canPop() ? context.pop() : context.go('/mechanic');
    } catch (e) {
      if (mounted) showMessage(context, 'Signup nahi bhej paye. Dobara try karo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    String? required(String? v) => (v ?? '').trim().isEmpty ? 'Ye bharna zaroori hai' : null;
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _form,
          child: Column(
            children: [
              const PageHeader(title: 'Mechanic signup', subtitle: 'Bike Pharma verified mechanic bano'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: BP.softYellow, borderRadius: BorderRadius.circular(BP.radius)),
                      child: const Text(
                        'Details bharo. Bike Pharma team check karke aapko verified ID (jaise BPM-0231) aur QR code degi. '
                        'Verify hone ke baad hi customers ko aapka profile dikhega.',
                        style: TextStyle(fontSize: 13.5, height: 1.4),
                      ),
                    ),
                    const SizedBox(height: 18),
                    const SectionTitle('Aapki details'),
                    const SizedBox(height: 10),
                    _Field(key: const Key('mechName'), controller: _name, label: 'Aapka naam', validator: required),
                    _Field(
                      key: const Key('mechPhone'),
                      controller: _phone,
                      label: 'Mobile number',
                      prefix: '+91 ',
                      keyboard: TextInputType.phone,
                      validator: (v) =>
                          RegExp(r'^[6-9]\d{9}$').hasMatch((v ?? '').trim()) ? null : '10 digit number daalo',
                    ),
                    const SizedBox(height: 8),
                    const SectionTitle('Garage'),
                    const SizedBox(height: 10),
                    _Field(
                      key: const Key('mechGarage'),
                      controller: _garage,
                      label: 'Garage ka naam',
                      validator: required,
                    ),
                    _Field(
                      key: const Key('mechAddress'),
                      controller: _address,
                      label: 'Garage ka address',
                      lines: 2,
                      validator: required,
                    ),
                    _Field(
                      controller: _maps,
                      label: 'Google Maps location link (optional)',
                      hint: 'Maps me garage pe pin karke link share karo',
                      keyboard: TextInputType.url,
                    ),
                    _Field(controller: _hours, label: 'Timing', hint: '9 AM to 8 PM'),
                    Row(
                      children: [
                        const Expanded(
                          child: Text('Experience', style: TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        IconButton(
                          onPressed: _experience > 0 ? () => setState(() => _experience--) : null,
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                        Text('$_experience saal', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        IconButton(
                          onPressed: _experience < 60 ? () => setState(() => _experience++) : null,
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _ChipGroup(
                      title: 'Kin brands ke specialist ho?',
                      options: mechanicBrands,
                      selected: _brands,
                      onChanged: _refresh,
                    ),
                    _ChipGroup(
                      title: 'Kaunsi gaadiyan?',
                      options: mechanicVehicleTypes,
                      selected: _types,
                      onChanged: _refresh,
                    ),
                    _ChipGroup(
                      title: 'Kaam jo karte ho',
                      options: mechanicServices,
                      selected: _services,
                      onChanged: _refresh,
                    ),
                    if (_chipError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _chipError!,
                          style: const TextStyle(color: BP.red, fontWeight: FontWeight.w600),
                        ),
                      ),
                    const SizedBox(height: 12),
                    const Row(
                      children: [
                        Icon(Icons.photo_camera_outlined, size: 18, color: BP.grey),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Garage photos verification ke time Bike Pharma team leti hai.',
                            style: TextStyle(fontSize: 12.5, color: BP.grey),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              BottomAction(
                child: PrimaryButton(
                  key: const Key('mechSubmit'),
                  label: 'VERIFICATION KE LIYE BHEJO',
                  loading: _saving,
                  onPressed: _submit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _refresh() => setState(() => _chipError = null);
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String? hint, prefix;
  final int lines;
  final TextInputType? keyboard;
  final String? Function(String?)? validator;
  const _Field({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.prefix,
    this.lines = 1,
    this.keyboard,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        maxLines: lines,
        keyboardType: keyboard,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixText: prefix,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(BP.radius)),
        ),
      ),
    );
  }
}

class _ChipGroup extends StatelessWidget {
  final String title;
  final List<String> options;
  final Set<String> selected;
  final VoidCallback onChanged;
  const _ChipGroup({required this.title, required this.options, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final o in options)
                FilterChip(
                  label: Text(o),
                  selected: selected.contains(o),
                  selectedColor: BP.yellow,
                  checkmarkColor: BP.black,
                  onSelected: (on) {
                    on ? selected.add(o) : selected.remove(o);
                    onChanged();
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }
}
