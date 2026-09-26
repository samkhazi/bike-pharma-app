import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

// TODO: replace with the Bike Pharma shop's real support number (E.164, no '+').
const shopSupportPhone = '919800000000';

String _formatPhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 12 && digits.startsWith('91')) {
    return '+91 ${digits.substring(2, 7)} ${digits.substring(7)}';
  }
  if (digits.length == 10) return '+91 ${digits.substring(0, 5)} ${digits.substring(5)}';
  return raw;
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final name = (app.profile?.name.trim().isNotEmpty ?? false) ? app.profile!.name : 'Rider';
    final phone = app.profile?.phone.isNotEmpty == true ? app.profile!.phone : app.phone;
    void soon() => showMessage(context, 'Jald aa raha hai!');

    final menu = <(String, VoidCallback)>[
      ('My orders', () => context.go('/orders')),
      ('Service history', () => context.go('/orders')),
      ('Saved addresses', soon),
      ('Wishlist', soon),
      ('Genuine mechanic', () => context.push('/scan')),
      ('Bike Doctor', () => context.push('/bike-doctor')),
      ('Help and support', () => _showHelp(context)),
      ('Language: Hindi / English', soon),
    ];

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          _Header(name: name, phone: phone.isEmpty ? '' : _formatPhone(phone), onEdit: () => _editName(context, name)),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Column(children: [
              _BikesCard(app: app),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: BP.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(children: [
                  for (var i = 0; i < menu.length; i++) ...[
                    if (i > 0) const Divider(height: 1, color: BP.border),
                    _MenuRow(label: menu[i].$1, onTap: menu[i].$2),
                  ],
                ]),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => _logout(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BP.red,
                    side: const BorderSide(color: Color(0xFFF0C4C0)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  icon: const Icon(Icons.logout),
                  label: const Text('Log out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('Aap dobara OTP se login kar sakte hain.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Log out', style: TextStyle(color: BP.red, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await context.read<AppState>().signOut();
      if (context.mounted) context.go('/login');
    } catch (e) {
      if (context.mounted) showMessage(context, 'Log out nahi ho paya. Please try again.');
    }
  }

  Future<void> _editName(BuildContext context, String current) async {
    final saved = await showDialog<bool>(context: context, builder: (_) => _EditNameDialog(initial: current));
    if (saved == true && context.mounted) showMessage(context, 'Naam update ho gaya');
  }

  void _showHelp(BuildContext context) {
    Future<void> open(Uri uri) async {
      try {
        final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!ok && context.mounted) showMessage(context, 'App open nahi ho paya');
      } catch (_) {
        if (context.mounted) showMessage(context, 'App open nahi ho paya');
      }
    }

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: BP.white,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Help and support', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const Text('Bike Pharma shop se baat karein', style: TextStyle(fontSize: 13, color: BP.grey)),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(backgroundColor: BP.yellow, child: Icon(Icons.call, color: BP.black)),
              title: const Text('Call the shop', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(_formatPhone(shopSupportPhone)),
              onTap: () {
                Navigator.pop(c);
                open(Uri(scheme: 'tel', path: '+$shopSupportPhone'));
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(backgroundColor: BP.black, child: Icon(Icons.chat, color: BP.yellow)),
              title: const Text('WhatsApp us', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('Usually replies within an hour'),
              onTap: () {
                Navigator.pop(c);
                open(Uri.parse('https://wa.me/$shopSupportPhone?text=${Uri.encodeComponent('Hi Bike Pharma, mujhe help chahiye')}'));
              },
            ),
          ]),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String name, phone;
  final VoidCallback onEdit;
  const _Header({required this.name, required this.phone, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      color: BP.black,
      padding: EdgeInsets.fromLTRB(20, top + 24, 20, 28),
      child: Stack(clipBehavior: Clip.none, children: [
        Positioned(
          top: -top - 24,
          right: -20,
          bottom: -28,
          width: 120,
          child: const CustomPaint(painter: _SlashPainter()),
        ),
        Row(children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle),
            child: const Icon(Icons.person_outline, size: 34, color: BP.black),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: BP.white)),
              if (phone.isNotEmpty)
                Text(phone, style: const TextStyle(fontSize: 14, color: Color(0xFFB5B5B0))),
            ]),
          ),
          Material(
            color: BP.black,
            shape: const CircleBorder(side: BorderSide(color: Color(0xFF3A3A3A))),
            child: IconButton(
              tooltip: 'Edit name',
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined, color: BP.white, size: 20),
            ),
          ),
        ]),
      ]),
    );
  }
}

