export type BikeType =
  | "commuter"
  | "naked"
  | "classic"
  | "cruiser"
  | "touring"
  | "sports"
  | "superbike"
  | "adventure"
  | "chopper"
  | "cafe"
  | "scrambler"
  | "scooter"
  | "moped"
  | "dirt"
  | "bobber"
  | "powercruiser";

export const bikeTypes: Record<BikeType, { label: string; example: string }> = {
  commuter: { label: "Commuter", example: "Splendor, Shine, Platina" },
  naked: { label: "Naked", example: "Duke, MT-15, Guerrilla" },
  classic: { label: "Retro classic", example: "Classic 350, CB350, Jawa 42" },
  cruiser: { label: "Cruiser", example: "Meteor 350, Avenger, Rebel" },
  touring: { label: "Touring", example: "Gold Wing, Pan America" },
  sports: { label: "Sports", example: "R15, RC 200, Ninja 500" },
  superbike: { label: "Superbike", example: "ZX-10R, Hayabusa, Panigale" },
  adventure: { label: "Adventure", example: "Himalayan, 390 Adventure, Xpulse" },
  chopper: { label: "Chopper", example: "Long forks, high bars" },
  cafe: { label: "Café racer", example: "Continental GT, Thruxton" },
  scrambler: { label: "Scrambler", example: "Scram 440, Bear 650, 400X" },
  scooter: { label: "Scooter", example: "Activa, Jupiter, Access" },
  moped: { label: "Moped", example: "XL100" },
  dirt: { label: "Dirt bike", example: "KLX230, off-road only" },
  bobber: { label: "Bobber", example: "Goan Classic, Perak, Shotgun" },
  powercruiser: { label: "Power cruiser", example: "Diavel, Rocket 3" },
};

export const bikeTypeOrder = Object.keys(bikeTypes) as BikeType[];

export const catalogAsOf = "September 2026";

type Entry = [model: string, type: BikeType, aliases?: string[]];

