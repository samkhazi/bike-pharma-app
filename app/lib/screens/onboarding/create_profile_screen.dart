import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../data/repository.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../../widgets/onboarding_widgets.dart';

class CreateProfileScreen extends StatefulWidget {
  const CreateProfileScreen({super.key});

  @override
  State<CreateProfileScreen> createState() => _CreateProfileScreenState();
}

class _CreateProfileScreenState extends State<CreateProfileScreen> {
  final _name = TextEditingController();
  final _reg = TextEditingController();
  Vehicle? _vehicle;
  bool _fetching = false;
  bool _saving = false;
  bool _lookupFailed = false;
  String? _nameError;
  String? _regError;

  @override
  void initState() {
    super.initState();
    _name.text = context.read<AppState>().profile?.name ?? '';
  }

  @override
  void dispose() {
    _name.dispose();
    _reg.dispose();
    super.dispose();
  }

  bool _validReg(String raw) => RegExp(r'^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$').hasMatch(normalizeRegNo(raw));

  Future<void> _fetch() async {
    final raw = _reg.text;
    if (!_validReg(raw)) {
      setState(() => _regError = 'Sahi registration number daalo, jaise MH 12 AB 1234');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _regError = null;
      _fetching = true;
      _lookupFailed = false;
    });
    try {
      final v = await context.read<AppState>().repo.lookupVehicle(normalizeRegNo(raw));
      if (mounted) setState(() => _vehicle = v);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _vehicle = null;
        _lookupFailed = true;
      });
      final msg = e is LookupUnavailable ? e.message : 'Vehicle details nahi mil payi';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$msg. Details khud bharo.'),
        action: SnackBarAction(label: 'KHUD BHARO', textColor: BP.yellow, onPressed: _manual),
      ));
    } finally {
      if (mounted) setState(() => _fetching = false);
    }
  }

  Future<void> _manual() async {
    // Keep the name if they already typed it, so the next screen won't ask again.
    final name = _name.text.trim();
    if (name.length >= 2) {
      try {
        await context.read<AppState>().saveProfile(name);
      } catch (_) {}
    }
    if (mounted) context.push('/vehicle-details');
  }

  Future<void> _edit() async {
    final v = _vehicle;
    if (v == null) return;
    final edited = await showModalBottomSheet<Vehicle>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BP.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _EditVehicleSheet(vehicle: v),
    );
    if (edited != null && mounted) setState(() => _vehicle = edited);
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    setState(() => _nameError = name.length < 2 ? 'Apna naam daalo' : null);
    if (_nameError != null) return;
    final v = _vehicle;
    if (v == null) {
      showMessage(
          context,
          _reg.text.trim().isEmpty
              ? 'Apni gaadi add karo: number daal ke FETCH dabao ya details khud bharo'
              : 'Pehle FETCH dabao, ya details khud bharo');
      return;
    }
    setState(() => _saving = true);
    final app = context.read<AppState>();
    try {
      await app.saveProfile(name);
      await app.addVehicle(v);
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) showMessage(context, 'Save nahi ho paya: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BP.white,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 36, 20, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Create your profile',
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: BP.black, height: 1.15)),
            const SizedBox(height: 10),
            const Text('Apni details bharo, taaki hum aapki bike ke hisaab se sahi parts dikha sakein.',
                style: TextStyle(fontSize: 15, color: BP.grey, height: 1.45, fontWeight: FontWeight.w500)),
            const SizedBox(height: 22),
            const FieldLabel('Your name'),
            TextField(
              key: const Key('nameField'),
              controller: _name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              onChanged: (_) {
                if (_nameError != null) setState(() => _nameError = null);
              },
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Enter your full name',
                hintStyle: const TextStyle(color: Color(0xFFA0A09A), fontWeight: FontWeight.w500),
                prefixIcon: const Icon(Icons.person_outline, color: BP.grey),
                errorText: _nameError,
              ),
            ),
            const SizedBox(height: 22),
            Row(children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.two_wheeler, size: 18, color: BP.black),
              ),
              const SizedBox(width: 10),
              const Text('Your vehicle', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 18),
            const FieldLabel('Vehicle registration number'),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: TextField(
                  key: const Key('regField'),
                  controller: _reg,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9 -]')),
                    LengthLimitingTextInputFormatter(14),
                    _UpperCase(),
                  ],
                  onChanged: (_) {
                    if (_regError != null) setState(() => _regError = null);
                  },
                  onSubmitted: (_) => _fetch(),
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  decoration: InputDecoration(
                    hintText: 'MH 12 AB 1234',
                    hintStyle: const TextStyle(color: Color(0xFFB5B5AE), fontWeight: FontWeight.w700),
                    prefixIcon: const Icon(Icons.credit_card, color: BP.black),
                    errorText: _regError,
                    errorMaxLines: 2,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 54,
                width: 84,
                child: FilledButton(
                  onPressed: _fetching ? null : _fetch,
                  style: FilledButton.styleFrom(
                    backgroundColor: BP.yellow,
                    foregroundColor: BP.black,
                    disabledBackgroundColor: BP.yellow.withValues(alpha: 0.6),
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                  ),
                  child: _fetching
                      ? const SizedBox(
                          width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: BP.black))
                      : const Text('FETCH'),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            const Row(children: [
              Icon(Icons.shield_outlined, size: 15, color: BP.grey),
              SizedBox(width: 6),
              Expanded(
                child: Text('Details govt. vehicle record (Vahan) se apne aap aa jayengi',
                    style: TextStyle(fontSize: 12.5, color: BP.grey, fontWeight: FontWeight.w500)),
              ),
            ]),
            const SizedBox(height: 16),
            if (_vehicle != null) _FetchedCard(vehicle: _vehicle!, onEdit: _edit),
            if (_lookupFailed && _vehicle == null) _LookupFailed(onManual: _manual),
            const SizedBox(height: 18),
            Center(
              child: GestureDetector(
                onTap: _manual,
                child: const Text.rich(
                  TextSpan(
                    style: TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500),
                    children: [
                      TextSpan(text: 'Registration number nahi hai? '),
                      TextSpan(
                          text: 'Details khud bharo',
                          style: TextStyle(color: Color(0xFF8A6A00), fontWeight: FontWeight.w800)),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ]),
        ),
      ),
      bottomNavigationBar: BottomAction(
        child: PrimaryButton(label: 'SAVE & CONTINUE', loading: _saving, onPressed: _save),
      ),
    );
  }
}

