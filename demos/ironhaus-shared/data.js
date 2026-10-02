/* ==========================================================================
   IRONHAUS – gemeinsame Demo-Daten (Kurse, Coaches, Reviews)
   Wird von Basic/Business/Premium wiederverwendet, damit der Kursplan,
   die Coach-Profile und Bewertungen auf allen Stufen identisch sind.
   ========================================================================== */
window.IronhausData = {
  courses: [
    { id: "c1", day: 0, time: "06:30", name: "Kraftzirkel", category: "Kraft", coach: "Jonas Bergmann", capacity: 12, booked: 9 },
    { id: "c2", day: 0, time: "17:00", name: "HIIT Basics", category: "HIIT", coach: "Mika Reinhardt", capacity: 14, booked: 14 },
    { id: "c3", day: 0, time: "19:00", name: "Boxen Technik", category: "Boxen", coach: "Zeynep Kaya", capacity: 10, booked: 4 },
    { id: "c4", day: 1, time: "07:00", name: "Mobility Flow", category: "Mobility", coach: "Lea Fischer", capacity: 16, booked: 6 },
    { id: "c5", day: 1, time: "18:00", name: "Kraft Grundlagen", category: "Kraft", coach: "Jonas Bergmann", capacity: 12, booked: 11 },
    { id: "c6", day: 1, time: "19:30", name: "HIIT Power", category: "HIIT", coach: "Mika Reinhardt", capacity: 14, booked: 8 },
    { id: "c7", day: 2, time: "06:30", name: "Boxen Cardio", category: "Boxen", coach: "Zeynep Kaya", capacity: 10, booked: 10 },
    { id: "c8", day: 2, time: "17:30", name: "Kraft Aufbau", category: "Kraft", coach: "Jonas Bergmann", capacity: 12, booked: 5 },
    { id: "c9", day: 3, time: "07:00", name: "Mobility & Faszien", category: "Mobility", coach: "Lea Fischer", capacity: 16, booked: 3 },
    { id: "c10", day: 3, time: "18:00", name: "HIIT Metcon", category: "HIIT", coach: "Mika Reinhardt", capacity: 14, booked: 12 },
    { id: "c11", day: 3, time: "19:30", name: "Boxen Sparring-Vorbereitung", category: "Boxen", coach: "Zeynep Kaya", capacity: 10, booked: 7 },
    { id: "c12", day: 4, time: "06:30", name: "Kraftzirkel", category: "Kraft", coach: "Jonas Bergmann", capacity: 12, booked: 6 },
    { id: "c13", day: 4, time: "17:00", name: "Mobility Flow", category: "Mobility", coach: "Lea Fischer", capacity: 16, booked: 2 },
    { id: "c14", day: 5, time: "10:00", name: "HIIT Weekend", category: "HIIT", coach: "Mika Reinhardt", capacity: 14, booked: 9 },
    { id: "c15", day: 5, time: "11:30", name: "Boxen Open Mat", category: "Boxen", coach: "Zeynep Kaya", capacity: 10, booked: 3 }
    // Sonntag (day 6) bewusst ohne Kurse -> Leerzustand
  ],

  coaches: [
    {
      id: "lea-fischer",
      name: "Lea Fischer",
      tag: "Mobility & Beweglichkeit",
      img: "../_assets/img/b797acf9ee79.jpg",
      bio: "Seit acht Jahren Trainerin, spezialisiert auf Beweglichkeit und Verletzungsprophylaxe im Kraftsport.",
      specialties: ["Mobility", "Faszientraining", "Aufwaermroutinen"]
    },
    {
      id: "jonas-bergmann",
      name: "Jonas Bergmann",
      tag: "Kraft & Powerlifting",
      img: "../_assets/img/baab6dbcb7c9.jpg",
      bio: "Ehemaliger Wettkampf-Kraftdreikaempfer, coacht seit 2016 Technik in Kniebeuge, Bankdruecken und Kreuzheben.",
      specialties: ["Kniebeuge", "Bankdruecken", "Kreuzheben"]
    },
    {
      id: "zeynep-kaya",
      name: "Zeynep Kaya",
      tag: "Boxen & Technik",
      img: "../_assets/img/275475e7340e.jpg",
      bio: "Trainerin fuer Boxtechnik und Konditionierung, legt grossen Wert auf saubere Fussarbeit und Timing.",
      specialties: ["Boxtechnik", "Fussarbeit", "Konditionierung"]
    },
    {
      id: "mika-reinhardt",
      name: "Mika Reinhardt",
      tag: "HIIT & Konditionstraining",
      img: "../_assets/img/6dd6d39dae77.jpg",
      bio: "Baut Konditionsblöcke, die niemals zweimal gleich aussehen - abwechslungsreich und intensiv.",
      specialties: ["HIIT", "Metcon", "Ausdauer"]
    }
  ],

  reviews: [
    { name: "Fatima K.", since: "2023", rating: 5, text: "Ich habe meine Kniebeuge in einem Jahr von 60 auf 110 Kilo gesteigert – ohne die Leute hier hätte ich nie so lange drangeblieben.", img: "../_assets/img/414ed16d5c84.jpg" },
    { name: "Robin T.", since: "2022", rating: 5, text: "Das Coaching-Team nimmt sich wirklich Zeit für Technik. Meine Klimmzugzahl hat sich seitdem verdoppelt.", img: "../_assets/img/c707bcd2a814.jpg" },
    { name: "Devrim S.", since: "2024", rating: 4, text: "24/7 Zugang bedeutet: Ich trainiere auch um 22 Uhr nach der Spätschicht. Genau das habe ich gesucht.", img: "../_assets/img/3ba0a3ac19e7.jpg" }
  ],

  days: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  dayShort: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],

  products: [
    { id: "p1", name: "IRONHAUS Whey Protein 900g", category: "Supplements", price: 34.9, img: "../_assets/img/c707bcd2a814.jpg", desc: "Neutral im Geschmack, 24g Eiweiss pro Portion." },
    { id: "p2", name: "IRONHAUS Kreatin Monohydrat 500g", category: "Supplements", price: 19.9, img: "../_assets/img/b391fcb534ae.jpg", desc: "Mikronisiert, geschmacksneutral." },
    { id: "p3", name: "IRONHAUS Trainings-Shirt", category: "Merch", price: 24.0, img: "../_assets/img/c76b4cb02c9f.jpg", desc: "Atmungsaktives Funktionsshirt, Unisex." },
    { id: "p4", name: "IRONHAUS Kapuzenpulli", category: "Merch", price: 44.0, img: "../_assets/img/a5e42a6e3129.jpg", desc: "Schwerer Baumwoll-Hoodie mit gesticktem Logo." },
    { id: "p5", name: "Widerstandsband-Set", category: "Zubehoer", price: 16.5, img: "../_assets/img/92aa83de1894.jpg", desc: "3 Staerken, ideal fuer Mobility & Aufwaermen." },
    { id: "p6", name: "Trainings-Handtuch", category: "Zubehoer", price: 12.0, img: "../_assets/img/32e605361761.jpg", desc: "Schnelltrocknend, mit Karabiner fuer die Tasche." }
  ]
};