// Indian market models on sale or recently discontinued, as of September 2026.
export const catalog: Record<string, Entry[]> = {
  Hero: [
    ["Splendor Plus", "commuter", ["splendor"]],
    ["Super Splendor", "commuter"],
    ["HF Deluxe", "commuter", ["hf dlx", "hf 100"]],
    ["Passion Plus", "commuter", ["passion pro", "passion"]],
    ["Glamour", "commuter"],
    ["Xtreme 125R", "naked"],
    ["Xtreme 160R", "naked", ["xtreme 160r 4v"]],
    ["Xtreme 250R", "naked"],
    ["Karizma XMR", "sports", ["karizma"]],
    ["Mavrick 440", "naked", ["mavrick"]],
    ["Xpulse 200 4V", "adventure", ["xpulse 200", "xpulse 210", "xpulse"]],
    ["Destini 125", "scooter", ["destini"]],
    ["Pleasure Plus", "scooter", ["pleasure"]],
    ["Xoom 110", "scooter", ["xoom"]],
    ["Vida VX2", "scooter", ["vida v2", "vida"]],
  ],
  Honda: [
    ["Shine 100", "commuter"],
    ["Shine 125", "commuter", ["shine", "cb shine"]],
    ["SP 125", "commuter", ["sp125"]],
    ["SP 160", "naked", ["sp160"]],
    ["Livo", "commuter"],
    ["Unicorn", "commuter", ["unicorn 160", "cb unicorn"]],
    ["Hornet 2.0", "naked", ["hornet", "cb200 hornet"]],
    ["CB200X", "adventure"],
    ["CB350", "classic", ["hness cb350", "h ness", "cb 350"]],
    ["CB350RS", "classic"],
    ["CB350C", "classic"],
    ["CB300R", "naked"],
    ["NX200", "adventure"],
    ["NX500", "adventure"],
    ["CB500", "naked"],
    ["Rebel 300", "cruiser"],
    ["Rebel 500", "cruiser"],
    ["XR 300L", "dirt"],
    ["Gold Wing", "touring", ["goldwing"]],
    ["Activa 6G", "scooter", ["activa"]],
    ["Activa 125", "scooter"],
    ["Activa e", "scooter"],
    ["QC1", "scooter"],
    ["Dio", "scooter", ["dio 125"]],
    ["ADV 160", "scooter"],
  ],
  Bajaj: [
    ["Platina 100", "commuter", ["platina"]],
    ["Platina 110", "commuter"],
    ["CT 110", "commuter", ["ct100", "ct 125x", "ct"]],
    ["Freedom 125", "commuter", ["freedom"]],
    ["Pulsar 125", "commuter"],
    ["Pulsar 150", "naked", ["pulsar 150 dts i"]],
    ["Pulsar N125", "naked"],
    ["Pulsar N160", "naked"],
    ["Pulsar NS160", "naked"],
    ["Pulsar NS200", "naked", ["ns200", "pulsar ns"]],
    ["Pulsar NS400Z", "naked", ["ns400"]],
    ["Pulsar N250", "naked"],
    ["Pulsar RS200", "sports", ["rs200"]],
    ["Avenger Street 160", "cruiser", ["avenger street"]],
    ["Avenger Cruise 220", "cruiser", ["avenger cruise", "avenger"]],
    ["Dominar 250", "naked"],
    ["Dominar 400", "naked", ["dominar"]],
    ["Chetak", "scooter", ["chetak electric"]],
  ],
  TVS: [
    ["XL100", "moped", ["xl 100", "xl super", "heavy duty"]],
    ["Sport", "commuter"],
    ["Star City+", "commuter", ["star city plus", "star city"]],
    ["Radeon", "commuter"],
    ["Raider 125", "naked", ["raider"]],
    ["Apache RTR 160", "naked", ["apache rtr 160 4v", "apache 160"]],
    ["Apache RTR 200", "naked", ["apache rtr 200 4v"]],
    ["Apache RTR 310", "naked"],
    ["Apache RR 310", "sports", ["rr310"]],
    ["Apache RTX 300", "adventure", ["rtx 300"]],
    ["Ronin", "scrambler"],
    ["Jupiter 110", "scooter", ["jupiter"]],
    ["Jupiter 125", "scooter"],
    ["Ntorq 125", "scooter", ["ntorq"]],
    ["Ntorq 150", "scooter"],
    ["Zest", "scooter", ["scooty zest", "scooty pep", "scooty"]],
    ["iQube", "scooter", ["iqube electric"]],
  ],
  "Royal Enfield": [
    ["Bullet 350", "classic", ["bullet", "bullet electra", "standard 350"]],
    ["Classic 350", "classic", ["classic 350 gorkha", "classic"]],
    ["Goan Classic 350", "bobber", ["goan classic"]],
    ["Hunter 350", "naked", ["hunter"]],
    ["Meteor 350", "cruiser", ["meteor", "thunderbird"]],
    ["Guerrilla 450", "naked", ["guerrilla"]],
    ["Scram 440", "scrambler", ["scram 411", "scram"]],
    ["Scrambler 450", "scrambler"],
    ["Himalayan 450", "adventure"],
    ["Himalayan 440", "adventure", ["himalayan 411", "himalayan"]],
    ["Interceptor 650", "classic", ["interceptor", "int 650"]],
    ["Continental GT 650", "cafe", ["continental gt", "gt 650", "continental"]],
    ["Continental GT 750", "cafe"],
    ["Classic 650", "classic"],
    ["Bear 650", "scrambler", ["bear"]],
    ["Shotgun 650", "bobber", ["shotgun"]],
    ["Super Meteor 650", "cruiser", ["super meteor"]],
  ],
  Yamaha: [
    ["FZ-S Fi", "naked", ["fzs", "fz s", "fz"]],
    ["FZ-X", "classic", ["fzx"]],
    ["MT-15", "naked", ["mt15", "mt 15 v2"]],
    ["R15 V4", "sports", ["yzf r15", "yzf r 15", "r15", "r 15"]],
    ["R2", "sports", ["yzf r2"]],
    ["R3", "sports", ["yzf r3"]],
    ["MT-03", "naked", ["mt03"]],
    ["Fascino 125", "scooter", ["fascino"]],
    ["RayZR 125", "scooter", ["ray zr", "rayzr"]],
    ["Aerox 155", "scooter", ["aerox"]],
    ["EC-06", "scooter", ["ec06"]],
  ],
  Suzuki: [
    ["Access 125", "scooter", ["access"]],
    ["e-Access", "scooter"],
    ["Avenis 125", "scooter", ["avenis"]],
    ["Burgman Street 125", "scooter", ["burgman"]],
    ["Gixxer", "naked", ["gixxer 155"]],
    ["Gixxer SF", "sports", ["gixxer sf 150"]],
    ["Gixxer 250", "naked"],
    ["Gixxer SF 250", "sports"],
    ["V-Strom SX", "adventure", ["v strom sx", "v strom"]],
    ["V-Strom 800DE", "adventure"],
    ["Hayabusa", "superbike", ["gsx1300r"]],
    ["GSX-8R", "sports"],
  ],
  KTM: [
    ["125 Duke", "naked"],
    ["200 Duke", "naked"],
    ["250 Duke", "naked"],
    ["390 Duke", "naked", ["duke 390", "duke"]],
    ["RC 200", "sports", ["rc200"]],
    ["RC 390", "sports", ["rc390", "rc"]],
    ["250 Adventure", "adventure"],
    ["390 Adventure", "adventure", ["390 adv", "adventure x"]],
    ["390 Enduro R", "dirt"],
    ["1390 Super Duke R", "naked", ["super duke"]],
  ],
  Husqvarna: [
    ["Svartpilen 250", "scrambler"],
    ["Svartpilen 401", "scrambler", ["svartpilen"]],
    ["Vitpilen 250", "cafe", ["vitpilen"]],
  ],
  Jawa: [
    ["Jawa 350", "classic"],
    ["Jawa 42", "classic", ["42 fj", "jawa 42 fj", "42"]],
    ["42 Bobber", "bobber", ["bobber"]],
    ["Perak", "bobber"],
  ],
  Yezdi: [
    ["Roadster", "classic"],
    ["Scrambler", "scrambler"],
    ["Adventure", "adventure"],
  ],
  "Harley-Davidson": [
    ["X440", "classic", ["x 440"]],
    ["Nightster", "cruiser"],
    ["Pan America 1250", "adventure", ["pan america"]],
    ["Fat Bob", "powercruiser"],
    ["Street Glide", "touring"],
    ["Road Glide", "touring"],
  ],
  Triumph: [
    ["Speed 400", "classic", ["speed t4"]],
    ["Scrambler 400 X", "scrambler", ["scrambler 400x", "400x"]],
    ["Thruxton 400", "cafe"],
    ["Bonneville 400", "classic"],
    ["Trident 660", "naked", ["trident"]],
    ["Street Triple", "naked"],
    ["Tiger 900", "adventure", ["tiger"]],
    ["Rocket 3", "powercruiser"],
  ],
  Kawasaki: [
    ["Ninja 300", "sports"],
    ["Ninja 500", "sports"],
    ["Ninja ZX-10R", "superbike", ["zx10r", "zx 10r"]],
    ["Z650", "naked"],
    ["Z900", "naked"],
    ["Eliminator", "cruiser"],
    ["Versys 650", "adventure", ["versys"]],
    ["KLX230", "dirt", ["klx"]],
  ],
  BMW: [
    ["G 310 R", "naked", ["g310r"]],
    ["G 310 RR", "sports", ["g310rr"]],
    ["G 310 GS", "adventure", ["g310gs"]],
    ["S 1000 RR", "superbike", ["s1000rr"]],
    ["R 1300 GS", "adventure", ["r1300gs", "gs"]],
    ["R nineT Racer", "cafe"],
  ],
  Ducati: [
    ["Monster", "naked"],
    ["Scrambler", "scrambler", ["scrambler icon"]],
    ["Panigale V4", "superbike", ["panigale"]],
    ["Multistrada V4", "adventure", ["multistrada"]],
    ["Diavel V4", "powercruiser", ["diavel"]],
    ["DesertX", "adventure"],
  ],
  Aprilia: [
    ["RS 457", "sports"],
    ["Tuono 457", "naked"],
    ["SR 160", "scooter"],
    ["SXR 160", "scooter", ["sxr 175", "sxr"]],
  ],
  Ather: [
    ["450X", "scooter", ["450 x", "450s", "450 apex"]],
    ["Rizta", "scooter"],
  ],
  Ola: [
    ["S1 Pro", "scooter", ["s1", "s1 air", "s1 x", "s1 z"]],
    ["Roadster X", "naked", ["roadster"]],
  ],
  Ultraviolette: [
    ["F77", "sports", ["f77 mach 2"]],
    ["Shockwave", "dirt"],
  ],
  Revolt: [["RV400", "naked", ["rv 400"]]],
  "Simple Energy": [["Simple One", "scooter", ["one", "wave"]]],
};

