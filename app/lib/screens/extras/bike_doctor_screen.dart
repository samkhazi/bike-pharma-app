import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

// ---------------------------------------------------------------------------
// Health model (ESTIMATE). There is no telematics / service history data yet,
// so these numbers are a rough rule-of-thumb estimate from the bike's age,
// odometer and last service date. Replace with real data when available.
// ---------------------------------------------------------------------------

enum WearLevel { ok, soon, replace }

class PartWear {
  final String name;
  final double used; // 0..1
  const PartWear(this.name, this.used);

  int get percent => (used * 100).round();
  WearLevel get level => used >= 0.75
      ? WearLevel.replace
      : used >= 0.5
          ? WearLevel.soon
          : WearLevel.ok;
}

class BikeHealth {
  final int score; // 0..100
  final List<PartWear> parts;
  final int kmSinceService;
  final int nextServiceInKm;
  const BikeHealth({
    required this.score,
    required this.parts,
    required this.kmSinceService,
    required this.nextServiceInKm,
  });

  /// e.g. "Achhi condition. Bas engine oil badalna hai."
  String get summary {
    final head = score >= 80
        ? 'Badhiya condition.'
        : score >= 60
            ? 'Achhi condition.'
            : score >= 40
                ? 'Theek-thaak condition.'
                : 'Service ki zarurat hai.';
    final due = parts.where((p) => p.level == WearLevel.replace).map((p) => p.name.toLowerCase()).toList();
    if (due.isEmpty) return '$head Sab theek chal raha hai.';
    if (due.length == 1) return '$head Bas ${due.first} badalna hai.';
    return '$head ${due.take(due.length - 1).join(', ')} aur ${due.last} badalne hain.';
  }
}

/// Typical intervals used by the estimate.
const serviceIntervalKm = 3000;
const serviceIntervalDays = 180;

/// Sample inputs until the app stores real odometer / service history.
const sampleKmPerYear = 4500;

int estimateOdometer(int year, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final days = n.difference(DateTime(year, 1, 1)).inDays.clamp(0, 365 * 40);
  return (days / 365 * sampleKmPerYear).round();
}

DateTime sampleLastService({DateTime? now}) => (now ?? DateTime.now()).subtract(const Duration(days: 45));

/// Estimates bike health from model [year], [odometer] (km) and the
/// [lastServiceDate]. Pure function so it can be unit tested.
BikeHealth computeBikeHealth(int year, int odometer, DateTime lastServiceDate, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final ageDays = math.max(1, n.difference(DateTime(year, 1, 1)).inDays);
  final ageYears = ageDays / 365;
  final odo = math.max(0, odometer);
  final kmPerDay = odo / ageDays;
  final daysSince = n.difference(lastServiceDate).inDays.clamp(0, 100000);
  final kmSince = math.min(odo, (daysSince * kmPerDay).round());

  double cyc(int lifeKm) => (odo % lifeKm) / lifeKm;
  double clamp(double v) => v.clamp(0.0, 1.0).toDouble();

  final parts = [
    PartWear('Engine oil', clamp(math.max(kmSince / serviceIntervalKm, daysSince / serviceIntervalDays))),
    PartWear('Brake pads', clamp(cyc(15000))),
    PartWear('Chain', clamp(math.max(cyc(30000), ageYears / 8))),
    PartWear('Air filter', clamp(cyc(12000))),
    PartWear('Tyres', clamp(math.max(cyc(30000), ageYears / 6))),
  ];

  final avg = parts.fold<double>(0, (s, p) => s + p.used) / parts.length;
  final dueCount = parts.where((p) => p.level == WearLevel.replace).length;
  final agePenalty = math.min(10.0, math.max(0, ageYears - 5) * 2);
  final score = (100 - avg * 50 - dueCount * 6 - agePenalty).round().clamp(0, 100);

  final nextIn = math.max(0, math.min(serviceIntervalKm - kmSince, ((serviceIntervalDays - daysSince) * kmPerDay).round()));
  return BikeHealth(score: score, parts: parts, kmSinceService: kmSince, nextServiceInKm: nextIn);
}

// ---------------------------------------------------------------------------

