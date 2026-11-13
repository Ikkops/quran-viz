// Generated from everyayah.com's recitations.js (2026-11-13): one bitrate per
// reciter (64 kbps where published, else the nearest), Hafs only, without
// translations, and without the sets that are incomplete on the server
// (Ibrahim al-Akhdar, Muhammad Jibril 64 kbps, Mustafa Isma'il). `bytes` is the size of the whole set: exact for the two
// local sets, otherwise estimated from the sizes of 40 ayahs spread over the
// mushaf (good to about a tenth), which is enough for "about 25 MB" labels
// and the seek bar's first estimate.

export interface ReciterInfo {
  name: string;
  nameAr: string;
  /** Folder of per-ayah MP3s on everyayah.com (ends in "/"). */
  source: string;
  bitrate: number;
  origin: string;
  /** Size of the whole set, for download and length estimates. */
  bytes: number;
}

/** A key of `RECITER_INFO`; also the folder name under `audio/`. */
export type ReciterId = string;

/** Every reciter the Android app offers for download. */
export const RECITER_INFO: Record<ReciterId, ReciterInfo> = {
  shuraym: {
    name: "Sa'ud ash-Shuraym",
    nameAr: "سعود الشريم",
    source: "https://everyayah.com/data/Saood_ash-Shuraym_64kbps/",
    bitrate: 64,
    origin: "HidayahOnline.org",
    bytes: 529_942_267,
  },
  yasser: {
    name: "Yasser ad-Dosari",
    nameAr: "ياسر الدوسري",
    source: "https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/",
    bitrate: 128,
    origin: "QuranicAudio.com",
    bytes: 1_495_802_496,
  },
  "abdulbasit-mujawwad": {
    name: "Abdul Basit Abdus-Samad (Mujawwad)",
    nameAr: "عبد الباسط عبد الصمد (مجود)",
    source: "https://everyayah.com/data/Abdul_Basit_Mujawwad_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 3_535_720_972,
  },
  abdulbasit: {
    name: "Abdul Basit Abdus-Samad (Murattal)",
    nameAr: "عبد الباسط عبد الصمد (مرتل)",
    source: "https://everyayah.com/data/Abdul_Basit_Murattal_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 887_482_971,
  },
  juhani: {
    name: "Abdullah Awwad al-Juhani",
    nameAr: "عبد الله عواد الجهني",
    source: "https://everyayah.com/data/Abdullaah_3awwaad_Al-Juhaynee_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_189_332_316,
  },
  basfar: {
    name: "Abdullah Basfar",
    nameAr: "عبد الله بصفر",
    source: "https://everyayah.com/data/Abdullah_Basfar_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 834_788_556,
  },
  matrud: {
    name: "Abdullah Matrud",
    nameAr: "عبد الله مطرود",
    source: "https://everyayah.com/data/Abdullah_Matroud_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_611_049_103,
  },
  sudais: {
    name: "Abdurrahman as-Sudais",
    nameAr: "عبد الرحمن السديس",
    source: "https://everyayah.com/data/Abdurrahmaan_As-Sudais_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 585_266_153,
  },
  shatri: {
    name: "Abu Bakr ash-Shatri",
    nameAr: "أبو بكر الشاطري",
    source: "https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 747_675_239,
  },
  nuaina: {
    name: "Ahmad Nu'aina'",
    nameAr: "أحمد نعينع",
    source: "https://everyayah.com/data/Ahmed_Neana_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_720_244_729,
  },
  ajamy: {
    name: "Ahmad al-Ajmi",
    nameAr: "أحمد بن علي العجمي",
    source: "https://everyayah.com/data/Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 688_030_779,
  },
  suwaid: {
    name: "Aiman Suwaid",
    nameAr: "أيمن سويد",
    source: "https://everyayah.com/data/Ayman_Sowaid_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 1_208_958_959,
  },
  alaqimi: {
    name: "Akram al-Alaqimi",
    nameAr: "أكرم العلاقمي",
    source: "https://everyayah.com/data/Akram_AlAlaqimy_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_564_310_066,
  },
  suwaisi: {
    name: "Ali Hajjaj as-Suwaisi",
    nameAr: "علي حجاج السويسي",
    source: "https://everyayah.com/data/Ali_Hajjaj_AlSuesy_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_762_433_948,
  },
  "ali-jabir": {
    name: "Ali Jabir",
    nameAr: "علي جابر",
    source: "https://everyayah.com/data/Ali_Jaber_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 718_833_134,
  },
  hudhaify: {
    name: "Ali al-Hudhaifi",
    nameAr: "علي الحذيفي",
    source: "https://everyayah.com/data/Hudhaify_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 838_903_548,
  },
  alili: {
    name: "Aziz Alili",
    nameAr: "عزيز عليلي",
    source: "https://everyayah.com/data/aziz_alili_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_483_240_586,
  },
  abbad: {
    name: "Faris Abbad",
    nameAr: "فارس عباد",
    source: "https://everyayah.com/data/Fares_Abbad_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 595_909_189,
  },
  rifai: {
    name: "Hani ar-Rifa'i",
    nameAr: "هاني الرفاعي",
    source: "https://everyayah.com/data/Hani_Rifai_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 716_674_657,
  },
  qahtani: {
    name: "Khalid al-Qahtani",
    nameAr: "خالد القحطاني",
    source: "https://everyayah.com/data/Khaalid_Abdullaah_al-Qahtaanee_192kbps/",
    bitrate: 192,
    origin: "EveryAyah.com",
    bytes: 2_228_997_077,
  },
  tunaiji: {
    name: "Khalifa at-Tunaiji",
    nameAr: "خليفة الطنيجي",
    source: "https://everyayah.com/data/khalefa_al_tunaiji_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 763_665_642,
  },
  muaiqly: {
    name: "Mahir al-Mu'aiqli",
    nameAr: "ماهر المعيقلي",
    source: "https://everyayah.com/data/Maher_AlMuaiqly_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 616_447_189,
  },
  banna: {
    name: "Mahmud Ali al-Banna",
    nameAr: "محمود علي البنا",
    source: "https://everyayah.com/data/mahmoud_ali_al_banna_32kbps/",
    bitrate: 32,
    origin: "EveryAyah.com",
    bytes: 376_438_749,
  },
  "husary-muallim": {
    name: "Mahmud Khalil al-Husari (Mu'allim, teaching)",
    nameAr: "محمود خليل الحصري (المعلم)",
    source: "https://everyayah.com/data/Husary_Muallim_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 2_693_946_120,
  },
  "husary-mujawwad": {
    name: "Mahmud Khalil al-Husari (Mujawwad)",
    nameAr: "محمود خليل الحصري (مجود)",
    source: "https://everyayah.com/data/Husary_Mujawwad_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 1_726_729_956,
  },
  husary: {
    name: "Mahmud Khalil al-Husari (Murattal)",
    nameAr: "محمود خليل الحصري (مرتل)",
    source: "https://everyayah.com/data/Husary_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 1_178_683_828,
  },
  alafasy: {
    name: "Mishary Rashid al-Afasy",
    nameAr: "مشاري راشد العفاسي",
    source: "https://everyayah.com/data/Alafasy_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 846_078_478,
  },
  abdulkarim: {
    name: "Muhammad Abdul Karim",
    nameAr: "محمد عبد الكريم",
    source: "https://everyayah.com/data/Muhammad_AbdulKareem_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_313_526_406,
  },
  ayyub: {
    name: "Muhammad Ayyub",
    nameAr: "محمد أيوب",
    source: "https://everyayah.com/data/Muhammad_Ayyoub_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 908_248_482,
  },
  "minshawi-32": {
    name: "Muhammad Siddiq al-Minshawi (32 kbps)",
    nameAr: "محمد صديق المنشاوي",
    source: "https://everyayah.com/data/Menshawi_32kbps/",
    bitrate: 32,
    origin: "EveryAyah.com",
    bytes: 403_899_730,
  },
  "minshawi-mujawwad": {
    name: "Muhammad Siddiq al-Minshawi (Mujawwad)",
    nameAr: "محمد صديق المنشاوي (مجود)",
    source: "https://everyayah.com/data/Minshawy_Mujawwad_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 1_717_878_688,
  },
  minshawi: {
    name: "Muhammad Siddiq al-Minshawi (Murattal)",
    nameAr: "محمد صديق المنشاوي (مرتل)",
    source: "https://everyayah.com/data/Minshawy_Murattal_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_594_008_290,
  },
  tablawi: {
    name: "Muhammad at-Tablawi",
    nameAr: "محمد محمود الطبلاوي",
    source: "https://everyayah.com/data/Mohammad_al_Tablaway_64kbps/",
    bitrate: 64,
    origin: "EveryAyah.com",
    bytes: 838_397_227,
  },
  qasim: {
    name: "Muhsin al-Qasim",
    nameAr: "محسن القاسم",
    source: "https://everyayah.com/data/Muhsin_Al_Qasim_192kbps/",
    bitrate: 192,
    origin: "EveryAyah.com",
    bytes: 1_716_675_642,
  },
  qatami: {
    name: "Nasir al-Qatami",
    nameAr: "ناصر القطامي",
    source: "https://everyayah.com/data/Nasser_Alqatami_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_124_839_033,
  },
  ghamdi: {
    name: "Sa'd al-Ghamdi",
    nameAr: "سعد الغامدي",
    source: "https://everyayah.com/data/Ghamadi_40kbps/",
    bitrate: 40,
    origin: "EveryAyah.com",
    bytes: 435_846_810,
  },
  "sahl-yasin": {
    name: "Sahl Yasin",
    nameAr: "سهل ياسين",
    source: "https://everyayah.com/data/Sahl_Yassin_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_407_354_279,
  },
  bukhatir: {
    name: "Salah Bukhatir",
    nameAr: "صلاح بو خاطر",
    source: "https://everyayah.com/data/Salaah_AbdulRahman_Bukhatir_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_296_238_694,
  },
  budair: {
    name: "Salah al-Budair",
    nameAr: "صلاح البدير",
    source: "https://everyayah.com/data/Salah_Al_Budair_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_276_765_442,
  },
  salamah: {
    name: "Yasir Salamah",
    nameAr: "ياسر سلامة",
    source: "https://everyayah.com/data/Yaser_Salamah_128kbps/",
    bitrate: 128,
    origin: "EveryAyah.com",
    bytes: 1_510_499_403,
  },
};

export const RECITERS: readonly ReciterId[] = Object.keys(RECITER_INFO);

/** The sets scripts/fetch_audio.py can download into `audio/` for the desktop
 *  (MIRRORS `RECITERS` in that script). */
export const LOCAL_RECITERS: readonly ReciterId[] = ["shuraym", "yasser"];