class _SlashPainter extends CustomPainter {
  const _SlashPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = BP.yellow
      ..strokeWidth = 3;
    canvas.drawLine(Offset(0, size.height * 0.25), Offset(size.width, size.height * 0.95), p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _EditNameDialog extends StatefulWidget {
  final String initial;
  const _EditNameDialog({required this.initial});

  @override
  State<_EditNameDialog> createState() => _EditNameDialogState();
}

class _EditNameDialogState extends State<_EditNameDialog> {
  late final _ctrl = TextEditingController(text: widget.initial == 'Rider' ? '' : widget.initial);
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().saveProfile(_ctrl.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showMessage(context, 'Naam save nahi ho paya. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: BP.white,
      title: const Text('Edit name', style: TextStyle(fontWeight: FontWeight.w800)),
      content: Form(
        key: _form,
        child: TextFormField(
          controller: _ctrl,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(hintText: 'Your full name'),
          validator: (v) {
            final t = v?.trim() ?? '';
            if (t.length < 2) return 'Please enter your name';
            if (t.length > 40) return 'Name is too long';
            return null;
          },
          onFieldSubmitted: (_) => _save(),
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _save,
          style: FilledButton.styleFrom(backgroundColor: BP.yellow, foregroundColor: BP.black),
          child: _busy
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: BP.black))
              : const Text('Save', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}

class _BikesCard extends StatelessWidget {
  final AppState app;
  const _BikesCard({required this.app});

  String _details(Vehicle v) =>
      [v.title, v.year.toString(), v.emission, if (v.regNo != null) formatRegNo(v.regNo!)].join(' · ');

  Future<void> _switch(BuildContext context, Vehicle v) async {
    try {
      await app.switchVehicle(v.id);
      if (context.mounted) showMessage(context, '${v.title} ab aapki active bike hai');
    } catch (_) {
      if (context.mounted) showMessage(context, 'Bike change nahi hua. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = app.activeVehicle;
    return CustomPaint(
      painter: const _DashedBorderPainter(),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
        decoration: BoxDecoration(color: BP.softYellow, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.pedal_bike, size: 28, color: BP.black),
            const SizedBox(width: 12),
            const Expanded(child: Text('My bikes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
            FilledButton(
              onPressed: () => context.push('/vehicle-details'),
              style: FilledButton.styleFrom(
                backgroundColor: BP.black,
                foregroundColor: BP.yellow,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 18),
              ),
              child: const Text('ADD', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ]),
          if (app.vehicles.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Abhi koi bike add nahi hai', style: TextStyle(fontSize: 13, color: BP.grey)),
            ),
          for (final v in app.vehicles)
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: v.id == active?.id ? null : () => _switch(context, v),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Icon(
                    v.id == active?.id ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                    size: 20,
                    color: v.id == active?.id ? BP.black : BP.grey,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(_details(v),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          color: v.id == active?.id ? BP.black : BP.grey,
                          fontWeight: v.id == active?.id ? FontWeight.w700 : FontWeight.w500,
                        )),
                  ),
                  if (v.id == active?.id)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(6)),
                      child: const Text('Active', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                    ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFD9A800)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(16)));
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 6), paint);
        d += 10;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _MenuRow extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _MenuRow({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Row(children: [
          Container(width: 8, height: 8, decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle)),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
          const Icon(Icons.chevron_right, color: BP.grey),
        ]),
      ),
    );
  }
}