const keywordTypes: [RegExp, BikeType][] = [
  [/scooty|scooter|activa|jupiter|access|ntorq|dio|fascino|rayzr|burgman|avenis|chetak|iqube|ather|pleasure|destini|maestro|aerox|vespa|ola s1|rizta|vida/, "scooter"],
  [/moped|xl ?100|luna/, "moped"],
  [/himalayan|adventure|xpulse|\bgs\b|tenere|v ?strom|tiger|desertx|multistrada|versys|africa twin|nx ?\d/, "adventure"],
  [/bobber|perak|shotgun/, "bobber"],
  [/cafe|continental|thruxton|vitpilen|racer/, "cafe"],
  [/scram|scrambler|svartpilen|ronin|bear/, "scrambler"],
  [/cruise|meteor|avenger|rebel|eliminator|vulcan|thunderbird|intruder/, "cruiser"],
  [/diavel|rocket ?3|fat bob|power cruiser/, "powercruiser"],
  [/glide|gold ?wing|touring/, "touring"],
  [/zx ?10|zx ?6|hayabusa|s ?1000|panigale|r1\b|cbr ?1000|rsv4/, "superbike"],
  [/\brr\b|\brs\b|\br ?15\b|\br ?3\b|\bsf\b|\brc ?\d|ninja|karizma|cbr/, "sports"],
  [/classic|bullet|jawa|cb ?350|interceptor|roadster|bonneville|speed ?400|x ?440|fz ?x|electra/, "classic"],
  [/duke|\bmt\b|mt ?\d|\bfz|xtreme|hornet|\bns\b|ns ?\d|apache|gixxer|dominar|trident|street triple|z ?\d{3}|guerrilla|hunter|mavrick|monster|tuono|raider/, "naked"],
  [/enduro|motocross|klx|crf|xr ?\d|dirt/, "dirt"],
  [/splendor|passion|shine|platina|\bct\b|hf|star city|radeon|livo|sp ?125|glamour|discover|freedom|unicorn|sport/, "commuter"],
];

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(bs ?[346]|bs-vi|dts ?i|fi|abs|disc|drum|std|standard edition|electric start|es|kick)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const squash = (value: string) => normalise(value).replace(/ /g, "");

