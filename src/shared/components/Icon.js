"use client";

import {
  Airplane, AirplaneTilt, ArrowBendLeftUp, ArrowClockwise, ArrowCounterClockwise,
  ArrowDown, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowUp, ArrowUpRight,
  ArrowsClockwise, ArrowsDownUp, ArrowsHorizontal, ArrowsInLineVertical, ArrowsLeftRight,
  ArrowsMerge, ArrowsOut, ArrowsSplit, Article, Atom, Bank, BatteryCharging,
  Bell, Binary, Binoculars, Blueprint, BookBookmark, BookOpen, Bookmarks,
  BracketsCurly, Brain, Broadcast, Broom, Browser, Bug, Buildings,
  CalendarBlank, CalendarCheck, CaretDown, CaretLeft, CaretRight, CaretUp,
  CaretUpDown, Certificate, ChartBar, ChartBarHorizontal, ChartDonut, ChartLine,
  ChartLineUp, ChartPieSlice, ChartPolar, ChartScatter, ChatCircle, ChatCircleDots,
  ChatTeardropDots, ChatsCircle, Check, CheckCircle, CheckFat, Checks,
  Circuitry, Circle, CircleNotch, ClipboardText, Clock, ClockClockwise,
  ClockCounterClockwise, Cloud, CloudArrowDown, CloudArrowUp, CloudCheck,
  CloudSlash, CloudWarning, Code, CodeBlock, CodeSimple, Coins, Command,
  Compass, ComputerTower, Control, Cookie, Copy, Cpu, CreditCard,
  Crosshair, Crown, Cube, CubeFocus, CurrencyCircleDollar, CurrencyDollar,
  Database, Desktop, DesktopTower, DeviceMobile, Devices, Diamond,
  DiamondsFour, Disc, Dna, DotsSixVertical, DotsThree, DotsThreeVertical,
  DownloadSimple, Drop, Ear, Envelope, Equalizer, Eraser, Export,
  Eye, EyeSlash, Faders, FadersHorizontal, FileArrowUp, FileCode,
  FileMagnifyingGlass, FileText, Files, FilmSlate, Fingerprint,
  Fire, Flag, Flask, FloppyDisk, FlowArrow, Flower, FolderOpen,
  ForkKnife, Funnel, FunnelSimple, FunnelX, Gauge, Gavel, Gear, GearSix,
  Gift, GitBranch, GitCommit, GitDiff, GitFork, GitMerge, Globe,
  GlobeHemisphereWest, GlobeStand, GraduationCap, Graph, GridFour, GridNine,
  Handshake, HardDrive, HardDrives, Hash, Headphones, Heart, Heartbeat,
  Hexagon, HourglassHigh, HourglassMedium, House, IdentificationBadge, Image,
  ImageSquare, Images, Infinity, Info, Key, KeyReturn, Keyboard,
  Keyhole, Kanban, Laptop, Layout, Leaf, Lifebuoy, Lightbulb,
  LightbulbFilament, Lightning, LightningSlash, LineSegments, Link, LinkBreak,
  LinkSimple, List, ListBullets, ListChecks, ListDashes, ListMagnifyingGlass,
  ListNumbers, ListPlus, Lock, LockKey, LockKeyOpen, LockLaminated,
  MagicWand, Magnet, MagnifyingGlass, MagnifyingGlassMinus, MagnifyingGlassPlus,
  MapPin, Medal, Megaphone, Memory, Microphone, Microscope, Minus,
  MinusCircle, Money, Monitor, MonitorPlay, Moon, MoonStars, MusicNote,
  NavigationArrow, Network, NetworkSlash, Newspaper, NotePencil, Notebook,
  Notepad, Notification, Package, PaintBrush, Palette, PaperPlaneRight,
  PaperPlaneTilt, Paperclip, Password, Path, Pause, PauseCircle, PawPrint,
  PencilSimple, PencilSimpleLine, Percent, Person, PersonArmsSpread, Phone,
  PiggyBank, Planet, Play, PlayCircle, Playlist, Plug, PlugCharging,
  Plugs, PlugsConnected, Plus, PlusCircle, Polygon, Power, PresentationChart,
  Prohibit, Pulse, PuzzlePiece, QrCode, Question, Queue, RadioButton,
  Ranking, Receipt, Record, Recycle, Repeat, Robot, Rocket, RocketLaunch,
  Rows, Rss, Ruler, Sailboat, Scales, Scan, Scissors, Scroll,
  SealCheck, SealWarning, ShareNetwork, Shield, ShieldCheck,
  ShieldChevron, ShieldPlus, ShieldSlash, ShieldStar, ShieldWarning, Shuffle,
  SidebarSimple, SignIn, SignOut, Siren, Sliders, SlidersHorizontal,
  Smiley, Snowflake, SortAscending, SortDescending, Sparkle, SpeakerHigh,
  Speedometer, SpinnerGap, SplitHorizontal, SplitVertical, SquaresFour,
  Stack, StackSimple, Star, StarFour, Steps, Stethoscope, Stop,
  StopCircle, Storefront, Strategy, Sun, SunDim, Swap, Swatches,
  Table, Tabs, Tag, TagChevron, Target, Terminal, TerminalWindow,
  TestTube, TextAa, Thermometer, ThumbsUp, Ticket, Timer, ToggleLeft,
  ToggleRight, Toolbox, TrafficSignal, Translate, Trash, TrashSimple,
  TreeStructure, TrendDown, TrendUp, Triangle, Trophy, UploadSimple,
  Usb, User, UserCheck, UserCircle, UserGear, Users, UsersThree,
  Vault, VideoCamera, VinylRecord, Wallet, Warning, WarningCircle,
  WarningDiamond, WarningOctagon, Watch, WaveSine, Waveform, Waves,
  WebhooksLogo, WifiHigh, WifiSlash, Wind, Wrench, X, XCircle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Bespoke MiawRouter Carbon Studio geometric SVG icons for core router & console primitives.
 * Engineered with 1.75px precision strokes and subtle 14% tonal accents for razor-sharp rendering on matte black.
 */
const STUDIO_SVG_ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  grid_view: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  router: (
    <>
      <rect x="2.5" y="13.5" width="19" height="6.5" rx="2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="6.5" cy="16.75" r="1.1" fill="currentColor" />
      <circle cx="10.25" cy="16.75" r="1.1" fill="currentColor" />
      <path d="M15.5 16.75h2.5M7.5 13.5V8.5m9 5V6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5 6a3.5 3.5 0 0 1 5 0M14 4a3.5 3.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="3.25" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="5" cy="6" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19" cy="6" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="5" cy="18" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19" cy="18" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6.8 7.5 9.6 9.9M17.2 7.5l-2.8 2.4M6.8 16.5l2.8-2.4M17.2 16.5l-2.8-2.4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </>
  ),
  dns: (
    <>
      <rect x="3" y="3.5" width="18" height="7" rx="2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="13.5" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="7" cy="7" r="1.1" fill="currentColor" />
      <circle cx="7" cy="17" r="1.1" fill="currentColor" />
      <path d="M11.5 7h5.5M11.5 17h5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  api: (
    <>
      <path d="M7.5 8 3.5 12l4 4M16.5 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 6.5-3 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.25" />
    </>
  ),
  vpn_key: (
    <>
      <circle cx="8" cy="12" r="4.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
      <path d="M12.5 12H21m-2.5 0v3m-3-3v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
      <path d="M12.5 12H21m-2.5 0v3m-3-3v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  ecg_heart: (
    <>
      <rect x="2.75" y="4" width="18.5" height="16" rx="3" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5.5 12h3l2-4 3 8 2-4h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  memory: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.2" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  bar_chart: (
    <>
      <rect x="3.5" y="12.5" width="4" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="10" y="8" width="4" height="12" rx="1.2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.75" />
      <rect x="16.5" y="4" width="4" height="16" rx="1.2" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  data_usage: (
    <>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path d="M12 3.5a8.5 8.5 0 1 1-6.9 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  analytics: (
    <>
      <path d="M3.5 19.5h17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="m4.5 15 4.5-4.5 3.5 3 6.5-7" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 6.5H19V10" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="m3 12.25 9 4.5 9-4.5M3 16.25l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  terminal: (
    <>
      <rect x="2.75" y="4" width="18.5" height="16" rx="2.75" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <path d="m7 9.5 3 2.5-3 2.5m5.5 0H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cable: (
    <>
      <path d="M7.5 6.5v4a3 3 0 0 0 3 3h3a3 3 0 0 0 3-3v-4" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9.5 3.5v3m5-3v3M12 13.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  bolt: (
    <>
      <path d="M13.2 2.8 4.8 13.2h6.2l-1.2 8 9.4-10.4H13l.2-8Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.25 4.5 6.2v5.3c0 4.9 3.2 8.2 7.5 9.3 4.3-1.1 7.5-4.4 7.5-9.3V6.2L12 3.25Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </>
  ),
  security: (
    <>
      <path d="M12 3.25 4.5 6.2v5.3c0 4.9 3.2 8.2 7.5 9.3 4.3-1.1 7.5-4.4 7.5-9.3V6.2L12 3.25Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="m9.2 12.2 2 2 3.8-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  verified_user: (
    <>
      <path d="M12 3.25 4.5 6.2v5.3c0 4.9 3.2 8.2 7.5 9.3 4.3-1.1 7.5-4.4 7.5-9.3V6.2L12 3.25Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="m9.2 12.2 2 2 3.8-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cached: (
    <>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="3" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4.5 6.5V12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4.5 12v5.5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V12" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  receipt_long: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.25 8h7.5M8.25 12h7.5M8.25 16h4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
};

const icons = {
  accessibility_new: PersonArmsSpread,
  account_circle: UserCircle,
  account_tree: TreeStructure,
  activity: Pulse,
  add: Plus,
  add_circle: PlusCircle,
  air: Wind,
  alt_route: GitFork,
  analytics: ChartLineUp,
  api: BracketsCurly,
  api_key: Key,
  apikey: Keyhole,
  apps: GridNine,
  arrow_back: ArrowLeft,
  arrow_downward: ArrowDown,
  arrow_forward: ArrowRight,
  arrow_outward: ArrowUpRight,
  arrow_right: CaretRight,
  arrow_upward: ArrowUp,
  attach_file: Paperclip,
  auto_awesome: Sparkle,
  auto_fix_high: MagicWand,
  available: CheckCircle,
  bar_chart: ChartBar,
  batch_prediction: Queue,
  block: Prohibit,
  blur_on: Disc,
  bolt: Lightning,
  book: BookBookmark,
  brush: PaintBrush,
  bug_report: Bug,
  build: Wrench,
  business: Buildings,
  cable: PlugsConnected,
  cached: Database,
  cancel: XCircle,
  category: DiamondsFour,
  change_history: GitDiff,
  chat: ChatCircleDots,
  check: Check,
  check_circle: CheckCircle,
  checklist: ListChecks,
  chevron_left: CaretLeft,
  chevron_right: CaretRight,
  clear_all: Broom,
  close: X,
  cloud: Cloud,
  cloud_done: CloudCheck,
  cloud_download: CloudArrowDown,
  cloud_off: CloudSlash,
  cloud_queue: Cloud,
  cloud_sync: ArrowsClockwise,
  cloud_upload: CloudArrowUp,
  code: Code,
  code_off: BracketsCurly,
  codeblock: CodeBlock,
  compress: ArrowsInLineVertical,
  computer: Laptop,
  content_copy: Copy,
  content_paste: ClipboardText,
  contrast: Swatches,
  cookie: Cookie,
  cpu: Cpu,
  dark_mode: MoonStars,
  dashboard: SquaresFour,
  data_array: BracketsCurly,
  data_object: FileCode,
  data_usage: ChartDonut,
  database: Database,
  delete: Trash,
  delete_sweep: Broom,
  deployed_code: CubeFocus,
  description: FileText,
  desktop_windows: Desktop,
  developer_board: Circuitry,
  devices: Devices,
  diamond: Diamond,
  dns: HardDrives,
  done_all: Checks,
  download: DownloadSimple,
  drag_indicator: DotsSixVertical,
  ecg_heart: Heartbeat,
  edit: PencilSimple,
  edit_note: NotePencil,
  emoji_events: Trophy,
  equalizer: Equalizer,
  error: WarningOctagon,
  expand_less: CaretUp,
  expand_more: CaretDown,
  explore: Compass,
  extension: PuzzlePiece,
  face: Smiley,
  file_copy: Files,
  file_upload: FileArrowUp,
  filter_alt: Funnel,
  filter_alt_off: FunnelX,
  filter_list: FunnelSimple,
  filter_list_off: FunnelX,
  fingerprint: Fingerprint,
  flag: Flag,
  flight: AirplaneTilt,
  flutter_dash: Airplane,
  folder: FolderOpen,
  folder_open: FolderOpen,
  free: Gift,
  gavel: Gavel,
  generating_tokens: Sparkle,
  globe: Globe,
  graphic_eq: Waveform,
  grid_view: SquaresFour,
  group: Users,
  group_work: UsersThree,
  handshake: Handshake,
  handyman: Toolbox,
  health_and_safety: Stethoscope,
  help: Question,
  history: ClockCounterClockwise,
  home: House,
  hourglass_empty: HourglassMedium,
  hourglass_top: HourglassHigh,
  http: Browser,
  hub: ShareNetwork,
  image: ImageSquare,
  image_search: Images,
  inbox: Envelope,
  info: Info,
  input: ArrowRight,
  insights: ChartPolar,
  inventory_2: Package,
  key: Key,
  key_off: LockKey,
  keyboard: Keyboard,
  keyboard_arrow_down: CaretDown,
  keyboard_arrow_up: CaretUp,
  lan: Graph,
  language: GlobeHemisphereWest,
  layers: Stack,
  light_mode: Sun,
  lightbulb: LightbulbFilament,
  link: LinkSimple,
  link_off: LinkBreak,
  list: ListBullets,
  list_alt: ListDashes,
  loading: CircleNotch,
  local_fire_department: Fire,
  local_florist: Flower,
  lock: LockKey,
  lock_open: LockKeyOpen,
  login: SignIn,
  logout: SignOut,
  manage_search: ListMagnifyingGlass,
  memory: Memory,
  menu: List,
  menu_book: BookOpen,
  mic: Microphone,
  model: Cube,
  model_training: Atom,
  models_url: Blueprint,
  monitor: Monitor,
  monitoring: Pulse,
  more_horiz: DotsThree,
  more_vert: DotsThreeVertical,
  movie: FilmSlate,
  music_note: MusicNote,
  neurology: Brain,
  notifications: Bell,
  oauth: IdentificationBadge,
  ok: SealCheck,
  open_in_new: ArrowSquareOut,
  output: Export,
  palette: Palette,
  pause: Pause,
  pause_circle: PauseCircle,
  payments: CurrencyCircleDollar,
  People: Users,
  perm_media: Images,
  person: User,
  pie_chart: ChartPieSlice,
  play_arrow: Play,
  play_circle: PlayCircle,
  playlist_add: ListPlus,
  podcasts: Broadcast,
  pool: Waves,
  power: Power,
  power_off: LightningSlash,
  power_settings_new: Power,
  price_change: Coins,
  privacy_tip: ShieldStar,
  progress_activity: SpinnerGap,
  psychology: Brain,
  psychology_alt: Brain,
  public: Globe,
  qr_code: QrCode,
  query_stats: FileMagnifyingGlass,
  radio_button_checked: RadioButton,
  radio_button_unchecked: Circle,
  receipt_long: Receipt,
  record_voice_over: SpeakerHigh,
  redeem: Gift,
  refresh: ArrowClockwise,
  remove: Minus,
  remove_circle: MinusCircle,
  replay: ArrowCounterClockwise,
  restart_alt: ArrowsClockwise,
  restaurant: ForkKnife,
  restore: ClockCounterClockwise,
  rocket: Rocket,
  rocket_launch: RocketLaunch,
  route: FlowArrow,
  router: Broadcast,
  rss_feed: Rss,
  rule: Sliders,
  sailing: Sailboat,
  save: FloppyDisk,
  saved_search: FileMagnifyingGlass,
  savings: PiggyBank,
  scatter_plot: ChartScatter,
  schedule: Clock,
  schema: GitBranch,
  school: GraduationCap,
  science: Flask,
  search: MagnifyingGlass,
  search_off: MagnifyingGlassMinus,
  security: ShieldCheck,
  send: PaperPlaneRight,
  sensors: Broadcast,
  settings: GearSix,
  settings_ethernet: Plugs,
  settings_input_component: Faders,
  share: ShareNetwork,
  shield: Shield,
  shield_lock: ShieldChevron,
  shield_with_heart: ShieldPlus,
  shuffle: Shuffle,
  smart_toy: Robot,
  smartphone: DeviceMobile,
  sort: SortDescending,
  spatial_audio: WaveSine,
  speaker: SpeakerHigh,
  speed: Gauge,
  star: Star,
  stop: Stop,
  stop_circle: StopCircle,
  storage: HardDrive,
  storefront: Storefront,
  stream: Waves,
  success: CheckCircle,
  surfing: Waves,
  swap_horiz: ArrowsLeftRight,
  swap_vert: ArrowsDownUp,
  sync: ArrowsClockwise,
  sync_alt: ArrowsLeftRight,
  table_chart: Table,
  table_rows: Rows,
  tag: Tag,
  task_alt: SealCheck,
  terminal: TerminalWindow,
  thumb_up: ThumbsUp,
  timeline: LineSegments,
  timer: Timer,
  toggle_off: ToggleLeft,
  toggle_on: ToggleRight,
  token: StarFour,
  transform: ArrowsMerge,
  translate: Translate,
  travel_explore: Binoculars,
  trending_down: TrendDown,
  trending_up: TrendUp,
  ts_url: GlobeStand,
  tune: FadersHorizontal,
  tunnel_url: ShareNetwork,
  unfold_more: CaretUpDown,
  upload: UploadSimple,
  upload_file: FileArrowUp,
  usb: Usb,
  vector_polygon: Polygon,
  verified: SealCheck,
  verified_user: ShieldCheck,
  Videocam: VideoCamera,
  visibility: Eye,
  visibility_off: EyeSlash,
  volunteer_activism: Heart,
  vpn_key: Password,
  vpn_lock: Vault,
  wallet: Wallet,
  warning: Warning,
  warning_amber: WarningDiamond,
  water_drop: Drop,
  webhook: WebhooksLogo,
  widgets: CubeFocus,
  wifi: WifiHigh,
  wifi_off: WifiSlash,
  wifi_tethering: Broadcast,
  workspace_premium: Crown,
};

// Directional & control icons that render sharpest in bold weight
const BOLD_STROKE_ICONS = new Set([
  "add", "remove", "check", "close", "done_all",
  "arrow_back", "arrow_downward", "arrow_forward", "arrow_outward", "arrow_right", "arrow_upward",
  "chevron_left", "chevron_right", "expand_less", "expand_more",
  "keyboard_arrow_down", "keyboard_arrow_up", "unfold_more",
  "loading", "progress_activity", "menu", "more_horiz", "more_vert",
  "drag_indicator", "search", "open_in_new", "input", "output",
  "swap_horiz", "swap_vert", "sync", "sync_alt", "refresh", "replay", "restart_alt",
]);

const warned = new Set();

export function Icon({ name, size = "1em", weight, fill, className, style, "aria-label": ariaLabel, ...rest }) {
  const customPaths = STUDIO_SVG_ICONS[name];
  if (customPaths && !fill) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        data-icon={name}
        {...rest}
      >
        {customPaths}
      </svg>
    );
  }

  const Component = icons[name] || Question;
  if (!icons[name] && process.env.NODE_ENV !== "production" && !warned.has(name)) {
    warned.add(name);
    console.warn(`[Icon] Unmapped legacy icon: ${name}`);
  }

  const resolvedWeight = fill
    ? "fill"
    : weight && weight !== "duotone"
      ? weight
      : BOLD_STROKE_ICONS.has(name)
        ? "bold"
        : "regular";

  return (
    <Component
      size={size}
      weight={resolvedWeight}
      className={className}
      style={style}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      data-icon={name}
      {...rest}
    />
  );
}

export default Icon;
