import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

/// Mechanic section: signup status while the shop verifies, then the
/// mechanic's verified ID card and QR code.
class MechanicHomeScreen extends StatefulWidget {
  const MechanicHomeScreen({super.key});

  @override
  State<MechanicHomeScreen> createState() => _MechanicHomeScreenState();
}

class _MechanicHomeScreenState extends State<MechanicHomeScreen> {
  late Future<MechanicApplication?> _future = _fetch();

  Future<MechanicApplication?> _fetch() => context.read<AppState>().repo.myMechanicApplication();

  void _reload() => setState(() {
    _future = _fetch();
  });

  Future<void> _openSignup() async {
    await context.push('/mechanic-signup');
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: 'Mechanic section',
              subtitle: 'Bike Pharma verified mechanics',
              back: context.canPop(),
              trailing: IconButton(onPressed: _reload, icon: const Icon(Icons.refresh), tooltip: 'Refresh'),
            ),
            Expanded(
              child: FutureBuilder<MechanicApplication?>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator(color: BP.black));
                  }
                  if (snap.hasError) {
                    return Center(
                      child: TextButton(onPressed: _reload, child: const Text('Load nahi ho paya. Dobara try karo')),
                    );
                  }
                  final a = snap.data;
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                    children: [
                      if (a == null)
                        _Intro(onSignup: _openSignup)
                      else if (a.isApproved)
                        _IdCard(a: a)
                      else
                        _Status(a: a, onEdit: _openSignup),
                      if (app.isAdmin) ...[
                        const SizedBox(height: 20),
                        ListTile(
                          key: const Key('openVerify'),
                          tileColor: BP.black,
                          textColor: BP.white,
                          iconColor: BP.yellow,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
                          leading: const Icon(Icons.verified_user),
                          title: const Text('Verify mechanics', style: TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: const Text(
                            'Shop owner: naye signups check karo',
                            style: TextStyle(color: Colors.white70),
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/admin/mechanics'),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Intro extends StatelessWidget {
  final VoidCallback onSignup;
  const _Intro({required this.onSignup});

  @override
  Widget build(BuildContext context) {
    const perks = [
      (Icons.qr_code_2, 'Apna verified ID aur QR code', 'Customer scan karke turant pehchaan lete hain'),
      (Icons.location_on_outlined, 'Nearby mechanic list me naam', 'Aas-paas ke customers aapko dhoondh sakte hain'),
      (Icons.inventory_2_outlined, 'Genuine spares, seedha shop se', 'Bike Pharma se parts, bharose ke saath'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(18)),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'MECHANIC HO?',
                style: TextStyle(color: BP.yellow, fontWeight: FontWeight.w800, letterSpacing: 1.2),
              ),
              SizedBox(height: 6),
              Text(
                'Bike Pharma verified mechanic bano',
                style: TextStyle(color: BP.white, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2),
              ),
              SizedBox(height: 8),
              Text(
                'Signup karo. Shop aapki details aur garage check karke verify karegi.',
                style: TextStyle(color: Colors.white70, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (final p in perks)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: BP.softYellow,
                  child: Icon(p.$1, color: BP.black),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.$2, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(p.$3, style: const TextStyle(fontSize: 12.5, color: BP.grey)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 8),
        PrimaryButton(key: const Key('startMechanicSignup'), label: 'MECHANIC SIGNUP', onPressed: onSignup),
      ],
    );
  }
}

class _Status extends StatelessWidget {
  final MechanicApplication a;
  final VoidCallback onEdit;
  const _Status({required this.a, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    final rejected = a.isRejected;
    final steps = [
      ('Signup bheja', true),
      ('Shop details aur garage check kar rahi hai', !rejected),
      ('Verified ID aur QR code milega', false),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: rejected ? const Color(0xFFFDECEA) : BP.softYellow,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                rejected ? 'Signup approve nahi hua' : 'Verification chal raha hai',
                style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                rejected
                    ? (a.reason?.isNotEmpty == true
                          ? 'Shop ka message: ${a.reason}'
                          : 'Details theek karke dobara bhejo.')
                    : 'Bike Pharma team aapki details check karke call karegi. Verify hote hi yahan ID dikhegi.',
                style: const TextStyle(height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (!rejected)
          for (var i = 0; i < steps.length; i++)
            Row(
              children: [
                Icon(
                  i == 0 ? Icons.check_circle : (i == 1 ? Icons.hourglass_top : Icons.radio_button_unchecked),
                  color: i == 0 ? BP.green : (i == 1 ? const Color(0xFFC2410C) : BP.grey),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(steps[i].$1, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
        const SizedBox(height: 12),
        _Summary(a: a),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          key: const Key('editMechanicSignup'),
          onPressed: onEdit,
          icon: const Icon(Icons.edit_outlined),
          label: Text(rejected ? 'Details theek karke dobara bhejo' : 'Details edit karo'),
        ),
      ],
    );
  }
}

class _Summary extends StatelessWidget {
  final MechanicApplication a;
  const _Summary({required this.a});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: BP.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(a.garageName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          Text('${a.name} · ${a.phone}', style: const TextStyle(color: BP.grey)),
          const SizedBox(height: 6),
          Text(a.address),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [for (final b in a.specialistBrands) Pill(b, dark: true), for (final s in a.services) Pill(s)],
          ),
        ],
      ),
    );
  }
}

class _IdCard extends StatelessWidget {
  final MechanicApplication a;
  const _IdCard({required this.a});

  @override
  Widget build(BuildContext context) {
    final id = a.mechanicId ?? '';
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(22)),
          child: Column(
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.verified, color: BP.yellow),
                  SizedBox(width: 8),
                  Flexible(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        'BIKE PHARMA VERIFIED',
                        style: TextStyle(color: BP.yellow, fontWeight: FontWeight.w800, letterSpacing: 1),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                id,
                style: const TextStyle(color: BP.white, fontWeight: FontWeight.w900, fontSize: 26, letterSpacing: 2),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: BP.white, borderRadius: BorderRadius.circular(16)),
                child: QrImageView(
                  key: const Key('mechanicQr'),
                  data: 'bikepharma://mechanic/$id',
                  size: 190,
                  backgroundColor: BP.white,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                a.garageName,
                style: const TextStyle(color: BP.white, fontSize: 20, fontWeight: FontWeight.w800),
              ),
              Text(a.name, style: const TextStyle(color: Colors.white70)),
              const SizedBox(height: 6),
              const Text(
                'Ye QR garage pe lagao. Customer scan karke aapka verified profile dekhega.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white60, fontSize: 12.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PrimaryButton(label: 'MERA PUBLIC PROFILE', onPressed: () => context.push('/mechanic/$id')),
      ],
    );
  }
}