export type TypeMatch = { type: BikeType; model?: string; brand?: string; source: "catalogue" | "guess" | "unknown" };

/** Match a brand and model, or a raw RC `maker_model` string such as "YZF R 15" or "PULSAR 150 DTS-I", to a body type. */
export function typeForModel(model: string, brand = ""): TypeMatch {
  const wanted = squash(model);
  if (!wanted) return { type: "commuter", source: "unknown" };
  const brands = brand && catalog[brand] ? [brand, ...Object.keys(catalog).filter((name) => name !== brand)] : Object.keys(catalog);
  let best: { score: number; match: TypeMatch } | null = null;
  for (const name of brands) {
    for (const [entry, type, aliases = []] of catalog[name]) {
      for (const candidate of [entry, ...aliases]) {
        const key = squash(candidate);
        if (!key) continue;
        const score = wanted === key ? 3 : wanted.startsWith(key) || key.startsWith(wanted) ? 2 : wanted.includes(key) ? 1 : 0;
        const bonus = name === brand ? 0.5 : 0;
        if (score && (!best || score + bonus + key.length / 100 > best.score)) {
          best = { score: score + bonus + key.length / 100, match: { type, model: entry, brand: name, source: "catalogue" } };
        }
      }
    }
  }
  if (best) return best.match;
  const text = normalise(`${brand} ${model}`);
  const guess = keywordTypes.find(([pattern]) => pattern.test(text));
  return guess ? { type: guess[1], source: "guess" } : { type: "commuter", source: "unknown" };
}

export const popularBrands = ["Hero", "Honda", "Bajaj", "TVS", "Royal Enfield", "Yamaha", "Suzuki", "KTM"];
