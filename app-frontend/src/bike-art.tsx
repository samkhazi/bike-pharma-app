import type { ReactNode } from "react";
import { bikeTypes, type BikeType } from "./bike-catalog";

const TYRE = "#1d1e21";
const FRAME = "#2b2d31";
const METAL = "#9c9fa5";
const CHROME = "#c7c9cd";
const FORK = "#c3c5ca";
const LAMP = "#f1f1ee";
const TAIL = "#d8412f";
const GLASS = "#cfd6db";

type WheelKind = "cast" | "wire" | "split";

function Wheel({
  x,
  y,
  r,
  tyre = 11,
  kind = "cast",
  knobby = false,
  disc,
  rimTone,
}: {
  x: number;
  y: number;
  r: number;
  tyre?: number;
  kind?: WheelKind;
  knobby?: boolean;
  disc?: number;
  rimTone?: string;
}) {
  const rim = r - tyre / 2 - 2;
  const spokes = kind === "wire" ? 16 : kind === "split" ? 3 : 5;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle className="b-rim" r={r + tyre / 2 + 1} fill="none" stroke="transparent" strokeWidth="1.5" />
      <circle className="b-tyre" r={r} fill="none" stroke={TYRE} strokeWidth={tyre} />
      {knobby && <circle className="b-tyre" r={r + tyre / 2} fill="none" stroke={TYRE} strokeWidth="3.5" strokeDasharray="3.5 3" />}
      {kind === "cast" && <circle r={r * 0.55} fill="none" stroke="#b9bbc0" strokeWidth="2" />}
      <g className="cx-spokes">
        {disc && (
          <>
            <circle r={disc} fill="none" stroke="#b9bbc0" strokeWidth="4" strokeDasharray="5 2.4" />
            <circle r={disc * 0.62} fill="none" stroke="#8d9096" strokeWidth="1.5" />
          </>
        )}
        {Array.from({ length: spokes }, (_, i) => {
          const angle = (i * 2 * Math.PI) / spokes - Math.PI / 2;
          if (kind === "wire") return <line key={i} x1="0" y1="0" x2={rim * Math.cos(angle)} y2={rim * Math.sin(angle)} stroke="#9a9ca1" strokeWidth="1.2" />;
          if (kind === "split") {
            return [-0.17, 0.17].map((spread) => (
              <line
                key={`${i}${spread}`}
                className="b-spoke"
                x1={7 * Math.cos(angle)}
                y1={7 * Math.sin(angle)}
                x2={rim * Math.cos(angle + spread)}
                y2={rim * Math.sin(angle + spread)}
                stroke="#3a3c40"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ));
          }
          return <line key={i} className="b-spoke" x1="0" y1="0" x2={rim * Math.cos(angle)} y2={rim * Math.sin(angle)} stroke="#3a3c40" strokeWidth={Math.max(2.5, r / 12)} strokeLinecap="round" />;
        })}
        <circle r={rim} fill="none" stroke="#8d9096" strokeWidth="1.5" />
        {rimTone && <circle r={rim + 1.8} fill="none" stroke={rimTone} strokeWidth="1.6" />}
      </g>
      <circle className="b-hub" r={Math.max(4, r * 0.16)} fill="#3a3c40" />
      <circle r="2.2" fill="#b9bbc0" />
    </g>
  );
}

const line = (d: string, color: string, width: number, className?: string, opacity?: number) => (
  <path className={className} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={opacity} />
);
const shape = (d: string, color: string, className?: string, opacity?: number) => <path className={className} d={d} fill={color} fillOpacity={opacity} />;
const fins = (x1: number, x2: number, ys: number[]) => ys.map((y) => <line key={y} className="b-fin" x1={x1} y1={y} x2={x2} y2={y - 2} stroke="#474a50" strokeWidth="2" />);
const shine = (d: string) => line(d, "#fff", 3, undefined, 0.35);
const lamp = (cx: number, cy: number, r: number) => <circle className="b-dark" cx={cx} cy={cy} r={r} fill={LAMP} stroke={TYRE} strokeWidth="3" />;
const tailLight = (x: number, y: number) => <rect x={x} y={y} width="6" height="7" rx="2" fill={TAIL} />;
const shadow = (from = 20, to = 320) => <ellipse className="b-shadow" cx={(from + to) / 2} cy="186" rx={(to - from) / 2} ry="5" fill="rgb(0 0 0 / 12%)" />;

