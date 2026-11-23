import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarDays,
  Cog,
  Check,
  CreditCard,
  Download,
  KeyRound,
  Landmark,
  Leaf,
  Smartphone,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ContactRound,
  Delete,
  ExternalLink,
  Gift,
  History,
  Home,
  ImageIcon,
  LifeBuoy,
  LocateFixed,
  MapPin,
  Maximize,
  MessageCircle,
  Minimize,
  Moon,
  Navigation,
  Phone as PhoneIcon,
  Plus,
  ReceiptIndianRupee,
  Search,
  Share2,
  ShieldCheck,
  Siren,
  Square,
  Star,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Sun,
  Upload,
  UserRound,
  Video,
  Wallet,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { haptic } from "./native";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createContext, useContext, type ReactNode } from "react";
import { BikeArt } from "./bike-art";
import { bikeTypeOrder, bikeTypes, catalog, popularBrands, typeForModel, type BikeType } from "./bike-catalog";
import { booking } from "./data";
import { ApiError, api, hasSession, live as onServer, logout, onSignedOut, playStream, saveSession } from "./live";
import "./customer.css";
import "./home.css";
import "./tracker.css";
import "./profile.css";

const BookMotionContext = createContext<null | "cover" | "reveal">(null);
type PageMotion = "push" | "pop" | "tab" | "reveal" | null;
const PageMotionContext = createContext<PageMotion>(null);
export const tabScreens = ["Home", "Track + live view", "Garage & history", "Profile"];
const screenDepth: Record<string, number> = {
  "Starting page": 0,
  "Login / Sign up": 1,
  OTP: 2,
  "Create account": 3,
  "Book service": 1,
  Offers: 1,
  Notifications: 1,
  "Warranty tracker": 1,
  "Add address": 2,
  "Part approval": 2,
  "Price estimate": 2,
  Invoices: 1,
  "Job card closed + pay": 2,
  Wallet: 1,
  "Refer a friend": 1,
  "Edit profile": 1,
};

function pageMotion(from: string, to: string): PageMotion {
  if (tabScreens.includes(from) && tabScreens.includes(to)) return "tab";
  const a = screenDepth[from] ?? 0;
  const b = screenDepth[to] ?? 0;
  return b >= a ? "push" : "pop";
}
const PhonePortalContext = createContext<HTMLElement | null>(null);

export type Theme = "dark" | "light";
export type Experience = "first" | "returning";

const ThemeContext = createContext<Theme>("light");

export type TestTools = {
  experience: Experience;
  setExperience: (experience: Experience) => void;
  restart: () => void;
};

export const TestToolsContext = createContext<TestTools | null>(null);

type DemoScreenProps = {
  screen: string;
  open: (screen: string) => void;
  experience: Experience;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

type Extra = {
  id: string;
  part: string;
  note: string;
  amount: number;
  status: "pending" | "approved" | "declined";
  by: string;
};

type WalletTxn = {
  id: string;
  title: string;
  detail: string;
  amount: number;
  when: string;
};

type VehicleId = string;

type ServiceBooking = {
  id: string;
  vehicleId: VehicleId;
  serviceIds: string[];
  stage: number;
  extras: Extra[];
  paid: boolean;
  scheduled: string;
  eta: string;
  mode: "pickup" | "visit";
  estimate: number;
  walletPaid?: number;
  collectAtDoor?: boolean;
  /** Set only on real data: the booking's uuid for API calls, the people on the job, the bay camera and the server's bill. */
  uuid?: string;
  people?: { advisor?: string; mechanic?: string; bay?: string; rider?: string };
  camera?: boolean;
  bill?: { lines: { id: string; name: string; price: number }[]; subtotal: number; discount: number; extras: number; tax: number; total: number; kind: "estimate" | "due" | "paid" };
  payAtCounter?: boolean;
};

type Payment = {
  id: string;
  bookingId?: string;
  vehicleId: VehicleId;
  service: string;
  when: string;
  methodLabel: string;
  ref?: string;
  wallet: number;
  total: number;
  lines: { label: string; amount: number }[];
  visit: string;
  discount: number;
  tax: number;
  note?: string;
};

type SavedAddress = {
  id: string;
  label: string;
  area: string;
  line: string;
  contact: string;
  phone: string;
};

type ProfileInfo = {
  name: string;
  phone: string;
  email: string;
  language: "English" | "Kannada" | "Hindi";
  backupName: string;
  backupPhone: string;
};

const defaultProfile: ProfileInfo = { name: "Sanath Naik", phone: "98765 43210", email: "", language: "English", backupName: "", backupPhone: "" };

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

type DemoState = {
  profile: ProfileInfo;
  bookings: ServiceBooking[];
  selectedBookingId: string | null;
  addresses: SavedAddress[];
  readNotices: string[];
  offer: string | null;
  rating: number;
  wallet: number;
  txns: WalletTxn[];
  payments: Payment[];
  viewingPaymentId: string | null;
};

const savedAddresses: SavedAddress[] = [
  { id: "home", label: "Home", area: "BTM 2nd Stage", line: "Flat 302, Sai Residency, 16th Main Rd, BTM 2nd Stage, Bengaluru 560076", contact: "Sanath Naik", phone: "98765 43210" },
  { id: "office", label: "Work", area: "Koramangala 6th Block", line: "3rd floor, Prestige Tower, 80 Feet Rd, Koramangala, Bengaluru 560095", contact: "Sanath Naik", phone: "98765 43210" },
];

type AppProps = {
  state: DemoState;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  open: (screen: string) => void;
  firstTime: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const services: { id: string; name: string; detail: string; price: number; type: string }[] = [
  { id: "general", name: "General service", detail: "24-point inspection and tune-up", price: 1499, type: "Service" },
  { id: "oil", name: "Engine oil change", detail: "Oil, filter and disposal", price: 799, type: "Service" },
  { id: "brake", name: "Brake inspection", detail: "Pads, fluid and calibration", price: 399, type: "Repair" },
  { id: "chain", name: "Chain clean and lube", detail: "Clean, tension and lubrication", price: 199, type: "Care" },
  { id: "wash", name: "Foam wash", detail: "Foam wash and polish", price: 149, type: "Care" },
  { id: "puc", name: "PUC check", detail: "Emission test and certificate", price: 100, type: "Care" },
];

const serviceCategories = ["All", "Service", "Repair", "Care"];

type OfferItem = { id: string; big: string; line: string; title: string; detail: string; till: string; amount: number; firstOnly: boolean; needs: string | undefined; withOther?: boolean };

const offerList: OfferItem[] = [
  { id: "first", big: "₹150", line: "off your first service", title: "₹150 off your first service", detail: "For new customers, on any booking", till: "Till 31 Oct", amount: 150, firstOnly: true, needs: undefined },
  { id: "wash", big: "Free", line: "foam wash with any service", title: "Free foam wash", detail: "With any other service", till: "Till 4 Oct", amount: 149, firstOnly: false, needs: "wash" },
  { id: "monsoon", big: "₹100", line: "off a brake inspection", title: "₹100 off a brake inspection", detail: "Get the brakes checked before the rains", till: "Till 15 Oct", amount: 100, firstOnly: false, needs: "brake" },
];

function offersFor(firstTime: boolean) {
  return offerList.filter((offer) => firstTime || !offer.firstOnly);
}

function offerFits(offer: (typeof offerList)[number], cart: string[]) {
  if (!offer.needs) return true;
  return cart.includes(offer.needs) && (!(offer.withOther ?? offer.needs === "wash") || cart.length > 1);
}

const stages = ["Booked", "Rider assigned", "Picked up", "At the workshop", "Being serviced", "Job card closed", "Delivered"];

const stageHeadline = [
  "Booking confirmed",
  "Arjun is on his way",
  "Your bike is with Arjun",
  "Checked in at the workshop",
  "Being serviced in Bay 03",
  "Service complete",
  "Delivered to your door",
];

type GarageBike = { name: string; make: string; plate: string; tone: string; colour: string; km: string; services: number; type: BikeType };

const vehicles: Record<string, GarageBike> = {
  guerrilla: { name: "Guerrilla 450", make: "Royal Enfield", plate: booking.registration, tone: "#2f5b8a", colour: "Brava Blue", km: "6,842", services: 3, type: "naked" as BikeType },
  classic: { name: "Classic 350", make: "Royal Enfield", plate: "KA 05 JC 1987", tone: "#6e2a2a", colour: "Chrome Red", km: "21,390", services: 11, type: "classic" as BikeType },
  access: { name: "Access 125", make: "Suzuki", plate: "KA 03 NK 8821", tone: "#45675b", colour: "Pearl Green", km: "9,240", services: 2, type: "scooter" as BikeType },
};

/** The customer's own bikes, in garage order (real data only; the sample keeps its fixed three). */
const liveGarage: string[] = [];

function garageKeys(firstTime: boolean): string[] {
  if (onServer) return liveGarage;
  return firstTime ? ["guerrilla"] : Object.keys(vehicles);
}

/** Names of services on past job cards that are no longer bookable (the workshop's labour lines). */
const serviceNames: Record<string, string> = {};

function serviceName(id: string) {
  return services.find((service) => service.id === id)?.name ?? serviceNames[id];
}

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

/** Reloads everything from the server after a change (set by CustomerApp). */
let reloadLive: () => Promise<void> = async () => {};

function inr(value: number) {
  const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(value));
  return `${value < 0 ? "−" : ""}₹${amount}`;
}

const bayNotes: Extra[] = [
  { id: "pads", part: "Front brake pads", note: "Below the thickness we recommend. A new set stops the bike shorter.", amount: 650, status: "pending", by: "Amit, Bay 03" },
  { id: "chain", part: "Chain clean and tension", note: "Dry and a little loose. Doing it now avoids a full replacement.", amount: 199, status: "pending", by: "Amit, Bay 03" },
];

const GST_RATE = 0.18;

const returningTxns: WalletTxn[] = [
  { id: "ref", title: "Referral bonus", detail: "Arun joined with your code", amount: 200, when: "12 Sep" },
  { id: "refund", title: "Refund", detail: "Cancelled wash, Access 125", amount: 149, when: "2 Sep" },
  { id: "used", title: "Used on a service", detail: "Brake inspection, Classic 350", amount: -150, when: "18 Aug" },
  { id: "cash", title: "Service cashback", detail: "General service, Guerrilla 450", amount: 151, when: "12 Jun" },
  { id: "welcome", title: "Welcome bonus", detail: "Added when you joined", amount: 70, when: "1 May" },
];

function approvedExtraTotal(extras: Extra[]) {
  return extras.filter((extra) => extra.status === "approved").reduce((sum, extra) => sum + extra.amount, 0);
}

function approvalNotice(extras: Extra[]) {
  const pending = extras.filter((extra) => extra.status === "pending").length;
  return pending === 1 ? "A part needs your OK" : `${pending} parts need your OK`;
}

function billFor(item: ServiceBooking) {
  if (item.bill) return { ...item.bill, fromServer: true };
  const lines = item.serviceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is (typeof services)[number] => Boolean(service));
  const subtotal = lines.reduce((sum, service) => sum + service.price, 0);
  const discount = Math.max(0, subtotal - item.estimate);
  const extras = approvedExtraTotal(item.extras);
  const taxable = item.estimate + extras;
  const tax = Math.round(taxable * GST_RATE);
  const kind: "estimate" | "due" | "paid" = item.paid ? "paid" : item.stage >= 5 ? "due" : "estimate";
  return { lines, subtotal, discount, extras, tax, total: taxable + tax, kind, fromServer: false };
}

function billKindLabel(kind: ReturnType<typeof billFor>["kind"]) {
  if (kind === "paid") return "Paid";
  if (kind === "due") return "Invoice due";
  return "Estimate";
}

function serviceTitle(item: ServiceBooking) {
  const first = serviceName(item.serviceIds[0]) ?? "Service";
  const more = item.serviceIds.length - 1;
  return more > 0 ? `${first} + ${more} more` : first;
}

function selectedBooking(state: DemoState) {
  return state.bookings.find((item) => item.id === state.selectedBookingId);
}

function updateBooking(state: DemoState, id: string, update: (item: ServiceBooking) => ServiceBooking): DemoState {
  return { ...state, bookings: state.bookings.map((item) => item.id === id ? update(item) : item) };
}

function bookingStatus(item: ServiceBooking) {
  if (item.stage === 0) return "Upcoming";
  if (item.stage >= 6) return "Completed";
  return headlineFor(item);
}

function headlineFor(item: ServiceBooking) {
  const people = item.people;
  if (!people) return stageHeadline[item.stage];
  const rider = people.rider ? firstName(people.rider) : null;
  return [
    "Booking confirmed",
    rider ? `${rider} is on the way` : "A rider is on the way",
    rider ? `Your bike is with ${rider}` : "Your bike is with our rider",
    "Checked in at the workshop",
    people.bay ? `Being serviced in ${people.bay}` : "Being serviced",
    "Service complete",
    item.mode === "pickup" ? "Delivered to your door" : "Delivered",
  ][item.stage] ?? "";
}

const returningBookings: ServiceBooking[] = [
  {
    id: booking.id,
    vehicleId: "guerrilla",
    serviceIds: ["general"],
    stage: 4,
    extras: bayNotes.map((note) => ({ ...note })),
    paid: false,
    scheduled: "Today, 2–4 PM",
    eta: "Ready by 7:30 PM today",
    mode: "pickup",
    estimate: 1499,
  },
  {
    id: "BS-2026-000125",
    vehicleId: "classic",
    serviceIds: ["oil", "chain"],
    stage: 0,
    extras: [],
    paid: false,
    scheduled: "Tomorrow, 11 AM–1 PM",
    eta: "Pickup tomorrow at 11 AM",
    mode: "pickup",
    estimate: 998,
  },
  {
    id: "BS-2026-000109",
    vehicleId: "classic",
    serviceIds: ["brake"],
    stage: 6,
    extras: [],
    paid: true,
    scheduled: "18 Aug, 9–11 AM",
    eta: "Delivered 18 Aug",
    mode: "visit",
    estimate: 399,
    walletPaid: 150,
  },
];

const returningPayments: Payment[] = [
  {
    id: "INV-2026-000109",
    bookingId: "BS-2026-000109",
    vehicleId: "classic",
    service: "Brake inspection",
    when: "18 Aug",
    methodLabel: "UPI",
    ref: "523418907211",
    wallet: 150,
    total: 471,
    lines: [{ label: "Brake inspection", amount: 399 }],
    visit: "Workshop visit",
    discount: 0,
    tax: 72,
  },
  {
    id: "INV-2026-000098",
    vehicleId: "access",
    service: "General service",
    when: "18 Aug",
    methodLabel: "Cash at the workshop",
    wallet: 0,
    total: 1769,
    lines: [{ label: "General service", amount: 1499 }],
    visit: "Workshop visit",
    discount: 0,
    tax: 270,
  },
  {
    id: "INV-2026-000074",
    vehicleId: "guerrilla",
    service: "General service",
    when: "12 Jun",
    methodLabel: "UPI",
    ref: "418902334156",
    wallet: 0,
    total: 1769,
    lines: [{ label: "General service", amount: 1499 }],
    visit: "Pickup and delivery",
    discount: 0,
    tax: 270,
    note: "₹151 cashback went to your wallet.",
  },
  {
    id: "INV-2026-000051",
    vehicleId: "classic",
    service: "Engine oil change",
    when: "14 Mar",
    methodLabel: "Cash at the workshop",
    wallet: 0,
    total: 943,
    lines: [{ label: "Engine oil change", amount: 799 }],
    visit: "Workshop visit",
    discount: 0,
    tax: 144,
  },
  {
    id: "INV-2026-000032",
    vehicleId: "access",
    service: "Foam wash",
    when: "2 Feb",
    methodLabel: "UPI",
    ref: "317745920183",
    wallet: 0,
    total: 176,
    lines: [{ label: "Foam wash", amount: 149 }],
    visit: "Workshop visit",
    discount: 0,
    tax: 27,
  },
];

const monthNames: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };

function paymentMonth(payment: Payment) {
  const short = payment.when.split(" ")[1];
  return short ? monthNames[short] ?? short : "This month";
}

function paymentMethods(payment: Payment) {
  const rest = payment.total - payment.wallet;
  const methods: string[] = [];
  if (payment.wallet > 0) methods.push("Wallet");
  if (rest > 0) methods.push(payment.methodLabel.startsWith("Cash") ? "Cash" : payment.methodLabel);
  return methods;
}

function MethodIcon({ method }: { method: string }) {
  if (method === "Cash") return <Banknote />;
  if (method === "Wallet") return <Wallet />;
  if (method === "Card") return <CreditCard />;
  if (method === "Net banking") return <Landmark />;
  return <Smartphone />;
}

function paidDetail(payment: Payment) {
  const rest = payment.total - payment.wallet;
  const how = payment.wallet > 0 && rest > 0 ? `Wallet and ${payment.methodLabel}` : payment.wallet > 0 ? "Wallet" : payment.methodLabel;
  return `${payment.when}, ${how}`;
}

function paymentFromBooking(item: ServiceBooking, method: string, walletUsed: number): Payment {
  const bill = billFor(item);
  const labels: Record<string, string> = { upi: "UPI", card: "Card", net: "Net banking", wallet: "Wallet" };
  const covered = walletUsed >= bill.total;
  return {
    id: item.id.replace("BS-", "INV-"),
    bookingId: item.id,
    vehicleId: item.vehicleId,
    service: serviceTitle(item),
    when: "Today",
    methodLabel: covered ? "Wallet" : labels[method] ?? "UPI",
    ref: !covered && (method === "upi" || method === "net") ? item.id.replace(/\D/g, "").slice(-12).padStart(12, "4") : undefined,
    wallet: walletUsed,
    total: bill.total,
    lines: [
      ...bill.lines.map((service) => ({ label: service.name, amount: service.price })),
      ...item.extras.filter((extra) => extra.status === "approved").map((extra) => ({ label: extra.part, amount: extra.amount })),
    ],
    visit: item.mode === "pickup" ? "Pickup and delivery" : "Workshop visit",
    discount: bill.discount,
    tax: bill.tax,
  };
}

function Logo({ className }: { className?: string }) {
  const theme = useContext(ThemeContext);
  return <img className={className} src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"} alt="Bike Surgeon" />;
}

function formatPlate(raw: string) {
  const compact = raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const match = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (!match) return compact;
  return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

function plateKey(raw: string) {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function Plate({ value, small }: { value: string; small?: boolean }) {
  return (
    <span className={`cx-plate ${small ? "small" : ""}`}>
      <i><span />IND</i>
      <b>{value}</b>
    </span>
  );
}

function Segments({ value, total }: { value: number; total: number }) {
  return (
    <div className="cx-segments" role="progressbar" aria-valuemin={0} aria-valuemax={total - 1} aria-valuenow={value}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < value ? "done" : index === value ? "now" : ""} />
      ))}
    </div>
  );
}