class _UpperCase extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

const _green = Color(0xFF1E7A3C);

class _FetchedCard extends StatelessWidget {
  final Vehicle vehicle;
  final VoidCallback onEdit;
  const _FetchedCard({required this.vehicle, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    final v = vehicle;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F8F1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFBFE0C7)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(color: _green, shape: BoxShape.circle),
            child: const Icon(Icons.check, size: 18, color: BP.white),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text('Vehicle details mil gayi',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _green)),
          ),
          GestureDetector(
            onTap: onEdit,
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Text('Edit',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF8A6A00))),
            ),
          ),
        ]),
        const SizedBox(height: 14),
        _pair(_detail('Brand', Text(v.brand, style: _value)), _detail('Model', Text(v.model, style: _value))),
        _pair(
          _detail('Year', Text('${v.year}', style: _value)),
          _detail(
            'Colour',
            Row(children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: swatchFor(v.colour),
                  shape: BoxShape.circle,
                  border: Border.all(color: BP.border),
                ),
              ),
              const SizedBox(width: 6),
              Flexible(child: Text(v.colour ?? '—', style: _value)),
            ]),
          ),
        ),
        _pair(_detail('Emission', Text(v.emission, style: _value)),
            _detail('Fuel', Text(v.fuel ?? '—', style: _value))),
        if (v.chassisMasked != null) ...[
          const Divider(color: Color(0xFFBFE0C7), height: 18),
          const SizedBox(height: 4),
          _detail('Chassis number',
              Text(v.chassisMasked!, style: _value.copyWith(letterSpacing: 1.2))),
        ],
      ]),
    );
  }

  static const _value = TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: BP.black);

  Widget _pair(Widget a, Widget b) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: a), Expanded(child: b)]),
      );

  Widget _detail(String label, Widget value) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12.5, color: BP.grey, fontWeight: FontWeight.w500)),
        const SizedBox(height: 3),
        value,
      ]);
}