function drawing(type: BikeType, tone: string): ReactNode {
  switch (type) {
    case "commuter":
      return (
        <>
          {shadow(30, 310)}
          {line("M40 132 Q80 98 122 122", TYRE, 5, "b-dark")}
          <Wheel x={80} y={146} r={38} tyre={9} kind="wire" />
          <Wheel x={260} y={146} r={38} tyre={9} kind="wire" />
          {line("M80 146 L152 134", FRAME, 7, "b-frame")}
          {shape("M88 138 L150 128 L152 136 L92 146 Z", TYRE, "b-dark-fill")}
          {line("M168 154 L112 152 L66 136", METAL, 6)}
          {line("M106 149 L60 132", CHROME, 11)}
          {shape("M142 106 L190 104 L196 138 L180 152 L152 152 L140 132 Z", FRAME, "b-frame-fill")}
          {fins(152, 186, [113, 120, 127])}
          {line("M150 106 L212 74", FRAME, 6, "b-frame")}
          {line("M214 64 L244 124", FORK, 6)}
          {line("M240 118 L260 146", TYRE, 8, "b-dark")}
          {line("M236 126 Q260 108 286 122", tone, 5)}
          {shape("M112 100 L150 100 L146 120 L116 120 Z", tone)}
          {shape("M56 92 L96 90 L98 100 L64 102 Z", tone)}
          {tailLight(51, 92)}
          {shape("M92 90 Q124 82 172 86 L170 98 Q126 100 96 100 Z", TYRE, "b-dark-fill")}
          {shape("M162 86 Q174 68 206 70 Q218 72 214 84 L204 100 Q182 102 166 100 Z", tone)}
          {shine("M174 78 Q186 72 202 74")}
          {line("M214 62 L204 46 L194 42", TYRE, 4, "b-dark")}
          {shape("M218 57 L242 54 L246 63 L220 66 Z", tone)}
          <rect className="b-dark" x="222" y="64" width="20" height="13" rx="3" fill={LAMP} stroke={TYRE} strokeWidth="2.5" />
        </>
      );
    case "classic":
      return (
        <>
          {shadow()}
          {line("M32 134 Q78 84 128 112", tone, 9)}
          <Wheel x={80} y={142} r={42} tyre={10} kind="wire" />
          <Wheel x={262} y={142} r={42} tyre={10} kind="wire" />
          {line("M80 142 L152 130", FRAME, 7, "b-frame")}
          {line("M168 155 L110 153 L58 145", METAL, 6)}
          {line("M116 151 L50 142", CHROME, 12)}
          {shape("M142 100 L194 98 L200 136 L184 154 L152 154 L140 132 Z", FRAME, "b-frame-fill")}
          {fins(152, 190, [106, 113, 120, 127])}
          {line("M152 100 L214 66", FRAME, 6, "b-frame")}
          {line("M216 60 L250 124", FORK, 8)}
          {line("M246 116 L262 142", TYRE, 9, "b-dark")}
          {line("M226 128 Q262 88 300 122", tone, 8)}
          {shape("M112 100 Q124 96 138 100 L136 118 L114 118 Z", tone)}
          {shape("M74 86 Q88 80 106 86 L104 94 L78 94 Z", TYRE, "b-dark-fill")}
          {line("M120 94 L118 102 M142 96 L142 104", METAL, 2)}
          {shape("M112 84 Q130 74 152 80 L150 94 Q130 96 114 92 Z", TYRE, "b-dark-fill")}
          {shape("M150 80 Q166 58 204 62 Q218 64 214 80 L202 96 Q176 100 152 98 Z", tone)}
          <circle cx="182" cy="80" r="6" fill="#e8dcc0" />
          {shine("M166 70 Q182 62 202 65")}
          {line("M214 58 L202 44 L188 40", TYRE, 4, "b-dark")}
          {line("M214 64 Q228 50 244 60", tone, 5)}
          {lamp(230, 71, 13)}
        </>
      );
    case "cruiser":
      return (
        <>
          {shadow(14, 330)}
          {line("M30 128 Q72 88 116 112", tone, 8)}
          <Wheel x={72} y={142} r={42} tyre={14} />
          <Wheel x={280} y={143} r={40} tyre={11} />
          {line("M72 142 L150 134", FRAME, 8, "b-frame")}
          {line("M172 157 L98 159 L46 151", METAL, 6)}
          {line("M114 157 L40 151", CHROME, 12)}
          {shape("M146 108 L206 106 L212 142 L194 156 L156 156 L142 134 Z", FRAME, "b-frame-fill")}
          {fins(156, 200, [115, 122, 129])}
          {line("M152 108 L224 70", FRAME, 6, "b-frame")}
          {line("M226 64 L264 130", FORK, 7)}
          {line("M258 120 L280 143", TYRE, 9, "b-dark")}
          {line("M248 122 Q280 94 312 120", tone, 6)}
          {line("M200 151 L228 151", TYRE, 4, "b-dark")}
          {line("M68 94 L62 68", METAL, 3)}
          {shape("M55 64 L70 62 L72 78 L57 80 Z", TYRE, "b-dark-fill")}
          {shape("M70 92 Q88 86 108 92 L108 102 L74 102 Z", TYRE, "b-dark-fill")}
          {shape("M112 98 Q134 90 160 94 L158 106 Q134 108 114 106 Z", TYRE, "b-dark-fill")}
          {shape("M152 88 Q172 68 216 72 Q228 74 222 88 L210 102 Q180 106 154 104 Z", tone)}
          {shine("M170 80 Q188 72 212 76")}
          {line("M224 60 L214 40 L198 42", TYRE, 4, "b-dark")}
          {lamp(240, 73, 12)}
        </>
      );
    case "touring":
      return (
        <>
          {shadow()}
          <Wheel x={82} y={144} r={40} />
          <Wheel x={264} y={144} r={40} />
          {line("M82 144 L150 136", FRAME, 8, "b-frame")}
          {line("M162 155 L58 151", CHROME, 9)}
          {shape("M146 112 L208 110 L210 142 L152 146 Z", FRAME, "b-frame-fill")}
          {shape("M42 100 Q42 94 48 94 L104 94 Q110 94 110 100 L108 132 Q108 138 102 138 L50 138 Q44 138 44 132 Z", tone)}
          {shape("M36 62 Q36 56 42 56 L88 56 Q94 56 94 62 L94 86 L36 86 Z", tone)}
          {shape("M90 86 Q120 74 162 82 L160 98 Q122 100 92 98 Z", TYRE, "b-dark-fill")}
          {shape("M140 86 Q172 68 212 74 L214 112 L148 114 Z", tone)}
          {line("M250 104 L264 144", TYRE, 9, "b-dark")}
          {line("M240 128 Q264 110 290 124", tone, 6)}
          {shape("M200 72 Q238 56 266 80 L272 108 Q248 122 212 114 Z", tone)}
          {shape("M214 64 Q230 30 252 34 L258 66 Q238 58 220 70 Z", GLASS, undefined, 0.55)}
          {shape("M250 88 L270 90 L266 99 L248 97 Z", LAMP)}
          {line("M226 64 L238 60", TYRE, 3, "b-dark")}
          {tailLight(36, 70)}
        </>
      );
    case "sports":
      return (
        <>
          {shadow()}
          <Wheel x={80} y={142} r={42} />
          <Wheel x={260} y={142} r={42} />
          {line("M80 142 L154 132", FRAME, 8, "b-frame")}
          {line("M160 150 L120 146", METAL, 6)}
          {line("M122 146 L92 131", CHROME, 12)}
          {shape("M152 118 L204 116 L200 148 L160 152 Z", FRAME, "b-frame-fill")}
          {line("M232 94 L254 138", FORK, 7)}
          {line("M238 128 Q260 112 284 124", tone, 5)}
          {shape("M58 72 L112 84 L110 96 L72 92 Z", tone)}
          {tailLight(54, 72)}
          {shape("M104 88 Q124 82 150 88 L148 98 L108 98 Z", TYRE, "b-dark-fill")}
          {shape("M140 86 Q160 70 198 74 L204 94 L146 98 Z", tone)}
          {shape("M164 92 L230 70 Q258 72 264 96 L248 126 L190 134 L160 120 Z", tone)}
          {line("M182 118 L248 104", "#fff", 4, undefined, 0.45)}
          {shape("M226 74 Q240 60 254 64 L258 80 Q244 74 230 80 Z", GLASS, undefined, 0.7)}
          {shape("M246 86 L264 90 L260 98 L244 94 Z", LAMP)}
          {line("M224 76 L212 72", TYRE, 3, "b-dark")}
        </>
      );
    case "superbike":
      return (
        <>
          {shadow()}
          <Wheel x={78} y={142} r={44} />
          <Wheel x={262} y={142} r={44} />
          {line("M78 142 L152 130", FRAME, 9, "b-frame")}
          {line("M150 150 L112 150", CHROME, 13)}
          {line("M118 150 L98 136", CHROME, 11)}
          {line("M244 110 L262 142", TYRE, 9, "b-dark")}
          {line("M240 130 Q262 112 288 124", tone, 5)}
          {shape("M50 64 L114 84 L110 96 L64 88 Z", tone)}
          {tailLight(46, 63)}
          {shape("M104 86 Q126 80 150 86 L148 96 L106 96 Z", TYRE, "b-dark-fill")}
          {shape("M146 94 L234 64 Q266 66 272 96 L252 136 L172 146 L142 126 Z", tone)}
          {shape("M160 134 L242 126 L230 146 L172 150 Z", "#000", undefined, 0.25)}
          {line("M168 120 L252 102", "#fff", 5, undefined, 0.45)}
          {shape("M232 66 Q248 48 264 54 L268 74 Q250 68 236 74 Z", GLASS, undefined, 0.7)}
          {shape("M252 84 L270 88 L266 96 L250 92 Z", LAMP)}
          {line("M228 74 L216 70", TYRE, 3, "b-dark")}
        </>
      );
    case "adventure":
      return (
        <>
          {shadow()}
          <Wheel x={82} y={142} r={42} tyre={10} kind="wire" knobby />
          <Wheel x={268} y={138} r={47} tyre={9} kind="wire" knobby />
          {line("M82 142 L154 128", FRAME, 8, "b-frame")}
          {line("M168 142 L122 126 L78 104", METAL, 6)}
          {line("M100 116 L62 96", CHROME, 12)}
          {shape("M144 102 L196 98 L202 132 L186 150 L152 150 L140 128 Z", FRAME, "b-frame-fill")}
          {fins(154, 192, [108, 115, 122])}
          {line("M148 155 L198 151 L206 139", TYRE, 4, "b-dark")}
          {line("M204 104 Q224 118 206 142", METAL, 4)}
          {line("M152 100 L220 60", FRAME, 6, "b-frame")}
          {line("M222 50 L258 128", FORK, 8)}
          {line("M254 118 L268 138", TYRE, 9, "b-dark")}
          {shape("M234 102 L288 110 L280 118 L232 112 Z", tone)}
          {line("M50 72 L96 74", METAL, 4)}
          {line("M58 74 L66 92", METAL, 3)}
          {shape("M56 76 L96 78 L98 88 L66 90 Z", tone)}
          {tailLight(52, 78)}
          {shape("M92 78 Q126 70 162 74 L160 88 Q126 90 94 90 Z", TYRE, "b-dark-fill")}
          {shape("M148 78 Q166 56 208 58 Q224 60 220 78 L208 100 Q178 104 150 100 Z", tone)}
          {shine("M164 68 Q184 60 206 62")}
          {shape("M226 42 Q236 26 252 28 L256 58 Q242 54 230 58 Z", GLASS, undefined, 0.6)}
          {line("M218 50 L206 36 L190 34", TYRE, 4, "b-dark")}
          {line("M192 32 L186 40", tone, 5)}
          {lamp(242, 67, 10)}
        </>
      );
    case "chopper":
      return (
        <>
          {shadow(14, 334)}
          {line("M30 124 Q70 88 112 114", tone, 7)}
          <Wheel x={70} y={140} r={44} tyre={15} kind="wire" />
          <Wheel x={298} y={149} r={35} tyre={8} kind="wire" />
          {line("M70 140 L150 130", FRAME, 7, "b-frame")}
          {line("M184 151 L86 155", CHROME, 6)}
          {line("M192 141 L92 147", CHROME, 6)}
          {shape("M148 120 L208 118 L202 148 L156 150 Z", FRAME, "b-frame-fill")}
          {shape("M152 120 L168 92 L182 96 L170 124 Z", FRAME, "b-frame-fill")}
          {shape("M180 118 L200 92 L212 98 L194 124 Z", FRAME, "b-frame-fill")}
          {line("M152 110 L238 60", FRAME, 6, "b-frame")}
          {line("M240 54 L294 144", FORK, 5)}
          {line("M244 56 L238 22 L222 20", CHROME, 4)}
          {shape("M160 84 Q176 70 204 74 Q214 78 208 88 L196 96 Q176 98 162 96 Z", tone)}
          {shape("M112 102 Q132 94 156 100 L154 110 L114 110 Z", TYRE, "b-dark-fill")}
          {line("M96 106 L86 58 L96 54", CHROME, 4)}
          {lamp(250, 65, 8)}
        </>
      );
    case "cafe":
      return (
        <>
          {shadow()}
          <Wheel x={80} y={142} r={42} tyre={10} kind="wire" />
          <Wheel x={262} y={142} r={42} tyre={10} kind="wire" />
          {line("M80 142 L152 130", FRAME, 7, "b-frame")}
          {line("M168 152 L118 146 L64 128", METAL, 6)}
          {line("M106 143 L54 124", CHROME, 13)}
          {shape("M140 100 L200 98 L206 134 L190 152 L150 152 L136 128 Z", FRAME, "b-frame-fill")}
          {fins(150, 196, [106, 113, 120, 127])}
          {line("M150 100 L216 66", FRAME, 6, "b-frame")}
          {line("M216 62 L250 124", FORK, 7)}
          {line("M246 116 L262 142", TYRE, 9, "b-dark")}
          {line("M238 121 Q262 105 286 117", METAL, 4)}
          {line("M150 151 L170 147", TYRE, 3, "b-dark")}
          {shape("M110 88 L146 86 L144 96 L112 96 Z", TYRE, "b-dark-fill")}
          {shape("M76 84 Q86 72 110 78 L112 96 L80 94 Z", tone)}
          {tailLight(72, 86)}
          {shape("M144 84 Q160 62 210 66 Q224 68 220 82 L208 96 Q176 100 146 98 Z", tone)}
          {line("M176 94 Q186 86 198 94", "#000", 3, undefined, 0.25)}
          {shine("M160 74 Q184 66 208 69")}
          {line("M220 76 L206 74", TYRE, 4, "b-dark")}
          {lamp(233, 77, 12)}
        </>
      );
    case "scrambler":
      return (
        <>
          {shadow()}
          <Wheel x={82} y={142} r={42} tyre={10} kind="wire" knobby />
          <Wheel x={262} y={142} r={42} tyre={10} kind="wire" knobby />
          {line("M82 142 L154 130", FRAME, 7, "b-frame")}
          {line("M168 140 L128 118 L80 96", METAL, 6)}
          {line("M112 108 L68 88", CHROME, 12)}
          {line("M104 102 L82 92", TYRE, 3, "b-dark")}
          {shape("M142 102 L196 98 L202 134 L186 152 L152 152 L138 128 Z", FRAME, "b-frame-fill")}
          {fins(152, 192, [108, 115, 122, 129])}
          {line("M150 100 L216 64", FRAME, 6, "b-frame")}
          {line("M216 58 L250 122", FORK, 8)}
          {line("M242 108 L262 142", TYRE, 11, "b-dark")}
          {shape("M56 82 L88 82 L90 92 L62 94 Z", tone)}
          {tailLight(51, 83)}
          {shape("M86 80 L162 78 L160 90 L88 92 Z", TYRE, "b-dark-fill")}
          {line("M104 81 L104 90 M122 80 L122 89 M140 80 L140 89", "#3a3c40", 1.5)}
          {shape("M150 80 Q164 60 204 62 Q218 64 214 80 L202 96 Q176 100 152 98 Z", tone)}
          {shine("M166 70 Q182 63 202 65")}
          {line("M238 98 Q262 86 288 96", tone, 5)}
          {line("M216 54 L204 38 L186 36", TYRE, 4, "b-dark")}
          {lamp(230, 69, 12)}
          {line("M222 69 L238 69 M230 61 L230 77", TYRE, 1.5)}
        </>
      );
    case "scooter":
      return (
        <>
          {shadow(44, 300)}
          <Wheel x={98} y={158} r={26} tyre={9} />
          <Wheel x={258} y={158} r={26} tyre={9} />
          {shape("M100 148 L156 146 L150 160 L108 162 Z", FRAME, "b-frame-fill")}
          {line("M112 162 L66 158", CHROME, 8)}
          {shape("M66 140 Q58 104 96 94 L178 90 Q196 92 196 112 L188 142 Q150 150 98 148 Z", tone)}
          {shine("M84 108 Q120 98 170 98")}
          <rect x="62" y="112" width="9" height="8" rx="2" fill={TAIL} />
          {shape("M90 92 Q130 80 180 86 L178 98 L94 100 Z", TYRE, "b-dark-fill")}
          {shape("M176 142 L232 142 L238 134 L182 134 Z", TYRE, "b-dark-fill")}
          {line("M252 132 L258 158", TYRE, 8, "b-dark")}
          {shape("M212 136 L226 76 Q234 58 256 60 L268 72 L254 138 Z", tone)}
          {shape("M218 134 L230 82 L244 80 L236 136 Z", "#000", undefined, 0.14)}
          {line("M238 142 Q258 124 280 138", tone, 5)}
          {shape("M232 60 Q248 44 266 50 L268 62 Q250 58 236 66 Z", tone)}
          {shape("M254 50 L268 52 L266 60 L252 58 Z", LAMP)}
          {line("M240 48 L236 38", TYRE, 2.5, "b-dark")}
        </>
      );
    case "moped":
      return (
        <>
          {shadow(40, 300)}
          {line("M52 136 Q86 106 120 128", tone, 5)}
          <Wheel x={86} y={152} r={33} tyre={8} kind="wire" />
          <Wheel x={256} y={152} r={33} tyre={8} kind="wire" />
          {line("M86 152 L150 144", FRAME, 6, "b-frame")}
          {shape("M150 128 L188 128 L184 150 L154 152 Z", FRAME, "b-frame-fill")}
          {line("M166 153 L96 153", CHROME, 6)}
          {line("M104 132 L168 132 L226 62", tone, 9)}
          {shape("M96 110 L142 110 L138 124 L100 124 Z", tone)}
          {line("M128 104 L134 130", FRAME, 5, "b-frame")}
          {shape("M108 96 Q128 88 150 94 L148 104 L110 104 Z", TYRE, "b-dark-fill")}
          {line("M62 100 L110 100", TYRE, 4, "b-dark")}
          {line("M70 100 L76 118", TYRE, 3, "b-dark")}
          {tailLight(56, 97)}
          {line("M234 134 Q256 118 280 130", tone, 5)}
          {line("M224 62 L250 148", FORK, 5)}
          {line("M226 58 L214 46 L202 44", TYRE, 4, "b-dark")}
          {lamp(237, 63, 9)}
        </>
      );
    case "dirt":
      return (
        <>
          {shadow()}
          <Wheel x={84} y={144} r={40} tyre={10} kind="wire" knobby />
          <Wheel x={270} y={140} r={45} tyre={9} kind="wire" knobby />
          {line("M84 144 L156 128", FRAME, 7, "b-frame")}
          {line("M170 140 L132 118 L86 90", METAL, 5)}
          {line("M112 102 L70 80", CHROME, 12)}
          {shape("M150 110 L196 104 L200 136 L162 146 Z", FRAME, "b-frame-fill")}
          {fins(158, 192, [114, 121])}
          {line("M156 100 L224 58", FRAME, 5, "b-frame")}
          {line("M226 52 L262 132", FORK, 8)}
          {line("M256 118 L270 140", TYRE, 9, "b-dark")}
          {line("M244 86 Q270 72 300 88", tone, 5)}
          {shape("M40 74 L68 76 L68 82 L44 82 Z", tone)}
          {shape("M62 78 L104 74 L100 98 L70 98 Z", LAMP)}
          {shape("M92 70 L180 72 L178 84 L94 84 Z", TYRE, "b-dark-fill")}
          {shape("M166 76 L218 66 L222 92 L202 104 L168 96 Z", tone)}
          {shape("M232 60 L252 56 L256 78 L236 82 Z", LAMP)}
          {line("M228 52 L216 38 L200 36", TYRE, 4, "b-dark")}
        </>
      );
    case "bobber":
      return (
        <>
          {shadow()}
          <Wheel x={80} y={142} r={42} tyre={14} kind="wire" />
          <Wheel x={262} y={142} r={42} tyre={14} kind="wire" />
          {line("M80 142 L152 132", FRAME, 7, "b-frame")}
          {line("M176 155 L92 157", CHROME, 6)}
          {line("M184 147 L98 151", CHROME, 5)}
          {shape("M142 104 L202 102 L208 140 L190 156 L152 156 L138 132 Z", FRAME, "b-frame-fill")}
          {fins(152, 198, [110, 117, 124, 131])}
          {line("M150 104 L214 70", FRAME, 6, "b-frame")}
          {line("M216 64 L250 124", FORK, 8)}
          {line("M246 116 L262 142", TYRE, 9, "b-dark")}
          {line("M48 112 Q78 92 108 104", tone, 8)}
          {tailLight(44, 108)}
          {shape("M116 92 Q134 84 156 90 L154 100 L118 100 Z", TYRE, "b-dark-fill")}
          {line("M126 100 L124 110 M146 100 L146 110", METAL, 2)}
          {shape("M150 84 Q166 64 204 68 Q216 70 212 84 L200 98 Q174 102 152 100 Z", tone)}
          {shine("M166 75 Q182 68 202 70")}
          {line("M236 113 Q262 99 286 109", tone, 7)}
          {line("M214 64 L204 52 L188 52", TYRE, 4, "b-dark")}
          {lamp(230, 75, 11)}
        </>
      );
    case "powercruiser":
      return (
        <>
          {shadow(16, 330)}
          <Wheel x={76} y={142} r={42} tyre={17} />
          <Wheel x={270} y={142} r={42} tyre={12} />
          {line("M76 142 L150 134", FRAME, 10, "b-frame")}
          {shape("M140 106 L208 104 L214 144 L196 158 L152 158 L136 134 Z", FRAME, "b-frame-fill")}
          {fins(150, 204, [112, 119, 126, 133])}
          {line("M178 151 L112 143", CHROME, 10)}
          {line("M176 139 L114 131", CHROME, 8)}
          {line("M150 104 L226 70", FRAME, 7, "b-frame")}
          {line("M226 64 L258 128", FORK, 10)}
          {line("M252 118 L270 142", TYRE, 11, "b-dark")}
          {line("M244 121 Q270 101 298 117", tone, 6)}
          {shape("M62 88 L100 90 L98 100 L70 100 Z", tone)}
          {tailLight(57, 89)}
          {shape("M98 94 Q124 86 152 92 L150 104 L102 104 Z", TYRE, "b-dark-fill")}
          {shape("M146 82 Q170 58 216 64 Q234 70 228 90 L214 108 Q182 114 150 110 Z", tone)}
          {shape("M200 94 L232 90 L228 118 L206 122 Z", "#000", undefined, 0.35)}
          {shine("M164 72 Q188 62 214 67")}
          {line("M224 64 L210 58 L196 60", TYRE, 5, "b-dark")}
          <rect className="b-dark" x="236" y="68" width="16" height="12" rx="3" fill={LAMP} stroke={TYRE} strokeWidth="2.5" />
        </>
      );
    case "naked":
    default:
      return (
        <>
          {shadow()}
          {/* Rear: hugger, split-spoke wheel with petal disc, alloy swingarm, chain and monoshock */}
          {line("M44 118 Q78 90 112 112", TYRE, 4, "b-dark")}
          <Wheel x={80} y={140} r={44} tyre={10} kind="split" disc={17} rimTone={tone} />
          {shape("M90 120 L102 124 L100 132 L88 128 Z", "#3a3c40")}
          {line("M80 128 L162 122 M80 152 L162 138", "#3a3c40", 1.8)}
          <circle cx="80" cy="140" r="11" fill="none" stroke="#3a3c40" strokeWidth="2.2" strokeDasharray="2.5 1.8" />
          {shape("M74 135 L162 121 L165 132 L80 147 Z", "#6b6e74")}
          {line("M86 138 L158 126", "#fff", 1.4, undefined, 0.35)}
          {line("M134 124 L150 100", "#c9a227", 5)}
          {line("M136 122 L149 102", "#1d1e21", 1.2, undefined, 0.6)}
          {/* Trellis frame and subframe */}
          {line("M221 60 L150 102 L163 126 M221 60 L198 104 L163 126 M150 102 L198 104 M186 80 L198 104 M170 88 L176 104", "#3a3c40", 3.2, "b-frame")}
          {line("M152 98 L96 86 M150 108 L104 90", "#3a3c40", 2.6, "b-frame")}
          {/* Engine: finned cylinder, crankcase, clutch cover, radiator */}
          {shape("M146 108 L170 86 L202 90 L210 132 L194 152 L156 152 L142 132 Z", FRAME, "b-frame-fill")}
          {fins(168, 200, [96, 102, 108, 114])}
          <circle cx="188" cy="130" r="10.5" fill="#3a3d42" stroke="#55585e" strokeWidth="2" />
          <circle cx="188" cy="130" r="4" fill="#55585e" />
          {shape("M209 86 L226 83 L231 124 L213 127 Z", TYRE, "b-dark-fill")}
          {line("M212 92 L227 90 M213 99 L228 97 M213 106 L229 104 M214 113 L230 111 M214 120 L230 118", "#3a3c40", 1.2)}
          {/* Exhaust: header under the engine into a stubby side can */}
          {line("M206 128 Q216 152 194 157 L152 158", METAL, 5)}
          {shape("M152 148 L114 144 L110 161 L152 165 Z", "#55585e")}
          {shape("M114 144 L104 149 L104 158 L110 161 Z", FRAME)}
          {line("M148 151 L120 148", "#fff", 1.4, undefined, 0.35)}
          {/* Footpegs and brake lever */}
          {line("M150 139 L165 136 M158 140 L174 146", TYRE, 3, "b-dark")}
          {/* Split seat and knife-edge tail */}
          {shape("M42 68 L108 80 L106 89 L86 88 L60 81 Z", tone)}
          {shape("M42 68 L52 70 L50 75 L42 73 Z", TAIL)}
          {shape("M72 74 L106 79 L105 87 L76 84 Z", TYRE, "b-dark-fill")}
          {shape("M106 84 Q128 76 156 82 L152 94 Q126 96 108 94 Z", TYRE, "b-dark-fill")}
          {shape("M112 96 L142 96 L138 108 L116 108 Z", "#000", undefined, 0.22)}
          {line("M68 90 L74 108", TYRE, 2.5, "b-dark")}
          {shape("M64 106 L80 106 L80 114 L64 114 Z", LAMP)}
          <circle cx="62" cy="100" r="2.4" fill="#e89a2c" />
          <Wheel x={262} y={140} r={44} tyre={10} kind="split" disc={25} rimTone={tone} />
          {/* Sharp tank with shrouds and knee recess */}
          {shape("M150 84 L176 62 L208 58 L219 66 L213 82 L197 97 L156 99 Z", tone)}
          {shape("M200 64 L228 70 L234 98 L213 106 L205 86 Z", tone)}
          {shape("M200 64 L228 70 L234 98 L213 106 L205 86 Z", "#000", undefined, 0.22)}
          {shape("M165 89 L187 84 L183 97 L163 98 Z", "#000", undefined, 0.2)}
          {line("M160 91 L201 85", "#000", 2, undefined, 0.25)}
          {line("M178 63 L208 60 L217 67", "#fff", 2, undefined, 0.5)}
          {/* USD fork, radial caliper, sharp fender */}
          {line("M221 58 L238 92", TYRE, 8, "b-dark")}
          {line("M238 92 L262 140", "#c9a227", 7)}
          {shape("M243 112 L254 108 L258 120 L247 124 Z", "#c9a227")}
          {shape("M236 122 L262 104 L290 113 L262 117 Z", tone)}
          {/* Angular LED headlamp, flyscreen, TFT, bars and mirror */}
          {shape("M230 56 L250 59 L255 77 L240 82 L229 70 Z", TYRE, "b-dark-fill")}
          {line("M237 62 L250 64 M235 70 L251 73", LAMP, 2.6)}
          {shape("M229 54 L243 45 L251 57 Z", GLASS, undefined, 0.65)}
          {shape("M217 46 L228 44 L229 50 L218 52 Z", "#3a3c40")}
          {line("M219 54 L206 44 L194 42", TYRE, 4, "b-dark")}
          {line("M194 42 L187 40", "#3a3c40", 5)}
          {line("M208 46 L203 32", TYRE, 2, "b-dark")}
          {shape("M196 27 L210 29 L208 34 L196 32 Z", TYRE, "b-dark-fill")}
        </>
      );
  }
}

export function BikeArt({ tone = "#2f5b8a", type = "naked", className = "" }: { tone?: string; type?: BikeType; className?: string }) {
  return (
    <svg className={`cx-bike ${className}`} viewBox="0 0 340 192" role="img" aria-label={bikeTypes[type].label}>
      {drawing(type, tone)}
    </svg>
  );
}