const tabItems = [
  { label: "Home", target: "Home", icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { label: "Bookings", target: "Track + live view", icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
  { label: "Book", target: "Book service", icon: <path d="M12 5v14M5 12h14" /> },
  { label: "Garage", target: "Garage & history", icon: <><path d="M3 10l9-6 9 6v10H3z" /><path d="M7 20v-6h10v6M7 17h10" /></> },
  { label: "Profile", target: "Profile", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
];

let lastTabIndex: number | null = null;

const BUBBLE = 26;
const BAR_HEIGHT = 68;

/** The cut-out follows the bubble; near the ends it narrows and eats into the corner so the shape stays clean. */
function notchPath(width: number, x: number) {
  const h = BAR_HEIGHT;
  const corner = 22;
  const depth = BUBBLE + 8;
  const half = Math.max(BUBBLE + 6, Math.min(BUBBLE + 22, x, width - x));
  const left = Math.min(corner, Math.max(0, x - half));
  const right = Math.min(corner, Math.max(0, width - x - half));
  const ease = (half - BUBBLE - 6) * 0.8;
  return [
    `M0 ${h - corner}`,
    `L0 ${left}Q0 0 ${left} 0`,
    `L${x - half} 0`,
    `C${x - half + ease} 0 ${x - BUBBLE - 6} ${depth} ${x} ${depth}`,
    `C${x + BUBBLE + 6} ${depth} ${x + half - ease} 0 ${x + half} 0`,
    `L${width - right} 0Q${width} 0 ${width} ${right}`,
    `L${width} ${h - corner}Q${width} ${h} ${width - corner} ${h}`,
    `L${corner} ${h}Q0 ${h} 0 ${h - corner}Z`,
  ].join("");
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function TabBar({ tab, onTab }: { tab: string; onTab?: (screen: string) => void }) {
  const index = Math.max(0, tabItems.findIndex((item) => item.label === tab));
  const [start] = useState(() => lastTabIndex ?? index);
  const bar = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const slot = useRef(start);
  const place = (at: number) => {
    slot.current = at;
    const width = bar.current?.clientWidth ?? 366;
    svg.current?.setAttribute("viewBox", `0 0 ${width} ${BAR_HEIGHT}`);
    shape.current?.setAttribute("d", notchPath(width, ((at + 0.5) * width) / 5));
    const left = `${(at + 0.5) * 20}%`;
    if (bubble.current) bubble.current.style.left = left;
    if (label.current) label.current.style.left = left;
  };
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const observer = new ResizeObserver(() => place(slot.current));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const from = lastTabIndex ?? index;
    lastTabIndex = index;
    if (from === index || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(index);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / 380);
      place(from + (index - from) * easeInOut(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    place(from);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [index]);
  const active = tabItems[index];
  return (
    <nav className="cx-tabbar" aria-label="Customer app">
      <div className="cx-tabbar-bar" ref={bar}>
        <svg className="cx-tabbar-shape" ref={svg} aria-hidden="true">
          <path ref={shape} />
        </svg>
        {tabItems.map((item) => (
          <button key={item.label} aria-current={tab === item.label ? "page" : undefined} onClick={() => onTab?.(item.target)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
            <span>{item.label}</span>
          </button>
        ))}
        <span className="cx-tab-bubble" ref={bubble} style={{ left: `${(start + 0.5) * 20}%` }} aria-hidden="true">
          <svg viewBox="0 0 24 24">{active.icon}</svg>
        </span>
        <span className="cx-tab-bubble-label" ref={label} style={{ left: `${(start + 0.5) * 20}%` }} aria-hidden="true">{active.label}</span>
      </div>
    </nav>
  );
}

function PhoneFrame({
  children,
  tab,
  footer,
  onTab,
  tone = "light",
  expand = false,
  sign = false,
  cover,
}: {
  children: React.ReactNode;
  tab?: string;
  footer?: React.ReactNode;
  onTab?: (screen: string) => void;
  tone?: "light" | "white" | "night";
  expand?: boolean;
  sign?: boolean;
  cover?: React.ReactNode;
}) {
  const motion = useContext(BookMotionContext);
  const page = useContext(PageMotionContext);
  const pageClass = page && !motion && !expand ? ` page-${page}` : "";
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const holdPortal = (node: HTMLDivElement | null) => {
    if (node) setPortal(node);
  };
  return (
    <PhonePortalContext.Provider value={portal}>
    <div className={`cx-phone ${tone}${sign ? " sign" : ""}${expand ? " cx-book-opening" : ""}`} ref={holdPortal}>
      <div className="cx-status">
        <span>9:41</span>
        <span>5G 94%</span>
      </div>
      <ScrollArea className="cx-viewport">
        <div className={`cx-screen${pageClass}`}>{children}</div>
      </ScrollArea>
      {footer && <div className="cx-footer">{footer}</div>}
      {cover}
      {motion === "cover" && <span className="cx-book-cover" aria-hidden="true" />}
      {motion === "reveal" && <span className="cx-book-reveal" aria-hidden="true" />}
      {motion && <img className={`cx-book-logo ${motion}`} src="/logo-mark.svg" alt="" />}
      {expand && !motion && <span className="cx-book-expand" aria-hidden="true" />}
      {tab && <TabBar tab={tab} onTab={onTab} />}
    </div>
    </PhonePortalContext.Provider>
  );
}

function TopBar({ title, onBack, action, leading, edge = false }: { title?: string; onBack?: () => void; action?: React.ReactNode; leading?: React.ReactNode; edge?: boolean }) {
  return (
    <div className={`cx-topbar${edge ? " edge" : ""}`}>
      {edge ? null : onBack ? <button className="cx-round" aria-label="Back" onClick={onBack}><ChevronLeft /></button> : leading ?? <span />}
      {title ? <strong>{title}</strong> : <span />}
      {action || <span />}
    </div>
  );
}

const fetchedScreens = new Set<string>();
/** Stand-in for the network round trip until screens fetch from the backend. */
const FETCH_MS = 700;

function useFetched(key: string) {
  const [arrived, setArrived] = useState<{ key: string } | null>(null);
  const waiting = !fetchedScreens.has(key);
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => {
      fetchedScreens.add(key);
      setArrived({ key });
    }, FETCH_MS);
    return () => window.clearTimeout(id);
  }, [key, waiting]);
  if (waiting) return "loading";
  return arrived?.key === key ? "fresh" : "cached";
}

function Fetching({ id, skeleton, children }: { id: string; skeleton: ReactNode; children: ReactNode }) {
  const phase = useFetched(id);
  const page = useContext(PageMotionContext);
  if (phase === "loading") return <>{skeleton}</>;
  return <PageMotionContext.Provider value={phase === "fresh" ? "reveal" : page}>{children}</PageMotionContext.Provider>;
}

function Skel({ w = "100%", h = 12, r, className = "" }: { w?: number | string; h?: number; r?: number; className?: string }) {
  return <i className={`cx-skel ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

function Spinner() {
  return <span className="cx-spinner" aria-hidden="true" />;
}

function SkeletonFrame({ label, children, ...frame }: { label: string; children: ReactNode; tab?: string; onTab?: (screen: string) => void; tone?: "light" | "white" | "night" }) {
  return (
    <PhoneFrame {...frame}>
      <span className="sr-only" role="status">{label}</span>
      {children}
    </PhoneFrame>
  );
}

function SkelHeading() {
  return (
    <div className="cx-heading">
      <Skel w="68%" h={30} r={8} />
      <Skel w="92%" h={14} />
      <Skel w="56%" h={14} />
    </div>
  );
}

function SkelGroupHead({ w = 110 }: { w?: number }) {
  return <div className="cx-group-head"><Skel w={w} h={18} r={6} /></div>;
}

function SkelRows({ count, lead = true, action = false }: { count: number; lead?: boolean; action?: boolean }) {
  return (
    <div className="cx-list">
      {Array.from({ length: count }, (_, index) => (
        <div className="cx-row" key={index}>
          {lead && <Skel w={22} h={22} r={7} />}
          <span className="cx-skel-text">
            <Skel w={`${[62, 48, 56][index % 3]}%`} h={14} />
            <Skel w={`${[84, 70, 78][index % 3]}%`} h={11} />
          </span>
          {action && <Skel w={112} h={36} r={999} />}
        </div>
      ))}
    </div>
  );
}

function SkelBookingCard() {
  return (
    <div className="cx-booking">
      <div className="cx-booking-card">
        <Skel w={68} h={52} r={12} />
        <span className="cx-skel-text">
          <Skel w="70%" h={15} />
          <Skel w="52%" h={11} />
          <Skel w={64} h={13} />
        </span>
      </div>
    </div>
  );
}

function HomeSkeleton({ open }: { open: (screen: string) => void }) {
  return (
    <SkeletonFrame label="Loading your home screen" tab="Home" onTab={open} tone="white">
      <div className="ah">
        <div className="ah-top">
          <Spanner className="ah-mark" bolt="#f6c31c" />
          <div className="ah-hello cx-skel-text"><Skel w={86} h={12} /><Skel w={128} h={20} r={7} /></div>
          <Skel w={88} h={44} r={14} />
          <Skel w={44} h={44} r={14} />
        </div>
        <div className="ah-job cx-skel-dark">
          <div className="cx-skel-text"><Skel w="58%" h={17} r={6} /><Skel w="42%" h={12} /></div>
          <div className="ah-steps" aria-hidden="true">
            <div className="ah-steps-base" />
            {homeSteps.map((step, index) => <i key={step.label} className="ah-node" style={{ left: `${index * 25}%` }} />)}
          </div>
          <div className="ah-job-foot"><Skel w={110} h={12} /><Skel w={120} h={12} /></div>
        </div>
        <div className="ah-sech"><Skel w={118} h={17} r={6} /></div>
        <Skel h={152} r={22} />
        <div className="ah-sech"><Skel w={104} h={17} r={6} /></div>
        <div className="ah-chips"><Skel w={112} h={36} r={999} /><Skel w={98} h={36} r={999} /></div>
        <div className="ah-veh">
          <div className="ah-veh-head">
            <Skel w={64} h={48} r={13} />
            <span className="ah-grow cx-skel-text"><Skel w="62%" h={15} /><Skel w={110} h={18} r={6} /></span>
          </div>
          {[46, 38, 52].map((width) => (
            <div className="ah-rem" key={width}>
              <Skel w={36} h={36} r={11} />
              <span className="ah-rem-body cx-skel-text"><Skel w={`${width}%`} h={13} /><Skel h={6} r={3} /></span>
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

function TrackerSkeleton({ state, setState, open }: AppProps) {
  const item = selectedBooking(state);
  if (!item) {
    return (
      <SkeletonFrame label="Loading your bookings" tab="Bookings" onTab={open}>
        <TopBar title="Bookings" edge action={<button className="cx-topbar-estimate" onClick={() => openPaymentHistory(open, "Track + live view")}><ReceiptIndianRupee />Payment history</button>} />
        <SkelHeading />
        <section className="cx-group">
          <SkelGroupHead w={70} />
          <div className="cx-booking-list"><SkelBookingCard /><SkelBookingCard /></div>
        </section>
        <section className="cx-group">
          <SkelGroupHead w={96} />
          <div className="cx-booking-list"><SkelBookingCard /></div>
        </section>
      </SkeletonFrame>
    );
  }
  return (
    <SkeletonFrame label="Loading this booking" tab="Bookings" onTab={open}>
      <TopBar title={serviceTitle(item)} onBack={() => setState((current) => ({ ...current, selectedBookingId: null }))} />
      <div className="cx-booking-bike">
        <Skel w={68} h={52} r={12} />
        <span className="cx-skel-text"><Skel w={130} h={16} /><Skel w={110} h={20} r={6} /></span>
      </div>
      <Skel h={196} r={24} />
      <div className="cx-status-block cx-skel-text"><Skel w="74%" h={30} r={8} /><Skel w="44%" h={14} /><Skel h={6} r={3} /></div>
      <Skel h={54} r={999} />
      <section className="cx-group"><SkelGroupHead w={80} /><SkelRows count={1} /></section>
      <section className="cx-group"><SkelGroupHead w={90} /><SkelRows count={3} lead={false} /></section>
    </SkeletonFrame>
  );
}

function InvoicesSkeleton({ open }: { open: (screen: string) => void }) {
  const from = billOrigin;
  return (
    <SkeletonFrame label="Loading your payments" tab={from === "Track + live view" ? "Bookings" : "Profile"} onTab={open}>
      <TopBar title="Payment history" onBack={() => { billOrigin = "Profile"; open(from); }} />
      <section className="cx-group">
        <SkelGroupHead w={96} />
        <div className="cx-bills">
          {[64, 52, 58].map((width) => (
            <div className="cx-bill" key={width}>
              <div className="cx-bill-main">
                <Skel w={60} h={56} r={14} />
                <span className="cx-skel-text"><Skel w={`${width}%`} h={15} /><Skel w="46%" h={12} /><Skel w="58%" h={12} /></span>
              </div>
              <div className="cx-bill-foot"><Skel w={86} h={12} /><Skel w={124} h={12} /></div>
            </div>
          ))}
        </div>
      </section>
    </SkeletonFrame>
  );
}

function WalletSkeleton({ open }: { open: (screen: string) => void }) {
  return (
    <SkeletonFrame label="Loading your wallet" tab="Profile" onTab={open}>
      <TopBar title="My wallet" onBack={() => open(walletOrigin)} />
      <section className="cx-wallet-card cx-skel-dark"><Skel w={96} h={12} /><Skel w={140} h={44} r={10} /><Skel w="70%" h={12} /></section>
      <div className="cx-wallet-stats">
        {[72, 40].map((width) => <div className="cx-wallet-stat cx-skel-text" key={width}><Skel w={width} h={12} /><Skel w={64} h={20} r={6} /></div>)}
      </div>
      <Skel h={64} r={16} />
      <section className="cx-group">
        <SkelGroupHead w={112} />
        <div className="cx-tx-list">
          {[50, 62, 44, 56].map((width) => (
            <div className="cx-tx" key={width}>
              <Skel w={36} h={36} r={12} />
              <span className="cx-tx-copy cx-skel-text"><Skel w={`${width}%`} h={13} /><Skel w="72%" h={11} /></span>
              <Skel w={48} h={13} />
            </div>
          ))}
        </div>
      </section>
    </SkeletonFrame>
  );
}

function OffersSkeleton({ open }: { open: (screen: string) => void }) {
  return (
    <SkeletonFrame label="Loading offers" tab="Home" onTab={open}>
      <TopBar title="Offers" onBack={() => open("Home")} />
      <SkelHeading />
      <SkelRows count={3} action />
    </SkeletonFrame>
  );
}

function NotificationsSkeleton({ open }: { open: (screen: string) => void }) {
  return (
    <SkeletonFrame label="Loading notifications" tab="Home" onTab={open}>
      <TopBar title="Notifications" onBack={() => open("Home")} />
      <SkelHeading />
      <section className="cx-group">
        <SkelGroupHead w={64} />
        <div className="cx-notes">
          {[70, 58, 64].map((width) => (
            <div className="cx-note" key={width}>
              <i />
              <span className="cx-skel-text"><Skel w={70} h={10} /><Skel w={`${width}%`} h={14} /><Skel w="92%" h={12} /><Skel w={110} h={10} /></span>
            </div>
          ))}
        </div>
      </section>
    </SkeletonFrame>
  );
}

function WarrantySkeleton({ open }: { open: (screen: string) => void }) {
  const back = () => {
    const fromGarage = garageMemory.handoff;
    garageMemory.handoff = false;
    if (fromGarage) backToGarage(open);
    else open("Garage & history");
  };
  return (
    <SkeletonFrame label="Loading warranties">
      <TopBar title="Warranties" onBack={back} />
      <SkelHeading />
      <div className="cx-list">
        {[52, 40, 46, 58].map((width) => (
          <div className="cx-row cx-warranty" key={width}>
            <span className="cx-skel-text"><Skel w={`${width}%`} h={15} /><Skel w="34%" h={12} /><Skel h={5} r={9} /><Skel w="46%" h={12} /></span>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

function GarageSkeleton({ open }: { open: (screen: string) => void }) {
  return (
    <SkeletonFrame label="Loading your garage" tab="Garage" onTab={open} tone="night">
      <header className="cx-garage-top"><h1>Garage</h1></header>
      <div className="cx-vehicle-row">
        <div className="cx-vehicles">
          {[92, 80].map((width) => (
            <div className="cx-vehicle" key={width}>
              <Skel w={66} h={48} r={12} />
              <span className="cx-skel-text"><Skel w={width} h={14} /><Skel w={78} h={11} /></span>
            </div>
          ))}
        </div>
      </div>
      <Skel w="auto" h={262} r={26} className="cx-skel-bay" />
      <div className="cx-skel-text"><Skel w="34%" h={12} /><Skel w="58%" h={30} r={8} /><Skel w={140} h={26} r={6} /></div>
      <Skel w="calc(100% - 5px)" h={48} r={2} />
      <section className="cx-group"><SkelGroupHead w={96} /><Skel h={92} r={20} /></section>
    </SkeletonFrame>
  );
}

let billOrigin = "Profile";
let walletOrigin = "Home";

function openPaymentHistory(open: (screen: string) => void, from: string) {
  billOrigin = from;
  open("Invoices");
}

function openWallet(open: (screen: string) => void, from: string) {
  walletOrigin = from;
  open("Wallet");
}

function Group({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cx-group">
      {(title || action) && <div className="cx-group-head">{title && <h3>{title}</h3>}{action}</div>}
      <div className="cx-list">{children}</div>
    </section>
  );
}

function Row({
  title,
  detail,
  value,
  lead,
  chevron,
  onClick,
  tone,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  lead?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  tone?: "danger";
}) {
  const body = (
    <>
      {lead && <span className="cx-row-lead">{lead}</span>}
      <span className="cx-row-text"><b>{title}</b>{detail && <small>{detail}</small>}</span>
      {value !== undefined && <span className="cx-row-value">{value}</span>}
      {chevron && <ChevronRight className="cx-chevron" />}
    </>
  );
  if (onClick) return <button className={`cx-row ${tone || ""}`} onClick={onClick}>{body}</button>;
  return <div className={`cx-row ${tone || ""}`}>{body}</div>;
}

function Line({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return <div className={`cx-line ${total ? "total" : ""}`}><span>{label}</span><b>{value}</b></div>;
}

function BillCard({ item }: { item: ServiceBooking }) {
  const bill = billFor(item);
  const vehicle = vehicles[item.vehicleId];
  const prefix = bill.kind === "estimate" ? "EST" : "INV";
  return (
    <section className="cx-jobcard">
      <header>
        <Logo />
        <div>
          <b>{item.id.replace("BS-", `${prefix}-`)}</b>
          <small>{item.paid && item.walletPaid ? `Paid, ${inr(item.walletPaid)} from wallet` : billKindLabel(bill.kind)}</small>
        </div>
      </header>
      <div className="cx-jobcard-bike">
        <span className="cx-jobcard-name"><b>{vehicle.name}</b><Plate value={vehicle.plate} small /></span>
        <small>{serviceTitle(item)}</small>
      </div>
      <div className="cx-jobcard-lines">
        {bill.lines.map((service) => <Line key={service.id} label={service.name} value={inr(service.price)} />)}
        {!(bill.fromServer && bill.kind !== "estimate") && item.extras.filter((extra) => extra.status === "approved").map((extra) => (
          <Line key={extra.id} label={extra.part} value={inr(extra.amount)} />
        ))}
        <Line label={item.mode === "pickup" ? "Pickup and delivery" : "Workshop visit"} value="Free" />
        {bill.discount > 0 && <Line label="Offer" value={`−${inr(bill.discount)}`} />}
        <Line label="GST 18%" value={inr(bill.tax)} />
      </div>
      <div className="cx-jobcard-total">
        <span>{bill.kind === "estimate" ? "Estimated total" : "Total"}</span>
        <b>{inr(bill.total)}</b>
      </div>
      {item.paid && <div className="cx-stamp">Paid</div>}
    </section>
  );
}

function InvoicePaper({ payment }: { payment: Payment }) {
  const vehicle = vehicles[payment.vehicleId];
  const rest = payment.total - payment.wallet;
  return (
    <section className="cx-jobcard">
      <header>
        <Logo />
        <div>
          <b>{payment.id}</b>
          <small>Paid {payment.when}</small>
        </div>
      </header>
      <div className="cx-jobcard-bike">
        <span className="cx-jobcard-name"><b>{vehicle.name}</b><Plate value={vehicle.plate} small /></span>
        <small>{payment.service}</small>
      </div>
      <div className="cx-jobcard-lines">
        {payment.lines.map((line) => <Line key={line.label} label={line.label} value={inr(line.amount)} />)}
        <Line label={payment.visit} value="Free" />
        {payment.discount > 0 && <Line label="Offer" value={`−${inr(payment.discount)}`} />}
        <Line label="GST 18%" value={inr(payment.tax)} />
      </div>
      <div className="cx-jobcard-total">
        <span>Total</span>
        <b>{inr(payment.total)}</b>
        <div className="cx-stamp">Paid</div>
      </div>
      <div className="cx-jobcard-pay">
        <b>How you paid</b>
        {payment.wallet > 0 && <Line label="Wallet" value={inr(payment.wallet)} />}
        {rest > 0 && <Line label={payment.methodLabel} value={inr(rest)} />}
        {payment.ref && <small>Reference {payment.ref}</small>}
        {payment.note && <small>{payment.note}</small>}
      </div>
    </section>
  );
}

function Splash({ open }: { open: (screen: string) => void }) {
  const theme = useContext(ThemeContext);
  const [startedAt] = useState(() => Date.now());
  const src = `/splash.html?theme=${theme}&t=${startedAt}`;
  useEffect(() => {
    const timer = window.setTimeout(() => open("Login / Sign up"), 5600);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <div className="cx-phone cx-phone-splash">
      <iframe className="cx-splash-frame" title="Bike Surgeon intro" src={src} />
      <button className="cx-splash-skip" onClick={() => open("Login / Sign up")} aria-label="Skip intro" />
    </div>
  );
}

const authStories = [
  { id: "pickup", title: "We collect it from your door", body: "A named rider picks up your bike, photographs it and hands it over at the workshop." },
  { id: "live", title: "Watch it being serviced", body: "Your bay camera goes live the moment your bike reaches the workshop." },
  { id: "approve", title: "Nothing extra without your OK", body: "If we find something extra, you get a short note and the price, then you decide." },
];

function StoryArt({ id }: { id: string }) {
  if (id === "pickup") {
    return (
      <div className="cx-story-art pickup" aria-hidden="true">
        <BikeArt />
        <div className="cx-story-chip">
          <span className="cx-avatar">AK</span>
          <span><b>Arjun is 6 min away</b><small>Pickup, 2–4 PM</small></span>
        </div>
      </div>
    );
  }
  if (id === "live") {
    return (
      <div className="cx-story-art live" aria-hidden="true">
        <div className="cx-feed">
          <div className="cx-feed-scene"><BikeArt tone="#35516f" /></div>
          <div className="cx-feed-top"><span>Bay 03, camera 1</span><span className="cx-live"><i />Live</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className="cx-story-art approve" aria-hidden="true">
      <div className="cx-story-approval">
        <b>Front brake pads</b>
        <small>Below the thickness we recommend.</small>
        <div><strong>₹650</strong><span className="cx-story-btn">Approve</span></div>
      </div>
    </div>
  );
}

const loginPhone = { digits: "", channel: "sms" as "sms" | "whatsapp" };

async function sendLoginCode(digits: string, channel: "sms" | "whatsapp") {
  loginPhone.digits = digits;
  loginPhone.channel = channel;
  if (onServer) await api("/v1/auth/otp/request", { body: { phone: digits, channel } });
}

/** Verifies the code, keeps the session and says where to go next. */
async function verifyLoginCode(code: string) {
  const session = await api<{ accessToken: string; refreshToken: string; isNewCustomer: boolean }>("/v1/auth/otp/verify", { body: { phone: loginPhone.digits, code } });
  saveSession(session);
  if (session.isNewCustomer) return "Create account";
  const bikes = await api<unknown[]>("/v1/vehicles").catch(() => [1]);
  return bikes.length ? "Home" : "Create account";
}

function Auth({ open }: { open: (screen: string) => void }) {
  const [story, setStory] = useState(0);
  const [phone, setPhone] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const send = (channel: "sms" | "whatsapp") => {
    setSending(true);
    sendLoginCode(phone.replace(/\D/g, ""), channel)
      .then(() => {
        if (channel === "whatsapp") toast("We’ll send the code on WhatsApp");
        open("OTP");
      })
      .catch((error) => toast.error(messageOf(error)))
      .finally(() => setSending(false));
  };
  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10;
  useEffect(() => {
    if (typing) return;
    const timer = window.setTimeout(() => setStory((value) => (value + 1) % authStories.length), 4200);
    return () => window.clearTimeout(timer);
  }, [story, typing]);
  const format = (value: string) => value.length > 5 ? `${value.slice(0, 5)} ${value.slice(5)}` : value;
  const press = (key: string) => {
    if (key === "del") setPhone((value) => format(value.replace(/\D/g, "").slice(0, -1)));
    else if (digits.length < 10) setPhone(format(digits + key));
  };
  const current = authStories[story];
  return (
    <div className={`cx-phone cx-auth ${typing ? "typing" : ""}`}>
      <div className="cx-status"><span>9:41</span><span>5G 94%</span></div>
      <section
        className="cx-stories"
        aria-roledescription="carousel"
        aria-label="How Bike Surgeon works"
        onClick={() => typing && setTyping(false)}
      >
        <div className="cx-story-bars" role="tablist" aria-label="Choose a story">
          {authStories.map((item, index) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={index === story}
              aria-label={item.title}
              onClick={(event) => {
                event.stopPropagation();
                setStory(index);
              }}
            >
              <span className={index < story ? "done" : index === story ? (typing ? "done" : "now") : ""}><i key={`${story}-${typing}`} /></span>
            </button>
          ))}
        </div>
        <Logo className="cx-logo" />
        <div className="cx-story" key={current.id} aria-live="polite">
          <StoryArt id={current.id} />
          <h1>{current.title}</h1>
          <p>{current.body}</p>
        </div>
      </section>
      <section className="cx-auth-sheet">
        <label className="cx-field">
          <span>Mobile number</span>
          <div className="cx-input-group">
            <em>+91</em>
            <input
              type="tel"
              inputMode="none"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              onFocus={() => setTyping(true)}
              onChange={(event) => setPhone(format(event.target.value.replace(/\D/g, "").slice(0, 10)))}
            />
          </div>
        </label>
        <button className="cx-btn cx-btn-primary" disabled={!valid || sending} onClick={() => send("sms")}>Continue</button>
        {!typing && <button className="cx-link cx-auth-alt" onClick={() => {
          if (!onServer) { setPhone("98765 43210"); toast("We’ll send the code on WhatsApp"); }
          else if (valid) send("whatsapp");
          else toast("Enter your mobile number first");
        }}>Get the code on WhatsApp instead</button>}
        <p className="cx-fine">Only used to log in and send service updates. By continuing you agree to our <button className="cx-link">terms</button> and <button className="cx-link">privacy policy</button>.</p>
        {typing && (
          <div className="cx-keyboard">
            {!onServer && (
              <button className="cx-suggest" onClick={() => setPhone("98765 43210")}>
                <small>From Contacts</small>
                <b>98765 43210</b>
              </button>
            )}
            <div className="cx-keys">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, index) =>
                key ? (
                  <button key={index} aria-label={key === "del" ? "Delete" : key} onClick={() => press(key)}>
                    {key === "del" ? <Delete /> : key}
                  </button>
                ) : <span key={index} />,
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const otpCode = "4719";

function boxInPhone(el: HTMLElement, root: HTMLElement) {
  const style = getComputedStyle(root);
  const zoom = Number.parseFloat(style.zoom || "1") || 1;
  const node = el.getBoundingClientRect();
  const phone = root.getBoundingClientRect();
  return {
    left: (node.left - phone.left) / zoom - (Number.parseFloat(style.borderLeftWidth) || 0),
    top: (node.top - phone.top) / zoom - (Number.parseFloat(style.borderTopWidth) || 0),
    width: node.width / zoom,
    height: node.height / zoom,
  };
}

function Otp({ open }: { open: (screen: string) => void }) {
  const [digits, setDigits] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error" | "done">("idle");
  const [countdown, setCountdown] = useState(30);
  const [read, setRead] = useState<"waiting" | "shown" | "flying" | "manual">(onServer ? "manual" : "waiting");
  const [errorText, setErrorText] = useState("");
  const [banner, setBanner] = useState<"in" | "out" | "gone">("gone");
  const [nudge, setNudge] = useState(0);
  const [arrived, setArrived] = useState(0);
  const [flights, setFlights] = useState<{ char: string; from: ReturnType<typeof boxInPhone>; to: ReturnType<typeof boxInPhone> }[]>([]);
  const [phone, setPhone] = useState<HTMLElement | null>(null);
  const sourceRefs = useRef<(HTMLElement | null)[]>([]);
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const manual = useRef(onServer);
  useEffect(() => {
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (manual.current || read !== "waiting") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setBanner("in");
      setRead("shown");
    }, nudge > 0 ? 40 : reduce ? 500 : 1200);
    return () => window.clearTimeout(timer);
  }, [nudge, read]);
  useEffect(() => {
    if (manual.current || read !== "shown") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (reduce) {
        setDigits(otpCode);
        setArrived(0b1111);
        setBanner("gone");
        setRead("manual");
        return;
      }
      setRead("flying");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [read]);
  useLayoutEffect(() => {
    if (read !== "flying" || !phone) return;
    const next = otpCode.split("").map((char, index) => {
      const from = sourceRefs.current[index];
      const to = slotRefs.current[index];
      if (!from || !to) return null;
      return { char, from: boxInPhone(from, phone), to: boxInPhone(to, phone) };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    setFlights(next);
  }, [read, phone]);
  useLayoutEffect(() => {
    if (!flights.length || !phone) return;
    const nodes = [...phone.querySelectorAll<HTMLElement>(".cx-otp-fly")];
    const animations = nodes.map((el, index) => {
      const item = flights[index];
      if (!item) return null;
      const dx = item.from.left - item.to.left + (item.from.width - item.to.width) / 2;
      const dy = item.from.top - item.to.top + (item.from.height - item.to.height) / 2;
      const startScale = Math.max(0.42, Math.min(0.72, item.from.height / item.to.height));
      const animation = el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${startScale})`, opacity: 1, filter: "drop-shadow(0 10px 12px rgb(0 0 0 / 22%))" },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.18 - 26}px) scale(${startScale + 0.2})`, opacity: 1, filter: "drop-shadow(0 16px 16px rgb(0 0 0 / 18%))", offset: 0.42 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1, filter: "drop-shadow(0 0 0 rgb(0 0 0 / 0))" },
      ], { duration: 720, delay: index * 110, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" });
      animation.finished.then(() => {
        if (animation.playState !== "finished") return;
        setArrived((value) => value | (1 << index));
      }).catch(() => {});
      return animation;
    });
    const dismiss = window.setTimeout(() => setBanner("out"), 110 * 3 + 160);
    return () => {
      animations.forEach((animation) => animation?.cancel());
      window.clearTimeout(dismiss);
    };
  }, [flights, phone]);
  useEffect(() => {
    if (arrived !== 0b1111 || digits === otpCode) return;
    setDigits(otpCode);
  }, [arrived, digits]);
  const takeOver = () => {
    manual.current = true;
    setRead("manual");
    setBanner("gone");
    setFlights([]);
  };
  const enter = (digit: string) => {
    if (digits.length >= 4 || status === "checking" || read === "flying" || read === "shown") return;
    if (read === "waiting") takeOver();
    setDigits((value) => value + digit);
    setStatus("idle");
  };
  useEffect(() => {
    if (digits.length !== 4) return;
    setStatus("checking");
    if (onServer) {
      let cancelled = false;
      verifyLoginCode(digits)
        .then((next) => {
          if (cancelled) return;
          setStatus("done");
          toast.success("Number verified");
          window.setTimeout(() => open(next), 700);
        })
        .catch((error) => {
          if (cancelled) return;
          setErrorText(error instanceof ApiError && error.status !== 400 ? error.message : "That code didn’t match. Try again.");
          setStatus("error");
          setDigits("");
          setArrived(0);
        });
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(() => {
      if (digits === otpCode) {
        setStatus("done");
        toast.success("Number verified");
        window.setTimeout(() => open("Create account"), 700);
      } else {
        setStatus("error");
        setDigits("");
        setArrived(0);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [digits, open]);
  const reading = read === "waiting" || read === "shown" || read === "flying";
  return (
    <PhoneFrame
      tone="white"
      cover={banner !== "gone" ? (
        <div className={`cx-otp-banner ${banner}`} role="status" onAnimationEnd={() => { if (banner === "out") setBanner("gone"); }}>
          <span className="cx-otp-banner-icon" aria-hidden="true"><MessageCircle /></span>
          <span className="cx-otp-banner-copy">
            <small>Messages <em>now</em></small>
            <b>Bike Surgeon</b>
            <p>Your code is <span className="cx-otp-code">{otpCode.split("").map((char, index) => <span key={index} ref={(node) => { sourceRefs.current[index] = node; }} className={flights.length ? "lifted" : ""}>{char}</span>)}</span></p>
          </span>
        </div>
      ) : null}
      footer={
        <div className="cx-keyboard">
          {!onServer && (
            <button className="cx-suggest" disabled={read === "shown" || read === "flying"} onClick={() => { if (read === "waiting") setNudge((value) => value + 1); else if (status === "idle") setDigits(otpCode); }}>
              <small>From Messages</small>
              <b>{otpCode}</b>
            </button>
          )}
          <div className="cx-keys">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, index) =>
              key ? (
                <button key={index} aria-label={key === "del" ? "Delete" : key} onClick={() => {
                  if (key === "del") {
                    if (read === "waiting") takeOver();
                    else if (read === "manual") setDigits((value) => value.slice(0, -1));
                    return;
                  }
                  enter(key);
                }}>
                  {key === "del" ? <Delete /> : key}
                </button>
              ) : <span key={index} />,
            )}
          </div>
        </div>
      }
    >
      <TopBar onBack={() => open("Login / Sign up")} />
      <div className="cx-heading">
        <h1>Enter the code</h1>
        <p>Sent to +91 {onServer ? spaced(loginPhone.digits) : "98765 43210"}{onServer && loginPhone.channel === "whatsapp" ? " on WhatsApp" : ""}. <button className="cx-link" onClick={() => open("Login / Sign up")}>Change number</button></p>
      </div>
      <div className={`cx-otp ${status} ${read === "waiting" ? "waiting" : ""}`} ref={(node) => setPhone(node?.closest<HTMLElement>(".cx-phone") ?? null)}>
        {[0, 1, 2, 3].map((index) => {
          const landed = (arrived & (1 << index)) !== 0;
          return (
            <span key={index} ref={(node) => { slotRefs.current[index] = node; }} className={status === "idle" && !reading && index === digits.length ? "active" : ""}>
              {status === "done" ? <Check /> : landed ? otpCode[index] : digits[index] || ""}
            </span>
          );
        })}
      </div>
      <p className={`cx-otp-note ${status === "error" ? "danger" : ""}`} aria-live="polite">
        {status === "checking" && <><Spinner />Checking the code</>}
        {status === "error" && (onServer ? errorText : "That code didn’t match. Try 4719.")}
        {status === "done" && "Verified"}
        {status === "idle" && read === "waiting" && "Checking Messages"}
        {status === "idle" && (read === "shown" || read === "flying") && "Found in Messages"}
        {status === "idle" && read === "manual" && (countdown ? `Resend code in 0:${String(countdown).padStart(2, "0")}` : <button className="cx-link" onClick={() => {
          if (!onServer) return;
          sendLoginCode(loginPhone.digits, loginPhone.channel).then(() => { setCountdown(30); toast.success("New code sent"); }).catch((error) => toast.error(messageOf(error)));
        }}>Resend code</button>)}
      </p>
      {phone && flights.length > 0 && createPortal(flights.map((item, index) => (
        (arrived & (1 << index)) === 0 ? (
          <span key={item.char + index} className="cx-otp-fly" style={{ left: item.to.left, top: item.to.top, width: item.to.width, height: item.to.height }} aria-hidden="true">{item.char}</span>
        ) : null
      )), phone)}
    </PhoneFrame>
  );
}

const bikeColours: [string, string][] = [
  ["Black", "#1d1e21"],
  ["Matte black", "#34332f"],
  ["Grey", "#6f7378"],
  ["Silver", "#c3c5ca"],
  ["White", "#f5f5f2"],
  ["Pearl white", "#e9e3d3"],
  ["Beige", "#d4c09c"],
  ["Red", "#b3261e"],
  ["Maroon", "#6e2a2a"],
  ["Orange", "#e0621a"],
  ["Yellow", "#e8b41a"],
  ["Gold", "#b8913a"],
  ["Copper", "#9a5a36"],
  ["Olive", "#5b6340"],
  ["Green", "#2f6b46"],
  ["Teal", "#1f6d73"],
  ["Sky blue", "#5f9bc9"],
  ["Blue", "#2f5b8a"],
  ["Navy", "#1f2d4d"],
  ["Purple", "#5a3d7a"],
];

function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#1b1c1f" : "#ffffff";
}

const makeYears = Array.from({ length: 21 }, (_, i) => String(2026 - i));

function TypePicker({ value, onPick }: { value: BikeType | null; onPick: (type: BikeType) => void }) {
  return (
    <div className="cx-type-grid" role="radiogroup" aria-label="Bike type">
      {bikeTypeOrder.map((item) => (
        <button key={item} role="radio" aria-checked={value === item} onClick={() => onPick(item)}>
          <BikeArt type={item} tone="#4f6d8a" />
          <span>{bikeTypes[item].label}</span>
        </button>
      ))}
    </div>
  );
}

type LookupResult = { registrationNumber: string; make: string | null; model: string | null; bodyType: BikeType | null; colourName: string | null; makeYear: number | null; chassisLast4: string | null };

/** The RC lookup on the server. Null when it is not set up or the number is not found; the screen then asks for the details. */
async function lookupPlate(reg: string) {
  try {
    const found = await api<LookupResult>("/v1/vehicles/lookup", { body: { registrationNumber: reg } });
    return found.make && found.model ? found : null;
  } catch {
    return null;
  }
}

function lookupLine(lookup: LookupResult | null, typeLabel: string) {
  if (!lookup) return `${typeLabel}, Stealth Black, made in 2023`;
  return [typeLabel, lookup.colourName, lookup.makeYear ? `made in ${lookup.makeYear}` : null].filter(Boolean).join(", ");
}

function CreateAccount({ open }: { open: (screen: string) => void }) {
  const [name, setName] = useState(onServer ? "" : "Sanath Naik");
  const [reg, setReg] = useState(onServer ? "" : "MH12AB1234");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState(false);
  const [manual, setManual] = useState(false);
  const [brand, setBrand] = useState("");
  const [brandText, setBrandText] = useState("");
  const [model, setModel] = useState("");
  const [modelText, setModelText] = useState("");
  const [year, setYear] = useState("");
  const [colour, setColour] = useState("");
  const [customHex, setCustomHex] = useState("#8a4fb3");
  const [pickedType, setPickedType] = useState<BikeType | null>(null);
  const [choosing, setChoosing] = useState(false);
  const typedModel = brand === "Other" || model === "Not listed";
  const modelName = (typedModel ? modelText : model).trim();
  const brandName = brand === "Other" ? brandText.trim() : brand;
  const found = lookup?.bodyType ? { type: lookup.bodyType, source: "catalog" } : typeForModel(lookup?.model ?? "XTREME 160R", lookup?.make ?? "Hero");
  const detected = manual && modelName ? typeForModel(modelName, brandName) : null;
  const bikeType = pickedType ?? (vehicle ? found.type : detected && detected.source !== "unknown" ? detected.type : null);
  const needsType = manual && Boolean(modelName) && !bikeType;
  const tone = colour === "Custom" ? customHex : bikeColours.find(([label]) => label === colour)?.[1] ?? "#2f5b8a";
  const manualDone = Boolean(brandName && modelName && year && colour && bikeType);
  const resetType = () => {
    setPickedType(null);
    setChoosing(false);
  };
  const fetchVehicle = () => {
    setLoading(true);
    if (onServer) {
      lookupPlate(reg).then((result) => {
        setLoading(false);
        resetType();
        if (result) {
          setLookup(result);
          setVehicle(true);
          setManual(false);
          toast.success("Found your bike");
        } else {
          toast("We couldn’t read that number. Enter the details yourself.");
          setManual(true);
        }
      });
      return;
    }
    window.setTimeout(() => {
      setLoading(false);
      setVehicle(true);
      resetType();
      toast.success("Found your bike");
    }, 900);
  };
  const pick = (type: BikeType) => {
    setPickedType(type);
    setChoosing(false);
  };
  const finish = async () => {
    if (!onServer) {
      open("Home");
      return;
    }
    setSaving(true);
    try {
      await api("/v1/me", { method: "PATCH", body: { name: name.trim().replace(/\s+/g, " ") } });
      const bike = vehicle && lookup
        ? { registrationNumber: reg, make: lookup.make, model: lookup.model, bodyType: bikeType ?? found.type, colourName: lookup.colourName, makeYear: lookup.makeYear, chassisLast4: lookup.chassisLast4 }
        : { registrationNumber: reg, make: brandName, model: modelName, bodyType: bikeType, colourName: colour === "Custom" ? "Custom colour" : colour, colourHex: tone, makeYear: Number(year) || null };
      await api("/v1/vehicles", { body: bike }).catch((error) => {
        if (!(error instanceof ApiError && error.status === 409)) throw error;
      });
      await reloadLive();
      open("Home");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setSaving(false);
    }
  };
  const plateReady = !onServer || plateKey(reg).length >= 6;
  return (
    <PhoneFrame
      tone="white"
      footer={<button className="cx-btn cx-btn-primary" disabled={saving || !name.trim() || !plateReady || !(vehicle || (manual && manualDone))} onClick={finish}>Continue</button>}
    >
      <TopBar onBack={() => open("OTP")} />
      <div className="cx-heading">
        <h1>Add your bike</h1>
        <p>Enter the number on your plate and we’ll fill in the rest from the RC.</p>
      </div>
      <label className="cx-field">
        <span>Your name</span>
        <input className="cx-input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="cx-field">
        <span>Registration number</span>
        <div className="cx-plate-input">
          <i>IND</i>
          <input value={reg} onChange={(event) => setReg(event.target.value.toUpperCase())} />
          <button className="cx-btn cx-btn-dark small" aria-busy={loading} disabled={loading || reg.length < 6} onClick={(event) => { event.preventDefault(); fetchVehicle(); }}>
            {loading ? <><Spinner />Finding…</> : "Find"}
          </button>
        </div>
      </label>
      {vehicle && (
        <div className="cx-found">
          <BikeArt tone="#1f2023" type={bikeType ?? found.type} />
          <div>
            <b>{lookup ? `${lookup.make} ${lookup.model}` : "Hero Xtreme 160R"}</b>
            <small>{lookupLine(lookup, bikeTypes[bikeType ?? found.type].label)}</small>
            {(!lookup || lookup.chassisLast4) && <small>Chassis ending {lookup ? lookup.chassisLast4 : "2198"}</small>}
            <button className="cx-link" onClick={() => setChoosing((value) => !value)}>{choosing ? "Keep this type" : "Not right? Change the type"}</button>
          </div>
        </div>
      )}
      {vehicle && choosing && <TypePicker value={bikeType} onPick={pick} />}
      {!vehicle && !manual && (
        <Group>
          <label className="cx-row">
            <span className="cx-row-lead"><Upload /></span>
            <span className="cx-row-text"><b>Upload a photo of the RC</b><small>We’ll read the details for you</small></span>
            <input className="cx-hidden-file" type="file" aria-label="Upload RC" onChange={fetchVehicle} />
            <ChevronRight className="cx-chevron" />
          </label>
          <Row title="Enter details yourself" onClick={() => setManual(true)} chevron />
        </Group>
      )}
      {manual && (
        <div className="cx-manual">
          <div className="cx-field" role="group" aria-label="Brand">
            <span>Brand</span>
            <div className="cx-choices">
              {[...popularBrands, "Other"].map((item) => (
                <button key={item} aria-pressed={brand === item} onClick={() => { setBrand(item); setModel(""); resetType(); }}>{item}</button>
              ))}
            </div>
            {brand === "Other" && <input className="cx-input" placeholder="Brand name" aria-label="Brand name" value={brandText} onChange={(event) => { setBrandText(event.target.value); resetType(); }} />}
          </div>
          <div className="cx-grid-2">
            <label className="cx-field">
              <span>Model</span>
              {brand === "Other" ? (
                <input className="cx-input" placeholder="Model name" value={modelText} onChange={(event) => { setModelText(event.target.value); resetType(); }} />
              ) : (
                <span className="cx-select">
                  <select className="cx-input" value={model} disabled={!brand} onChange={(event) => { setModel(event.target.value); resetType(); }}>
                    <option value="" disabled>{brand ? "Choose" : "Pick a brand"}</option>
                    {(catalog[brand] ?? []).map(([item]) => <option key={item} value={item}>{item}</option>)}
                    <option value="Not listed">Not listed</option>
                  </select>
                  <ChevronDown />
                </span>
              )}
            </label>
            <label className="cx-field">
              <span>Make year</span>
              <span className="cx-select">
                <select className="cx-input" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="" disabled>Year</option>
                  {makeYears.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <ChevronDown />
              </span>
            </label>
          </div>
          {model === "Not listed" && brand !== "Other" && (
            <input className="cx-input" placeholder="Model name" aria-label="Model name" value={modelText} onChange={(event) => { setModelText(event.target.value); resetType(); }} />
          )}
          {modelName && (
            <div className="cx-field">
              <span>Type</span>
              <div className="cx-type-detect">
                <span className="cx-type-art"><BikeArt type={bikeType ?? "commuter"} tone={tone} /></span>
                <span className="cx-row-text">
                  <b>{bikeType ? bikeTypes[bikeType].label : "Which one looks like yours?"}</b>
                </span>
                {bikeType && <button className="cx-link" onClick={() => setChoosing((value) => !value)}>{choosing ? "Done" : "Change"}</button>}
              </div>
              {(choosing || needsType) && <TypePicker value={bikeType} onPick={pick} />}
            </div>
          )}
          <div className="cx-field" role="group" aria-label="Colour">
            <div className="cx-field-row">
              <span>Colour</span>
              <b>{colour === "Custom" ? "Your own colour" : colour}</b>
            </div>
            <div className="cx-swatches">
              {bikeColours.map(([label, hex]) => (
                <button key={label} type="button" aria-label={label} title={label} aria-pressed={colour === label} style={{ background: hex }} onClick={() => setColour(label)}>
                  {colour === label && <Check style={{ color: inkOn(hex) }} />}
                </button>
              ))}
              <label className={`cx-swatch-custom${colour === "Custom" ? " on" : ""}`} title="Another colour" style={colour === "Custom" ? { background: customHex } : undefined}>
                <input
                  type="color"
                  value={customHex}
                  aria-label="Another colour"
                  onChange={(event) => {
                    setCustomHex(event.target.value);
                    setColour("Custom");
                  }}
                />
                {colour === "Custom" ? <Check style={{ color: inkOn(customHex) }} /> : <Plus />}
              </label>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

function whoHas(item: ServiceBooking) {
  if (item.people) {
    const { mechanic, bay, rider } = item.people;
    if (item.stage >= 3 && item.stage <= 4 && (mechanic || bay)) return [mechanic ? firstName(mechanic) : null, bay].filter(Boolean).join(" in ");
    if (item.stage === 2) return rider ? `With ${firstName(rider)}` : "With our rider";
    return bookingStatus(item);
  }
  if (item.vehicleId === "guerrilla" && item.stage >= 3 && item.stage <= 4) return "Rahul in Bay 03";
  if (item.stage === 2) return "With Arjun";
  return bookingStatus(item);
}

function BookingCard({ item, onOpen, onAction, compact = false }: { item: ServiceBooking; onOpen: () => void; onAction?: (destination: string) => void; compact?: boolean }) {
  const vehicle = vehicles[item.vehicleId];
  const pending = item.extras.filter((extra) => extra.status === "pending");
  const inBay = item.stage >= 3 && item.stage <= 4;
  const pendingTotal = pending.reduce((sum, extra) => sum + extra.amount, 0);
  const homeTrack = compact && item.stage >= 2;
  const trackSteps = [
    { label: "Booked", stage: 0 },
    { label: "Picked up", stage: 2 },
    { label: "In bay", stage: 3 },
    { label: "Closed", stage: 5 },
    { label: "Delivered", stage: 6 },
  ];
  const trackIndex = trackSteps.reduce((current, step, index) => item.stage >= step.stage ? index : current, 0);
  const withWhom = whoHas(item);
  const action = pending.length
    ? { text: approvalNotice(item.extras), amount: pendingTotal, detail: `if you approve ${pending.length === 1 ? "it" : "all"}`, verb: "Review", destination: "Part approval" }
    : item.stage >= 5 && !item.paid
      ? { text: "Your invoice is ready", amount: billFor(item).total, detail: "now or at delivery", verb: "Pay", destination: "Job card closed + pay" }
      : null;
  if (homeTrack) {
    return (
      <div className="cx-booking cx-job">
        <div className="cx-job-bike">
          <b>{vehicle.name}</b>
          <Plate value={vehicle.plate} small />
        </div>
        <button
          className="cx-job-main"
          onClick={onOpen}
          aria-label={`${vehicle.name}, ${vehicle.plate}. ${item.eta}. ${withWhom}. ${serviceTitle(item)}. ${trackSteps[trackIndex].label}.`}
        >
          <span className="cx-job-when">
            <b>{item.eta.replace(/ today$/, "")}</b>
            <small>{item.eta.endsWith(" today") ? "Today. " : ""}{withWhom}. {serviceTitle(item)}.</small>
          </span>
          <span className="cx-segments" aria-hidden="true">
            {trackSteps.map((step, index) => (
              <span className={index < trackIndex ? "done" : index === trackIndex ? "now" : ""} key={step.label} />
            ))}
          </span>
          <span className="cx-job-steps" aria-hidden="true">
            {trackSteps.map((step, index) => (
              <small className={index === trackIndex ? "now" : index < trackIndex ? "done" : ""} key={step.label}>{step.label}</small>
            ))}
          </span>
        </button>
        {action && onAction && (
          <button className="cx-booking-action" onClick={() => onAction(action.destination)}>
            <span><b>{action.text}</b><small><strong>{inr(action.amount)}</strong> {action.detail}</small></span>
            <em>{action.verb}</em>
          </button>
        )}
        {inBay && (
          <button className="cx-job-bay" onClick={onOpen}>
            <i />
            <Video />
            See the bay
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`cx-booking${compact ? " compact" : ""}`}>
      <button className="cx-booking-card" onClick={onOpen}>
        <span className="cx-booking-art"><BikeArt tone={vehicle.tone} type={vehicle.type} /></span>
        <span className="cx-booking-copy">
          <span className="cx-booking-title"><b>{vehicle.name}</b><small>{vehicle.plate}</small></span>
          <small>{serviceTitle(item)}</small>
          <strong>{bookingStatus(item)}</strong>
          <small>{item.stage === 0 ? item.scheduled : item.eta}{inBay && <span className="cx-live-mark">Live</span>}</small>
        </span>
        <ChevronRight className="cx-chevron" />
      </button>
      {action && onAction && (
        <button className="cx-booking-action" onClick={() => onAction(action.destination)}>
          <span><b>{action.text}</b><small>{inr(action.amount)} {action.detail}</small></span>
          <em>{action.verb}</em>
        </button>
      )}
    </div>
  );
}

function sprocketPath(cx: number, cy: number) {
  const teeth = 30;
  const step = (Math.PI * 2) / teeth;
  const at = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const outline = Array.from({ length: teeth }, (_, i) => {
    const a = i * step;
    return [at(25, a), at(28, a + step * 0.24), at(28, a + step * 0.5), at(25, a + step * 0.74)].join(" L");
  }).join(" L");
  const hole = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
  const lightening = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return hole(cx + 14.5 * Math.cos(a), cy + 14.5 * Math.sin(a), 5);
  }).join("");
  return `M${outline}Z${lightening}${hole(cx, cy, 5.5)}`;
}

function SparesShelfArt() {
  return (
    <svg className="cx-bike cx-spares-art" viewBox="8 20 156 82" aria-hidden="true">
      <ellipse className="b-shadow" cx="44" cy="96" rx="25" ry="2" fill="rgb(0 0 0 / 12%)" />
      <ellipse className="b-shadow" cx="88" cy="96" rx="22" ry="2" fill="rgb(0 0 0 / 12%)" />
      <ellipse className="b-shadow" cx="106" cy="96.4" rx="32" ry="1.8" fill="rgb(0 0 0 / 12%)" />

      <path d={sprocketPath(88, 68)} fill="#8d9096" fillRule="evenodd" />
      <circle cx="88" cy="68" r="22.4" fill="none" stroke="#b9bbc0" strokeWidth="1.2" />
      <path d="M70 55 Q78 44 92 42" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />

      <path
        d="M22 96 V47 Q22 40 29 38 L32 37 V32 H45 V37 L59 39 Q66 40 66 47 V96 Z M54 43 H57 Q60 43 60 46 V49 Q60 52 57 52 H54 Q51 52 51 49 V46 Q51 43 54 43 Z"
        fill="#f6c31c"
        fillRule="evenodd"
      />
      <path d="M58 39.2 Q66 40 66 47 V96 H58 Z" fill="#000" fillOpacity="0.14" />
      <path d="M24.8 49 V90" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.4" />
      <rect x="27" y="56" width="34" height="30" rx="3" fill="#f1f1ee" />
      <path className="b-dark-fill" d="M27 64 V59 Q27 56 30 56 H58 Q61 56 61 59 V64 Z" fill="#1d1e21" />
      <path className="b-dark" d="M32 71 H54 M32 77 H47" fill="none" stroke="#1d1e21" strokeWidth="2" strokeLinecap="round" />
      <rect className="b-dark-fill" x="31" y="27" width="15" height="7" rx="2" fill="#1d1e21" />

      <rect x="72" y="88" width="6" height="5" rx="1.5" fill="#9c9fa5" />
      <path className="b-dark" d="M78 88 Q78 86 80 86 H101 L103 87.5 V94.5 L101 96 H80 Q78 96 78 94 Z" fill="#f1f1ee" stroke="#1d1e21" strokeWidth="1.2" />
      <path d="M83 86.8 V95.2 M86.5 86.8 V95.2 M90 86.8 V95.2" fill="none" stroke="#c9cbcf" strokeWidth="1" />
      <rect x="103" y="85" width="12" height="11" rx="1.5" fill="#9c9fa5" />
      <path d="M107 85.5 V95.5 M111 85.5 V95.5" fill="none" stroke="#7d8087" strokeWidth="1" />
      <rect x="115" y="87.5" width="13" height="7" fill="#c7c9cd" />
      <path d="M118 87.8 L117 94.2 M121.5 87.8 L120.5 94.2 M125 87.8 L124 94.2" fill="none" stroke="#8d9096" strokeWidth="1" />
      <path d="M128 89 H132 V93 H130" fill="none" stroke="#8d9096" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparesNote({ fitFor }: { fitFor: string }) {
  return (
    <a
      className="cx-spares"
      href="https://bikepharma.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Spares that fit your ${fitFor}, from our sister store Bike Pharma. Opens in a new tab`}
    >
      <span className="cx-spares-copy">
        <b>Spares that fit your {fitFor}</b>
        <small>From our sister store.</small>
        <span className="cx-spares-cta">Shop spares <ArrowUpRight /></span>
      </span>
      <SparesShelfArt />
      <span className="cx-spares-ledge"><i>Bike Pharma</i></span>
    </a>
  );
}