class BikeDoctorScreen extends StatelessWidget {
  const BikeDoctorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bike = context.watch<AppState>().activeVehicle;
    final now = DateTime.now();
    final year = bike?.year ?? now.year - 3;
    final odometer = estimateOdometer(year, now: now);
    final lastService = sampleLastService(now: now);
    final health = computeBikeHealth(year, odometer, lastService, now: now);
    final km = NumberFormat.decimalPattern('en_IN');

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                _Header(bike: bike),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: _ScoreCard(health: health),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Row(children: [
                    Expanded(child: _Stat('Odometer', '${km.format(odometer)} km')),
                    const SizedBox(width: 10),
                    Expanded(child: _Stat('Last service', DateFormat('d MMM yyyy').format(lastService))),
                    const SizedBox(width: 10),
                    Expanded(child: _Stat('Next service', 'in ${km.format(health.nextServiceInKm)} km')),
                  ]),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Text('* Andaza (estimate) hai: bike ke saal aur average riding se nikala gaya.',
                      style: TextStyle(fontSize: 11, color: BP.grey)),
                ),
                const Padding(padding: EdgeInsets.fromLTRB(20, 22, 20, 12), child: SectionTitle('Parts ki halat')),
                for (final p in health.parts)
                  Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 14), child: _PartRow(part: p)),
                const Padding(padding: EdgeInsets.fromLTRB(20, 10, 20, 12), child: SectionTitle('Smart tools')),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: IntrinsicHeight(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Expanded(
                        child: _ToolCard(
                          icon: Icons.photo_camera_outlined,
                          title: 'Photo se part dhundo',
                          body: 'Toote part ki photo kheecho, app sahi part dhundh dega',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ToolCard(
                          icon: Icons.mic_none_rounded,
                          title: 'Awaaz se problem pakdo',
                          body: 'Engine start karke awaaz record karo, app batayega kya dikkat hai',
                        ),
                      ),
                    ]),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: PrimaryButton(label: 'BOOK SERVICE', onPressed: () => context.go('/service')),
          ),
        ]),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Vehicle? bike;
  const _Header({this.bike});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(children: [
        const CircleBack(),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Flexible(child: Text('Bike Doctor', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: BP.yellow, borderRadius: BorderRadius.circular(6)),
                child: const Text('NEW', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ]),
            Text(
              bike == null
                  ? 'Apni bike add karo'
                  : [bike!.title, if (bike!.regNo != null) formatRegNo(bike!.regNo!)].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  final BikeHealth health;
  const _ScoreCard({required this.health});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
      decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(22)),
      child: Column(children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: health.score.toDouble()),
          duration: const Duration(milliseconds: 1200),
          curve: Curves.easeOutCubic,
          builder: (context, v, _) => SizedBox(
            width: 220,
            height: 124,
            child: CustomPaint(
              painter: HealthGaugePainter(v / 100),
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('${v.round()}',
                      style: const TextStyle(
                          fontSize: 52, height: 1, fontWeight: FontWeight.w800, color: BP.white)),
                  const SizedBox(height: 6),
                  const Text('HEALTH SCORE',
                      style: TextStyle(
                          fontSize: 11, letterSpacing: 1.6, fontWeight: FontWeight.w700, color: Color(0xFFBDBDBD))),
                ]),
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: const Color(0xFF262626), borderRadius: BorderRadius.circular(10)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 8, height: 8, decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle)),
            const SizedBox(width: 10),
            Flexible(
              child: Text(health.summary,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: BP.white)),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// Semicircle gauge: grey track with a yellow arc for [value] (0..1).
class HealthGaugePainter extends CustomPainter {
  final double value;
  HealthGaugePainter(this.value);

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 16.0;
    final r = math.min(size.width / 2, size.height) - stroke / 2;
    final center = Offset(size.width / 2, stroke / 2 + r);
    final rect = Rect.fromCircle(center: center, radius: r);
    final track = Paint()
      ..color = const Color(0xFF3A3A3A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, track);
    if (value > 0) {
      canvas.drawArc(rect, math.pi, math.pi * value.clamp(0.0, 1.0), false, track..color = BP.yellow);
    }
  }

  @override
  bool shouldRepaint(HealthGaugePainter old) => old.value != value;
}

class _Stat extends StatelessWidget {
  final String label, value;
  const _Stat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(BP.radius)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12, color: BP.grey)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        ),
      ]),
    );
  }
}

const _amber = Color(0xFFB8740A);

IconData _partIcon(String name) => switch (name) {
      'Engine oil' => Icons.water_drop_outlined,
      'Brake pads' => Icons.radio_button_checked,
      'Chain' => Icons.link,
      'Air filter' => Icons.air,
      _ => Icons.trip_origin,
    };

class _PartRow extends StatelessWidget {
  final PartWear part;
  const _PartRow({required this.part});

  @override
  Widget build(BuildContext context) {
    final color = switch (part.level) {
      WearLevel.replace => BP.red,
      WearLevel.soon => _amber,
      WearLevel.ok => BP.green,
    };
    final Widget action = switch (part.level) {
      WearLevel.replace => SizedBox(
          height: 32,
          child: FilledButton(
            onPressed: () => context.go('/shop'),
            style: FilledButton.styleFrom(
              backgroundColor: BP.yellow,
              foregroundColor: BP.black,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            child: const Text('Buy'),
          ),
        ),
      WearLevel.soon => GestureDetector(
          onTap: () => context.go('/service'),
          child: const Text('Jaldi badlo', style: TextStyle(color: _amber, fontWeight: FontWeight.w800, fontSize: 13)),
        ),
      WearLevel.ok =>
        const Text('Theek hai', style: TextStyle(color: BP.green, fontWeight: FontWeight.w800, fontSize: 13)),
    };
    return Row(children: [
      Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(10)),
        child: Icon(_partIcon(part.name), size: 18),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(part.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
            Text('${part.percent}% used', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: part.used,
              minHeight: 7,
              color: color,
              backgroundColor: const Color(0xFFEDEDE9),
            ),
          ),
        ]),
      ),
      const SizedBox(width: 12),
      SizedBox(width: 78, child: Align(alignment: Alignment.centerRight, child: action)),
    ]);
  }
}

class _ToolCard extends StatelessWidget {
  final IconData icon;
  final String title, body;
  const _ToolCard({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BP.white,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16), side: const BorderSide(color: BP.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _comingSoon(context, title),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: BP.black, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: BP.yellow, size: 20),
            ),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, height: 1.2)),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(fontSize: 12, color: BP.grey, height: 1.35)),
          ]),
        ),
      ),
    );
  }
}

void _comingSoon(BuildContext context, String title) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: BP.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.auto_awesome, color: BP.yellow, size: 36),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Coming soon! Ye feature jaldi aa raha hai.',
              textAlign: TextAlign.center, style: TextStyle(color: BP.grey)),
          const SizedBox(height: 20),
          PrimaryButton(label: 'THEEK HAI', arrow: false, onPressed: () => Navigator.of(ctx).pop()),
        ]),
      ),
    ),
  );
}
