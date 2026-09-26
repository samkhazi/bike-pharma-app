import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

/// `+919800000000` -> `+91 98000 00000`
String formatIndianPhone(String raw) {
  final d = raw.replaceAll(RegExp(r'\D'), '');
  final local = d.length > 10 ? d.substring(d.length - 10) : d;
  if (local.length != 10) return raw;
  return '+91 ${local.substring(0, 5)} ${local.substring(5)}';
}

class MechanicProfileScreen extends StatefulWidget {
  final String id;
  const MechanicProfileScreen({super.key, required this.id});

  @override
  State<MechanicProfileScreen> createState() => _MechanicProfileScreenState();
}

class _MechanicProfileScreenState extends State<MechanicProfileScreen> {
  late Future<Mechanic?> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final id = parseMechanicId(widget.id);
    _future = id == null ? Future.value(null) : context.read<AppState>().repo.mechanic(id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<Mechanic?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: BP.black));
          }
          if (snap.hasError) {
            return _Message(
              icon: Icons.wifi_off_rounded,
              title: 'Load nahi ho paya',
              body: 'Internet check karke dobara try karo.',
              action: 'DOBARA TRY KARO',
              onAction: () => setState(_load),
            );
          }
          final m = snap.data;
          if (m == null || !m.verified) {
            return _Message(
              icon: Icons.gpp_bad_outlined,
              title: 'Mechanic nahi mila',
              body: 'Ye mechanic verified nahi hai ya ID galat hai',
              action: 'DOOSRA QR SCAN KARO',
              onAction: () => context.canPop() ? context.pop() : context.go('/scan'),
            );
          }
          return _Profile(m: m);
        },
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title, body, action;
  final VoidCallback onAction;
  const _Message(
      {required this.icon, required this.title, required this.body, required this.action, required this.onAction});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Align(alignment: Alignment.centerLeft, child: CircleBack()),
        ),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(color: BP.softYellow, shape: BoxShape.circle),
                  child: Icon(icon, size: 36, color: BP.black),
                ),
                const SizedBox(height: 16),
                Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(body, textAlign: TextAlign.center, style: const TextStyle(color: BP.grey, fontSize: 14)),
                const SizedBox(height: 24),
                PrimaryButton(label: action, arrow: false, onPressed: onAction),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

Future<void> _launch(BuildContext context, Uri uri) async {
  bool ok;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    ok = false;
  }
  if (!ok && context.mounted) showMessage(context, 'Ye khul nahi paya. Dobara try karo.');
}

class _Profile extends StatelessWidget {
  final Mechanic m;
  const _Profile({required this.m});