class _LookupFailed extends StatelessWidget {
  final VoidCallback onManual;
  const _LookupFailed({required this.onManual});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: BP.softYellow,
        borderRadius: BorderRadius.circular(BP.radius),
        border: Border.all(color: BP.yellow.withValues(alpha: 0.5)),
      ),
      child: Row(children: [
        const Icon(Icons.info_outline, color: Color(0xFF8A6A00)),
        const SizedBox(width: 10),
        const Expanded(
          child: Text('Details abhi nahi mil payi. Koi baat nahi, 30 second mein khud bhar do.',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.35)),
        ),
        TextButton(
          onPressed: onManual,
          child: const Text('Khud bharo',
              style: TextStyle(fontWeight: FontWeight.w800, color: BP.black)),
        ),
      ]),
    );
  }
}

/// Lets the user correct fetched details before saving.
class _EditVehicleSheet extends StatefulWidget {
  final Vehicle vehicle;
  const _EditVehicleSheet({required this.vehicle});

  @override
  State<_EditVehicleSheet> createState() => _EditVehicleSheetState();
}

class _EditVehicleSheetState extends State<_EditVehicleSheet> {
  late final _brand = TextEditingController(text: widget.vehicle.brand);
  late final _model = TextEditingController(text: widget.vehicle.model);
  late int _year = widget.vehicle.year;
  late String? _colour = widget.vehicle.colour;
  late String _emission = widget.vehicle.emission;

  @override
  void dispose() {
    _brand.dispose();
    _model.dispose();
    super.dispose();
  }

  void _done() {
    if (_brand.text.trim().isEmpty || _model.text.trim().isEmpty) {
      showMessage(context, 'Brand aur model dono bharo');
      return;
    }
    final m = widget.vehicle.toMap()
      ..['brand'] = _brand.text.trim()
      ..['model'] = _model.text.trim()
      ..['year'] = _year
      ..['colour'] = _colour
      ..['emission'] = _emission;
    Navigator.pop(context, Vehicle.fromMap(widget.vehicle.id, m));
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now().year;
    final years = [for (var y = now; y >= 2005; y--) y];
    if (!years.contains(_year)) years.add(_year);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Vehicle details edit karo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: TextField(controller: _brand, decoration: const InputDecoration(labelText: 'Brand'))),
            const SizedBox(width: 10),
            Expanded(child: TextField(controller: _model, decoration: const InputDecoration(labelText: 'Model'))),
          ]),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _year,
            decoration: const InputDecoration(labelText: 'Year'),
            items: [for (final y in years) DropdownMenuItem(value: y, child: Text('$y'))],
            onChanged: (y) => setState(() => _year = y ?? _year),
          ),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in vehicleColours.keys)
              ChoiceChip(
                label: Text(c),
                selected: _colour == c,
                onSelected: (_) => setState(() => _colour = c),
              ),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            for (final e in const ['BS4', 'BS6']) ...[
              if (e == 'BS6') const SizedBox(width: 10),
              Expanded(
                child: ChoiceChip(
                  label: SizedBox(width: double.infinity, child: Text(e, textAlign: TextAlign.center)),
                  selected: _emission == e,
                  onSelected: (_) => setState(() => _emission = e),
                ),
              ),
            ],
          ]),
          const SizedBox(height: 20),
          PrimaryButton(label: 'DONE', arrow: false, onPressed: _done),
        ]),
      ),
    );
  }
}