const bookingIntent: { vehicle: VehicleId | null; services: string[] | null } = { vehicle: null, services: null };

function takeBookingIntent() {
  const next = bookingIntent.vehicle ? { vehicle: bookingIntent.vehicle, services: bookingIntent.services ?? ["general"] } : null;
  bookingIntent.vehicle = null;
  bookingIntent.services = null;
  return next;
}

function startBooking(open: (screen: string) => void, vehicle: VehicleId, serviceIds: string[]) {
  bookingIntent.vehicle = vehicle;
  bookingIntent.services = serviceIds;
  open("Book service");
}

const offerBooking = { active: false, leaveTimer: 0 };

function offerServices(id: string) {
  const needs = offerList.find((offer) => offer.id === id)?.needs;
  if (needs === "wash") return ["general", "wash"];
  return needs ? [needs] : ["general"];
}

function bookWithOffer(
  open: (screen: string) => void,
  setState: React.Dispatch<React.SetStateAction<DemoState>>,
  id: string,
  vehicle?: VehicleId,
) {
  const offer = offerList.find((item) => item.id === id);
  setState((current) => ({ ...current, offer: id }));
  offerBooking.active = true;
  if (vehicle) startBooking(open, vehicle, offerServices(id));
  else open("Book service");
  if (offer) toast.success(`${offer.title} applied`, { description: "Pick a time and it comes off the bill." });
}

const spannerPath = "M563.54,85Q477.07,0,322,0,171.8,0,83.41,85.66,15.78,151.34.32,251.82H142.66a191.29,191.29,0,0,1,180-125.59c105.94,0,192.24,86,192.24,192.25s-86.3,192.24-192.24,192.24A191.78,191.78,0,0,1,142,383.85H0c10,69.23,37,125.26,80.83,168.74q86,84.52,236,84.37Q471.93,637,561,553.23q88.88-84,88.88-227.67Q649.84,170.51,563.54,85Z";

function Spanner({ className, bolt = "currentColor" }: { className?: string; bolt?: string }) {
  return (
    <svg className={className} viewBox="0 0 650 637" aria-hidden="true">
      <path fill="currentColor" d={spannerPath} />
      <polygon fill={bolt} points="302.3 403.24 582.62 403.24 582.62 233.7 302.3 233.7 253.36 318.47 302.3 403.24" />
    </svg>
  );
}

const offerLooks: Record<string, { tag: string; big: string }> = {
  first: { tag: "FIRST SERVICE", big: "₹150 OFF" },
  wash: { tag: "THIS WEEK", big: "FREE" },
  monsoon: { tag: "MONSOON CARE", big: "₹100 OFF" },
};
const offerTones = ["y", "d", "s"] as const;

