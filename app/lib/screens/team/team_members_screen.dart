import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// Owner only: the team list by mobile number. Whoever is on it gets team
/// tools after OTP login; "Owner" also gets these owner screens.
class TeamMembersScreen extends StatefulWidget {
  const TeamMembersScreen({super.key});

  @override
  State<TeamMembersScreen> createState() => _TeamMembersScreenState();
}

class _TeamMembersScreenState extends State<TeamMembersScreen> {
  List<TeamMember>? _members;

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isOwner) _load();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<AppState>().repo.teamMembers();
      if (mounted) setState(() => _members = list);
    } catch (_) {
      if (mounted) {
        setState(() => _members = []);
        showMessage(context, 'Team list load nahi ho payi');
      }
    }
  }

  Future<void> _add() async {
    final member = await showDialog<TeamMember>(context: context, builder: (_) => const _AddMemberDialog());
    if (member == null || !mounted) return;
    try {
      await context.read<AppState>().repo.saveTeamMember(member);
      if (!mounted) return;
      showMessage(context, '${member.name} team me add ho gaye');
      await _load();
    } catch (e) {
      if (mounted) showMessage(context, e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _remove(TeamMember m) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text('${m.name} ko team se hatana hai?'),
        content: Text('${formatPhone(m.phone)} se team tools band ho jayenge.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
          TextButton(
            key: const Key('removeConfirm'),
            onPressed: () => Navigator.pop(d, true),
            child: const Text(
              'Hatao',
              style: TextStyle(color: BP.red, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<AppState>().repo.removeTeamMember(m.phone);
      await _load();
    } catch (e) {
      if (mounted) showMessage(context, e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.isOwner) {
      return const AccessDenied(title: 'Team members', message: 'Ye screen sirf owner ke liye hai.');
    }
    final members = _members;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: 'Team members',
              subtitle: members == null ? null : '${members.length} number team list me',
            ),
            Expanded(
              child: members == null
                  ? const Center(child: CircularProgressIndicator(color: BP.black))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      children: [
                        const Text(
                          'Is list ke numbers OTP login karte hi team tools dekhte hain. Customers aur mechanics ko '
                          'ye kabhi nahi dikhta.',
                          style: TextStyle(color: BP.grey, height: 1.4),
                        ),
                        const SizedBox(height: 14),
                        for (final m in members)
                          Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                            decoration: BoxDecoration(
                              border: Border.all(color: BP.border),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(m.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                                      Text(formatPhone(m.phone), style: const TextStyle(color: BP.grey)),
                                    ],
                                  ),
                                ),
                                Pill(m.role == StaffRole.owner ? 'Owner' : 'Team', dark: m.role == StaffRole.owner),
                                if (m.phone == app.phone)
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 12),
                                    child: Text(
                                      'Aap',
                                      style: TextStyle(color: BP.grey, fontWeight: FontWeight.w700),
                                    ),
                                  )
                                else
                                  IconButton(
                                    key: Key('remove-${m.phone}'),
                                    tooltip: 'Hatao',
                                    icon: const Icon(Icons.delete_outline),
                                    onPressed: () => _remove(m),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
            ),
            BottomAction(
              child: PrimaryButton(key: const Key('addMember'), label: 'TEAM MEMBER ADD KARO', onPressed: _add),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddMemberDialog extends StatefulWidget {
  const _AddMemberDialog();

  @override
  State<_AddMemberDialog> createState() => _AddMemberDialogState();
}

class _AddMemberDialogState extends State<_AddMemberDialog> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  StaffRole _role = StaffRole.staff;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _save() {
    final name = _name.text.trim();
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (name.isEmpty) return setState(() => _error = 'Naam daalo');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(digits)) return setState(() => _error = '10 digit mobile number daalo');
    Navigator.pop(context, TeamMember(phone: '+91$digits', name: name, role: _role));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Team member add karo'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            key: const Key('memberName'),
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Naam'),
          ),
          TextField(
            key: const Key('memberPhone'),
            controller: _phone,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+91 ', counterText: ''),
          ),
          const SizedBox(height: 14),
          SegmentedButton<StaffRole>(
            segments: const [
              ButtonSegment(value: StaffRole.staff, label: Text('Team'), icon: Icon(Icons.badge_outlined)),
              ButtonSegment(
                value: StaffRole.owner,
                label: Text('Owner', key: Key('memberRoleOwner')),
                icon: Icon(Icons.shield_outlined),
              ),
            ],
            selected: {_role},
            onSelectionChanged: (s) => setState(() => _role = s.first),
          ),
          const SizedBox(height: 8),
          Text(
            _role == StaffRole.owner
                ? 'Owner: sab kuch, plus team members aur mechanic discount.'
                : 'Team: mechanic verify (baad me inventory aur billing).',
            style: const TextStyle(fontSize: 12.5, color: BP.grey),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                _error!,
                style: const TextStyle(color: BP.red, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(key: const Key('memberSave'), onPressed: _save, child: const Text('Add')),
      ],
    );
  }
}