  @override
  Widget build(BuildContext context) {
    final digits = m.phone.replaceAll(RegExp(r'\D'), '');
    return Column(children: [
      Expanded(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            _Gallery(m: m),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(8)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.verified_user_outlined, size: 14, color: BP.yellow),
                    SizedBox(width: 6),
                    Text('BIKE PHARMA VERIFIED',
                        style: TextStyle(color: BP.yellow, fontSize: 11.5, fontWeight: FontWeight.w800)),
                  ]),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Container(
                    width: 56,
                    height: 56,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle),
                    child: Text(m.initials, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                      Text(m.garageName, style: const TextStyle(fontSize: 14, color: BP.grey)),
                    ]),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: BP.softYellow,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: BP.yellow),
                    ),
                    child: Column(children: [
                      const Text('MECHANIC ID',
                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xFF6B5500))),
                      Text(m.id, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                ]),
                const SizedBox(height: 18),
                Row(children: [
                  Expanded(child: _StatBox(Icons.star_border_rounded, m.rating.toStringAsFixed(1), 'Rating')),
                  const SizedBox(width: 8),
                  Expanded(child: _StatBox(Icons.build_outlined, '${m.experienceYears} yrs', 'Experience')),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _StatBox(Icons.verified_user_outlined,
                        m.spareBuyerSince > 0 ? 'Since ${m.spareBuyerSince}' : 'New', 'Genuine spares'),
                  ),
                ]),
                if (m.specialistBrands.isNotEmpty) ..._chips('Specialist in brands', m.specialistBrands, dark: true),
                if (m.vehicleTypes.isNotEmpty) ..._chips('Vehicle types', m.vehicleTypes),
                if (m.services.isNotEmpty) ..._chips('Kaam jo karte hain', m.services),
                const SizedBox(height: 22),
                const SectionTitle('Location'),
                const SizedBox(height: 10),
                Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: BP.border),
                  ),
                  child: Column(children: [
                    SizedBox(
                      height: 120,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: const _MapPainter(),
                        child: Center(
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(color: BP.black, shape: BoxShape.circle),
                            child: const Icon(Icons.location_on_outlined, color: BP.yellow, size: 20),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(m.address, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                            if (m.openHours.isNotEmpty)
                              Text(m.openHours, style: const TextStyle(fontSize: 12.5, color: BP.grey)),
                          ]),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: () => _launch(
                            context,
                            Uri.parse('https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}'),
                          ),
                          icon: const Icon(Icons.near_me_outlined, size: 18),
                          label: const Text('Map'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: BP.black,
                            side: const BorderSide(color: BP.black, width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            textStyle: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 22),
                const SectionTitle('Mobile number'),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.phone_outlined, color: BP.yellow, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(formatIndianPhone(m.phone),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                    const Text('Verified',
                        style: TextStyle(color: BP.green, fontWeight: FontWeight.w800, fontSize: 13)),
                  ]),
                ),
              ]),
            ),
          ],
        ),
      ),
      Container(
        padding: EdgeInsets.fromLTRB(20, 10, 20, 12 + MediaQuery.of(context).padding.bottom),
        child: Row(children: [
          Expanded(
            child: SizedBox(
              height: 54,
              child: FilledButton.icon(
                onPressed: () => _launch(context, Uri(scheme: 'tel', path: '+$digits')),
                icon: const Icon(Icons.phone_outlined),
                label: const Text('CALL'),
                style: FilledButton.styleFrom(
                  backgroundColor: BP.yellow,
                  foregroundColor: BP.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SizedBox(
              height: 54,
              child: OutlinedButton.icon(
                onPressed: () => _launch(context, Uri.parse('https://wa.me/$digits')),
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('WHATSAPP'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: BP.black,
                  side: const BorderSide(color: BP.black, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
        ]),
      ),
    ]);
  }

  List<Widget> _chips(String title, List<String> items, {bool dark = false}) => [
        const SizedBox(height: 22),
        SectionTitle(title),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final s in items) Pill(s, dark: dark)]),
      ];
}

class _Gallery extends StatefulWidget {
  final Mechanic m;
  const _Gallery({required this.m});

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  int _page = 0;

  void _share() {
    final link = 'bikepharma://mechanic/${widget.m.id}';
    Clipboard.setData(ClipboardData(text: link));
    showMessage(context, 'Link copy ho gaya: $link');
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.m.photos;
    final top = MediaQuery.of(context).padding.top;
    return SizedBox(
      height: 190 + top,
      child: Stack(fit: StackFit.expand, children: [
        ColoredBox(
          color: const Color(0xFF2A2A2A),
          child: photos.isEmpty
              ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.image_outlined, size: 40, color: Color(0xFF8A8A85)),
                  SizedBox(height: 6),
                  Text('Garage photo', style: TextStyle(color: Color(0xFF8A8A85), fontSize: 14)),
                ])
              : PageView.builder(
                  itemCount: photos.length,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemBuilder: (_, i) => Image.network(
                    photos[i],
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const Center(child: Icon(Icons.broken_image_outlined, size: 40, color: Color(0xFF8A8A85))),
                  ),
                ),
        ),
        Positioned(top: top + 12, left: 16, child: const CircleBack(filled: true)),
        Positioned(
          top: top + 12,
          right: 16,
          child: Material(
            color: BP.white,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _share,
              child: const SizedBox(width: 44, height: 44, child: Icon(Icons.share_outlined, size: 20)),
            ),
          ),
        ),
        if (photos.isNotEmpty)
          Positioned(
            right: 12,
            bottom: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(20)),
              child: Text('${_page + 1} / ${photos.length} photos',
                  style: const TextStyle(color: BP.white, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
      ]),
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String value, label;
  const _StatBox(this.icon, this.value, this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: BP.border)),
      child: Column(children: [
        Icon(icon, size: 20),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ),
        Text(label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, color: BP.grey)),
      ]),
    );
  }
}

/// Simple drawn map placeholder: light blocks separated by white roads.
class _MapPainter extends CustomPainter {
  const _MapPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFFEEEFEA));
    final road = Paint()..color = BP.white;
    canvas.drawRect(Rect.fromLTWH(size.width * 0.36, 0, 10, size.height), road);
    canvas.drawRect(Rect.fromLTWH(size.width * 0.72, 0, 10, size.height), road);
    canvas.drawRect(Rect.fromLTWH(0, size.height * 0.3, size.width, 10), road);
    canvas.drawRect(Rect.fromLTWH(0, size.height * 0.72, size.width, 8), road);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