const homeSteps = [
  { label: "Booked", stage: 0 },
  { label: "Picked up", stage: 2 },
  { label: "Servicing", stage: 3 },
  { label: "Job closed", stage: 5 },
  { label: "Delivered", stage: 6 },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

function readyTime(item: ServiceBooking) {
  return item.eta.match(/^Ready by (.+?)(?: today)?$/)?.[1] ?? null;
}

function pickupWhen(item: ServiceBooking) {
  return `Pickup ${briefWhen(item.scheduled).replace(/^(Today|Tomorrow)/, (day) => day.toLowerCase())}`;
}

function jobWhere(item: ServiceBooking) {
  if (item.stage === 0) return pickupWhen(item);
  if (item.stage === 1) return item.people ? headlineFor(item) : "Arjun is on his way";
  return whoHas(item);
}

type HomeRow = { key: string; title: string; status: string; pct: number; tone: "ok" | "warn"; icon: GarageIcon; act: () => void };

function HomeRowIcon({ icon }: { icon: GarageIcon }) {
  if (icon === "service") return <CalendarDays />;
  if (icon === "insurance") return <ShieldCheck />;
  if (icon === "puc") return <Leaf />;
  return <KeyRound />;
}

function HomeScreen({ state, setState, open, firstTime }: AppProps) {
  const [help, setHelp] = useState<null | { kind: "renew" | "puc"; vehicle: VehicleId }>(null);
  const garage: VehicleId[] = garageKeys(firstTime);
  const [bike, setBike] = useState<VehicleId>(garage[0]);
  const [slide, setSlide] = useState(0);
  const jobs = state.bookings.filter((item) => item.stage < 6).sort((a, b) => b.stage - a.stage);
  const job = jobs[0];
  const waiting = state.bookings.find((item) => item.extras.some((extra) => extra.status === "pending"));
  const pending = waiting?.extras.filter((extra) => extra.status === "pending") ?? [];
  const pendingTotal = pending.reduce((sum, extra) => sum + extra.amount, 0);
  const unread = firstTime ? 0 : unreadNotices(state).length;
  const offers = offersFor(firstTime);
  const lastPaid = state.payments[0];
  const shown = garage.includes(bike) ? bike : garage[0];
  const isFree = (key: VehicleId) => !state.bookings.some((item) => item.vehicleId === key && item.stage < 6);
  const offerBike = isFree(shown) ? shown : garage.find(isFree);
  const insuranceDoc = useDocPhoto(shown, "insurance");
  const pucDoc = useDocPhoto(shown, "puc");
  const openJob = (id: string, destination = "Track + live view") => {
    setState((current) => ({ ...current, selectedBookingId: id }));
    open(destination);
  };
  const openGarageLine = (key: VehicleId, line: GarageLine) => {
    if (line.act === "job") openJob(line.bookingId, line.screen);
    else if (line.act === "book") startBooking(open, key, line.services);
    else if (line.act === "warranty") open("Warranty tracker");
    else if (line.act === "garage") showInGarage(open, key);
    else setHelp({ kind: line.act, vehicle: key });
  };
  const rows: HomeRow[] = firstTime
    ? [
        { key: "service", title: "Next service", status: "Book your first", pct: 0, tone: "warn", icon: "service", act: () => startBooking(open, shown, ["general"]) },
        { key: "insurance", title: "Insurance", status: insuranceDoc.photo ? "Photo added" : "Not added", pct: insuranceDoc.photo ? 100 : 0, tone: insuranceDoc.photo ? "ok" : "warn", icon: "insurance", act: () => showDocInGarage(open, shown, "insurance") },
        { key: "puc", title: "PUC certificate", status: pucDoc.photo ? "Photo added" : "Not added", pct: pucDoc.photo ? 100 : 0, tone: pucDoc.photo ? "ok" : "warn", icon: "puc", act: () => showDocInGarage(open, shown, "puc") },
        { key: "warranty", title: "Warranty", status: "Not added", pct: 0, tone: "warn", icon: "warranty", act: () => open("Warranty tracker") },
      ]
    : garageCardLines(shown, state.bookings).map((line) => ({
        key: line.title,
        title: line.title,
        status: line.status,
        pct: line.pct,
        tone: line.tone === "ok" ? "ok" : "warn",
        icon: line.icon,
        act: () => openGarageLine(shown, line),
      }));
  const stepIndex = job ? homeSteps.reduce((current, step, index) => (job.stage >= step.stage ? index : current), 0) : 0;
  const inBay = job ? job.stage >= 3 && job.stage <= 4 : false;
  const ready = job ? readyTime(job) : null;
  return (
    <PhoneFrame tab="Home" onTab={open} tone="white">
      <GarageHelpSheet help={help} bookings={state.bookings} onOpenChange={(next) => { if (!next) setHelp(null); }} />
      <div className="ah">
        <Spanner className="ah-watermark" />
        <div className="ah-top ah-an" style={{ "--i": 0 } as React.CSSProperties}>
          <Spanner className="ah-mark" bolt="#f6c31c" />
          <div className="ah-hello"><small>{greeting()}</small><b>{firstName(state.profile.name)}</b></div>
          <button className="ah-wallet" aria-label={`Wallet, ${inr(state.wallet)}`} onClick={() => openWallet(open, "Home")}><Wallet /><span>{inr(state.wallet)}</span></button>
          <button className={`ah-bell${unread ? " ah-ringing" : ""}`} aria-label={unread ? `${unread} new notifications` : "Notifications"} onClick={() => open("Notifications")}>
            <Bell />
            {unread > 0 && <i />}
          </button>
        </div>

        {waiting && pending.length > 0 && (
          <button className="ah-approval ah-an" style={{ "--i": 1 } as React.CSSProperties} onClick={() => openJob(waiting.id, "Part approval")}>
            <span className="ah-ti dk"><Wrench /></span>
            <span className="ah-grow">
              <h4>Approval needed</h4>
              <p>{pending.length === 1 ? pending[0].part : `${pending[0].part} and ${pending.length - 1} more`}.<br />Replace for <b>{inr(pendingTotal)}</b>?</p>
            </span>
            <span className="ah-sbtn">REVIEW</span>
          </button>
        )}

        {job ? (
          <div
            className="ah-job ah-an"
            style={{ "--i": 2 } as React.CSSProperties}
            role="button"
            tabIndex={0}
            aria-label={`${serviceTitle(job)}, ${vehicles[job.vehicleId].name}. ${homeSteps[stepIndex].label}. ${job.eta}.`}
            onClick={() => openJob(job.id)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openJob(job.id); } }}
          >
            <div className="ah-row">
              <div className="ah-grow">
                <h3>{serviceTitle(job)}</h3>
                <div className="ah-meta">{vehicles[job.vehicleId].name} · {vehicles[job.vehicleId].plate}</div>
              </div>
              {inBay && (
                <button className="ah-live" onClick={(event) => { event.stopPropagation(); openJob(job.id); }}>
                  <span className="ah-rdot" />WATCH LIVE
                </button>
              )}
            </div>
            <div className="ah-steps" aria-hidden="true">
              <div className="ah-steps-base" />
              <div className="ah-steps-fill" style={{ width: `${stepIndex * 25}%` }} />
              {homeSteps.map((step, index) => {
                const mode = index < stepIndex || job.stage >= 6 ? "done" : index === stepIndex ? "cur" : "";
                return (
                  <span key={step.label}>
                    <i className={`ah-node ${mode}`} style={{ left: `${index * 25}%` }}>{mode === "done" && <Check strokeWidth={3.2} />}</i>
                    <small className={`ah-node-label ${mode}`} style={{ left: `${index * 25}%` }}>{step.label}</small>
                  </span>
                );
              })}
            </div>
            <div className="ah-job-foot">
              <span>{jobWhere(job)}</span>
              <span>{ready ? <>Ready by <b>{ready}</b></> : <b>{job.eta}</b>}</span>
            </div>
          </div>
        ) : (
          <div className="ah-job ah-job-start ah-an" style={{ "--i": 2 } as React.CSSProperties}>
            <h3>{firstTime ? "Book your first service" : "No bike in the workshop"}</h3>
            <div className="ah-meta">{vehicles[shown].name} · {vehicles[shown].plate}</div>
            <p>We collect it from your door, service it and bring it back. You pay after the work.</p>
            <div className="ah-job-foot">
              <span>General service <b>{inr(services.find((service) => service.id === "general")?.price ?? 1499)}</b></span>
              <button className="ah-sbtn y" onClick={() => startBooking(open, shown, ["general"])}>BOOK NOW</button>
            </div>
          </div>
        )}

        {jobs.slice(1).map((item) => (
          <button key={item.id} className="ah-bord ah-row ah-more ah-an" style={{ "--i": 2 } as React.CSSProperties} onClick={() => openJob(item.id)}>
            <span className="ah-ti s"><CalendarDays /></span>
            <span className="ah-grow"><span className="ah-t1">{vehicles[item.vehicleId].name}, {serviceTitle(item).toLowerCase()}</span><span className="ah-t2">{item.stage === 0 ? pickupWhen(item) : bookingStatus(item)}</span></span>
            <ChevronRight className="ah-chev" />
          </button>
        ))}

        <div className="ah-an" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="ah-sech"><h3>Offers for you</h3><button onClick={() => open("Offers")}>See all</button></div>
          <div className="ah-car" onScroll={(event) => {
            const el = event.currentTarget;
            const card = el.firstElementChild as HTMLElement | null;
            if (card) setSlide(Math.round(el.scrollLeft / (card.offsetWidth + 12)));
          }}>
            {offers.map((offer, index) => {
              const look = offerLooks[offer.id] ?? { tag: "OFFER", big: offer.big };
              const tone = offerTones[index % offerTones.length];
              const saved = state.offer === offer.id;
              return (
                <div key={offer.id} className={`ah-offer ${tone}`}>
                  <svg className="ah-offer-art" viewBox="0 0 650 637" aria-hidden="true"><path d={spannerPath} /></svg>
                  <h5>{look.tag}</h5>
                  <div className="ah-big">{look.big}</div>
                  <div className="ah-sub">{offer.line.charAt(0).toUpperCase() + offer.line.slice(1)}</div>
                  <button className="ah-claim" onClick={() => bookWithOffer(open, setState, offer.id, offerBike)}>BOOK THE SERVICE</button>
                  <span className="ah-till">{saved ? "In your wallet" : offer.till}</span>
                </div>
              );
            })}
          </div>
          {offers.length > 1 && <div className="ah-dots" aria-hidden="true">{offers.map((offer, index) => <i key={offer.id} className={index === Math.min(slide, offers.length - 1) ? "on" : ""} />)}</div>}
        </div>

        <div className="ah-an" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="ah-sech"><h3>My vehicles</h3><button onClick={() => open("Garage & history")}>My Garage</button></div>
          <div className="ah-chips" role="tablist" aria-label="Your vehicles">
            {garage.map((key) => (
              <button key={key} role="tab" aria-selected={key === shown} className={`ah-chip${key === shown ? " on" : ""}`} onClick={() => setBike(key)}>{vehicles[key].name}</button>
            ))}
            <button className="ah-chip add" onClick={() => showAddVehicle(open)}>+ Add vehicle</button>
          </div>
          <div className="ah-veh">
            <button className="ah-veh-head" onClick={() => showInGarage(open, shown)}>
              <span className="ah-veh-art"><BikeArt tone={vehicles[shown].tone} type={vehicles[shown].type} /></span>
              <span className="ah-grow">
                <span className="ah-t1">{vehicles[shown].make} {vehicles[shown].name}</span>
                <span className="ah-plate"><i>IND</i>{vehicles[shown].plate}</span>
              </span>
              <ChevronRight className="ah-chev" />
            </button>
            {rows.map((row) => (
              <button key={row.key} className="ah-rem" onClick={row.act}>
                <span className="ah-ti s w"><HomeRowIcon icon={row.icon} /></span>
                <span className="ah-rem-body">
                  <span className="ah-rem-top"><b>{row.title}</b><small>{row.status}</small></span>
                  <span className="ah-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.pct} aria-label={`${row.title} remaining`}>
                    <i className={row.tone} style={{ width: `${row.pct}%` }} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="ah-an ah-spares-note" style={{ "--i": 5 } as React.CSSProperties}>
          <SparesNote fitFor={firstTime ? "bike" : "bikes"} />
        </div>

        <RoadsideDialog>
          <button className="ah-sos ah-an" style={{ "--i": 6 } as React.CSSProperties}>
            <span className="ah-ti s"><TriangleAlert /></span>
            <span className="ah-grow"><span className="ah-t1">Breakdown on the road?</span><span className="ah-t2">Get roadside help in minutes</span></span>
            <ChevronRight className="ah-chev" />
          </button>
        </RoadsideDialog>

        {lastPaid && (
          <div className="ah-an" style={{ "--i": 7 } as React.CSSProperties}>
            <div className="ah-sech"><h3>Service history</h3><button onClick={() => openPaymentHistory(open, "Home")}>See all</button></div>
            <button
              className="ah-bord ah-row ah-history"
              onClick={() => {
                setState((current) => ({ ...current, viewingPaymentId: lastPaid.id, selectedBookingId: lastPaid.bookingId ?? null }));
                open("Job card closed + pay");
              }}
            >
              <span className="ah-ti"><Cog /></span>
              <span className="ah-grow"><span className="ah-t1">{lastPaid.service}, {vehicles[lastPaid.vehicleId].name}</span><span className="ah-t2">{lastPaid.when} · {inr(lastPaid.total)} · Paid</span></span>
              <span className="ah-inv"><Download strokeWidth={2.4} />Invoice</span>
            </button>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

const slotHours: Record<string, [number, number]> = { "9–11 AM": [9, 11], "11 AM–1 PM": [11, 13], "2–4 PM": [14, 16], "4–6 PM": [16, 18] };

function nextDays() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index);
    return [index === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" }), String(date.getDate())];
  });
}

function BookingScreen({ state, setState, open, firstTime }: AppProps) {
  const fromGarage = useFromGarage();
  const [intent] = useState(() => takeBookingIntent());
  const [viaOffer] = useState(() => offerBooking.active);
  const booked = useRef(false);
  useEffect(() => {
    offerBooking.active = false;
    window.clearTimeout(offerBooking.leaveTimer);
    return () => {
      if (!viaOffer || booked.current) return;
      offerBooking.leaveTimer = window.setTimeout(() => {
        toast("Your offers have been added to the wallet and will apply automatically when booking the next service.");
      }, 0);
    };
  }, [viaOffer]);
  const [step, setStep] = useState(0);
  const [bike, setBike] = useState<VehicleId>(() => intent?.vehicle
    ?? (onServer ? liveGarage.find((key) => !state.bookings.some((item) => item.vehicleId === key && item.stage < 6)) ?? liveGarage[0] : firstTime ? "guerrilla" : "access"));
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const vehicle = vehicles[bike];
  const bikeChoices = onServer ? liveGarage : (firstTime ? ["guerrilla"] : ["guerrilla", "classic", "access"]) as VehicleId[];
  const [category, setCategory] = useState("All");
  const [applied, setApplied] = useState<string | null>(() => state.offer ?? (firstTime ? "first" : null));
  const [cart, setCart] = useState(() => {
    if (intent?.services.length) return intent.services;
    return state.offer ? offerServices(state.offer) : ["general"];
  });
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [mode, setMode] = useState<"pickup" | "visit">("pickup");
  const [day, setDay] = useState(() => (onServer && new Date().getHours() >= 14 ? 1 : 0));
  const [slot, setSlot] = useState("2–4 PM");
  const pager = useRef<HTMLDivElement>(null);
  const jumpingTo = useRef<number | null>(null);
  const goToCategory = (item: string) => {
    const index = serviceCategories.indexOf(item);
    const el = pager.current;
    setCategory(item);
    haptic.select();
    if (!el) return;
    jumpingTo.current = index;
    el.scrollTo({ left: index * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  useLayoutEffect(() => {
    const el = pager.current;
    if (el) el.scrollLeft = serviceCategories.indexOf(category) * el.clientWidth;
  }, [step]);
  const onPagerScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (jumpingTo.current !== null) {
      if (index === jumpingTo.current && Math.abs(el.scrollLeft - index * el.clientWidth) < 2) jumpingTo.current = null;
      return;
    }
    const next = serviceCategories[index];
    if (next && next !== category) {
      setCategory(next);
      haptic.select();
    }
  };
  const subtotal = cart.reduce((sum, id) => sum + (services.find((service) => service.id === id)?.price || 0), 0);
  const offer = offerList.find((item) => item.id === applied);
  const discount = offer && offerFits(offer, cart) ? Math.min(offer.amount, subtotal) : 0;
  const taxableNow = Math.max(0, subtotal - discount);
  const taxNow = Math.round(taxableNow * GST_RATE);
  const estimatedNow = taxableNow + taxNow;
  const availableOffers = offersFor(firstTime);
  const fittingOffers = availableOffers.filter((item) => offerFits(item, cart)).sort((a, b) => b.amount - a.amount);
  const lockedOffers = availableOffers.filter((item) => !offerFits(item, cart));
  const activeOffer = discount > 0 ? offer : null;
  const suggestedOffer = activeOffer ?? fittingOffers[0] ?? null;
  const offerBlock = (item: (typeof offerList)[number]) => item.needs === "wash"
    ? "Add a foam wash with another service"
    : item.needs === "brake"
      ? "Add a brake inspection"
      : "Not for this booking";
  const applyOffer = (id: string) => {
    setApplied(id);
    setCouponsOpen(false);
    const item = offerList.find((entry) => entry.id === id);
    if (item) toast.success(`${item.title} applied`);
  };
  const bikeUnavailable = state.bookings.some((item) => item.vehicleId === bike && item.stage < 6);
  const days = onServer ? nextDays() : [["Today", "27"], ["Mon", "28"], ["Tue", "29"], ["Wed", "30"], ["Thu", "1"], ["Fri", "2"]];
  const pickupAddress = state.addresses[0];
  const slotGone = (item: string, dayIndex: number) => onServer
    ? dayIndex === 0 && (slotHours[item]?.[0] ?? 0) <= new Date().getHours()
    : dayIndex === 0 && ["9–11 AM", "11 AM–1 PM"].includes(item);
  const timeOk = !onServer || (!slotGone(slot, day) && (mode === "visit" || Boolean(pickupAddress)));
  const when = `${day === 0 ? "Today" : `${days[day][0]} ${days[day][1]}`}, ${slot}`;
  const titles = ["What does it need?", "When should we come?", "Check and confirm"];
  const confirm = () => {
    if (onServer) {
      const [from, to] = slotHours[slot] ?? [14, 16];
      const base = new Date();
      const at = (hour: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + day, hour).toISOString();
      setBusy(true);
      api<{ id: string; number: string }>("/v1/bookings", {
        body: {
          vehicleId: bike,
          serviceIds: cart,
          mode,
          slotStart: at(from),
          slotEnd: at(to),
          pickupAddressId: mode === "pickup" ? pickupAddress?.id ?? null : null,
          offerId: discount > 0 ? applied : null,
        },
      })
        .then(async (created) => {
          booked.current = true;
          await reloadLive();
          setState((current) => ({ ...current, selectedBookingId: created.number, offer: null }));
          setCreatedId(created.number);
          toast.success("Booking confirmed");
          setStep(3);
        })
        .catch((error) => toast.error(messageOf(error)))
        .finally(() => setBusy(false));
      return;
    }
    const id = `BS-2026-${String(126 + state.bookings.length).padStart(6, "0")}`;
    const item: ServiceBooking = {
      id,
      vehicleId: bike,
      serviceIds: cart,
      stage: 0,
      extras: [],
      paid: false,
      scheduled: when,
      eta: mode === "pickup" ? `Pickup ${when.toLowerCase()}` : `Drop-off ${when.toLowerCase()}`,
      mode,
      estimate: subtotal - discount,
    };
    booked.current = true;
    setState((current) => ({ ...current, bookings: [...current.bookings, item], selectedBookingId: id, offer: null }));
    setCreatedId(id);
    toast.success("Booking confirmed");
    setStep(3);
  };

  const footer =
    step === 0 ? (
      <div className="cx-footer-row">
        <div><b>{inr(subtotal)}</b><small>{cart.length} {cart.length === 1 ? "service" : "services"}, before GST</small></div>
        <button className="cx-btn cx-btn-primary" disabled={!cart.length || bikeUnavailable} onClick={() => setStep(1)}>Choose a time</button>
      </div>
    ) : step === 1 ? (
      <div className="cx-footer-row">
        <div><b>{when}</b><small>{mode === "pickup" ? "Pickup from home" : "At the workshop"}</small></div>
        <button className="cx-btn cx-btn-primary" disabled={!timeOk} onClick={() => setStep(2)}>Review</button>
      </div>
    ) : step === 2 ? (
      <div className="cx-footer-row">
        <div><b>{inr(estimatedNow)}</b><small>Estimate with GST</small></div>
        <button className="cx-btn cx-btn-primary" disabled={busy} onClick={confirm}>Confirm booking</button>
      </div>
    ) : undefined;

  if (step === 3) {
    return (
      <PhoneFrame
        tone="white"
        footer={
          <div className="cx-stack">
            <button className="cx-btn cx-btn-primary" onClick={() => open("Track + live view")}>Track booking</button>
            <button className="cx-btn cx-btn-quiet" onClick={() => {
              setStep(0);
              setCreatedId(null);
              setApplied(null);
            }}>Book another service</button>
            <button className="cx-btn cx-btn-quiet" onClick={() => open("Home")}>Back to home</button>
          </div>
        }
      >
        <div className="cx-done">
          <span><Check /></span>
          <h1>You’re booked</h1>
          <p>{onServer ? (mode === "pickup" ? "We’ll collect your" : "Bring your") : "Arjun will collect your"} {vehicle.name} {when.toLowerCase().startsWith("today") ? "today" : "on " + when.split(",")[0]} between {slot}.</p>
        </div>
        <Group>
          <Row title="Booking" value={createdId ?? "Confirmed"} />
          <Row title="Pickup" value={when} />
          <Row title="Estimate" value={inr(estimatedNow)} detail="Includes GST" />
        </Group>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame footer={footer}>
      <TopBar title="Book a service" onBack={step ? () => setStep((value) => value - 1) : () => (fromGarage ? backToGarage(open) : open("Home"))} />
      <div className="cx-stepper">
        <Segments value={step} total={3} />
        <h1>{titles[step]}</h1>
      </div>

      {step === 0 && (
        <>
          <div className="cx-vehicle-pick">
            <BikeArt tone={vehicle.tone} type={vehicle.type} className="thumb" />
            <span><b>{vehicle.name}</b><Plate value={vehicle.plate} small /></span>
            <button type="button" aria-expanded={picking} onClick={() => setPicking((open) => !open)}>Change</button>
          </div>
          {bikeUnavailable && <p className="cx-booking-warning">This bike already has an active or upcoming service. Choose another bike to continue.</p>}
          {picking && (
            <div className="cx-list" role="listbox" aria-label="Your bikes">
              {bikeChoices.map((id) => {
                const item = vehicles[id];
                const selected = id === bike;
                const unavailable = state.bookings.some((serviceBooking) => serviceBooking.vehicleId === id && serviceBooking.stage < 6);
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={unavailable}
                    className={`cx-bike-option${selected ? " selected" : ""}`}
                    onClick={() => {
                      setBike(id);
                      setPicking(false);
                    }}
                  >
                    <span className="cx-bike-option-art"><BikeArt tone={item.tone} type={item.type} /></span>
                    <span className="cx-row-text"><b>{item.name}</b><small>{unavailable ? "Already has a booking" : `${item.make}, ${item.colour}`}</small></span>
                    <span className="cx-tick">{selected && <Check />}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="cx-segmented" role="tablist" aria-label="Service type">
            {serviceCategories.map((item) => (
              <button key={item} role="tab" aria-selected={category === item} onClick={() => goToCategory(item)}>{item}</button>
            ))}
          </div>
          <div className="cx-pager" ref={pager} onScroll={onPagerScroll} data-swipe-pager>
            {serviceCategories.map((item) => (
              <div key={item} className="cx-pager-page" role="tabpanel" aria-label={item} aria-hidden={item !== category}>
                <div className="cx-list">
                  {services.filter((service) => item === "All" || service.type === item).map((service) => {
                    const selected = cart.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        className={`cx-row cx-pick ${selected ? "selected" : ""}`}
                        aria-pressed={selected}
                        tabIndex={item === category ? 0 : -1}
                        onClick={() => setCart((current) => selected ? current.filter((id) => id !== service.id) : [...current, service.id])}
                      >
                        <span className="cx-tick">{selected && <Check />}</span>
                        <span className="cx-row-text"><b>{service.name}</b><small>{service.detail}</small></span>
                        <span className="cx-row-value">{inr(service.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="cx-segmented">
            <button aria-selected={mode === "pickup"} onClick={() => setMode("pickup")}>Pick up from me</button>
            <button aria-selected={mode === "visit"} onClick={() => setMode("visit")}>I’ll drop it off</button>
          </div>
          <Group>
            {mode === "pickup"
              ? onServer
                ? <Row lead={<MapPin />} title={pickupAddress?.label ?? "Add a pickup address"} detail={pickupAddress ? pickupAddress.area : "Where the rider collects the bike"} value={<button className="cx-link" onClick={() => open("Add address")}>{pickupAddress ? "Change" : "Add"}</button>} />
                : <Row lead={<MapPin />} title="Home" detail="BTM 2nd Stage, Bengaluru" value={<button className="cx-link">Change</button>} />
              : <Row lead={<Warehouse />} title="Bike Surgeon, Davangere" detail="Open till 8 PM, 2.4 km away" value={<button className="cx-link" onClick={() => window.open("https://www.google.com/maps/dir/?api=1&destination=14.4734864,75.8880148", "_blank", "noopener,noreferrer")}>Map</button>} />}
          </Group>
          <section className="cx-group">
            <div className="cx-group-head"><h3>{onServer ? new Date().toLocaleDateString("en-IN", { month: "long" }) : "September"}</h3></div>
            <div className="cx-days">
              {days.map(([label, date], index) => (
                <button key={date} aria-pressed={day === index} onClick={() => setDay(index)}>
                  <small>{label}</small><b>{date}</b>
                </button>
              ))}
            </div>
          </section>
          <section className="cx-group">
            <div className="cx-group-head"><h3>{mode === "pickup" ? "Pickup window" : "Drop-off window"}</h3></div>
            <div className="cx-slots">
              {["9–11 AM", "11 AM–1 PM", "2–4 PM", "4–6 PM"].map((item, index) => {
                const gone = slotGone(item, day);
                return (
                  <button key={item} aria-pressed={slot === item} disabled={gone} onClick={() => setSlot(item)}>
                    {item}
                    <small>{gone ? "Passed" : index === 3 && !onServer ? "2 left" : "Open"}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {step === 2 && (
        <>
          <Group>
            <Row lead={<BikeArt tone={vehicle.tone} type={vehicle.type} className="thumb" />} title={vehicle.name} detail={<Plate value={vehicle.plate} small />} />
            <Row lead={<CalendarDays />} title={when} detail={mode === "pickup" ? `Pickup from ${onServer ? pickupAddress?.area ?? "your address" : "BTM 2nd Stage"}` : "Drop-off at Davangere"} />
          </Group>
          <section className="cx-coupon" aria-label="Offer">
            {activeOffer ? (
              <div className="cx-coupon-main">
                <Gift />
                <span>
                  <b>{activeOffer.title}</b>
                  <small>Saving {inr(discount)} on this booking</small>
                </span>
                <button className="cx-coupon-apply" onClick={() => setApplied(null)}>Remove</button>
              </div>
            ) : suggestedOffer ? (
              <button className="cx-coupon-main" onClick={() => applyOffer(suggestedOffer.id)}>
                <Gift />
                <span>
                  <b>{suggestedOffer.title}</b>
                  <small>Save {inr(suggestedOffer.amount)} · {suggestedOffer.till}</small>
                </span>
                <span className="cx-coupon-apply">Apply</span>
              </button>
            ) : (
              <button className="cx-coupon-main" onClick={() => { setShowLocked(true); setCouponsOpen(true); }}>
                <Gift />
                <span>
                  <b>Apply a coupon</b>
                  <small>Nothing here fits this booking yet</small>
                </span>
                <ChevronRight />
              </button>
            )}
            {(suggestedOffer || activeOffer) && availableOffers.length > 1 && (
              <button className="cx-coupon-more" onClick={() => { setShowLocked(false); setCouponsOpen(true); }}>
                View all coupons
                <ChevronRight />
              </button>
            )}
          </section>
          <div className="cx-group-head"><h3>Price estimate</h3><small>Before extra parts</small></div>
          <section className="cx-receipt">
            {cart.map((id) => {
              const item = services.find((service) => service.id === id);
              return item ? <Line key={id} label={item.name} value={inr(item.price)} /> : null;
            })}
            <Line label={mode === "pickup" ? "Pickup and delivery" : "Workshop visit"} value="Free" />
            {discount > 0 && offer && <Line label={offer.title} value={`−${inr(discount)}`} />}
            <Line label="GST 18%" value={inr(taxNow)} />
            <Line label="Estimated total" value={inr(estimatedNow)} total />
            <p>The package price is fixed. Extra parts are a separate approval, then they join the invoice.</p>
          </section>
          <Sheet open={couponsOpen} onOpenChange={setCouponsOpen}>
            <PhoneSheet side="bottom" className="cx-sheet">
              <SheetHeader>
                <SheetTitle>Coupons</SheetTitle>
                <SheetDescription>The best one for this booking is at the top.</SheetDescription>
              </SheetHeader>
              <div className="cx-sheet-body">
                {fittingOffers.length > 0 && (
                  <div className="cx-list">
                    {fittingOffers.map((item) => {
                      const on = activeOffer?.id === item.id;
                      return (
                        <div className="cx-row" key={item.id}>
                          <span className="cx-row-text">
                            <b>{item.title}</b>
                            <small>{item.detail}. {item.till}.</small>
                          </span>
                          {on
                            ? <span className="cx-coupon-applied">Applied</span>
                            : <button className="cx-coupon-apply" onClick={() => applyOffer(item.id)}>Apply</button>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {lockedOffers.length > 0 && (
                  <>
                    <button className="cx-coupon-locked" aria-expanded={showLocked} onClick={() => setShowLocked((value) => !value)}>
                      {lockedOffers.length} {lockedOffers.length === 1 ? "coupon" : "coupons"} that don’t apply
                      <ChevronDown />
                    </button>
                    {showLocked && (
                      <div className="cx-list">
                        {lockedOffers.map((item) => (
                          <div className="cx-row cx-coupon-off" key={item.id}>
                            <span className="cx-row-text">
                              <b>{item.title}</b>
                              <small>{offerBlock(item)}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </PhoneSheet>
          </Sheet>
        </>
      )}
    </PhoneFrame>
  );
}

function CameraFeed({ item }: { item?: ServiceBooking }) {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(() => new Date());
  const [live, setLive] = useState(true);
  const [full, setFull] = useState(false);
  const [feed, setFeed] = useState<"loading" | "on" | "off">(onServer ? "loading" : "on");
  const bay = item?.people?.bay ?? "Bay 03";
  const uuid = item?.uuid;
  useEffect(() => {
    if (!onServer || !uuid) return;
    let cancelled = false;
    let timer = 0;
    let stopPlayer: (() => void) | null = null;
    const later = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(start, ms);
    };
    async function start() {
      try {
        const camera = await api<{ playbackUrl: string; expiresAt: string }>(`/v1/bookings/${uuid}/camera`);
        if (cancelled || !video.current) return;
        stopPlayer?.();
        stopPlayer = await playStream(video.current, camera.playbackUrl, () => {
          if (!cancelled) later(5000);
        });
        if (cancelled) return stopPlayer();
        setFeed("on");
        later(Math.max(30_000, new Date(camera.expiresAt).getTime() - Date.now() - 60_000));
      } catch {
        if (cancelled) return;
        setFeed("off");
        later(20_000);
      }
    }
    start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopPlayer?.();
    };
  }, [uuid]);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    const onChange = () => setFull(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);
  const stop = () => {
    video.current?.pause();
    setLive(false);
  };
  const goLive = () => {
    const el = video.current;
    if (onServer && el && el.seekable.length) el.currentTime = el.seekable.end(el.seekable.length - 1);
    el?.play();
    setLive(true);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.current?.requestFullscreen();
  };
  return (
    <div className={`cx-feed ${live && feed === "on" ? "is-live" : "is-stopped"}`} ref={stage}>
      <video ref={video} src={onServer ? undefined : "/bay-cam.mp4"} autoPlay muted loop={!onServer} playsInline aria-label={`${bay} live camera`} />
      <div className="cx-feed-top">
        <span>{bay}</span>
        <span className="cx-feed-clock">{time.toLocaleTimeString("en-GB")}</span>
      </div>
      {(!live || feed === "off") && <div className="cx-feed-paused">Camera stopped</div>}
      {live && feed === "loading" && <div className="cx-feed-paused">Connecting to the bay camera…</div>}
      <div className="cx-feed-controls">
        <button type="button" onClick={stop} disabled={!live} aria-label="Stop"><Square /></button>
        <button type="button" className={`cx-live-btn ${live ? "on" : ""}`} onClick={goLive} aria-pressed={live}><i />Live</button>
        <button type="button" onClick={toggleFull} aria-label={full ? "Exit fullscreen" : "Fullscreen"}>{full ? <Minimize /> : <Maximize />}</button>
      </div>
    </div>
  );
}

const visitTags = ["On time", "Fair price", "Work explained", "Bike feels better", "Tell us more"];
const nextInterests = [
  ["next", "Next service"],
  ["chain", "Chain clean soon"],
  ["tyres", "A tyre check"],
  ["friend", "A friend who rides"],
] as const;

function ServiceReview({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: ServiceBooking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const vehicle = vehicles[item.vehicleId];
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const [leads, setLeads] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const work = [
    ...item.serviceIds.map(serviceName).filter((name): name is string => Boolean(name)),
    ...item.extras.filter((extra) => extra.status === "approved").map((extra) => extra.id === "pads" ? "Brake pads" : extra.id === "chain" ? "Chain lube" : onServer ? extra.part : "Extra work"),
  ];
  const pickup = item.mode === "pickup";
  const person = item.people
    ? (pickup ? item.people.rider : item.people.advisor) || (pickup ? "Our rider" : "The workshop team")
    : pickup ? "Arjun K." : "Amit Patil";
  const personNote = item.people
    ? pickup ? `Delivered by ${person}.` : `Seen by ${person} at the workshop.`
    : pickup ? "Delivered by Arjun K." : "Seen by Amit at the workshop.";
  const happy = stars >= 4;
  const toggle = (list: string[], value: string, set: (next: string[]) => void) => {
    set(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  };
  const vote = (name: string, mark: "up" | "down") => {
    setVotes((current) => {
      const next = { ...current };
      if (next[name] === mark) delete next[name];
      else next[name] = mark;
      return next;
    });
  };
  const submit = () => {
    const asked = nextInterests.filter(([id]) => leads.includes(id)).map(([, label]) => label);
    const liked = work.filter((name) => votes[name] === "up");
    const follow = [
      ...asked,
      ...liked.map((name) => `${name} again`),
      ...(votes.person === "up" ? [`${firstName(person)} for the next ${pickup ? "pickup" : "visit"}`] : []),
    ];
    if (onServer && item.uuid) {
      const workVotes = Object.fromEntries(Object.entries(votes).filter(([name]) => name !== "person"));
      api(`/v1/bookings/${item.uuid}/review`, {
        body: { stars, tags: tags.filter((tag) => tag !== "Tell us more"), note: note.trim() || null, workVotes, staffVote: votes.person ?? null, followUpInterests: follow.slice(0, 10).map((text) => text.slice(0, 60)) },
      }).catch((error) => toast.error(messageOf(error)));
    }
    if (happy && follow.length) {
      toast.success(follow.length === 1 ? `We’ll follow up: ${follow[0]}.` : `We’ll follow up on ${follow.length} things you asked for.`);
    } else if (happy) {
      toast.success("Thanks. Glad the bike is back with you.");
    } else {
      toast.success("Thanks. We’ll look at what went wrong.");
    }
    onDone();
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <PhoneSheet side="bottom" className="cx-sheet cx-review-sheet">
        <SheetHeader>
          <SheetTitle>How was your service?</SheetTitle>
          <SheetDescription>{item.eta.startsWith("Delivered") ? item.eta : `${vehicle.name}, back with you the same day.`}</SheetDescription>
        </SheetHeader>
        <div className="cx-review">
          <div className="cx-review-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" role="radio" aria-checked={stars === star} aria-label={`${star} stars`} onClick={() => setStars(star)}>
                <Star className={star <= stars ? "on" : ""} />
              </button>
            ))}
          </div>
          <div className="cx-chips">
            {visitTags.map((tag) => (
              <button key={tag} type="button" className={tags.includes(tag) ? "on" : ""} aria-pressed={tags.includes(tag)} onClick={() => toggle(tags, tag, setTags)}>
                {tag}{tag === "Tell us more" ? "…" : ""}
              </button>
            ))}
          </div>
          {tags.includes("Tell us more") && <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should we know?" />}
          <section className="cx-review-block">
            <h3>How was the work?</h3>
            {work.map((name) => (
              <div className="cx-thumb-row" key={name}>
                <b>{name}</b>
                <span className="cx-thumbs">
                  <button type="button" aria-label={`Not happy with ${name}`} aria-pressed={votes[name] === "down"} className={votes[name] === "down" ? "on-down" : ""} onClick={() => vote(name, "down")}><ThumbsDown /></button>
                  <button type="button" aria-label={`Happy with ${name}`} aria-pressed={votes[name] === "up"} className={votes[name] === "up" ? "on-up" : ""} onClick={() => vote(name, "up")}><ThumbsUp /></button>
                </span>
              </div>
            ))}
          </section>
          <section className="cx-review-block">
            <h3>{pickup ? "How was pickup?" : "How was the workshop?"}</h3>
            <p>{personNote}</p>
            <div className="cx-thumb-row">
              <b>{person}</b>
              <span className="cx-thumbs">
                <button type="button" aria-label="Not happy with them" aria-pressed={votes.person === "down"} className={votes.person === "down" ? "on-down" : ""} onClick={() => vote("person", "down")}><ThumbsDown /></button>
                <button type="button" aria-label="Happy for them to do the next one" aria-pressed={votes.person === "up"} className={votes.person === "up" ? "on-up" : ""} onClick={() => vote("person", "up")}><ThumbsUp /></button>
              </span>
            </div>
          </section>
          {happy && (
            <section className="cx-review-block">
              <h3>What should we line up next?</h3>
              <p>We’ll follow up. Nothing is booked until you confirm.</p>
              <div className="cx-chips">
                {nextInterests.map(([id, label]) => (
                  <button key={id} type="button" className={leads.includes(id) ? "on" : ""} aria-pressed={leads.includes(id)} onClick={() => toggle(leads, id, setLeads)}>
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}
          {stars > 0 && stars < 4 && !tags.includes("Tell us more") && <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should we fix?" />}
          <button type="button" className="cx-btn cx-btn-primary" disabled={stars === 0} onClick={submit}>Submit review</button>
        </div>
      </PhoneSheet>
    </Sheet>
  );
}

function Tracker({ state, setState, open }: AppProps) {
  const item = selectedBooking(state);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  useEffect(() => {
    setReviewOpen(false);
  }, [item?.id]);
  if (!item && state.bookings.length === 0) {
    return (
      <PhoneFrame
        tab="Bookings"
        onTab={open}
        footer={<button className="cx-btn cx-btn-primary" onClick={() => open("Book service")}>Book a service</button>}
      >
        <TopBar title="Bookings" edge action={<button className="cx-topbar-estimate" onClick={() => openPaymentHistory(open, "Track + live view")}><ReceiptIndianRupee />Payment history</button>} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>No bookings yet</h1>
          <p>Pickup, the live bay camera and every update will show up here once you book.</p>
        </div>
      </PhoneFrame>
    );
  }
  if (!item) {
    const sections = [
      ["Active", state.bookings.filter((bookingItem) => bookingItem.stage > 0 && bookingItem.stage < 6)],
      ["Upcoming", state.bookings.filter((bookingItem) => bookingItem.stage === 0)],
      ["Completed", state.bookings.filter((bookingItem) => bookingItem.stage >= 6)],
    ] as const;
    return (
      <PhoneFrame tab="Bookings" onTab={open}>
        <TopBar title="Bookings" edge action={<button className="cx-topbar-estimate" onClick={() => openPaymentHistory(open, "Track + live view")}><ReceiptIndianRupee />Payment history</button>} />
        <div className="cx-heading">
          <h1>All your services</h1>
          <p>Each booking keeps its own updates, approvals and bill.</p>
        </div>
        {sections.map(([title, items]) => items.length > 0 && (
          <section className="cx-group cx-booking-section" key={title}>
            <div className="cx-group-head"><h3>{title}</h3><small>{items.length}</small></div>
            <div className="cx-booking-list">
              {items.map((bookingItem) => (
                <BookingCard
                  key={bookingItem.id}
                  item={bookingItem}
                  onOpen={() => setState((current) => ({ ...current, selectedBookingId: bookingItem.id }))}
                  onAction={(destination) => {
                    setState((current) => ({ ...current, selectedBookingId: bookingItem.id }));
                    open(destination);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </PhoneFrame>
    );
  }
  const vehicle = vehicles[item.vehicleId];
  const inBay = item.stage >= 3 && item.stage <= 4;
  const bill = billFor(item);
  const linked = state.payments.find((entry) => entry.bookingId === item.id);
  const pending = item.extras.filter((extra) => extra.status === "pending");
  const ready = readyTime(item);
  const crew = item.people;
  const riderFirst = crew?.rider ? firstName(crew.rider) : null;
  const stepNote = (index: number) => {
    if (index <= item.stage && crew) {
      return [
        "Booking confirmed",
        riderFirst ? `${riderFirst} is on the way` : "A rider is on the way",
        riderFirst ? `${riderFirst} has your bike` : "Our rider has your bike",
        "Checked in at Bike Surgeon",
        inBay ? (crew.mechanic || crew.bay ? `${crew.mechanic ? firstName(crew.mechanic) : "The mechanic"} is working on it${crew.bay ? ` in ${crew.bay}` : ""}` : "Being serviced") : "Work done",
        "Job card closed",
        "Back with you",
      ][index];
    }
    if (index <= item.stage) return ["Booking confirmed", "Arjun is on his way", "Arjun has your bike", "Checked in at Bike Surgeon", inBay ? "Rahul is working on it in Bay 03" : "Work done", "Job card closed", "Back with you"][index];
    if (index === 5) return ready ? `Expected ${ready}` : item.eta;
    if (index === 6) return item.mode === "pickup" ? "We bring it to your door" : "Collect it at the workshop";
    return "Next";
  };
  return (
    <PhoneFrame tab="Bookings" onTab={open}>
      <TopBar
        title={serviceTitle(item)}
        onBack={() => setState((current) => ({ ...current, selectedBookingId: null }))}
        action={<button className="cx-round" aria-label="Help" onClick={() => setAdvisorOpen(true)}><LifeBuoy /></button>}
      />
      <div className="cx-booking-bike">
        <span className="cx-booking-art"><BikeArt tone={vehicle.tone} type={vehicle.type} /></span>
        <span><b>{vehicle.name}</b><Plate value={vehicle.plate} small /></span>
      </div>
      {inBay && (!onServer || item.camera) ? (
        <div className="cx-feed-wrap">
          <CameraFeed item={item} />
        </div>
      ) : (
        <div className="cx-feed-off">
          <BikeArt tone={vehicle.tone} type={vehicle.type} />
          <p>{item.stage < 3 ? `The bay camera turns on when your bike reaches ${onServer ? "the bay" : "Bay 03"}.` : inBay ? "The bay camera is off right now." : "The bay camera is off now that the service is done."}</p>
        </div>
      )}

      <div className="cx-status-block trk-status">
        <h1>{headlineFor(item)}</h1>
        <p>{ready ? <>Ready by <b>{ready}</b>{item.eta.endsWith(" today") ? " today" : ""}</> : item.eta}</p>
        <Segments value={item.stage} total={stages.length} />
      </div>

      <button className="cx-btn cx-btn-dark" onClick={() => setAdvisorOpen(true)}>
        <PhoneIcon /> Call the advisor
      </button>

      {pending.length > 0 && (
        <button className="cx-notice trk-notice" onClick={() => open("Part approval")}>
          <Wrench />
          <span>
            <b>{approvalNotice(item.extras)}</b>
            <small>{inr(pending.reduce((sum, extra) => sum + extra.amount, 0))} if you approve {pending.length === 1 ? "it" : "all"}. Nothing extra is done until you say yes.</small>
          </span>
          <em>Review</em>
        </button>
      )}
      {item.stage >= 5 && !item.paid && (
        <button className="cx-notice trk-notice" onClick={() => {
          setState((current) => ({ ...current, viewingPaymentId: null, selectedBookingId: item.id }));
          open("Job card closed + pay");
        }}>
          <ReceiptIndianRupee />
          <span><b>Your invoice is ready</b><small>{inr(bill.total)}, pay now or at delivery</small></span>
          <em>Pay</em>
        </button>
      )}

      <Group title="The bill">
        <Row
          lead={<ReceiptIndianRupee />}
          title={bill.kind === "estimate" ? "Price estimate" : "Invoice"}
          detail={bill.kind === "estimate" ? "Package, GST, and parts you approve" : item.collectAtDoor ? "Pay at delivery" : linked ? paidDetail(linked) : bill.kind === "paid" ? "Paid" : "Due now"}
          value={inr(bill.total)}
          chevron
          onClick={() => {
            setState((current) => ({ ...current, viewingPaymentId: linked?.id ?? null, selectedBookingId: item.id }));
            open(bill.kind === "estimate" ? "Price estimate" : "Job card closed + pay");
          }}
        />
      </Group>

      <section className="cx-group">
        <div className="cx-group-head"><h3>Progress</h3><small>{item.id}</small></div>
        <ol className="trk-steps">
          {stages.map((stage, index) => {
            const mode = index < item.stage || item.stage >= 6 ? "done" : index === item.stage ? "now" : "todo";
            return (
              <li key={stage} className={mode} aria-current={mode === "now" ? "step" : undefined}>
                <i>{mode === "done" && <Check strokeWidth={3.2} />}</i>
                <div>
                  <b>{stage}</b>
                  <small>{stepNote(index)}</small>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {item.stage >= 6 && reviewedId !== item.id && (
        <button className="cx-review-prompt" onClick={() => setReviewOpen(true)}>
          <b>How was the service?</b>
          <small>A few taps, then we only follow up on what you ask for</small>
        </button>
      )}

      <Group title="Looking after your bike">
        <Row lead={<span className="cx-avatar">{initials(crew?.advisor ?? advisor.name)}</span>} title={crew?.advisor ?? advisor.name} detail="Service advisor" value={<button className="cx-round" aria-label="Call the advisor" onClick={() => setAdvisorOpen(true)}><PhoneIcon /></button>} />
        {(!crew || crew.mechanic) && <Row lead={<span className="cx-avatar">{crew?.mechanic ? initials(crew.mechanic) : "RM"}</span>} title={crew?.mechanic ?? "Rahul M."} detail={crew ? `Mechanic${crew.bay ? `, ${crew.bay}` : ""}` : "Mechanic, Bay 03"} />}
        {(!crew || crew.rider) && <Row lead={<span className="cx-avatar">{crew?.rider ? initials(crew.rider) : "AK"}</span>} title={crew?.rider ?? "Arjun K."} detail="Pickup and delivery" />}
      </Group>

      {!onServer && <button
        className="cx-demo-control"
        disabled={item.stage >= 6}
        onClick={() => {
          const next = Math.min(6, item.stage + 1);
          setState((current) => updateBooking(current, item.id, (bookingItem) => ({ ...bookingItem, stage: next })));
          if (next === 6) setReviewOpen(true);
        }}
      >
        Demo: move to the next stage
      </button>}
      <AdvisorSheet open={advisorOpen} onOpenChange={setAdvisorOpen} />
      <ServiceReview
        key={item.id}
        item={item}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={() => setReviewedId(item.id)}
      />
    </PhoneFrame>
  );
}

function Approval({ state, setState, open }: AppProps) {
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [justApproved, setJustApproved] = useState<number | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (justApproved === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => openRef.current("Price estimate"), reduce ? 500 : 1200);
    return () => window.clearTimeout(id);
  }, [justApproved]);
  const item = selectedBooking(state)
    ?? state.bookings.find((bookingItem) => bookingItem.extras.some((extra) => extra.status === "pending"))
    ?? state.bookings.find((bookingItem) => bookingItem.extras.length > 0)
    ?? null;
  if (!item || item.extras.length === 0) {
    return (
      <PhoneFrame tab="Bookings" onTab={open}>
        <TopBar title="Part approval" onBack={() => open("Track + live view")} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>Nothing to approve</h1>
          <p>If the bay finds a part, the name, the reason and the price land here. Nothing extra is fitted until you say yes.</p>
        </div>
      </PhoneFrame>
    );
  }
  const pending = item.extras.filter((extra) => extra.status === "pending");
  const pendingTotal = pending.reduce((sum, extra) => sum + extra.amount, 0);
  const approved = approvedExtraTotal(item.extras);
  const decide = (id: string, approvedPart: boolean) => {
    if (onServer && item.uuid) {
      api(`/v1/bookings/${item.uuid}/extras/${id}/decision`, { body: { approve: approvedPart } })
        .catch((error) => toast.error(messageOf(error)))
        .finally(() => reloadLive());
    }
    setState((current) => updateBooking(current, item.id, (bookingItem) => ({
      ...bookingItem,
      extras: bookingItem.extras.map((extra) => (extra.id === id ? { ...extra, status: approvedPart ? "approved" : "declined" } : extra)),
    })));
    toast[approvedPart ? "success" : "message"](approvedPart ? "Approved. The bay will fit this part." : "Noted. We’ll leave this part.");
  };
  const approvedMoment = justApproved === null ? undefined : (
    <div className="cx-approved" role="status">
      <span><Check /></span>
      <h1>Approved</h1>
      <p>{inr(justApproved)} is on the estimate. The bay will fit these parts.</p>
    </div>
  );
  return (
    <PhoneFrame
      tone="white"
      cover={approvedMoment}
      footer={
        pending.length === 0 ? (
          <button className="cx-btn cx-btn-quiet" onClick={() => open("Price estimate")}>See the estimate</button>
        ) : pending.length > 1 ? (
          <button
            className="cx-btn cx-btn-primary"
            onClick={() => {
              const total = pendingTotal;
              if (onServer && item.uuid) {
                api(`/v1/bookings/${item.uuid}/extras/approve-all`, { body: {} })
                  .catch((error) => toast.error(messageOf(error)))
                  .finally(() => reloadLive());
              }
              setState((current) => updateBooking(current, item.id, (bookingItem) => ({
                ...bookingItem,
                extras: bookingItem.extras.map((extra) => (extra.status === "pending" ? { ...extra, status: "approved" } : extra)),
              })));
              setJustApproved(total);
            }}
          >
            Approve all {inr(pendingTotal)}
          </button>
        ) : undefined
      }
    >
      <TopBar title="Part approval" onBack={() => open("Track + live view")} />
      <div className="cx-heading">
        <h1>{pending.length ? "Parts from the bay" : "You’re up to date"}</h1>
        <p>
          {pending.length
            ? `The ${inr(item.estimate)} package stays as booked. These parts are extra, and only if you approve them.`
            : "Every part from this service has a decision."}
        </p>
      </div>
      <button className="cx-btn cx-btn-quiet" onClick={() => setAdvisorOpen(true)}>
        <PhoneIcon /> Call the advisor
      </button>
      <div className="cx-extras">
        {item.extras.map((extra) => (
          <article key={extra.id} className={`cx-extra ${extra.status}`}>
            <header>
              <b>{extra.part}</b>
              <small>{extra.by}</small>
            </header>
            <p>{extra.note}</p>
            <div>
              <strong>{inr(extra.amount)}</strong>
              {extra.status === "pending" ? (
                <span>
                  <button type="button" className="cx-btn small cx-btn-quiet" onClick={() => decide(extra.id, false)}>Not now</button>
                  <button type="button" className="cx-btn small cx-btn-primary" onClick={() => decide(extra.id, true)}>Approve</button>
                </span>
              ) : (
                <small>{extra.status === "approved" ? "Approved" : "Left for later"}</small>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="cx-running">
        <div><span>Package</span><b>{inr(item.estimate)}</b></div>
        <div><span>Approved parts</span><b>{inr(approved)}</b></div>
        <p>GST is added when this becomes the invoice.</p>
      </section>
      <AdvisorSheet
        open={advisorOpen}
        onOpenChange={setAdvisorOpen}
        note="Ask whether a part is needed, why it costs what it does, and what happens if you leave it for later."
      />
    </PhoneFrame>
  );
}

function activeBooking(state: DemoState) {
  return selectedBooking(state)
    ?? state.bookings.find((item) => item.stage > 0 && item.stage < 6)
    ?? state.bookings.find((item) => item.stage < 6)
    ?? state.bookings[0]
    ?? null;
}

function Pay({ state, setState, open }: AppProps) {
  const fromGarage = useFromGarage();
  const [method, setMethod] = useState("upi");
  const back = () => (fromGarage ? backToGarage(open) : open("Invoices"));
  const viewed = state.viewingPaymentId ? state.payments.find((entry) => entry.id === state.viewingPaymentId) : undefined;
  const selected = selectedBooking(state);
  if (viewed && (!selected || selected.id === viewed.bookingId)) {
    const rest = viewed.total - viewed.wallet;
    const how = viewed.wallet > 0 && rest > 0
      ? `${inr(viewed.wallet)} from your wallet, ${inr(rest)} by ${viewed.methodLabel}`
      : viewed.wallet > 0
        ? `${inr(viewed.wallet)} from your wallet`
        : viewed.methodLabel;
    const live = selected && selected.stage < 6;
    return (
      <PhoneFrame footer={live
        ? <button className="cx-btn cx-btn-primary" onClick={() => open("Track + live view")}>Track delivery</button>
        : <button className="cx-btn cx-btn-primary" onClick={() => openPaymentHistory(open, "Profile")}>Payment history</button>}
      >
        <TopBar title="Invoice" onBack={back} />
        <div className="cx-heading">
          <h1>Paid in full</h1>
          <p>Paid on {viewed.when}. {how}.</p>
        </div>
        <InvoicePaper payment={viewed} />
      </PhoneFrame>
    );
  }
  const item = selected ?? activeBooking(state);
  if (!item) {
    return (
      <PhoneFrame tab="Bookings" onTab={open}>
        <TopBar title="Invoice" onBack={back} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>No invoice yet</h1>
          <p>An estimate stays an estimate until the job card closes. Then every line, the GST and the total land here.</p>
        </div>
        <button className="cx-btn cx-btn-quiet" onClick={() => open("Price estimate")}>See the estimate</button>
      </PhoneFrame>
    );
  }
  const bill = billFor(item);
  const rider = item.people ? (item.people.rider ? firstName(item.people.rider) : "the rider") : "Arjun";
  const counter = Boolean(item.payAtCounter) && !item.paid;
  const payable = bill.kind === "due" && !item.collectAtDoor && !counter;
  const fromWallet = method === "wallet" ? Math.min(state.wallet, bill.total) : 0;
  const rest = bill.total - fromWallet;
  const methods = [
    ...(state.wallet > 0 ? [["wallet", "Wallet", `${inr(state.wallet)} workshop credit`] as const] : []),
    ["upi", "UPI", "GPay, PhonePe, Paytm"] as const,
    ["card", "Card", "Credit or debit"] as const,
    ["net", "Net banking", "All major banks"] as const,
    ["later", "Pay at delivery", `Cash or UPI to ${rider}`] as const,
  ];
  const pay = () => {
    if (onServer && item.uuid) {
      const done = (text: string) => async () => {
        await reloadLive();
        toast.success(text);
      };
      if (method === "later") {
        api(`/v1/bookings/${item.uuid}/pay-at-delivery`, { body: {} }).then(done(`You’ll pay ${rider} at delivery`)).catch((error) => toast.error(messageOf(error)));
        return;
      }
      const online = method === "net" ? "netbanking" : method === "card" ? "card" : "upi";
      api<{ pendingPayment: unknown }>(`/v1/bookings/${item.uuid}/pay`, { body: { walletAmount: fromWallet, ...(rest > 0 ? { method: online } : {}) } })
        .then(async (result) => {
          await reloadLive();
          if (result.pendingPayment) toast.success(fromWallet ? `${inr(fromWallet)} taken from your wallet` : "Payment started", { description: "It shows as paid once the workshop confirms it." });
          else toast.success("Paid from your wallet");
        })
        .catch((error) => toast.error(messageOf(error)));
      return;
    }
    if (method === "later") {
      setState((current) => updateBooking(current, item.id, (bookingItem) => ({ ...bookingItem, collectAtDoor: true, paid: false })));
      toast.success(`You’ll pay ${rider} at delivery`);
      return;
    }
    const payment = paymentFromBooking(item, method, fromWallet);
    setState((current) => {
      const next = updateBooking(current, item.id, (bookingItem) => ({
        ...bookingItem,
        paid: true,
        collectAtDoor: false,
        stage: Math.max(5, bookingItem.stage),
        walletPaid: fromWallet || undefined,
      }));
      return {
        ...next,
        viewingPaymentId: payment.id,
        wallet: current.wallet - fromWallet,
        txns: fromWallet
          ? [{ id: `pay-${item.id}`, title: "Used on a service", detail: `${payment.service}, ${vehicles[item.vehicleId].name}`, amount: -fromWallet, when: "Now" }, ...current.txns]
          : current.txns,
        payments: [payment, ...current.payments.filter((entry) => entry.bookingId !== item.id)],
      };
    });
    toast.success(fromWallet && rest === 0 ? "Paid from your wallet" : fromWallet ? `${inr(fromWallet)} taken from your wallet` : "Payment received");
  };
  const label = method === "later" ? "Confirm pay at delivery" : method === "wallet" && rest > 0 ? `Use ${inr(fromWallet)} and pay ${inr(rest)}` : `Pay ${inr(bill.total)}`;
  return (
    <PhoneFrame
      footer={
        item.paid
          ? <button className="cx-btn cx-btn-primary" onClick={() => open("Track + live view")}>Track delivery</button>
          : item.collectAtDoor || counter
            ? <button className="cx-btn cx-btn-quiet" onClick={() => open("Track + live view")}>Back to the booking</button>
            : payable
              ? <button className="cx-btn cx-btn-primary" onClick={pay}>{label}</button>
              : <button className="cx-btn cx-btn-quiet" onClick={() => open("Price estimate")}>This is still an estimate</button>
      }
    >
      <TopBar title="Invoice" onBack={back} />
      <div className="cx-heading">
        <h1>{counter ? "Pay at the workshop" : item.collectAtDoor ? `Pay ${rider} at the door` : payable ? "The job card is closed" : item.paid ? "Paid in full" : "Not an invoice yet"}</h1>
        <p>
          {counter
            ? "This bill is from the workshop counter. Pay there by cash, UPI or card, and it shows here as paid."
            : item.collectAtDoor
            ? "Cash or UPI when the bike comes back. This invoice stays open until that payment is in."
            : payable
              ? `Package, approved parts and GST. Pay now, or hand it to ${rider} at the door.`
              : item.paid
                ? item.mode === "pickup" || !item.people ? `Your bike is on its way back with ${rider}.` : "Thank you. Your payment is in."
                : "This becomes the invoice when the job card closes. Extra parts join it only after you approve them."}
        </p>
      </div>
      <BillCard item={item} />
      {payable && (
        <Group title="Pay with">
          {methods.map(([id, title, detail]) => (
            <button key={id} className="cx-row" aria-pressed={method === id} onClick={() => setMethod(id)}>
              <span className={`cx-radio ${method === id ? "on" : ""}`} />
              <span className="cx-row-text"><b>{title}</b><small>{detail}</small></span>
            </button>
          ))}
        </Group>
      )}
    </PhoneFrame>
  );
}

function Estimate({ state, open }: AppProps) {
  const item = activeBooking(state);
  if (!item) {
    return (
      <PhoneFrame tab="Home" onTab={open} footer={<button className="cx-btn cx-btn-primary" onClick={() => open("Book service")}>Book a service</button>}>
        <TopBar title="Price estimate" onBack={() => open("Home")} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>No estimate yet</h1>
          <p>Choose a service and you’ll see the package, GST and the total before you confirm. Extra parts are never a surprise.</p>
        </div>
      </PhoneFrame>
    );
  }
  const bill = billFor(item);
  return (
    <PhoneFrame
      footer={
        bill.kind === "estimate"
          ? <button className="cx-btn cx-btn-primary" onClick={() => open(item.extras.some((extra) => extra.status === "pending") ? "Part approval" : "Track + live view")}>{item.extras.some((extra) => extra.status === "pending") ? "Review parts" : "Back to the booking"}</button>
          : <button className="cx-btn cx-btn-primary" onClick={() => open("Job card closed + pay")}>Open the invoice</button>
      }
    >
      <TopBar title="Price estimate" onBack={() => open("Track + live view")} />
      <div className="cx-heading">
        <h1>{bill.kind === "estimate" ? "What this service should cost" : "This estimate is now the bill"}</h1>
        <p>
          The package price is fixed. Pickup stays free. GST is 18%.{" "}
          {item.extras.some((extra) => extra.status === "pending")
            ? "Parts the bay finds later stay off this total until you approve them."
            : item.extras.some((extra) => extra.status === "approved")
              ? "The parts you approved are on this total."
              : "Extra parts stay off this total until you approve them."}
        </p>
      </div>
      <BillCard item={item} />
    </PhoneFrame>
  );
}

function Invoices({ state, setState, open }: AppProps) {
  const [from] = useState(() => {
    const origin = billOrigin;
    billOrigin = "Profile";
    return origin;
  });
  const openPayment = (payment: Payment) => {
    setState((current) => ({ ...current, viewingPaymentId: payment.id, selectedBookingId: payment.bookingId ?? null }));
    open("Job card closed + pay");
  };
  const months = [...new Set(state.payments.map(paymentMonth))];
  const quiet = state.payments.length === 0;
  return (
    <PhoneFrame tab={from === "Track + live view" ? "Bookings" : "Profile"} onTab={open}>
      <TopBar title="Payment history" onBack={() => open(from)} />
      {quiet ? (
        <div className="cx-quiet">
          <BikeArt />
          <h1>No invoices yet</h1>
          <p>Receipts for paid services land here.</p>
        </div>
      ) : (
        months.map((month) => (
          <section className="cx-group" key={month}>
            <div className="cx-group-head"><h3>{month}</h3></div>
            <div className="cx-bills">
              {state.payments.filter((payment) => paymentMonth(payment) === month).map((payment) => (
                <BillStub
                  key={payment.id}
                  vehicleId={payment.vehicleId}
                  meta={<><span>{payment.when}</span><PaidWith payment={payment} /></>}
                  service={payment.service}
                  amount={payment.total}
                  view={{ label: "View details", onClick: () => openPayment(payment) }}
                  side={
                    <button className="cx-bill-download" onClick={() => toast.success(`Receipt ${payment.id} downloaded`)}>
                      <Download /> Download receipt
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </PhoneFrame>
  );
}

function PaidWith({ payment }: { payment: Payment }) {
  return (
    <span className="cx-bill-how">
      {paymentMethods(payment).map((method, index) => (
        <span key={method}>{index > 0 && <i>+</i>}<MethodIcon method={method} />{method}</span>
      ))}
    </span>
  );
}

function BillStub({
  vehicleId,
  meta,
  service,
  amount,
  view,
  side,
}: {
  vehicleId: VehicleId;
  meta: ReactNode;
  service: string;
  amount: number;
  view: { label: string; onClick: () => void };
  side: ReactNode;
}) {
  const vehicle = vehicles[vehicleId];
  return (
    <article className="cx-bill">
      <button type="button" className="cx-bill-main" onClick={view.onClick}>
        <span className="cx-bill-art"><BikeArt tone={vehicle.tone} type={vehicle.type} /></span>
        <span className="cx-bill-copy">
          <span className="cx-bill-title"><b>{vehicle.name}</b><strong>{inr(amount)}</strong></span>
          <span className="cx-bill-meta">{meta}</span>
          <small>{service}</small>
        </span>
      </button>
      <div className="cx-bill-foot">
        <button className="cx-bill-view" onClick={view.onClick}>{view.label}</button>
        {side}
      </div>
    </article>
  );
}

function WalletScreen({ state, open, firstTime }: AppProps) {
  const earned = state.txns.filter((txn) => txn.amount > 0).reduce((sum, txn) => sum + txn.amount, 0);
  const used = state.txns.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum - txn.amount, 0);
  const savedOffer = offerList.find((offer) => offer.id === state.offer);
  const waiting = offersFor(firstTime).filter((offer) => offer.id !== state.offer).length;
  return (
    <PhoneFrame
      tab="Profile"
      onTab={open}
      footer={<button className="cx-btn cx-btn-primary" onClick={() => open("Book service")}>Use on a service <ArrowUpRight /></button>}
    >
      <TopBar title="My wallet" onBack={() => open(walletOrigin)} />
      <section className="cx-wallet-card">
        <Wrench className="cx-wallet-mark" aria-hidden="true" />
        <span>Wallet balance</span>
        <b>{inr(state.wallet)}</b>
        <p>Use it on your next service. Offer savings are added here automatically.</p>
      </section>
      <div className="cx-wallet-stats">
        <div className="cx-wallet-stat"><span>Total earned</span><b>{inr(earned)}</b></div>
        <div className="cx-wallet-stat"><span>Used</span><b>{inr(used)}</b></div>
      </div>
      {savedOffer && (
        <button className="cx-notice trk-notice" onClick={() => open("Book service")}>
          <Gift />
          <span>
            <b>Saved offer: {savedOffer.title.charAt(0).toLowerCase() + savedOffer.title.slice(1)}</b>
            <small>Applies automatically when you book your next service. {savedOffer.till}.</small>
          </span>
          <em>Book</em>
        </button>
      )}
      <button className="cx-notice" onClick={() => open("Offers")}>
        <Gift />
        <span>
          <b>{waiting > 0 ? `${waiting} ${waiting === 1 ? "offer" : "offers"} waiting` : "No other offers right now"}</b>
          <small>{waiting > 0 ? "Book a service with one and it comes off the bill." : "New offers come every week."}</small>
        </span>
        <ChevronRight className="cx-chevron" />
      </button>
      <section className="cx-group">
        <div className="cx-group-head"><h3>Transactions</h3></div>
        {state.txns.length === 0 ? (
          <p className="cx-wallet-empty">Nothing here yet. A refund, a referral or a claimed offer shows up as credit.</p>
        ) : (
          <div className="cx-tx-list">
            {state.txns.map((txn) => {
              const credit = txn.amount > 0;
              return (
                <div className={`cx-tx${txn.when === "Now" ? " fresh" : ""}`} key={txn.id}>
                  <span className={`cx-tx-icon${credit ? " in" : ""}`}>{credit ? <Plus /> : <Wrench />}</span>
                  <span className="cx-tx-copy"><b>{txn.title}</b><small>{txn.detail}, {txn.when}</small></span>
                  <span className={credit ? "cx-credit" : "cx-debit"}>{credit ? "+" : "−"} {inr(Math.abs(txn.amount))}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PhoneFrame>
  );
}

let referralCode = "SANATH200";
let liveReferrals: { name: string; status: string; detail: string; amount: number }[] = [];
let referralShareText = `Use my Bike Surgeon code ${referralCode}. You get ₹200 off your first completed service, and I get ₹200 in wallet credit.`;

function ReferralScreen({ open, firstTime }: AppProps) {
  const referrals = onServer
    ? liveReferrals
    : firstTime
    ? []
    : [
        { name: "Arun K.", status: "Credit received", detail: "First service completed", amount: 200 },
        { name: "Vijay N.", status: "Waiting", detail: "Joined, service not completed", amount: 0 },
      ];
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied");
    } catch {
      toast(`Code: ${referralCode}`);
    }
  };
  const share = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: "Bike Surgeon referral", text: referralShareText, dialogTitle: "Share your code" });
        return;
      } catch (error) {
        if (error instanceof Error && /cancel/i.test(error.message)) return;
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "Bike Surgeon referral", text: referralShareText });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyCode();
  };
  return (
    <PhoneFrame tab="Profile" onTab={open}>
      <TopBar title="Refer a friend" onBack={() => open("Profile")} />
      <div className="cx-heading">
        <h1>₹200 for both of you</h1>
        <p>Your friend gets ₹200 off their first completed service. You get ₹200 in wallet credit after it is done.</p>
      </div>

      <section className="cx-referral-code" aria-label={`Referral code ${referralCode}`}>
        <span>Your referral code</span>
        <div>
          <b>{referralCode}</b>
          <button className="cx-round" aria-label="Copy referral code" onClick={copyCode}><Copy /></button>
        </div>
      </section>

      <div className="cx-referral-actions">
        <a
          className="cx-btn cx-btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(referralShareText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle /> Share on WhatsApp
        </a>
        <button className="cx-btn cx-btn-quiet" onClick={share}><Share2 /> More ways to share</button>
      </div>

      <section className="cx-group">
        <div className="cx-group-head"><h3>How it works</h3></div>
        <ol className="cx-referral-steps">
          <li><i>1</i><span><b>Share your code</b><small>Your friend enters it when booking.</small></span></li>
          <li><i>2</i><span><b>They complete a service</b><small>The ₹200 discount is applied to their bill.</small></span></li>
          <li><i>3</i><span><b>Your wallet is credited</b><small>Use the ₹200 on any future service.</small></span></li>
        </ol>
      </section>

      <section className="cx-group">
        <div className="cx-group-head">
          <h3>Your referrals</h3>
          {referrals.length > 0 && <small>{referrals.length}</small>}
        </div>
        {referrals.length === 0 ? (
          <p className="cx-wallet-empty">No referrals yet. Share your code to get started.</p>
        ) : (
          <div className="cx-referral-list">
            {referrals.map((item) => (
              <div className="cx-referral-person" key={item.name}>
                <span className="cx-avatar">{item.name.split(" ").map((part) => part[0]).join("")}</span>
                <span><b>{item.name}</b><small>{item.detail}</small></span>
                <em className={item.amount ? "earned" : ""}>{item.amount ? `+${inr(item.amount)}` : item.status}</em>
              </div>
            ))}
          </div>
        )}
      </section>

      <button className="cx-notice" onClick={() => openWallet(open, "Refer a friend")}>
        <Wallet />
        <span><b>Referral credit goes to your wallet</b><small>See your balance and transactions.</small></span>
        <ChevronRight className="cx-chevron" />
      </button>
      <p className="cx-fine">One reward per new customer. Credit is added after their first service is completed and paid.</p>
    </PhoneFrame>
  );
}

function OffersScreen({ setState, open, firstTime }: AppProps) {
  const bookWith = (id: string) => bookWithOffer(open, setState, id);
  return (
    <PhoneFrame tab="Home" onTab={open}>
      <TopBar title="Offers" onBack={() => open("Home")} />
      <div className="cx-heading">
        <h1>{offersFor(firstTime).length} offers for you</h1>
        <p>Pick one when you book and it comes straight off the bill.</p>
      </div>
      <Group>
        {offersFor(firstTime).map((item) => (
          <Row
            key={item.id}
            lead={<Gift />}
            title={item.title}
            detail={`${item.detail}. ${item.till}.`}
            value={<button className="cx-btn small cx-btn-primary" onClick={() => bookWith(item.id)}>Book the service</button>}
          />
        ))}
      </Group>
    </PhoneFrame>
  );
}

type GarageBook = {
  odo: number;
  odoNote: string;
  insurance: { insurer: string; cover: string; till: string; due: boolean; life: number };
  puc: { till: string; due: boolean; reading: string; life: number };
  warrantyLife: number;
  services: string[][];
  next: string;
  earlier: number;
  warranties: string;
};

const garageBook: Record<string, GarageBook> = {
  guerrilla: {
    odo: 68423,
    odoNote: "Recorded at today’s service",
    insurance: { insurer: "ICICI Lombard", cover: "Comprehensive", till: "Till 12 Aug 2027", due: false, life: 83 },
    puc: { till: "Due in 24 days", due: true, reading: "CO 0.21%, HC 180 ppm", life: 14 },
    warrantyLife: 54,
    services: [
      ["1st free service", "12 Dec 25", "1,010 km"],
      ["Oil change", "14 Apr 26", "4,120 km"],
      ["General service", "29 Sep 26", "6,842 km"],
    ],
    next: "Due at 9,800 km or 29 Mar",
    earlier: 0,
    warranties: "4 active",
  },
  classic: {
    odo: 213904,
    odoNote: "You updated it on 26 Sep",
    insurance: { insurer: "Tata AIG", cover: "Third party", till: "Renews in 12 days", due: true, life: 8 },
    puc: { till: "Till 4 Feb 2027", due: false, reading: "CO 0.34%, HC 240 ppm", life: 63 },
    warrantyLife: 36,
    services: [
      ["Brake inspection", "18 Aug 26", "21,390 km", "INV-2026-000109"],
      ["General service", "2 Jul 26", "20,950 km"],
      ["Brake pads", "11 Mar 26", "18,200 km"],
    ],
    next: "Due now, at 21,500 km",
    earlier: 8,
    warranties: "2 active",
  },
  access: {
    odo: 92402,
    odoNote: "Recorded on 18 Aug",
    insurance: { insurer: "HDFC ERGO", cover: "Comprehensive", till: "Till 8 Jun 2027", due: false, life: 65 },
    puc: { till: "Till 12 Mar 2027", due: false, reading: "CO 0.18%, HC 164 ppm", life: 83 },
    warrantyLife: 62,
    services: [
      ["General service", "18 Aug 26", "9,240 km", "INV-2026-000098"],
      ["Oil change", "7 Feb 26", "6,310 km"],
    ],
    next: "Due at 12,000 km or 18 Feb",
    earlier: 0,
    warranties: "2 active",
  },
};

type GarageIcon = "service" | "insurance" | "puc" | "warranty";

type GarageLine = {
  title: string;
  status: string;
  pct: number;
  icon: GarageIcon;
  tone: "due" | "live" | "soon" | "ok";
  verb: string;
} & (
  | { act: "job"; bookingId: string; screen: string }
  | { act: "book"; services: string[] }
  | { act: "renew" }
  | { act: "puc" }
  | { act: "warranty" }
  | { act: "garage" }
);

function briefWhen(scheduled: string) {
  const [day, time] = scheduled.split(", ");
  if (!time) return scheduled;
  const start = time.split("–")[0].trim();
  const suffix = /[AP]M/.test(start) ? "" : time.match(/[AP]M/)?.[0] ?? "";
  return `${day}, ${start}${suffix ? ` ${suffix}` : ""}`;
}

function garageCardLines(key: VehicleId, bookings: ServiceBooking[]): GarageLine[] {
  const book = garageBook[key];
  const active = bookings.find((item) => item.vehicleId === key && item.stage < 6);
  const km = Math.round(book.odo / 10);
  const target = Number(book.next.replace(/,/g, "").match(/(\d+)\s*km/)?.[1] ?? km);
  const left = target - km;
  const service: GarageLine = active
    ? active.extras.some((extra) => extra.status === "pending")
      ? { title: "Next service", status: "Parts need your OK", pct: 58, icon: "service", tone: "due", verb: "Review", act: "job", bookingId: active.id, screen: "Part approval" }
      : active.stage >= 3 && active.stage <= 4
        ? { title: "Next service", status: "In the bay now", pct: 68, icon: "service", tone: "live", verb: "Track", act: "job", bookingId: active.id, screen: "Track + live view" }
        : active.stage >= 5 && !active.paid
          ? { title: "Next service", status: "Invoice ready", pct: 90, icon: "service", tone: "due", verb: "Pay", act: "job", bookingId: active.id, screen: "Job card closed + pay" }
          : active.stage >= 2
            ? { title: "Next service", status: "In the workshop", pct: 46, icon: "service", tone: "soon", verb: "Track", act: "job", bookingId: active.id, screen: "Track + live view" }
            : { title: "Next service", status: briefWhen(active.scheduled), pct: 24, icon: "service", tone: "soon", verb: "Track", act: "job", bookingId: active.id, screen: "Track + live view" }
    : book.next.startsWith("Due now") || left <= 200
      ? { title: "Next service", status: "Due now", pct: Math.max(8, Math.min(18, Math.round((Math.max(left, 0) / 800) * 100))), icon: "service", tone: "due", verb: "Book", act: "book", services: ["general"] }
      : { title: "Next service", status: `${Math.max(left, 0).toLocaleString("en-IN")} km left`, pct: Math.max(8, Math.min(100, Math.round((left / 3000) * 100))), icon: "service", tone: "ok", verb: "Book", act: "book", services: ["general"] };
  const insurance: GarageLine = book.insurance.due
    ? { title: "Insurance", status: book.insurance.till, pct: book.insurance.life, icon: "insurance", tone: "due", verb: "Renew", act: "renew" }
    : { title: "Insurance", status: book.insurance.till, pct: book.insurance.life, icon: "insurance", tone: "ok", verb: "View", act: "garage" };
  const puc: GarageLine = book.puc.due
    ? active
      ? { title: "PUC certificate", status: book.puc.till, pct: book.puc.life, icon: "puc", tone: "due", verb: "Add", act: "puc" }
      : { title: "PUC certificate", status: book.puc.till, pct: book.puc.life, icon: "puc", tone: "due", verb: "Book", act: "book", services: ["puc"] }
    : { title: "PUC certificate", status: book.puc.till, pct: book.puc.life, icon: "puc", tone: "ok", verb: "View", act: "garage" };
  const warranty: GarageLine = { title: "Warranty", status: book.warranties, pct: book.warrantyLife, icon: "warranty", tone: "ok", verb: "View", act: "warranty" };
  return [service, insurance, puc, warranty];
}

const kmPins = [1000, 5000, 10000, 25000, 50000];

const kmSchedule: Record<string, [string, number, number][]> = {
  guerrilla: [
    ["Engine oil", 6842, 3000],
    ["Chain", 6842, 1000],
    ["Brake pads", 6842, 15000],
  ],
  classic: [
    ["Engine oil", 20950, 2500],
    ["Chain", 20390, 800],
    ["Brake pads", 18200, 12000],
  ],
  access: [
    ["Engine oil", 9240, 3000],
    ["Drive belt", 6310, 8000],
    ["Brake shoes", 0, 20000],
  ],
};

function kmLife(current: number, doneAt: number, every: number) {
  const left = every - Math.max(0, current - doneAt);
  const pct = Math.max(0, Math.min(100, Math.round((left / every) * 100)));
  const note = left > 0
    ? `${Math.round(left).toLocaleString("en-IN")} km to go`
    : `${Math.round(-left).toLocaleString("en-IN")} km past due`;
  return { pct, note, left };
}

function PopButton({ children, tone = "yellow", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "yellow" | "light" }) {
  return <button className={`cx-pop ${tone} ${className}`} {...props}>{children}</button>;
}

function Odometer({
  tenths,
  blank,
  editing,
  onChange,
}: {
  tenths: number;
  blank?: boolean;
  editing?: boolean;
  onChange?: (tenths: number) => void;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (editing) {
      setShown(tenths);
      return;
    }
    const timer = window.setTimeout(() => setShown(tenths), 80);
    return () => window.clearTimeout(timer);
  }, [tenths, editing]);
  const roll = (index: number, steps: number) => {
    if (!steps) return;
    onChange?.(tenths + steps * 10 ** (6 - index));
  };
  const startDrag = (event: React.PointerEvent<HTMLSpanElement>, index: number) => {
    if (!editing) return;
    event.preventDefault();
    const originY = event.clientY;
    const origin = tenths;
    const unit = 10 ** (6 - index);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    haptic.start();
    let moved = 0;
    const move = (pointer: PointerEvent) => {
      const steps = Math.round((originY - pointer.clientY) / 26);
      if (steps === moved) return;
      moved = steps;
      onChange?.(origin + steps * unit);
    };
    const end = () => {
      haptic.end();
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };
  const digits = String(Math.max(0, shown)).padStart(7, "0").slice(-7).split("");
  return (
    <div className={`cx-odo ${editing ? "editing" : ""}`} aria-label={blank ? "Odometer not recorded" : `${(tenths / 10).toLocaleString("en-IN")} km`}>
      {digits.map((digit, index) => (
        <span
          key={index}
          className={`cx-drum ${index === 6 ? "tenth" : ""} ${editing ? "live" : ""}`}
          onPointerDown={(event) => startDrag(event, index)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") roll(index, 1);
            if (event.key === "ArrowDown") roll(index, -1);
          }}
          role={editing ? "slider" : undefined}
          aria-valuemin={editing ? 0 : undefined}
          aria-valuemax={editing ? 9 : undefined}
          aria-valuenow={editing ? Number(digit) : undefined}
          aria-label={editing ? `Dial ${index + 1}` : undefined}
          tabIndex={editing ? 0 : undefined}
        >
          {blank ? (
            <i>–</i>
          ) : (
            <span style={{ transform: `translateY(${-Number(digit) * 10}%)`, transitionDelay: editing ? "0ms" : `${(6 - index) * 70}ms` }}>
              {"0123456789".split("").map((n) => <i key={n}>{n}</i>)}
            </span>
          )}
        </span>
      ))}
      <b>km</b>
    </div>
  );
}

function HealthGauge({ score }: { score: number | null }) {
  const angle = score === null ? -90 : -90 + score * 1.8;
  const point = (value: number, radius = 80) => {
    const theta = ((180 - value * 1.8) * Math.PI) / 180;
    return `${100 + radius * Math.cos(theta)} ${100 - radius * Math.sin(theta)}`;
  };
  return (
    <svg className="cx-gauge" viewBox="0 0 200 112" aria-hidden="true">
      <path d={`M${point(0)} A80 80 0 0 1 ${point(30)}`} stroke="#e2553f" />
      <path d={`M${point(31)} A80 80 0 0 1 ${point(59)}`} stroke="#e0a526" />
      <path d={`M${point(60)} A80 80 0 0 1 ${point(100)}`} stroke="#f2efe8" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} className="tick" d={`M${point(i * 10, 64)} L${point(i * 10, 70)}`} />
      ))}
      <g className="cx-needle" style={{ "--angle": `${angle}deg` } as React.CSSProperties}>
        <path d="M100 100 L100 30" />
      </g>
      <circle cx="100" cy="100" r="8" fill="#f2efe8" />
      <circle cx="100" cy="100" r="3" fill="#1a1917" />
    </svg>
  );
}

function Stamp({ date, turn }: { date: string; turn: number }) {
  const id = useId().replace(/:/g, "");
  const [day, ...rest] = date.split(" ");
  return (
    <svg className="cx-ink" viewBox="0 0 100 100" style={{ transform: `rotate(${turn}deg)` }} aria-hidden="true">
      <defs><path id={`ring-${id}`} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" /></defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontSize="10" fontWeight="800" letterSpacing="1.4" fill="currentColor">
        <textPath href={`#ring-${id}`}>BIKE SURGEON • DAVANGERE •</textPath>
      </text>
      <text x="50" y="50" textAnchor="middle" fontSize="15" fontWeight="900" fill="currentColor">{day}</text>
      <text x="50" y="63" textAnchor="middle" fontSize="9" fontWeight="800" fill="currentColor">{rest.join(" ").toUpperCase()}</text>
    </svg>
  );
}

type DocId = "rc" | "insurance" | "puc";

const docInfo: Record<DocId, { title: string; added: string }> = {
  rc: { title: "Registration certificate", added: "14 Mar 2025" },
  insurance: { title: "Insurance policy", added: "12 Aug 2026" },
  puc: { title: "Pollution certificate", added: "24 Mar 2026" },
};

function storedDoc(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const docListeners = new Set<() => void>();

function docKey(vehicle: string, doc: DocId) {
  return `bike-surgeon:doc:${vehicle}:${doc}`;
}

function saveDoc(vehicle: string, doc: DocId, photo: string) {
  window.localStorage.setItem(docKey(vehicle, doc), photo);
  window.localStorage.setItem(`${docKey(vehicle, doc)}:at`, new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
  docListeners.forEach((listener) => listener());
}

function watchDocs(listener: () => void) {
  docListeners.add(listener);
  return () => {
    docListeners.delete(listener);
  };
}

function useDocPhoto(vehicle: string, doc: DocId) {
  const photo = useSyncExternalStore(watchDocs, () => storedDoc(docKey(vehicle, doc)));
  const at = useSyncExternalStore(watchDocs, () => storedDoc(`${docKey(vehicle, doc)}:at`));
  return { photo, at };
}

async function shrinkPhoto(file: File, longest = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function DocScan({ doc, vehicle }: { doc: DocId; vehicle: VehicleId }) {
  const id = useId().replace(/:/g, "");
  const bike = vehicles[vehicle];
  const book = garageBook[vehicle];
  const lines = (x: number, y: number, widths: number[], gap = 22) =>
    widths.map((width, index) => <rect key={index} x={x} y={y + index * gap} width={width} height="8" rx="4" fill="#d6d0c3" />);
  const field = (x: number, y: number, label: string, value: string, size = 17) => (
    <>
      <text x={x} y={y} fill="#8a8578" fontSize="12">{label}</text>
      <text x={x} y={y + 22} fill="#1f1e1b" fontSize={size} fontWeight="700">{value}</text>
    </>
  );
  return (
    <svg className="cx-scan" viewBox="0 0 600 800" role="img" aria-label={`Photo of the ${docInfo[doc].title.toLowerCase()}`}>
      <defs>
        <radialGradient id={`${id}-table`} cx="45%" cy="38%" r="80%"><stop offset="0" stopColor="#5a4d40" /><stop offset="1" stopColor="#241f1b" /></radialGradient>
        <filter id={`${id}-drop`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="16" floodOpacity="0.45" /></filter>
      </defs>
      <rect width="600" height="800" fill={`url(#${id}-table)`} />
      {doc === "rc" && (
        <g transform="translate(300 400) rotate(-5) translate(-230 -146)" filter={`url(#${id}-drop)`}>
          <rect width="460" height="292" rx="18" fill="#f4f0e6" />
          <path d="M0 18 A18 18 0 0 1 18 0 H442 A18 18 0 0 1 460 18 V58 H0 Z" fill="#2c5b83" />
          <text x="24" y="37" fill="#fff" fontSize="17" fontWeight="700">Certificate of Registration</text>
          <circle cx="424" cy="29" r="15" fill="#e7dcc0" />
          <rect x="24" y="80" width="58" height="44" rx="8" fill="#d4b35a" />
          <path d="M24 102 H82 M53 80 V124" stroke="#b08f3c" strokeWidth="2" />
          {field(108, 94, "Registration number", bike.plate, 24)}
          {field(24, 168, "Owner", "Sanath Naik")}
          {field(24, 226, "Maker and model", `${bike.make} ${bike.name}`, 15)}
          {lines(300, 162, [128, 100, 116], 24)}
        </g>
      )}
      {doc === "insurance" && (
        <g transform="translate(300 405) rotate(2.5) translate(-220 -300)" filter={`url(#${id}-drop)`}>
          <rect width="440" height="600" rx="4" fill="#f7f5ef" />
          <rect x="28" y="30" width="44" height="44" rx="8" fill="#8f2c3b" />
          <text x="84" y="50" fill="#1f1e1b" fontSize="18" fontWeight="800">{book.insurance.insurer}</text>
          <text x="84" y="70" fill="#8a8578" fontSize="12">Motor insurance policy schedule</text>
          <line x1="28" y1="96" x2="412" y2="96" stroke="#dcd6c8" strokeWidth="2" />
          {field(28, 128, "Policy number", "3005/2614/4471")}
          {field(240, 128, "Vehicle", bike.plate)}
          {field(28, 190, "Cover", book.insurance.cover)}
          {field(240, 190, "Validity", book.insurance.till.replace(/^Till /, "Till "))}
          {lines(28, 262, [384, 356, 372, 300, 380, 332], 22)}
          <rect x="28" y="412" width="384" height="112" rx="4" fill="none" stroke="#dcd6c8" strokeWidth="2" />
          {lines(44, 432, [200, 160, 240, 180], 22)}
          <path d="M300 560 q14 -22 28 -4 t26 -6 t30 4" fill="none" stroke="#2c4a7a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {doc === "puc" && (
        <g transform="translate(300 400) rotate(-3) translate(-170 -260)" filter={`url(#${id}-drop)`}>
          <rect width="340" height="520" rx="6" fill="#fbfaf5" />
          <text x="24" y="44" fill="#1f1e1b" fontSize="16" fontWeight="800">Pollution Under Control</text>
          <text x="24" y="64" fill="#8a8578" fontSize="12">Certificate</text>
          <g transform="translate(236 20)">
            {Array.from({ length: 64 }, (_, index) => ((index * 37 + 11) % 7 < 3 || index % 9 === 0) && (
              <rect key={index} x={(index % 8) * 10} y={Math.floor(index / 8) * 10} width="10" height="10" fill="#1f1e1b" />
            ))}
          </g>
          <line x1="24" y1="116" x2="316" y2="116" stroke="#e2ddd0" strokeWidth="2" />
          {field(24, 146, "Vehicle", bike.plate)}
          {field(24, 204, "Fuel", "Petrol, 4 stroke")}
          {field(24, 262, "Reading", book.puc.reading, 15)}
          {lines(24, 320, [292, 246, 270], 22)}
          <g transform="translate(206 432) rotate(-10)">
            <rect x="-66" y="-30" width="132" height="60" rx="8" fill="none" stroke="#2f7d4f" strokeWidth="5" />
            <text x="0" y="14" textAnchor="middle" fill="#2f7d4f" fontSize="36" fontWeight="900">PASS</text>
          </g>
        </g>
      )}
    </svg>
  );
}

function DocViewer({ doc, vehicle, sample, onClose }: { doc: DocId; vehicle: string; sample: boolean; onClose: () => void }) {
  const portal = useContext(PhonePortalContext);
  const { photo } = useDocPhoto(vehicle, doc);
  const [zoomed, setZoomed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const info = docInfo[doc];
  const hasImage = Boolean(photo) || sample;
  const toggleZoom = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!hasImage) return;
    const box = event.currentTarget.getBoundingClientRect();
    const fx = (event.clientX - box.left) / box.width;
    const fy = (event.clientY - box.top) / box.height;
    setZoomed((value) => !value);
    requestAnimationFrame(() => {
      const el = stage.current;
      if (!el) return;
      el.scrollTo({ left: fx * el.scrollWidth - el.clientWidth / 2, top: fy * el.scrollHeight - el.clientHeight / 2 });
    });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = await shrinkPhoto(file);
      saveDoc(vehicle, doc, next);
      setZoomed(false);
      toast.success("Saved on this phone");
    } catch {
      toast("Couldn’t save the photo here. Free up some space on the phone and try again.");
    }
  };
  if (!portal) return null;
  return createPortal(
    <div className="cx-viewer" role="dialog" aria-modal="true" aria-label={`${info.title}, original photo`}>
      <header>
        <button className="cx-viewer-close" aria-label="Close" onClick={onClose} autoFocus><X /></button>
        <div>
          <b>{info.title}</b>
          <small>{photo ? "Your photo" : sample ? `Photo added ${info.added}` : "No photo yet"}</small>
        </div>
      </header>
      <div ref={stage} className={`cx-viewer-stage ${zoomed ? "zoomed" : ""}`} onClick={toggleZoom}>
        {photo ? (
          <img src={photo} alt={`${info.title}, your photo`} />
        ) : sample ? (
          <DocScan doc={doc} vehicle={vehicle as VehicleId} />
        ) : (
          <div className="cx-viewer-empty">
            <ImageIcon />
            <p>{doc === "rc" ? "We fetched these details from Vahan. Add a photo of the card to keep a copy here." : "Add a photo of the document to keep a copy here."}</p>
          </div>
        )}
      </div>
      <footer>
        <p>{hasImage ? "Saved only on this phone. It isn’t uploaded anywhere." : "The photo stays only on this phone."}</p>
        <label className="cx-btn cx-viewer-pick">
          <input type="file" accept="image/*" onChange={pick} />
          {hasImage ? "Replace photo" : "Add a photo"}
        </label>
      </footer>
    </div>,
    portal,
  );
}

const garageMemory = {
  scroll: 0,
  vehicle: "guerrilla",
  fanned: false,
  restore: false,
  handoff: false,
  adding: false,
  select: null as string | null,
  openDoc: null as DocId | null,
  added: {} as Record<string, GarageBike>,
};

function showInGarage(open: (screen: string) => void, key: string) {
  garageMemory.adding = false;
  garageMemory.select = key;
  open("Garage & history");
}

function showDocInGarage(open: (screen: string) => void, key: string, doc: DocId) {
  garageMemory.openDoc = doc;
  showInGarage(open, key);
}

function showAddVehicle(open: (screen: string) => void) {
  garageMemory.adding = true;
  garageMemory.select = null;
  open("Garage & history");
}

const emptyGarageRecord = {
  odo: 0,
  odoNote: "Not recorded yet",
  insurance: { insurer: "", cover: "", till: "Not added", due: false },
  puc: { till: "Not added", due: false, reading: "" },
  services: [] as [string, string, string][],
  next: "Book it and it gets stamped here",
  earlier: 0,
  warranties: "None yet",
};

function garageRecord(id: string) {
  return garageBook[id] ?? emptyGarageRecord;
}

const freshSchedule: [string, number, number][] = [
  ["Engine oil", 0, 3000],
  ["Chain", 0, 1000],
  ["Brake pads", 0, 15000],
];

function AddVehicle({
  plates,
  onClose,
  onSave,
}: {
  plates: string[];
  onClose: () => void;
  onSave: (bike: GarageBike) => void;
}) {
  const portal = useContext(PhonePortalContext);
  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const [manual, setManual] = useState(false);
  const [brand, setBrand] = useState("");
  const [brandText, setBrandText] = useState("");
  const [model, setModel] = useState("");
  const [modelText, setModelText] = useState("");
  const [year, setYear] = useState("");
  const [colour, setColour] = useState("");
  const [customHex, setCustomHex] = useState("#8a4fb3");
  const [pickedType, setPickedType] = useState<BikeType | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const lookedUp = lookup?.bodyType ? { type: lookup.bodyType, source: "catalog" } : typeForModel(lookup?.model ?? "Xtreme 160R", lookup?.make ?? "Hero");
  const typedModel = brand === "Other" || model === "Not listed";
  const modelName = (typedModel ? modelText : model).trim();
  const brandName = brand === "Other" ? brandText.trim() : brand;
  const detected = manual && modelName ? typeForModel(modelName, brandName) : null;
  const bikeType = pickedType ?? (found ? lookedUp.type : detected && detected.source !== "unknown" ? detected.type : null);
  const needsType = manual && Boolean(modelName) && !bikeType;
  const tone = colour === "Custom" ? customHex : bikeColours.find(([label]) => label === colour)?.[1] ?? "#2f5b8a";
  const manualDone = Boolean(brandName && modelName && year && colour && bikeType);
  const plateOk = plateKey(reg).length >= 6;
  const ready = plateOk && (found ? Boolean(bikeType) : manual && manualDone);
  const resetType = () => {
    setPickedType(null);
    setChoosing(false);
  };
  const fetchVehicle = () => {
    if (plates.some((plate) => plateKey(plate) === plateKey(reg))) {
      toast("That vehicle is already in your garage");
      return;
    }
    setLoading(true);
    if (onServer) {
      lookupPlate(reg).then((result) => {
        setLoading(false);
        resetType();
        if (result) {
          setLookup(result);
          setFound(true);
          setManual(false);
          toast.success("Found your bike");
        } else {
          toast("We couldn’t read that number. Enter the details yourself.");
          setManual(true);
        }
      });
      return;
    }
    window.setTimeout(() => {
      setLoading(false);
      setFound(true);
      setManual(false);
      resetType();
      toast.success("Found your bike");
    }, 900);
  };
  const pick = (type: BikeType) => {
    setPickedType(type);
    setChoosing(false);
  };
  const save = () => {
    if (!ready || !bikeType) return;
    if (plates.some((plate) => plateKey(plate) === plateKey(reg))) {
      toast("That vehicle is already in your garage");
      return;
    }
    const plate = formatPlate(reg);
    if (found) {
      onSave({
        name: lookup?.model ?? "Xtreme 160R",
        make: lookup?.make ?? "Hero",
        plate,
        tone: "#1f2023",
        colour: lookup ? lookup.colourName ?? "Colour not set" : "Stealth Black",
        km: "0",
        services: 0,
        type: bikeType,
      });
      return;
    }
    onSave({
      name: modelName,
      make: brandName,
      plate,
      tone,
      colour: colour === "Custom" ? "Custom colour" : colour,
      km: "0",
      services: 0,
      type: bikeType,
    });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!portal) return null;
  return createPortal(
    <div className="cx-add-vehicle" role="dialog" aria-modal="true" aria-labelledby="cx-add-vehicle-title">
      <header className="cx-add-vehicle-top">
        <button className="cx-round" type="button" aria-label="Back" onClick={onClose}><ChevronLeft /></button>
        <h1 id="cx-add-vehicle-title">Add a vehicle</h1>
      </header>
      <div className="cx-add-vehicle-body">
        <p>Enter the number on the plate. We’ll fill in the bike from the registration certificate.</p>
        <label className="cx-field">
          <span>Registration number</span>
          <div className="cx-plate-input">
            <i>IND</i>
            <input value={reg} onChange={(event) => { setReg(event.target.value.toUpperCase()); setFound(false); }} />
            <button className="cx-btn cx-btn-dark small" type="button" aria-busy={loading} disabled={loading || !plateOk} onClick={fetchVehicle}>
              {loading ? <><Spinner />Finding…</> : "Find"}
            </button>
          </div>
        </label>
        {found && (
          <div className="cx-found">
            <BikeArt tone="#1f2023" type={bikeType ?? lookedUp.type} />
            <div>
              <b>{lookup ? `${lookup.make} ${lookup.model}` : "Hero Xtreme 160R"}</b>
              <small>{lookupLine(lookup, bikeTypes[bikeType ?? lookedUp.type].label)}</small>
              {(!lookup || lookup.chassisLast4) && <small>Chassis ending {lookup ? lookup.chassisLast4 : "2198"}</small>}
              <button className="cx-link" type="button" onClick={() => setChoosing((value) => !value)}>{choosing ? "Keep this type" : "Not right? Change the type"}</button>
            </div>
          </div>
        )}
        {found && choosing && <TypePicker value={bikeType} onPick={pick} />}
        {!found && !manual && (
          <Group>
            <label className="cx-row">
              <span className="cx-row-lead"><Upload /></span>
              <span className="cx-row-text"><b>Upload a photo of the RC</b><small>We’ll read the details for you</small></span>
              <input className="cx-hidden-file" type="file" aria-label="Upload RC" onChange={fetchVehicle} />
              <ChevronRight className="cx-chevron" />
            </label>
            <Row title="Enter details yourself" onClick={() => setManual(true)} chevron />
          </Group>
        )}
        {manual && (
          <div className="cx-manual">
            <div className="cx-field" role="group" aria-label="Brand">
              <span>Brand</span>
              <div className="cx-choices">
                {[...popularBrands, "Other"].map((item) => (
                  <button key={item} type="button" aria-pressed={brand === item} onClick={() => { setBrand(item); setModel(""); resetType(); }}>{item}</button>
                ))}
              </div>
              {brand === "Other" && <input className="cx-input" placeholder="Brand name" aria-label="Brand name" value={brandText} onChange={(event) => { setBrandText(event.target.value); resetType(); }} />}
            </div>
            <div className="cx-grid-2">
              <label className="cx-field">
                <span>Model</span>
                {brand === "Other" ? (
                  <input className="cx-input" placeholder="Model name" value={modelText} onChange={(event) => { setModelText(event.target.value); resetType(); }} />
                ) : (
                  <span className="cx-select">
                    <select className="cx-input" value={model} disabled={!brand} onChange={(event) => { setModel(event.target.value); resetType(); }}>
                      <option value="" disabled>{brand ? "Choose" : "Pick a brand"}</option>
                      {(catalog[brand] ?? []).map(([item]) => <option key={item} value={item}>{item}</option>)}
                      <option value="Not listed">Not listed</option>
                    </select>
                    <ChevronDown />
                  </span>
                )}
              </label>
              <label className="cx-field">
                <span>Make year</span>
                <span className="cx-select">
                  <select className="cx-input" value={year} onChange={(event) => setYear(event.target.value)}>
                    <option value="" disabled>Year</option>
                    {makeYears.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <ChevronDown />
                </span>
              </label>
            </div>
            {model === "Not listed" && brand !== "Other" && (
              <input className="cx-input" placeholder="Model name" aria-label="Model name" value={modelText} onChange={(event) => { setModelText(event.target.value); resetType(); }} />
            )}
            {modelName && (
              <div className="cx-field">
                <span>Type</span>
                <div className="cx-type-detect">
                  <span className="cx-type-art"><BikeArt type={bikeType ?? "commuter"} tone={tone} /></span>
                  <span className="cx-row-text">
                    <b>{bikeType ? bikeTypes[bikeType].label : "Which one looks like yours?"}</b>
                  </span>
                  {bikeType && <button className="cx-link" type="button" onClick={() => setChoosing((value) => !value)}>{choosing ? "Done" : "Change"}</button>}
                </div>
                {(choosing || needsType) && <TypePicker value={bikeType} onPick={pick} />}
              </div>
            )}
            <div className="cx-field" role="group" aria-label="Colour">
              <div className="cx-field-row">
                <span>Colour</span>
                <b>{colour === "Custom" ? "Your own colour" : colour}</b>
              </div>
              <div className="cx-swatches">
                {bikeColours.map(([label, hex]) => (
                  <button key={label} type="button" aria-label={label} title={label} aria-pressed={colour === label} style={{ background: hex }} onClick={() => setColour(label)}>
                    {colour === label && <Check style={{ color: inkOn(hex) }} />}
                  </button>
                ))}
                <label className={`cx-swatch-custom${colour === "Custom" ? " on" : ""}`} title="Another colour" style={colour === "Custom" ? { background: customHex } : undefined}>
                  <input
                    type="color"
                    value={customHex}
                    aria-label="Another colour"
                    onChange={(event) => {
                      setCustomHex(event.target.value);
                      setColour("Custom");
                    }}
                  />
                  {colour === "Custom" ? <Check style={{ color: inkOn(customHex) }} /> : <Plus />}
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      <footer>
        <button className="cx-btn cx-btn-primary" type="button" disabled={!ready} onClick={save}>Add to garage</button>
      </footer>
    </div>,
    portal,
  );
}

function leaveGarage(open: (screen: string) => void, screen: string) {
  garageMemory.handoff = true;
  open(screen);
}

function backToGarage(open: (screen: string) => void) {
  garageMemory.restore = true;
  open("Garage & history");
}

function useFromGarage() {
  const [fromGarage] = useState(() => garageMemory.handoff);
  useEffect(() => {
    garageMemory.handoff = false;
  }, []);
  return fromGarage;
}

function Garage({ state, setState, open, firstTime }: AppProps) {
  const [restoring] = useState(() => garageMemory.restore);
  const [picked, setVehicle] = useState<string>(() => (restoring ? garageMemory.vehicle : garageMemory.select ?? "guerrilla"));
  const [added, setAdded] = useState<Record<string, GarageBike>>(() => garageMemory.added);
  const [adding, setAdding] = useState(() => garageMemory.adding);
  const [arrivals, setArrivals] = useState(0);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [fanned, setFanned] = useState(() => restoring && garageMemory.fanned);
  const anchor = useRef<HTMLElement>(null);
  const vehicleRow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = anchor.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    if (restoring) {
      viewport.scrollTop = garageMemory.scroll;
      requestAnimationFrame(() => {
        viewport.scrollTop = garageMemory.scroll;
      });
    } else {
      garageMemory.scroll = 0;
    }
    const remember = () => {
      garageMemory.scroll = viewport.scrollTop;
    };
    viewport.addEventListener("scroll", remember, { passive: true });
    return () => viewport.removeEventListener("scroll", remember);
  }, [restoring]);
  useEffect(() => {
    garageMemory.restore = false;
    garageMemory.select = null;
    garageMemory.adding = false;
    garageMemory.openDoc = null;
  }, []);
  useEffect(() => {
    garageMemory.vehicle = picked;
    garageMemory.fanned = fanned;
  }, [picked, fanned]);
  const [viewing, setViewing] = useState<DocId | null>(() => garageMemory.openDoc);
  const [saved, setSaved] = useState<Partial<Record<string, number>>>({});
  const [editing, setEditing] = useState(false);
  const [draftTenths, setDraftTenths] = useState<number | null>(null);
  const shown: Record<string, GarageBike> = { ...vehicles, ...added };
  const stockKeys = garageKeys(firstTime);
  const keys = [...stockKeys, ...Object.keys(added).filter((id) => !stockKeys.includes(id))];
  const vehicle = keys.includes(picked) ? picked : keys[0];
  const freshBike = firstTime || !(vehicle in vehicles);
  const insuranceDoc = useDocPhoto(vehicle, "insurance");
  const pucDoc = useDocPhoto(vehicle, "puc");
  useLayoutEffect(() => {
    const row = vehicleRow.current;
    const selected = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !selected) return;
    const edge = 32;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    const behavior = arrivals ? "smooth" : "auto";
    if (left < row.scrollLeft) row.scrollTo({ left: Math.max(0, left - edge), behavior });
    else if (right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: right - row.clientWidth + edge, behavior });
  }, [vehicle, arrivals]);
  const [rowOverflows, setRowOverflows] = useState(false);
  useLayoutEffect(() => {
    const row = vehicleRow.current;
    if (!row) return;
    const measure = () => setRowOverflows(row.scrollWidth > row.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [keys.length]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 700);
    return () => window.clearTimeout(timer);
  }, [leaving, arrivals]);
  const bike = shown[vehicle];
  const book = garageRecord(vehicle);
  const recorded = saved[vehicle];
  const blank = recorded === undefined && freshBike && !editing;
  const floor = recorded ?? (freshBike ? 0 : book.odo);
  const tenths = editing && draftTenths !== null ? draftTenths : floor;
  const km = (editing ? floor : tenths) / 10;
  const formatKm = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  const odoNote = editing
    ? "Drag a dial up or down"
    : recorded !== undefined
      ? "You updated it just now"
      : freshBike
        ? "Not recorded yet"
        : book.odoNote;
  useEffect(() => {
    setEditing(false);
    setDraftTenths(null);
  }, [vehicle, firstTime]);
  const beginEdit = () => {
    haptic.tap();
    setDraftTenths(floor);
    setEditing(true);
  };
  const rollTo = (next: number) => {
    const clamped = Math.min(9_999_999, Math.max(floor, next));
    if (clamped !== next) haptic.edge();
    else haptic.tick();
    setDraftTenths(clamped);
  };
  const saveReading = () => {
    const next = draftTenths ?? floor;
    if (freshBike && recorded === undefined && next === 0) {
      toast("Roll the dials up from zero");
      return;
    }
    haptic.done();
    if (onServer) {
      api(`/v1/vehicles/${vehicle}`, { method: "PATCH", body: { odometerKm: Math.round(next / 10) } })
        .then(() => reloadLive())
        .catch((error) => toast.error(messageOf(error)));
    }
    setSaved((current) => ({ ...current, [vehicle]: next }));
    setEditing(false);
    setDraftTenths(null);
    if (next !== floor) toast.success(`Odometer saved at ${formatKm(next / 10)} km`);
  };
  const known = !(freshBike && recorded === undefined);
  const schedule = freshBike ? freshSchedule : kmSchedule[vehicle] ?? freshSchedule;
  const noIns = onServer && book.insurance.till === "Not added";
  const noPuc = onServer && book.puc.till === "Not added";
  const wear = known
    ? schedule.map(([name, doneAt, every]) => ({ name, ...kmLife(km, doneAt, every) }))
    : [];
  const score = wear.length ? Math.round(wear.reduce((sum, item) => sum + item.pct, 0) / wear.length) : null;
  const soonest = [...wear].sort((a, b) => a.left - b.left)[0];
  const verdict = !soonest
    ? "Not checked yet"
    : soonest.left <= 0
      ? `${soonest.name} is due`
      : soonest.pct < 40
        ? `${soonest.name} is getting close`
        : "On schedule";
  const basis = known
    ? `Estimated from ${formatKm(km)} km`
    : "Add a reading and oil, chain and brakes follow from the kilometres.";
  const nextPin = kmPins.find((pin) => km < pin) ?? kmPins[kmPins.length - 1];
  const prevPin = [0, ...kmPins].filter((pin) => pin <= km).pop() ?? 0;
  const pinProgress = Math.round(((km - prevPin) / (nextPin - prevPin)) * 100);
  const park = (key: string) => {
    if (key === vehicle) return;
    setDirection(keys.indexOf(key) > keys.indexOf(vehicle) ? 1 : -1);
    setLeaving(vehicle);
    setVehicle(key);
    setArrivals((value) => value + 1);
  };
  const slide = { "--dir": direction } as React.CSSProperties;
  const original = (doc: DocId) => (
    <button
      className="cx-doc-original"
      tabIndex={fanned ? 0 : -1}
      aria-hidden={!fanned || undefined}
      onClick={(event) => {
        event.stopPropagation();
        setViewing(doc);
      }}
    >
      <ImageIcon />Original
    </button>
  );
  const title = (key: string, state: string) => (
    <div className={`cx-garage-title ${state}`} key={`${state}-${key}-${arrivals}`} style={slide} aria-hidden={state === "out" || undefined}>
      <small>{shown[key].make}, {shown[key].colour}</small>
      <h2>{shown[key].name}</h2>
      <Plate value={shown[key].plate} />
    </div>
  );
  const acceptVehicle = (next: GarageBike) => {
    if (onServer) {
      api<{ id: string }>("/v1/vehicles", {
        body: { registrationNumber: next.plate, make: next.make, model: next.name, bodyType: next.type, colourName: next.colour, colourHex: /^#[0-9a-f]{6}$/i.test(next.tone) ? next.tone : null },
      })
        .then(async (created) => {
          await reloadLive();
          setDirection(1);
          setLeaving(vehicle);
          setVehicle(created.id);
          setArrivals((value) => value + 1);
          setAdding(false);
          toast.success(`${next.name} is in your garage`);
        })
        .catch((error) => toast.error(messageOf(error)));
      return;
    }
    const id = `plate:${plateKey(next.plate)}`;
    setAdded((current) => {
      const fleet = { ...current, [id]: next };
      garageMemory.added = fleet;
      return fleet;
    });
    if (id !== vehicle) {
      setDirection(1);
      setLeaving(vehicle);
      setVehicle(id);
      setArrivals((value) => value + 1);
    }
    setAdding(false);
    toast.success(`${next.name} is in your garage`);
  };
  return (
    <PhoneFrame tab="Garage" onTab={open} tone="night">
      {adding && (
        <AddVehicle
          plates={keys.map((key) => shown[key].plate)}
          onClose={() => setAdding(false)}
          onSave={acceptVehicle}
        />
      )}
      {viewing && <DocViewer key={`${vehicle}-${viewing}`} doc={viewing} vehicle={vehicle} sample={!freshBike && !onServer} onClose={() => setViewing(null)} />}
      <svg className="cx-defs" aria-hidden="true">
        <filter id="cx-ink-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
        </filter>
      </svg>

      <header className="cx-garage-top" ref={anchor}>
        <h1>Garage</h1>
      </header>

      <div className="cx-vehicle-row">
        <div className={`cx-vehicles${rowOverflows ? " overflows" : ""}`} role="tablist" aria-label="Your vehicles" ref={vehicleRow}>
          {keys.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={vehicle === key} className="cx-vehicle" onClick={() => park(key)}>
              <span className="cx-vehicle-photo"><BikeArt tone={shown[key].tone} type={shown[key].type} /></span>
              <span className="cx-vehicle-text">
                <b>{shown[key].name}</b>
                <small>{shown[key].plate}</small>
              </span>
              {vehicle === key && <i className="cx-vehicle-tick"><Check /></i>}
            </button>
          ))}
        </div>
        <button className="cx-vehicle-add" type="button" aria-label="Add vehicle" onClick={() => setAdding(true)}>
          <Plus />
          <span>Add</span>
        </button>
      </div>

      <section className="cx-bay" aria-label={`${bike.make} ${bike.name} parked in your garage`}>
        <span className="cx-bay-light" />
        <span className="cx-bay-cone" />
        {leaving && (
          <div className="cx-bay-bike out" key={`out-${leaving}-${arrivals}`} style={slide} aria-hidden="true">
            <BikeArt tone={shown[leaving].tone} type={shown[leaving].type} />
            <BikeArt tone={shown[leaving].tone} type={shown[leaving].type} className="mirror" />
          </div>
        )}
        <div className={`cx-bay-bike ${arrivals ? "roll" : ""}`} key={`${vehicle}-${arrivals}`} style={slide}>
          <BikeArt tone={bike.tone} type={bike.type} />
          <BikeArt tone={bike.tone} type={bike.type} className="mirror" />
        </div>
      </section>

      <div className="cx-garage-name">
        {leaving && title(leaving, "out")}
        {title(vehicle, arrivals ? "roll" : "")}
      </div>
      <PopButton className="block" onClick={() => leaveGarage(open, "Book service")}>{firstTime ? "Book your first service" : "Book a service"}</PopButton>

      <section className="cx-group">
        <div className="cx-group-head">
          <h3>Odometer</h3>
          <button className="cx-link" onClick={editing ? saveReading : beginEdit}>{editing ? "Save" : blank ? "Add reading" : "Update"}</button>
        </div>
        <Odometer tenths={editing ? tenths : floor} blank={blank} editing={editing} onChange={rollTo} />
        <small className="cx-odo-note">{odoNote}</small>
      </section>

      <section className="cx-health">
        <div className="cx-health-top">
          <HealthGauge key={`${vehicle}-${score ?? "empty"}`} score={score} />
          <div>
            <p className="cx-health-score">{score ?? "–"}<small>/100</small></p>
            <b>{verdict}</b>
            <small>{basis}</small>
          </div>
        </div>
        {wear.length > 0 && (
          <ul className="cx-parts">
            {wear.map(({ name, pct, note }) => (
              <li key={name}>
                <span><b>{name}</b><small>{note}</small></span>
                <span className={`cx-fuel ${pct < 35 ? "low" : pct < 60 ? "mid" : ""}`} aria-label={`${pct}% left`}>
                  {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < Math.round(pct / 12.5) ? "on" : ""} />)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cx-group">
        <div className="cx-group-head"><h3>Glovebox</h3><small>{fanned ? "Tap to stack" : "Tap to spread out"}</small></div>
        <div className={`cx-glovebox ${fanned ? "open" : ""}`} onClick={() => setFanned((value) => !value)}>
          <article className="cx-doc rc">
            <header><b>Registration certificate</b><span className="cx-doc-status">{vehicle in vehicles ? "Verified" : "Added"}</span></header>
            <div className="cx-doc-body">
              <span className="cx-chip" />
              <strong>{bike.plate}</strong>
              <small>{onServer ? state.profile.name : vehicle in vehicles ? "Sanath Naik, registered Mar 2025" : "Added just now"}</small>
            </div>
            {original("rc")}
          </article>
          {(freshBike || noIns) && insuranceDoc.photo ? (
            <article className="cx-doc ins">
              <header><b>Insurance</b><span className="cx-doc-status">Photo added</span></header>
              <div className="cx-doc-body">
                <strong>Saved on this phone</strong>
                <small>Added {insuranceDoc.at ?? "today"}. {firstName(advisor.name)} checks the dates at your {freshBike ? "first" : "next"} service.</small>
              </div>
              {original("insurance")}
            </article>
          ) : freshBike || noIns ? (
            <article className="cx-doc empty">
              <header><b>Insurance</b><button className="cx-link" onClick={(event) => { event.stopPropagation(); setViewing("insurance"); }}>Add</button></header>
              <div className="cx-doc-body"><small>We’ll remind you a month before it lapses.</small></div>
            </article>
          ) : (
            <article className="cx-doc ins">
              <header><b>Insurance</b><span className={`cx-doc-status ${book.insurance.due ? "due" : ""}`}>{book.insurance.till}</span></header>
              <div className="cx-doc-body">
                <strong>{book.insurance.insurer}</strong>
                <small>{book.insurance.cover}{onServer ? "" : ", policy ending 4471"}</small>
                {book.insurance.due && <PopButton tone="light" className="small" onClick={(event) => { event.stopPropagation(); toast("Renewal quotes from 3 insurers"); }}>Renew</PopButton>}
              </div>
              {original("insurance")}
            </article>
          )}
          {(freshBike || noPuc) && pucDoc.photo ? (
            <article className="cx-doc puc">
              <header><b>Pollution certificate</b><span className="cx-doc-status">Photo added</span></header>
              <div className="cx-doc-body">
                <strong>Saved on this phone</strong>
                <small>Added {pucDoc.at ?? "today"}. {firstName(advisor.name)} checks the reading at your {freshBike ? "first" : "next"} service.</small>
              </div>
              {original("puc")}
            </article>
          ) : freshBike || noPuc ? (
            <article className="cx-doc empty">
              <header><b>Pollution certificate</b><button className="cx-link" onClick={(event) => { event.stopPropagation(); setViewing("puc"); }}>Add</button></header>
              <div className="cx-doc-body"><small>Or we’ll get a fresh one at your first service.</small></div>
            </article>
          ) : (
            <article className="cx-doc puc">
              <header><b>Pollution certificate</b><span className={`cx-doc-status ${book.puc.due ? "due" : ""}`}>{book.puc.till}</span></header>
              <div className="cx-doc-body">
                <strong>Petrol, 4 stroke</strong>
                <small>{book.puc.reading}</small>
              </div>
              <span className="cx-pass">PASS</span>
              {original("puc")}
            </article>
          )}
        </div>
        <Group>
          <Row lead={<ShieldCheck />} title="Warranties" detail={freshBike ? "None yet" : book.warranties} chevron onClick={() => leaveGarage(open, "Warranty tracker")} />
        </Group>
      </section>

      <section className="cx-group">
        <div className="cx-group-head"><h3>Service book</h3><small>{freshBike ? "No stamps yet" : `${bike.services} stamps`}</small></div>
        <div className="cx-book">
          {!freshBike && book.services.map((row, index) => {
            const [title, date, reading, invoiceId] = row;
            return (
              <div className="cx-book-row" key={`${date}-${index}`}>
                <span>
                  <b>{title}</b>
                  <small>{date}, {reading}</small>
                  {invoiceId && (
                    <button
                      className="cx-link"
                      onClick={() => {
                        const payment = state.payments.find((entry) => entry.id === invoiceId);
                        if (!payment) return;
                        setState((current) => ({ ...current, viewingPaymentId: payment.id, selectedBookingId: payment.bookingId ?? null }));
                        leaveGarage(open, "Job card closed + pay");
                      }}
                    >
                      Invoice
                    </button>
                  )}
                </span>
                <Stamp date={date} turn={[-9, 7, -4][index] ?? -6} />
              </div>
            );
          })}
          <div className="cx-book-row next">
            <span><b>{freshBike ? "Your first service" : "Next service"}</b><small>{freshBike ? "Book it and it gets stamped here" : book.next}</small></span>
            <span className="cx-stamp-slot" />
          </div>
          {!freshBike && book.earlier > 0 && <button className="cx-link" onClick={() => toast("Opening the full service book")}>See {book.earlier} earlier stamps</button>}
        </div>
      </section>

      <section className="cx-group">
        <div className="cx-group-head"><h3>Kilometre club</h3><small>{blank ? "Starts with your first reading" : `${kmPins.filter((pin) => km >= pin).length} of ${kmPins.length} pins`}</small></div>
        <div className="cx-pins">
          {kmPins.map((pin) => {
            const earned = !blank && km >= pin;
            const upcoming = !blank && pin === nextPin;
            return (
              <span
                key={pin}
                className={`cx-pin ${earned ? "on" : ""} ${upcoming ? "next" : ""}`}
                style={upcoming ? ({ "--p": pinProgress } as React.CSSProperties) : undefined}
              >
                <b>{pin / 1000}k</b>
              </span>
            );
          })}
        </div>
        <p className="cx-pin-note">
          {blank
            ? "Add your odometer reading and every 1,000 km starts counting towards a pin."
            : `${Math.max(0, Math.round(nextPin - km)).toLocaleString("en-IN")} km to the ${nextPin.toLocaleString("en-IN")} km pin, which comes with ₹200 off a service.`}
        </p>
      </section>
    </PhoneFrame>
  );
}

/** Warranties of all the customer's bikes: title, brand, what is left, percent left (real data only). */
let liveWarranties: [string, string, string, number][] = [];

function Warranty({ open, firstTime }: { open: (screen: string) => void; firstTime: boolean }) {
  const fromGarage = useFromGarage();
  const back = () => (fromGarage ? backToGarage(open) : open("Garage & history"));
  const items = [
    ["Bike warranty", "Royal Enfield", "11 months left", 54],
    ["Battery", "Exide Xplore", "Till 18 Jan 2027", 72],
    ["Front tyre", "Ceat Zoom", "12,400 of 18,000 km left", 38],
    ["Front brake pads", "Genuine part", "8 months left", 62],
  ] as const;
  const shownItems: readonly (readonly [string, string, string, number])[] = onServer ? liveWarranties : items;
  if (firstTime || shownItems.length === 0) {
    return (
      <PhoneFrame footer={<button className="cx-btn cx-btn-quiet" onClick={() => toast(onServer ? "Ask the workshop to add it at your next visit" : "Add a warranty")}><Plus /> Add a warranty</button>}>
        <TopBar title="Warranties" onBack={back} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>No warranties yet</h1>
          <p>Add your bike’s warranty, or wait for the first service. Parts we fit come with their own, tracked here.</p>
        </div>
      </PhoneFrame>
    );
  }
  return (
    <PhoneFrame footer={<button className="cx-btn cx-btn-quiet" onClick={() => toast("Add a warranty")}><Plus /> Add a warranty</button>}>
      <TopBar title="Warranties" onBack={back} />
      <div className="cx-heading">
        <h1>{onServer ? `${shownItems.length} active ${shownItems.length === 1 ? "warranty" : "warranties"}` : "Four active warranties"}</h1>
        <p>We keep the receipts and serial numbers, and remind you a month before each one ends.</p>
      </div>
      <div className="cx-list">
        {shownItems.map(([title, brand, detail, value]) => (
          <button className="cx-row cx-warranty" key={title} onClick={() => toast(`${title} details`)}>
            <span className="cx-row-text">
              <b>{title}</b>
              <small>{brand}</small>
              <span className="cx-meter"><i style={{ width: `${value}%` }} /></span>
              <small>{detail}</small>
            </span>
            <ChevronRight className="cx-chevron" />
          </button>
        ))}
      </div>
    </PhoneFrame>
  );
}

function PhoneSheet(props: React.ComponentProps<typeof SheetContent>) {
  const portal = useContext(PhonePortalContext);
  return <SheetContent {...props} container={portal} />;
}

const advisor = { name: "Amit Patil", phone: "+91 98450 11223", tel: "tel:+919845011223", wa: "919845011223" };
const workshopTel = { href: advisor.tel };

function AdvisorSheet({ open, onOpenChange, note = "Service advisor for your bikes and bookings." }: { open: boolean; onOpenChange: (open: boolean) => void; note?: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <PhoneSheet side="bottom" className="cx-sheet cx-advisor-sheet">
        <SheetHeader>
          <SheetTitle>{advisor.name}</SheetTitle>
          <SheetDescription>{note}</SheetDescription>
        </SheetHeader>
        <div className="cx-sheet-body">
          <p className="cx-advisor-number">{advisor.phone}</p>
          <a className="cx-btn cx-btn-primary" href={advisor.tel}><PhoneIcon /> Call</a>
        </div>
      </PhoneSheet>
    </Sheet>
  );
}

function GarageHelpSheet({
  help,
  bookings,
  onOpenChange,
}: {
  help: null | { kind: "renew" | "puc"; vehicle: VehicleId };
  bookings: ServiceBooking[];
  onOpenChange: (open: boolean) => void;
}) {
  const key = help?.vehicle ?? (onServer ? liveGarage[0] ?? "" : "classic");
  const bike = vehicles[key];
  const book = garageBook[key];
  const am = firstName(advisor.name);
  if (!bike || !book) return null;
  const active = bookings.find((item) => item.vehicleId === key && item.stage < 6);
  const pucPrice = services.find((service) => service.id === "puc")?.price ?? 100;
  const renewing = help?.kind === "renew";
  const note = renewing
    ? `${book.insurance.insurer}, ${book.insurance.cover.toLowerCase()}. ${book.insurance.till}. ${am} can ask 3 insurers for a quote. You pay the insurer after you pick one.`
    : active && active.stage >= 3 && active.stage <= 4
      ? `The ${bike.name} is in the workshop now. A pollution certificate is ${inr(pucPrice)}. Ask ${am} to add it to this job. You pay after the work.`
      : `The ${bike.name} is already booked. A pollution certificate is ${inr(pucPrice)}. Ask ${am} to add it to that visit. You pay after the work.`;
  const waText = renewing
    ? `Hi ${am}, please get insurance quotes for my ${bike.name}, ${bike.plate}. ${book.insurance.insurer}, ${book.insurance.cover.toLowerCase()}, ${book.insurance.till.toLowerCase()}.`
    : `Hi ${am}, please add a pollution certificate to the current job for my ${bike.name}, ${bike.plate}. It is ${inr(pucPrice)}.`;
  return (
    <Sheet open={help !== null} onOpenChange={onOpenChange}>
      <PhoneSheet side="bottom" className="cx-sheet cx-help-sheet">
        <SheetHeader>
          <SheetTitle>{renewing ? "Renew insurance" : "Pollution certificate"}</SheetTitle>
          <SheetDescription>{bike.name}, {bike.plate}</SheetDescription>
        </SheetHeader>
        <div className="cx-sheet-body">
          <p className="cx-help-note">{note}</p>
          <p className="cx-advisor-number">{advisor.phone}</p>
          <div className="cx-help-actions">
            <a className="cx-btn cx-btn-primary" href={`https://wa.me/${advisor.wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp {am}</a>
            <a className="cx-btn cx-btn-quiet" href={advisor.tel}><PhoneIcon /> Call {am}</a>
          </div>
        </div>
      </PhoneSheet>
    </Sheet>
  );
}

function PhoneDialog(props: React.ComponentProps<typeof DialogContent>) {
  const portal = useContext(PhonePortalContext);
  return <DialogContent {...props} container={portal} />;
}

const roadside = { phone: "+91 80 4718 2200", tel: "tel:+918047182200" };

/** Sends the customer's location to the workshop on WhatsApp (real data only). */
function shareRoadsideLocation() {
  const send = (where: string) => {
    const text = `I need roadside help. ${where}`;
    window.open(`https://wa.me/${advisor.wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };
  if (!navigator.geolocation) return send("Please call me.");
  navigator.geolocation.getCurrentPosition(
    (position) => send(`My location: https://maps.google.com/?q=${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`),
    () => send("Please call me."),
    { enableHighAccuracy: true, timeout: 8000 },
  );
}

function RoadsideDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <PhoneDialog className="cx-dialog">
        <DialogHeader><DialogTitle>Send roadside help?</DialogTitle><DialogDescription>We’ll share your location with the nearest rider and call you within two minutes.</DialogDescription></DialogHeader>
        <div className="cx-stack">
          <button className="cx-btn cx-btn-danger" onClick={() => (onServer ? shareRoadsideLocation() : toast.success("Help is on the way. Request SOS-2291."))}><Navigation /> Share my location</button>
          <a className="cx-btn cx-btn-quiet" href={roadside.tel}><PhoneIcon /> Call {roadside.phone}</a>
        </div>
      </PhoneDialog>
    </Dialog>
  );
}

function Profile({ state, open, firstTime, theme, setTheme }: AppProps) {
  const [push, setPush] = useState(true);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const testTools = useContext(TestToolsContext);
  const dueBills = state.bookings.filter((item) => !item.paid && item.stage >= 5).length;
  return (
    <PhoneFrame tab="Profile" onTab={open}>
      <header className="cx-profile">
        <span className="cx-avatar large">{initials(state.profile.name)}</span>
        <div><h1>{state.profile.name}</h1><p>+91 {state.profile.phone}</p></div>
        <button className="cx-btn cx-btn-quiet small" onClick={() => open("Edit profile")}>Edit</button>
      </header>
      <Group>
        <Row lead={<Wallet />} title="Wallet" detail="Workshop credit" value={inr(state.wallet)} chevron onClick={() => openWallet(open, "Profile")} />
        <Row lead={<Share2 />} title="Refer a friend" detail="You both get ₹200" chevron onClick={() => open("Refer a friend")} />
        <Row lead={<ReceiptIndianRupee />} title="Payment history" detail={firstTime ? "None yet" : dueBills ? "Ready to pay" : "What you have paid"} value={firstTime ? "None" : dueBills ? String(dueBills) : String(state.payments.length)} chevron onClick={() => openPaymentHistory(open, "Profile")} />
        <Row lead={<Gift />} title="Offers" value={String(offersFor(firstTime).length)} chevron onClick={() => open("Offers")} />
        <Row lead={<History />} title="Service history" value={onServer ? String(state.bookings.filter((item) => item.stage >= 6).length || "None") : firstTime ? "None" : "4"} chevron onClick={() => open("Garage & history")} />
        <Row lead={<ShieldCheck />} title="Warranties" value={onServer ? String(liveWarranties.length || "None") : firstTime ? "None" : "4"} chevron onClick={() => open("Warranty tracker")} />
      </Group>
      <Group>
        <Row
          lead={<span className="cx-avatar">{initials(advisor.name)}</span>}
          title="Call the advisor"
          detail={`${advisor.name}, service advisor`}
          value={<PhoneIcon />}
          onClick={() => setAdvisorOpen(true)}
        />
        <Sheet>
          <SheetTrigger asChild>
            <button className="cx-row"><span className="cx-row-lead"><MapPin /></span><span className="cx-row-text"><b>Saved addresses</b></span><span className="cx-row-value">{state.addresses.length || "None"}</span><ChevronRight className="cx-chevron" /></button>
          </SheetTrigger>
          <PhoneSheet side="bottom" className="cx-sheet">
            <SheetHeader><SheetTitle>Saved addresses</SheetTitle><SheetDescription>Used for pickup and delivery.</SheetDescription></SheetHeader>
            <div className="cx-sheet-body">
              {state.addresses.length === 0 ? (
                <p className="cx-fine">Add home so a rider knows where to collect the bike.</p>
              ) : (
                <div className="cx-list">
                  {state.addresses.map((address) => (
                    <Row
                      key={address.id}
                      lead={address.label === "Home" ? <Home /> : address.label === "Work" ? <Warehouse /> : <MapPin />}
                      title={address.label}
                      detail={address.line}
                    />
                  ))}
                </div>
              )}
              <button className="cx-btn cx-btn-dark" onClick={() => open("Add address")}><Plus /> Add an address</button>
            </div>
          </PhoneSheet>
        </Sheet>
        <label className="cx-row">
          <span className="cx-row-lead"><Bell /></span>
          <span className="cx-row-text"><b>Service updates</b><small>Push, SMS and WhatsApp</small></span>
          <Switch checked={push} onCheckedChange={setPush} />
        </label>
        <div className="cx-row">
          <span className="cx-row-lead">{theme === "dark" ? <Moon /> : <Sun />}</span>
          <span className="cx-row-text"><b>Appearance</b></span>
          <div className="cx-segmented cx-appearance" role="radiogroup" aria-label="Appearance">
            <button role="radio" aria-checked={theme === "light"} aria-selected={theme === "light"} onClick={() => setTheme("light")}>Light</button>
            <button role="radio" aria-checked={theme === "dark"} aria-selected={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button className="cx-row"><span className="cx-row-lead"><LifeBuoy /></span><span className="cx-row-text"><b>Help</b></span><ChevronRight className="cx-chevron" /></button>
          </DialogTrigger>
          <PhoneDialog className="cx-dialog">
            <DialogHeader><DialogTitle>How can we help?</DialogTitle><DialogDescription>Your bike and booking details are shared with the team automatically.</DialogDescription></DialogHeader>
            <div className="cx-stack">
              <a className="cx-btn cx-btn-dark" href={`https://wa.me/${advisor.wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> Chat with {firstName(advisor.name)}</a>
              <a className="cx-btn cx-btn-quiet" href={workshopTel.href}><PhoneIcon /> Call the workshop</a>
            </div>
          </PhoneDialog>
        </Dialog>
      </Group>
      <Group>
        <RoadsideDialog>
          <button className="cx-row danger"><span className="cx-row-lead"><Siren /></span><span className="cx-row-text"><b>Roadside help</b><small>Breakdown, flat tyre or accident</small></span><ChevronRight className="cx-chevron" /></button>
        </RoadsideDialog>
      </Group>
      <Group title="Our other brand">
        <a className="cx-row" href="https://bikepharma.com/" target="_blank" rel="noopener noreferrer">
          <span className="cx-row-text"><b>Bike Pharma</b><small>{Capacitor.isNativePlatform() ? "Opens in your browser" : "Opens in a new tab"}</small></span>
          <ExternalLink className="cx-chevron" />
        </a>
      </Group>
      {onServer && (
        <Group>
          <Row
            lead={<UserRound />}
            title="Log out"
            detail={`+91 ${state.profile.phone}`}
            chevron
            onClick={() => {
              logout().finally(() => open("Login / Sign up"));
            }}
          />
        </Group>
      )}
      {testTools && !onServer && (
        <Group title="Test build">
          <div className="cx-row">
            <span className="cx-row-lead"><UserRound /></span>
            <span className="cx-row-text"><b>Sample customer</b></span>
            <div className="cx-segmented cx-appearance" role="radiogroup" aria-label="Sample customer">
              <button role="radio" aria-checked={testTools.experience === "first"} aria-selected={testTools.experience === "first"} onClick={() => testTools.setExperience("first")}>New</button>
              <button role="radio" aria-checked={testTools.experience === "returning"} aria-selected={testTools.experience === "returning"} onClick={() => testTools.setExperience("returning")}>Returning</button>
            </div>
          </div>
          <Row lead={<History />} title="Start over" detail="Intro, login and add your bike again" chevron onClick={testTools.restart} />
        </Group>
      )}
      <AdvisorSheet open={advisorOpen} onOpenChange={setAdvisorOpen} />
    </PhoneFrame>
  );
}

const languages: { id: ProfileInfo["language"]; label: string }[] = [
  { id: "English", label: "English" },
  { id: "Kannada", label: "ಕನ್ನಡ" },
  { id: "Hindi", label: "हिंदी" },
];

function tenDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function spaced(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

function EditProfile({ state, setState, open }: AppProps) {
  const saved = state.profile;
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [language, setLanguage] = useState(saved.language);
  const [backupName, setBackupName] = useState(saved.backupName);
  const [backupPhone, setBackupPhone] = useState(saved.backupPhone);
  const [numberOpen, setNumberOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const backupDigits = tenDigits(backupPhone);
  const emailOk = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const backupOk = (backupName.trim() === "" && backupDigits === "") || (backupName.trim().length > 0 && backupDigits.length === 10);
  const nameOk = name.trim().length >= 2;
  const next: ProfileInfo = {
    ...saved,
    name: name.trim().replace(/\s+/g, " "),
    email: email.trim(),
    language,
    backupName: backupName.trim(),
    backupPhone: backupDigits ? spaced(backupDigits) : "",
  };
  const changed = (Object.keys(next) as (keyof ProfileInfo)[]).some((key) => next[key] !== saved[key]);
  const openBookings = state.bookings.filter((item) => item.stage < 6).length;
  const save = () => {
    if (onServer) {
      api("/v1/me", {
        method: "PATCH",
        body: { name: next.name, email: next.email || null, language: next.language, backupContactName: next.backupName || null, backupContactPhone: backupDigits || null },
      })
        .then(async () => {
          await reloadLive();
          toast.success("Profile saved");
          open("Profile");
        })
        .catch((error) => toast.error(messageOf(error)));
      return;
    }
    setState((current) => ({ ...current, profile: next }));
    toast.success("Profile saved");
    open("Profile");
  };
  const sendCode = () => {
    if (onServer) {
      toast("To change your number, call the workshop. Your bikes and bookings move with you.");
      setNumberOpen(false);
      return;
    }
    toast.success(`Code sent to +91 ${spaced(tenDigits(newNumber))}`, { description: "Enter it to switch. Your bikes and bookings stay with you." });
    setNumberOpen(false);
    setNewNumber("");
  };
  return (
    <PhoneFrame
      tone="white"
      footer={<button className="cx-btn cx-btn-primary" disabled={!changed || !nameOk || !emailOk || !backupOk} onClick={save}>Save changes</button>}
    >
      <TopBar title="Edit profile" onBack={() => open("Profile")} />
      <div className="pf-avatar">
        <span className="cx-avatar large">{initials(name)}</span>
        <small>Your initials show to the rider and the workshop.</small>
      </div>

      <label className="cx-field">
        <span>Your name</span>
        <input className="cx-input" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        {!nameOk && <small className="pf-error">Enter your name so the rider knows who to ask for.</small>}
      </label>

      <div className="cx-field">
        <span>Mobile number</span>
        <div className="pf-phone">
          <span className="pf-phone-number">+91 {saved.phone}</span>
          <span className="pf-verified"><ShieldCheck />Verified</span>
          <button type="button" className="cx-link" onClick={() => setNumberOpen(true)}>Change</button>
        </div>
        <small className="cx-addr-hint">You log in with this number. Service updates come here.</small>
      </div>

      <label className="cx-field">
        <span>Email (optional)</span>
        <input className="cx-input" type="email" inputMode="email" autoComplete="email" placeholder="For invoices by email" value={email} onChange={(event) => setEmail(event.target.value)} />
        {!emailOk && <small className="pf-error">That email doesn’t look right.</small>}
      </label>

      <div className="cx-field" role="group" aria-label="Language for updates">
        <span>Language for updates</span>
        <div className="cx-choices">
          {languages.map((item) => (
            <button key={item.id} type="button" aria-pressed={language === item.id} lang={item.id === "Kannada" ? "kn" : item.id === "Hindi" ? "hi" : "en"} onClick={() => setLanguage(item.id)}>{item.label}</button>
          ))}
        </div>
        <small className="cx-addr-hint">For SMS, WhatsApp and calls from the workshop.</small>
      </div>

      <div className="cx-field" role="group" aria-label="Backup contact">
        <span>Backup contact (optional)</span>
        <input className="cx-input" placeholder="Name, like a family member" aria-label="Backup contact name" value={backupName} onChange={(event) => setBackupName(event.target.value)} />
        <div className="cx-input-group">
          <em>+91</em>
          <input inputMode="numeric" placeholder="Mobile number" aria-label="Backup contact mobile number" value={backupPhone} onChange={(event) => setBackupPhone(event.target.value.replace(/[^\d ]/g, "").slice(0, 11))} />
        </div>
        {!backupOk && <small className="pf-error">Add both a name and a 10-digit number, or leave both empty.</small>}
        <small className="cx-addr-hint">We call them only if we can’t reach you about your bike.</small>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="pf-delete">Delete my account</button>
        </DialogTrigger>
        <PhoneDialog className="cx-dialog">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              {openBookings > 0
                ? `You have ${openBookings === 1 ? "an open booking" : `${openBookings} open bookings`}. Once ${openBookings === 1 ? "it is" : "they are"} delivered or cancelled, you can delete your account here.`
                : `Your bikes, service history and ${state.wallet > 0 ? `${inr(state.wallet)} wallet credit` : "wallet"} will be removed. Invoices are kept for tax records.`}
            </DialogDescription>
          </DialogHeader>
          <div className="cx-stack">
            {openBookings > 0 ? (
              <button className="cx-btn cx-btn-dark" onClick={() => open("Track + live view")}>See my bookings</button>
            ) : (
              <button className="cx-btn cx-btn-danger" onClick={() => {
                if (!onServer) { toast("Your account is deleted"); open("Starting page"); return; }
                api("/v1/me", { method: "DELETE" })
                  .then(() => logout()).then(() => { toast("Your account is deleted"); open("Starting page"); })
                  .catch((error) => toast.error(messageOf(error)));
              }}>Delete account</button>
            )}
          </div>
        </PhoneDialog>
      </Dialog>

      <Sheet open={numberOpen} onOpenChange={setNumberOpen}>
        <PhoneSheet side="bottom" className="cx-sheet">
          <SheetHeader>
            <SheetTitle>Change mobile number</SheetTitle>
            <SheetDescription>We’ll send a code to the new number. Your bikes and bookings move with you.</SheetDescription>
          </SheetHeader>
          <div className="cx-sheet-body">
            <div className="cx-input-group">
              <em>+91</em>
              <input inputMode="numeric" placeholder="New mobile number" aria-label="New mobile number" value={newNumber} onChange={(event) => setNewNumber(event.target.value.replace(/[^\d ]/g, "").slice(0, 11))} />
            </div>
            <button className="cx-btn cx-btn-primary" disabled={tenDigits(newNumber).length !== 10 || spaced(tenDigits(newNumber)) === saved.phone} onClick={sendCode}>Send code</button>
          </div>
        </PhoneSheet>
      </Sheet>
    </PhoneFrame>
  );
}

const mapAreas = [
  { name: "BTM 2nd Stage", line: "16th Main Rd, BTM 2nd Stage, Bengaluru 560076", x: 450, y: 450 },
  { name: "Jayanagar 4th Block", line: "11th Main Rd, Jayanagar, Bengaluru 560011", x: 170, y: 170 },
  { name: "Koramangala 6th Block", line: "80 Feet Rd, Koramangala, Bengaluru 560095", x: 740, y: 190 },
  { name: "Madiwala", line: "Hosur Rd, Madiwala, Bengaluru 560068", x: 170, y: 730 },
  { name: "HSR Layout Sector 2", line: "27th Main Rd, HSR Layout, Bengaluru 560102", x: 740, y: 720 },
];
if (onServer) {
  ["PJ Extension", "Vidyanagar", "MCC B Block", "Nijalingappa Layout", "SS Layout"].forEach((name, index) => {
    mapAreas[index].name = name;
    mapAreas[index].line = `${name}, Davangere, Karnataka`;
  });
}

const MAP = 900;
const MAP_VIEW = { w: 390, h: 360 };
const homeSpot = { x: MAP_VIEW.w / 2 - mapAreas[0].x, y: MAP_VIEW.h / 2 - mapAreas[0].y };

function nearestArea(offset: { x: number; y: number }) {
  const cx = MAP_VIEW.w / 2 - offset.x;
  const cy = MAP_VIEW.h / 2 - offset.y;
  return mapAreas.reduce((best, area) => (Math.hypot(area.x - cx, area.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? area : best));
}

function CityMap() {
  const blocks = [];
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 6; row++) {
      const x = col * 150 + 12;
      const y = row * 150 + 12;
      const park = (col === 1 && row === 3) || (col === 4 && row === 1);
      const lake = col === 3 && row === 4;
      if (lake) continue;
      blocks.push(
        <g key={`${col}-${row}`}>
          <rect className={park ? "m-park" : "m-block"} x={x} y={y} width="126" height="126" rx="10" />
          {!park && (
            <>
              <rect className="m-lot" x={x + 12} y={y + 12} width="46" height="38" rx="4" />
              <rect className="m-lot" x={x + 68} y={y + 12} width="46" height="52" rx="4" />
              <rect className="m-lot" x={x + 12} y={y + 62} width="46" height="52" rx="4" />
              <rect className="m-lot" x={x + 68} y={y + 76} width="46" height="38" rx="4" />
            </>
          )}
        </g>,
      );
    }
  }
  return (
    <svg className="cx-map-art" width={MAP} height={MAP} viewBox={`0 0 ${MAP} ${MAP}`} aria-hidden="true">
      <rect className="m-street" width={MAP} height={MAP} />
      {blocks}
      <ellipse className="m-water" cx="525" cy="675" rx="66" ry="54" />
      <path className="m-main-edge" d="M0 300 H900 M600 0 V900 M-20 860 L880 -20" />
      <path className="m-main" d="M0 300 H900 M600 0 V900 M-20 860 L880 -20" />
      {[
        ["Outer Ring Rd", 90, 294, 0],
        ["Hosur Rd", 606, 560, 90],
        ["80 Feet Rd", 250, 612, -44],
      ].map(([label, x, y, turn]) => (
        <text key={label as string} className="m-road-label" x={x} y={y} transform={`rotate(${turn} ${x} ${y})`}>{label}</text>
      ))}
      {mapAreas.map((area) => <text key={area.name} className="m-area" x={area.x} y={area.y + 28} textAnchor="middle">{area.name.toUpperCase()}</text>)}
    </svg>
  );
}

const phoneContacts: string[][] = onServer ? [] : [
  ["Amit Patil", "98450 11223"],
  ["Ananya Rao", "97311 44556"],
  ["Arjun K.", "99001 22881"],
  ["Meera Shenoy", "98860 33441"],
  ["Priya Nair", "97420 66771"],
  ["Ramesh Naik", "98123 45678"],
  ["Workshop desk", "08041 23778"],
];

function AddAddress({ state, setState, open }: AppProps) {
  const [offset, setOffset] = useState(homeSpot);
  const [dragging, setDragging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [area, setArea] = useState(mapAreas[0]);
  const [house, setHouse] = useState("");
  const [landmark, setLandmark] = useState("");
  const [label, setLabel] = useState("Home");
  const [custom, setCustom] = useState("");
  const [forMe, setForMe] = useState(true);
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const settle = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const locate = (next: { x: number; y: number }) => {
    setLocating(true);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      setArea(nearestArea(next));
      setLocating(false);
    }, 550);
  };
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  const onDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    setLocating(true);
  };
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setOffset({
      x: clamp(start.ox + event.clientX - start.x, MAP_VIEW.w - MAP),
      y: clamp(start.oy + event.clientY - start.y, MAP_VIEW.h - MAP),
    });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    locate(offset);
  };
  const recenter = () => {
    setOffset(homeSpot);
    locate(homeSpot);
  };
  const applyContact = (person: string, number: string) => {
    setContact(person);
    setPhone(number.replace(/\D/g, "").slice(-10));
    setContactsOpen(false);
    setContactQuery("");
  };
  const chooseContact = async () => {
    const picker = (navigator as Navigator & { contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> } }).contacts;
    if (!picker) {
      setContactsOpen(true);
      return;
    }
    try {
      const [person] = await picker.select(["name", "tel"], { multiple: false });
      if (!person) return;
      applyContact(person.name?.[0] ?? "", person.tel?.[0] ?? "");
    } catch {
      /* The phone contact picker was dismissed. */
    }
  };
  const shownContacts = phoneContacts.filter(([person, number]) => `${person} ${number}`.toLowerCase().includes(contactQuery.trim().toLowerCase()));

  const digits = phone.replace(/\D/g, "");
  const name = label === "Other" ? custom.trim() : label;
  const replaces = label !== "Other" && state.addresses.some((address) => address.label === label);
  const valid = !locating && house.trim().length > 0 && name.length > 0 && (forMe || (contact.trim().length > 0 && digits.length === 10));
  const save = () => {
    if (onServer) {
      const post = (spot: { latitude: number; longitude: number } | null) =>
        api("/v1/me/addresses", {
          body: {
            label: name,
            area: area.name,
            line: [house.trim(), landmark.trim() && `near ${landmark.trim()}`, area.line].filter(Boolean).join(", "),
            landmark: landmark.trim() || null,
            contactName: forMe ? state.profile.name : contact.trim(),
            contactPhone: forMe ? tenDigits(state.profile.phone) || null : digits,
            latitude: spot?.latitude ?? null,
            longitude: spot?.longitude ?? null,
          },
        })
          .then(async () => {
            await reloadLive();
            toast.success(`${name} address saved`);
            open("Profile");
          })
          .catch((error) => toast.error(messageOf(error)));
      if (!navigator.geolocation) return void post(null);
      navigator.geolocation.getCurrentPosition(
        (position) => post({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => post(null),
        { timeout: 6000, maximumAge: 120000 },
      );
      return;
    }
    const entry: SavedAddress = {
      id: `${name.toLowerCase()}-${Date.now()}`,
      label: name,
      area: area.name,
      line: [house.trim(), landmark.trim() && `near ${landmark.trim()}`, area.line].filter(Boolean).join(", "),
      contact: forMe ? state.profile.name : contact.trim(),
      phone: forMe ? state.profile.phone : `${digits.slice(0, 5)} ${digits.slice(5)}`,
    };
    setState((current) => ({
      ...current,
      addresses: [...current.addresses.filter((address) => address.label !== entry.label), entry],
    }));
    toast.success(`${entry.label} address saved`);
    open("Profile");
  };

  return (
    <PhoneFrame
      tone="white"
      footer={
        <button className="cx-btn cx-btn-primary" disabled={!valid} onClick={save}>
          {locating ? "Finding the spot…" : "Save address"}
        </button>
      }
    >
      <div className="cx-addr-map">
        <div
          className={`cx-map${dragging ? " dragging" : ""}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="cx-map-pan" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
            <CityMap />
          </div>
        </div>
        <div className="cx-map-top">
          <button className="cx-round" aria-label="Back" onClick={() => open("Profile")}><ChevronLeft /></button>
          <button className="cx-map-search" onClick={() => toast("Search for an area, street or building")}>
            <Search />Search for an area or building
          </button>
        </div>
        <div className={`cx-map-pin${dragging ? " lifted" : ""}`} aria-hidden="true">
          <span className="cx-map-tip">{dragging ? "Release to set the pickup spot" : "Your bike is picked up here"}</span>
          <svg viewBox="0 0 40 52">
            <path d="M20 50 C20 50 36 31 36 18 A16 16 0 0 0 4 18 C4 31 20 50 20 50 Z" />
            <circle cx="20" cy="18" r="6.5" />
          </svg>
          <i />
        </div>
        <button className="cx-map-locate" onClick={recenter}><LocateFixed />Use current location</button>
      </div>

      <section className="cx-addr-form">
        <div className="cx-addr-spot">
          <span><MapPin /></span>
          <div>
            <b>{locating ? "Locating…" : area.name}</b>
            <small>{locating ? "Hold on while we read the map" : area.line}</small>
          </div>
        </div>

        <label className="cx-field">
          <span>House, flat or floor</span>
          <input className="cx-input" placeholder="Flat 302, Sai Residency" value={house} onChange={(event) => setHouse(event.target.value)} />
        </label>
        <label className="cx-field">
          <span>Landmark (optional)</span>
          <input className="cx-input" placeholder="Opposite Udupi Grand" value={landmark} onChange={(event) => setLandmark(event.target.value)} />
        </label>

        <div className="cx-field" role="group" aria-label="Save as">
          <span>Save as</span>
          <div className="cx-choices">
            {["Home", "Work", "Other"].map((item) => (
              <button key={item} aria-pressed={label === item} onClick={() => setLabel(item)}>{item}</button>
            ))}
          </div>
          {label === "Other" && (
            <input className="cx-input" placeholder="Name it, like Parents’ place" aria-label="Address name" value={custom} onChange={(event) => setCustom(event.target.value)} />
          )}
          {replaces && <small className="cx-addr-hint">This replaces your saved {label} address.</small>}
        </div>

        <div className="cx-field" role="group" aria-label="Contact at this address">
          <span>Who hands over the bike?</span>
          <div className="cx-segmented">
            <button aria-selected={forMe} onClick={() => setForMe(true)}>Me</button>
            <button aria-selected={!forMe} onClick={() => setForMe(false)}>Someone else</button>
          </div>
          {forMe ? (
            <div className="cx-addr-contact">
              <span className="cx-avatar">{initials(state.profile.name)}</span>
              <div><b>{state.profile.name}</b><small>+91 {state.profile.phone}</small></div>
            </div>
          ) : (
            <>
              <button type="button" className="cx-contact-pick" onClick={chooseContact}><ContactRound />Choose from phone contacts</button>
              <input className="cx-input" placeholder="Their name" aria-label="Contact name" value={contact} onChange={(event) => setContact(event.target.value)} />
              <div className="cx-input-group">
                <em>+91</em>
                <input inputMode="numeric" placeholder="Mobile number" aria-label="Contact mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d ]/g, "").slice(0, 11))} />
              </div>
              <Sheet open={contactsOpen} onOpenChange={setContactsOpen}>
                <PhoneSheet side="bottom" className="cx-sheet cx-contacts">
                  <SheetHeader>
                    <SheetTitle>Phone contacts</SheetTitle>
                    <SheetDescription>Pick who the rider should call.</SheetDescription>
                  </SheetHeader>
                  <div className="cx-sheet-body">
                    <label className="cx-input-group">
                      <em><Search /></em>
                      <input placeholder="Search contacts" aria-label="Search contacts" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} />
                    </label>
                    <div className="cx-list">
                      {shownContacts.map(([person, number]) => (
                        <button key={person} className="cx-row" onClick={() => applyContact(person, number)}>
                          <span className="cx-avatar">{person.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                          <span className="cx-row-text"><b>{person}</b><small>+91 {number}</small></span>
                        </button>
                      ))}
                    </div>
                    {shownContacts.length === 0 && <p className="cx-fine">No contact matches that.</p>}
                  </div>
                </PhoneSheet>
              </Sheet>
            </>
          )}
          <small className="cx-addr-hint">The rider calls this number when they arrive.</small>
        </div>
      </section>
    </PhoneFrame>
  );
}

type Notice = { id: string; kind: string; title: string; body: string; bike: string; when: string; day: string; bookingId?: string; screen: string; unread: boolean };

const notices: Notice[] = [
  { id: "pads", kind: "Update", title: "Two parts need your OK", body: "Amit sent them from Bay 03. Nothing extra is fitted until you say yes.", bike: "Guerrilla 450", when: "6:48 PM", day: "Today", bookingId: booking.id, screen: "Part approval", unread: true },
  { id: "bay", kind: "Update", title: "Service has started", body: "Rahul is on the general service in Bay 03. The camera is live.", bike: "Guerrilla 450", when: "6:40 PM", day: "Today", bookingId: booking.id, screen: "Track + live view", unread: true },
  { id: "pickup-reminder", kind: "Reminder", title: "Pickup is tomorrow", body: "Arjun collects the Classic 350 between 11 AM and 1 PM.", bike: "Classic 350", when: "5:10 PM", day: "Today", bookingId: "BS-2026-000125", screen: "Track + live view", unread: true },
  { id: "classic-booked", kind: "Confirmation", title: "You’re booked", body: "Engine oil change and chain clean. Pickup tomorrow, 11 AM–1 PM.", bike: "Classic 350", when: "4:02 PM", day: "Today", bookingId: "BS-2026-000125", screen: "Track + live view", unread: false },
  { id: "moved", kind: "Rescheduled", title: "Pickup moved", body: "The Classic 350 was 4–6 PM today. It’s now tomorrow, 11 AM–1 PM.", bike: "Classic 350", when: "Yesterday", day: "Earlier", bookingId: "BS-2026-000125", screen: "Track + live view", unread: false },
  { id: "cancelled", kind: "Cancelled", title: "Foam wash cancelled", body: "The Sunday 4–6 PM visit was cancelled. Nothing was charged.", bike: "Access 125", when: "12 Sep", day: "Earlier", screen: "", unread: false },
  { id: "guerrilla-booked", kind: "Confirmation", title: "General service booked", body: "Pickup today, 2–4 PM, from BTM 2nd Stage.", bike: "Guerrilla 450", when: "Yesterday", day: "Earlier", bookingId: booking.id, screen: "Track + live view", unread: false },
];

function unreadNotices(state: DemoState) {
  return notices.filter((notice) => notice.unread && !state.readNotices.includes(notice.id));
}

function Notifications({ state, setState, open, firstTime }: AppProps) {
  const unread = unreadNotices(state);
  const mark = (ids: string[]) => {
    if (onServer) api("/v1/notifications/read", { body: { ids: ids.slice(0, 200) } }).catch(() => {});
    setState((current) => ({ ...current, readNotices: [...new Set([...current.readNotices, ...ids])] }));
  };
  const openNotice = (notice: Notice) => {
    if (onServer && notice.unread && !state.readNotices.includes(notice.id)) api("/v1/notifications/read", { body: { ids: [notice.id] } }).catch(() => {});
    setState((current) => ({
      ...current,
      selectedBookingId: notice.bookingId ? notice.bookingId : current.selectedBookingId,
      readNotices: [...new Set([...current.readNotices, notice.id])],
    }));
    if (!notice.screen) {
      toast(onServer ? notice.body : "That visit was cancelled. Nothing was charged.");
      return;
    }
    open(notice.screen);
  };
  if (firstTime) {
    return (
      <PhoneFrame tab="Home" onTab={open}>
        <TopBar title="Notifications" onBack={() => open("Home")} />
        <div className="cx-quiet">
          <BikeArt />
          <h1>Nothing yet</h1>
          <p>Booking confirmations, reminders, schedule changes and service updates will land here.</p>
        </div>
      </PhoneFrame>
    );
  }
  return (
    <PhoneFrame tab="Home" onTab={open}>
      <TopBar title="Notifications" onBack={() => open("Home")} />
      <div className="cx-heading">
        <h1>{unread.length ? `${unread.length} new` : "You’re up to date"}</h1>
        <p>Confirmations, reminders, schedule changes and service updates.</p>
      </div>
      {unread.length > 0 && (
        <button className="cx-link" onClick={() => mark(notices.map((notice) => notice.id))}>Mark all read</button>
      )}
      {["Today", "Earlier"].map((day) => (
        <section className="cx-group" key={day}>
          <div className="cx-group-head"><h3>{day}</h3></div>
          <div className="cx-notes">
            {notices.filter((notice) => notice.day === day).map((notice) => {
              const fresh = notice.unread && !state.readNotices.includes(notice.id);
              return (
                <button key={notice.id} className={`cx-note${fresh ? " unread" : ""}`} onClick={() => openNotice(notice)}>
                  <i />
                  <span>
                    <small>{notice.kind}</small>
                    <b>{notice.title}</b>
                    <p>{notice.body}</p>
                    <em>{notice.bike} · {notice.when}</em>
                  </span>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Real data: everything the screens show, read from the Bike Surgeon API and shaped like the sample data,
// so every screen stays exactly as designed.
// ---------------------------------------------------------------------------

type ApiPerson = { name: string; phone: string | null } | null;
type ApiBooking = {
  id: string; number: string; status: string; stage: number; mode: "pickup" | "visit"; source: string;
  vehicle: { id: string; make: string; model: string; registrationNumber: string };
  services: { id: string; name: string; price: number }[];
  slotStart: string; slotEnd: string; promisedReadyAt: string | null;
  bay: { code: string; name: string } | null; advisor: ApiPerson; mechanic: ApiPerson; rider: ApiPerson;
  packageSubtotal: number; discountAmount: number; estimateAmount: number; payAtDelivery: boolean; paid: boolean; invoiceId: string | null;
  cameraAvailable: boolean;
  extras: { id: string; partName: string; note: string; amount: number; status: "pending" | "approved" | "declined"; raisedBy: string | null }[];
  deliveredAt: string | null; closedAt: string | null; createdAt: string;
};
type ApiInvoice = {
  id: string; number: string; jobCardId: string; bookingNumber: string; vehicleId: string; vehicleLabel: string; mode: "pickup" | "visit";
  status: "open" | "paid" | "void"; source?: "app" | "workshop";
  lines: { kind: string; label: string; amount: number }[];
  discountAmount: number; gstAmount: number; total: number; walletAmount: number;
  payments: { method: string; amount: number; status: string; providerReference: string | null }[];
  issuedAt: string; paidAt: string | null;
};
type ApiVehicle = {
  id: string; registrationNumber: string; make: string; model: string; bodyType: BikeType; colourName: string | null; colourHex: string | null;
  makeYear: number | null; odometerKm: number | null; odometerRecordedAt: string | null;
  documents: { kind: "rc" | "insurance" | "puc"; provider: string | null; policyType: string | null; reading: string | null; validUntil: string | null }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function shortDay(iso: string) {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function dayWord(iso: string) {
  const diff = Math.round((dayStart(new Date(iso)) - dayStart(new Date())) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return shortDay(iso);
}

function clockOf(iso: string) {
  const date = new Date(iso);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return { time: `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}`, half: hour < 12 ? "AM" : "PM" };
}

function slotText(start: string, end: string) {
  const a = clockOf(start);
  const b = clockOf(end);
  return `${dayWord(start)}, ${a.half === b.half ? `${a.time}–${b.time} ${b.half}` : `${a.time} ${a.half}–${b.time} ${b.half}`}`;
}

function etaText(b: ApiBooking) {
  if (b.stage >= 6) {
    const word = dayWord(b.deliveredAt ?? b.closedAt ?? b.slotEnd);
    return `Delivered ${word === "Today" || word === "Yesterday" ? word.toLowerCase() : word}`;
  }
  if (b.stage === 0) {
    const word = dayWord(b.slotStart);
    const start = clockOf(b.slotStart);
    return `${b.mode === "pickup" ? "Pickup" : "Drop-off"} ${word === "Today" || word === "Tomorrow" ? word.toLowerCase() : word} at ${start.time} ${start.half}`;
  }
  if (b.promisedReadyAt) {
    const ready = clockOf(b.promisedReadyAt);
    const word = dayWord(b.promisedReadyAt);
    return `Ready by ${ready.time} ${ready.half}${word === "Today" ? " today" : `, ${word}`}`;
  }
  if (b.stage >= 5) return b.mode === "pickup" ? "On its way back soon" : "Ready to collect";
  return "We’ll share the ready time soon";
}

function plainPhone(phone: string | null | undefined) {
  return String(phone ?? "").replace(/\D/g, "").slice(-10);
}

const methodNames: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Net banking", cash: "Cash at the workshop", wallet: "Wallet" };

function invoiceTitle(inv: ApiInvoice) {
  const work = inv.lines.filter((line) => line.kind === "service");
  const first = work[0]?.label ?? inv.lines[0]?.label ?? "Service";
  return work.length > 1 ? `${first} + ${work.length - 1} more` : first;
}

function lifeOf(validUntil: string | null, span: number) {
  if (!validUntil) return null;
  const days = Math.round((new Date(`${validUntil}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  const date = new Date(`${validUntil}T00:00:00`);
  const till = days < 0 ? `Ended ${shortDay(date.toISOString())}` : days <= 30 ? `Due in ${days} ${days === 1 ? "day" : "days"}` : `Till ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return { till, due: days <= 30, life: Math.max(0, Math.min(100, Math.round((days / span) * 100))) };
}

const fallbackTones = ["#2f5b8a", "#6e2a2a", "#45675b", "#1f2023", "#8a6d2f"];

function replaceAll<T>(list: T[], next: T[]) {
  list.splice(0, list.length, ...next);
}

function replaceKeys<T>(record: Record<string, T>, next: Record<string, T>) {
  for (const key of Object.keys(record)) delete record[key];
  Object.assign(record, next);
}

function spacedPhone(phone: string | null) {
  const digits = plainPhone(phone);
  return digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : "";
}

/** Reads the signed-in customer's data and fills the screens' tables. Returns the parts of the state that come from the server. */
async function loadLiveState(): Promise<Omit<DemoState, "selectedBookingId" | "offer" | "rating" | "viewingPaymentId" | "readNotices">> {
  const [me, bikes, jobs, invoices, wallet, addresses, inbox, catalogue, offers, workshop, referral] = await Promise.all([
    api<{ name: string; phone: string; email: string | null; language: ProfileInfo["language"]; backupContactName: string | null; backupContactPhone: string | null }>("/v1/me"),
    api<ApiVehicle[]>("/v1/vehicles"),
    api<ApiBooking[]>("/v1/bookings"),
    api<ApiInvoice[]>("/v1/invoices"),
    api<{ balance: number; transactions: { id: string; title: string; detail: string; amount: number; createdAt: string }[] }>("/v1/wallet"),
    api<{ id: string; label: string; area: string; line: string; contactName: string | null; contactPhone: string | null }[]>("/v1/me/addresses"),
    api<{ items: { id: string; kind: string; title: string; body: string; bookingNumber: string | null; vehicleLabel: string | null; targetScreen: string | null; read: boolean; createdAt: string }[] }>("/v1/notifications"),
    api<{ id: string; name: string; detail: string; category: string; price: number }[]>("/v1/services"),
    api<{ id: string; title: string; shortLabel: string; detail: string; discountAmount: number; firstBookingOnly: boolean; requiresServiceId: string | null; requiresOtherService: boolean; validUntil: string | null }[]>("/v1/offers"),
    api<{ name: string; phone: string | null; whatsapp: string | null; roadsidePhone: string | null; advisor: ApiPerson }>("/v1/workshop"),
    api<{ code: string; rewardAmount: number; shareText: string; referrals: { name: string; status: string }[] }>("/v1/referral"),
  ]);
  const extrasByBike = await Promise.all(bikes.map((bike) => Promise.all([
    api<{ item: string; lastDoneKm: number; intervalKm: number | null }[]>(`/v1/vehicles/${bike.id}/maintenance`).catch(() => []),
    api<{ title: string; brand: string; startsOn: string | null; endsOn: string | null; endsAtKm: number | null }[]>(`/v1/vehicles/${bike.id}/warranties`).catch(() => []),
  ])));

  // Catalogue, offers, workshop contacts, referral
  replaceAll(services, catalogue.map((item) => ({ id: item.id, name: item.name, detail: item.detail, price: item.price, type: item.category })));
  replaceAll(offerList, offers.map((offer) => ({
    id: offer.id,
    big: /^free\b/i.test(offer.title) ? "Free" : inr(offer.discountAmount),
    line: offer.shortLabel,
    title: offer.title,
    detail: offer.detail,
    till: offer.validUntil ? `Till ${shortDay(`${offer.validUntil}T12:00:00`)}` : "While it lasts",
    amount: offer.discountAmount,
    firstOnly: offer.firstBookingOnly,
    needs: offer.requiresServiceId ?? undefined,
    withOther: offer.requiresOtherService,
  })));
  const contact = workshop.advisor?.phone ?? workshop.phone ?? workshop.whatsapp;
  Object.assign(advisor, {
    name: workshop.advisor?.name ?? workshop.name,
    phone: spacedPhone(contact),
    tel: contact ? `tel:+91${plainPhone(contact)}` : "tel:",
    wa: `91${plainPhone(workshop.whatsapp ?? contact)}`,
  });
  workshopTel.href = workshop.phone ? `tel:+91${plainPhone(workshop.phone)}` : advisor.tel;
  const sos = workshop.roadsidePhone ?? workshop.phone;
  Object.assign(roadside, { phone: spacedPhone(sos), tel: sos ? `tel:+91${plainPhone(sos)}` : "tel:" });
  referralCode = referral.code;
  referralShareText = referral.shareText;
  liveReferrals = referral.referrals.map((friend) => ({
    name: friend.name,
    status: friend.status === "rewarded" ? "Credit received" : friend.status === "void" ? "Not eligible" : "Waiting",
    detail: friend.status === "rewarded" ? "First service completed" : "Joined, service not completed",
    amount: friend.status === "rewarded" ? referral.rewardAmount : 0,
  }));

  // Bikes: the garage plus any bike that only appears on old bills
  const open = jobs.filter((job) => job.status !== "cancelled");
  const delivered = (vehicleId: string) => open.filter((job) => job.vehicle.id === vehicleId && job.stage >= 6);
  const bikesById: Record<string, GarageBike> = {};
  bikes.forEach((bike, index) => {
    bikesById[bike.id] = {
      name: bike.model,
      make: bike.make,
      plate: formatPlate(bike.registrationNumber),
      tone: bike.colourHex ?? bikeColours.find(([label]) => label.toLowerCase() === (bike.colourName ?? "").toLowerCase())?.[1] ?? fallbackTones[index % fallbackTones.length],
      colour: bike.colourName ?? "Colour not set",
      km: bike.odometerKm != null ? bike.odometerKm.toLocaleString("en-IN") : "0",
      services: delivered(bike.id).length,
      type: bike.bodyType,
    };
  });
  const remember = (id: string, make: string, model: string, plate: string) => {
    if (bikesById[id]) return;
    bikesById[id] = { name: model, make, plate: formatPlate(plate), tone: "#5b5b5b", colour: "Colour not set", km: "0", services: delivered(id).length, type: typeForModel(model, make).type };
  };
  jobs.forEach((job) => remember(job.vehicle.id, job.vehicle.make, job.vehicle.model, job.vehicle.registrationNumber));
  invoices.forEach((inv) => remember(inv.vehicleId, "", inv.vehicleLabel, ""));
  replaceKeys(vehicles, bikesById);
  replaceAll(liveGarage, bikes.map((bike) => bike.id));

  // Bookings with their bills
  const invoiceFor = (jobId: string) => invoices.find((inv) => inv.jobCardId === jobId && inv.status !== "void");
  const bookings: ServiceBooking[] = open.map((job) => {
    job.services.forEach((service) => {
      serviceNames[service.id] = service.name;
    });
    const inv = invoiceFor(job.id);
    const extras = job.extras.map((extra) => ({ id: extra.id, part: extra.partName, note: extra.note, amount: extra.amount, status: extra.status, by: extra.raisedBy ?? "" }));
    const approved = approvedExtraTotal(extras);
    const bill: ServiceBooking["bill"] = inv
      ? {
          lines: inv.lines.filter((line) => line.kind !== "discount").map((line, index) => ({ id: `${inv.id}-${index}`, name: line.label, price: line.amount })),
          subtotal: inv.lines.filter((line) => line.kind !== "discount").reduce((sum, line) => sum + line.amount, 0),
          discount: inv.discountAmount,
          extras: 0,
          tax: inv.gstAmount,
          total: inv.total,
          kind: inv.status === "paid" ? "paid" : "due",
        }
      : {
          lines: job.services.map((service) => ({ id: service.id, name: service.name, price: service.price })),
          subtotal: job.packageSubtotal,
          discount: job.discountAmount,
          extras: approved,
          tax: Math.round((job.estimateAmount + approved) * GST_RATE),
          total: job.estimateAmount + approved + Math.round((job.estimateAmount + approved) * GST_RATE),
          kind: job.stage >= 5 ? "due" : "estimate",
        };
    return {
      id: job.number,
      uuid: job.id,
      vehicleId: job.vehicle.id,
      serviceIds: job.services.map((service) => service.id),
      stage: Math.max(0, job.stage),
      extras,
      paid: job.paid,
      scheduled: slotText(job.slotStart, job.slotEnd),
      eta: etaText(job),
      mode: job.mode,
      estimate: job.estimateAmount,
      walletPaid: inv?.walletAmount || undefined,
      collectAtDoor: job.payAtDelivery && !job.paid,
      people: { advisor: job.advisor?.name, mechanic: job.mechanic?.name, bay: job.bay?.name, rider: job.rider?.name },
      camera: job.cameraAvailable,
      bill,
      payAtCounter: inv?.source === "workshop",
    };
  });

  // Payment history: every paid bill, newest first
  const payments: Payment[] = invoices
    .filter((inv) => inv.status === "paid")
    .sort((a, b) => (b.paidAt ?? b.issuedAt).localeCompare(a.paidAt ?? a.issuedAt))
    .map((inv) => {
      const money = inv.payments.filter((p) => p.status === "succeeded" && p.method !== "wallet");
      const labels = [...new Set(money.map((p) => methodNames[p.method] ?? p.method))];
      return {
        id: inv.number,
        bookingId: inv.bookingNumber,
        vehicleId: inv.vehicleId,
        service: invoiceTitle(inv),
        when: shortDay(inv.paidAt ?? inv.issuedAt),
        methodLabel: labels.length > 1 ? labels.map((label) => label.replace(" at the workshop", "")).join(" + ") : labels[0] ?? "Wallet",
        ref: money.find((p) => p.providerReference)?.providerReference ?? undefined,
        wallet: inv.walletAmount,
        total: inv.total,
        lines: inv.lines.filter((line) => line.kind !== "discount").map((line) => ({ label: line.label, amount: line.amount })),
        visit: inv.mode === "pickup" ? "Pickup and delivery" : "Workshop visit",
        discount: inv.discountAmount,
        tax: inv.gstAmount,
      };
    });

  // Garage records: odometer, documents, service stamps, wear and warranties
  const books: Record<string, GarageBook> = {};
  const schedules: Record<string, [string, number, number][]> = {};
  const warrantyRows: [string, string, string, number][] = [];
  bikes.forEach((bike, index) => {
    const [maintenance, warranties] = extrasByBike[index];
    const done = delivered(bike.id).sort((a, b) => (b.deliveredAt ?? b.slotEnd).localeCompare(a.deliveredAt ?? a.slotEnd));
    const km = bike.odometerKm ?? 0;
    const insurance = bike.documents.find((doc) => doc.kind === "insurance");
    const puc = bike.documents.find((doc) => doc.kind === "puc");
    const insuranceLife = lifeOf(insurance?.validUntil ?? null, 365);
    const pucLife = lifeOf(puc?.validUntil ?? null, 180);
    const last = done[0];
    const nextDate = last ? new Date(new Date(last.deliveredAt ?? last.slotEnd).getTime() + 182 * 86_400_000) : null;
    const rows = warranties.map((item): [string, string, string, number] => {
      const life = lifeOf(item.endsOn, 365);
      const detail = item.endsOn ? (life?.till ?? "") : item.endsAtKm ? `Till ${item.endsAtKm.toLocaleString("en-IN")} km` : "Active";
      return [item.title, item.brand || bikesById[bike.id].make, detail, life?.life ?? (item.endsAtKm && km ? Math.max(0, Math.min(100, Math.round(((item.endsAtKm - km) / item.endsAtKm) * 100))) : 100)];
    }).filter((row) => !row[2].startsWith("Ended"));
    warrantyRows.push(...rows);
    books[bike.id] = {
      odo: km * 10,
      odoNote: bike.odometerRecordedAt ? `Recorded on ${shortDay(bike.odometerRecordedAt)}` : "Not recorded yet",
      insurance: insuranceLife
        ? { insurer: insurance?.provider ?? "Insurance", cover: insurance?.policyType ?? "Policy", till: insuranceLife.till, due: insuranceLife.due, life: insuranceLife.life }
        : { insurer: "", cover: "", till: "Not added", due: false, life: 0 },
      puc: pucLife
        ? { till: pucLife.till, due: pucLife.due, reading: puc?.reading ?? "", life: pucLife.life }
        : { till: "Not added", due: false, reading: "", life: 0 },
      warrantyLife: rows.length ? Math.round(rows.reduce((sum, row) => sum + row[3], 0) / rows.length) : 0,
      services: done.slice(0, 3).map((job) => {
        const inv = invoiceFor(job.id);
        const date = new Date(job.deliveredAt ?? job.slotEnd);
        return [job.services[0]?.name ?? (inv ? invoiceTitle(inv) : "Service"), `${date.getDate()} ${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`, job.mode === "pickup" ? "Pickup and delivery" : "Workshop visit", ...(inv?.status === "paid" ? [inv.number] : [])];
      }),
      next: last && nextDate
        ? `Due at ${(km + 3000).toLocaleString("en-IN")} km or ${nextDate.getDate()} ${MONTHS[nextDate.getMonth()]}`
        : "Due now, book the first service here",
      earlier: Math.max(0, done.length - 3),
      warranties: rows.length ? `${rows.length} active` : "None yet",
    };
    const tracked = maintenance.filter((item) => item.intervalKm).map((item): [string, number, number] => [item.item, item.lastDoneKm, item.intervalKm ?? 3000]);
    schedules[bike.id] = tracked.length ? tracked : [["Engine oil", last ? km : 0, 3000], ["Chain", last ? km : 0, 1000], ["Brake pads", last ? km : 0, 15000]];
  });
  replaceKeys(garageBook, books);
  replaceKeys(kmSchedule, schedules);
  liveWarranties = warrantyRows;

  // Notifications
  replaceAll(notices, inbox.items.map((item) => {
    const word = dayWord(item.createdAt);
    const at = clockOf(item.createdAt);
    return {
      id: item.id,
      kind: item.kind.charAt(0).toUpperCase() + item.kind.slice(1),
      title: item.title,
      body: item.body,
      bike: item.vehicleLabel ?? "Bike Surgeon",
      when: word === "Today" ? `${at.time} ${at.half}` : word,
      day: word === "Today" ? "Today" : "Earlier",
      bookingId: item.bookingNumber ?? undefined,
      screen: item.bookingNumber && !bookings.some((job) => job.id === item.bookingNumber) && item.targetScreen !== "Invoices" ? "" : item.targetScreen ?? "",
      unread: !item.read,
    };
  }));

  return {
    profile: {
      name: me.name,
      phone: spaced(plainPhone(me.phone)),
      email: me.email ?? "",
      language: me.language,
      backupName: me.backupContactName ?? "",
      backupPhone: me.backupContactPhone ? spaced(plainPhone(me.backupContactPhone)) : "",
    },
    bookings,
    addresses: addresses.map((address) => ({
      id: address.id,
      label: address.label,
      area: address.area,
      line: address.line,
      contact: address.contactName ?? me.name,
      phone: spaced(plainPhone(address.contactPhone ?? me.phone)),
    })),
    wallet: wallet.balance,
    txns: wallet.transactions.map((txn) => ({ id: txn.id, title: txn.title, detail: txn.detail, amount: txn.amount, when: shortDay(txn.createdAt) })),
    payments,
  };
}

const onboardingScreens = ["Starting page", "Login / Sign up", "OTP", "Create account"];

const presets: Record<DemoScreenProps["experience"], DemoState> = {
  first: { profile: defaultProfile, bookings: [], selectedBookingId: null, addresses: [], readNotices: [], offer: null, rating: 0, wallet: 0, txns: [], payments: [], viewingPaymentId: null },
  returning: { profile: { ...defaultProfile, email: "sanath.naik@gmail.com", backupName: "Lakshmi Naik", backupPhone: "94481 20457" }, bookings: returningBookings, selectedBookingId: null, addresses: savedAddresses, readNotices: [], offer: null, rating: 0, wallet: 420, txns: returningTxns, payments: returningPayments, viewingPaymentId: null },
};

export function CustomerApp({ screen, open, experience, theme, setTheme }: DemoScreenProps) {
  const [state, setState] = useState<DemoState>(() => (onServer ? { ...presets.first, profile: { ...defaultProfile, name: "", phone: "" } } : presets[experience]));
  const [liveReady, setLiveReady] = useState(false);
  const onboarding = onboardingScreens.includes(screen);
  useEffect(() => {
    if (!onServer || onboarding || !hasSession()) return;
    let alive = true;
    const load = async () => {
      try {
        const next = await loadLiveState();
        if (!alive) return;
        setState((current) => ({ ...current, ...next }));
        setLiveReady(true);
      } catch (error) {
        if (error instanceof ApiError && error.status !== 401 && error.status !== 0) toast.error(error.message);
      }
    };
    reloadLive = load;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20_000);
    const onShow = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onShow);
    const stop = onSignedOut(() => open("Login / Sign up"));
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      stop();
    };
  }, [onboarding, open]);
  useEffect(() => {
    if (onServer && liveReady && !onboarding && liveGarage.length === 0) open("Create account");
  }, [liveReady, onboarding, open, state.bookings]);
  const originRef = useRef(screen);
  const [motion, setMotion] = useState<null | { from: string; phase: "cover" | "reveal" }>(null);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (screen !== originRef.current) {
    const from = originRef.current;
    if (screen === "Book service" && from !== "Book service" && !reduceMotion) {
      if (!motion) setMotion({ from, phase: "cover" });
    } else {
      originRef.current = screen;
      if (motion) setMotion(null);
    }
  }
  useEffect(() => {
    if (motion?.phase !== "cover") return;
    const id = window.setTimeout(() => setMotion((current) => current ? { ...current, phase: "reveal" } : current), 490);
    return () => window.clearTimeout(id);
  }, [motion?.phase, motion?.from]);
  useEffect(() => {
    if (motion?.phase !== "reveal") return;
    const id = window.setTimeout(() => {
      originRef.current = "Book service";
      setMotion(null);
    }, 230);
    return () => window.clearTimeout(id);
  }, [motion?.phase]);
  useEffect(() => {
    if (onServer) return;
    fetchedScreens.clear();
    setState(presets[experience]);
  }, [experience]);
  useEffect(() => {
    if (screen === "Starting page") fetchedScreens.clear();
  }, [screen]);
  const firstTime = onServer ? state.bookings.length === 0 && state.payments.length === 0 : experience === "first";
  const app = useMemo(() => ({ state, setState, open, firstTime, theme, setTheme }), [state, open, firstTime, theme, setTheme]);
  const shown = motion?.phase === "cover" ? motion.from : screen;
  const pageRef = useRef<{ screen: string; kind: PageMotion }>({ screen: shown, kind: null });
  if (pageRef.current.screen !== shown) {
    const bloomed = shown === "Book service" && !reduceMotion;
    pageRef.current = { screen: shown, kind: bloomed ? null : pageMotion(pageRef.current.screen, shown) };
  }
  let view: ReactNode;
  if (onServer && !onboarding && (!liveReady || liveGarage.length === 0)) view = <HomeSkeleton open={open} />;
  else if (shown === "Starting page") view = <Splash open={open} />;
  else if (shown === "Login / Sign up") view = <Auth open={open} />;
  else if (shown === "OTP") view = <Otp open={open} />;
  else if (shown === "Create account") view = <CreateAccount open={open} />;
  else if (shown === "Home") view = <Fetching key={shown} id="home" skeleton={<HomeSkeleton open={open} />}><HomeScreen {...app} /></Fetching>;
  else if (shown === "Book service") view = <BookingScreen {...app} />;
  else if (shown === "Track + live view") view = <Fetching key={shown} id={state.selectedBookingId ? `booking:${state.selectedBookingId}` : "bookings"} skeleton={<TrackerSkeleton {...app} />}><Tracker {...app} /></Fetching>;
  else if (shown === "Part approval") view = <Approval {...app} />;
  else if (shown === "Price estimate") view = <Estimate {...app} />;
  else if (shown === "Invoices") view = <Fetching key={shown} id="payments" skeleton={<InvoicesSkeleton open={open} />}><Invoices {...app} /></Fetching>;
  else if (shown === "Job card closed + pay") view = <Pay {...app} />;
  else if (shown === "Wallet") view = <Fetching key={shown} id="wallet" skeleton={<WalletSkeleton open={open} />}><WalletScreen {...app} /></Fetching>;
  else if (shown === "Refer a friend") view = <ReferralScreen {...app} />;
  else if (shown === "Offers") view = <Fetching key={shown} id="offers" skeleton={<OffersSkeleton open={open} />}><OffersScreen {...app} /></Fetching>;
  else if (shown === "Garage & history") view = <Fetching key={shown} id="garage" skeleton={<GarageSkeleton open={open} />}><Garage {...app} /></Fetching>;
  else if (shown === "Warranty tracker") view = <Fetching key={shown} id="warranties" skeleton={<WarrantySkeleton open={open} />}><Warranty open={open} firstTime={firstTime} /></Fetching>;
  else if (shown === "Add address") view = <AddAddress {...app} />;
  else if (shown === "Notifications") view = <Fetching key={shown} id="notifications" skeleton={<NotificationsSkeleton open={open} />}><Notifications {...app} /></Fetching>;
  else if (shown === "Edit profile") view = <EditProfile {...app} />;
  else view = <Profile {...app} />;
  return (
    <ThemeContext.Provider value={theme}>
      <BookMotionContext.Provider value={motion?.phase ?? null}>
        <PageMotionContext.Provider value={pageRef.current.kind}>{view}</PageMotionContext.Provider>
      </BookMotionContext.Provider>
    </ThemeContext.Provider>
  );
}
