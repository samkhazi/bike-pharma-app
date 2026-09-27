import 'package:flutter/material.dart';

import '../core/theme.dart';

class NavTab {
  final String label;
  final IconData icon;
  const NavTab(this.label, this.icon);
}

const navTabs = [
  NavTab('Home', Icons.home_outlined),
  NavTab('Shop', Icons.grid_view_rounded),
  NavTab('Service', Icons.build_outlined),
  NavTab('Orders', Icons.inventory_2_outlined),
  NavTab('Profile', Icons.person_outline),
];

/// Bottom nav chosen by Sam: white bar, the active icon rises into a yellow
/// bubble with a black border that slides between tabs. Only the active tab
/// shows its label.
class BubbleNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const BubbleNav({super.key, required this.index, required this.onTap});

  static const _curve = Curves.easeOutBack;
  static const _duration = Duration(milliseconds: 450);

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return LayoutBuilder(builder: (context, c) {
      final tabW = c.maxWidth / navTabs.length;
      const bubble = 56.0;
      return SizedBox(
        height: 84 + bottom,
        child: Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(
            top: 20,
            child: Container(
              decoration: const BoxDecoration(
                color: BP.white,
                border: Border(top: BorderSide(color: BP.border)),
                boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, -4))],
              ),
            ),
          ),
          AnimatedPositioned(
            duration: _duration,
            curve: _curve,
            left: tabW * index + (tabW - bubble) / 2,
            top: 0,
            child: Container(
              width: bubble,
              height: bubble,
              decoration: BoxDecoration(
                color: BP.yellow,
                shape: BoxShape.circle,
                border: Border.all(color: BP.black, width: 3),
                boxShadow: const [BoxShadow(color: Color(0x33FFC20E), blurRadius: 12, offset: Offset(0, 4))],
              ),
            ),
          ),
          Row(children: [
            for (var i = 0; i < navTabs.length; i++)
              Expanded(
                child: Semantics(
                  button: true,
                  selected: i == index,
                  label: navTabs[i].label,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onTap(i),
                    child: _TabItem(tab: navTabs[i], active: i == index),
                  ),
                ),
              ),
          ]),
        ]),
      );
    });
  }
}

class _TabItem extends StatelessWidget {
  final NavTab tab;
  final bool active;
  const _TabItem({required this.tab, required this.active});

  @override
  Widget build(BuildContext context) {
    return Stack(alignment: Alignment.topCenter, children: [
      AnimatedPadding(
        duration: BubbleNav._duration,
        curve: BubbleNav._curve,
        padding: EdgeInsets.only(top: active ? 16 : 40),
        child: Icon(tab.icon, size: 24, color: active ? BP.black : BP.grey),
      ),
      Positioned(
        top: 62,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 250),
          opacity: active ? 1 : 0,
          child: Text(tab.label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
        ),
      ),
    ]);
  }
}
