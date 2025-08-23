// Svenska postnummer med specifika områden/stadsdelar
export interface PostalCodeData {
  postalCode: string;
  city: string;
  area: string;
}

export const swedishPostalCodes: PostalCodeData[] = [
  // Stockholm
  { postalCode: "100 05", city: "Stockholm", area: "Norrmalm" },
  { postalCode: "101 22", city: "Stockholm", area: "Gamla Stan" },
  { postalCode: "102 12", city: "Stockholm", area: "Norrmalm" },
  { postalCode: "111 20", city: "Stockholm", area: "Östermalm" },
  { postalCode: "111 49", city: "Stockholm", area: "Östermalm" },
  { postalCode: "112 19", city: "Stockholm", area: "Östermalm" },
  { postalCode: "113 30", city: "Stockholm", area: "Östermalm" },
  { postalCode: "114 35", city: "Stockholm", area: "Östermalm" },
  { postalCode: "115 42", city: "Stockholm", area: "Södermalm" },
  { postalCode: "116 21", city: "Stockholm", area: "Södermalm" },
  { postalCode: "117 43", city: "Stockholm", area: "Södermalm" },
  { postalCode: "118 25", city: "Stockholm", area: "Södermalm" },
  { postalCode: "136 55", city: "Stockholm", area: "Vega" },
  { postalCode: "163 41", city: "Stockholm", area: "Spånga" },
  { postalCode: "164 40", city: "Stockholm", area: "Kista" },
  { postalCode: "165 58", city: "Stockholm", area: "Hässelby" },
  { postalCode: "168 67", city: "Stockholm", area: "Bromma" },
  { postalCode: "172 65", city: "Stockholm", area: "Sundbyberg" },
  { postalCode: "175 62", city: "Stockholm", area: "Järfälla" },
  { postalCode: "182 31", city: "Stockholm", area: "Danderyd" },
  { postalCode: "183 30", city: "Stockholm", area: "Täby" },

  // Göteborg
  { postalCode: "400 14", city: "Göteborg", area: "Centrum" },
  { postalCode: "401 15", city: "Göteborg", area: "Nordstaden" },
  { postalCode: "402 22", city: "Göteborg", area: "Hisingen" },
  { postalCode: "411 01", city: "Göteborg", area: "Centrum" },
  { postalCode: "411 18", city: "Göteborg", area: "Linnéstaden" },
  { postalCode: "412 63", city: "Göteborg", area: "Majorna" },
  { postalCode: "413 14", city: "Göteborg", area: "Masthugget" },
  { postalCode: "414 51", city: "Göteborg", area: "Högsbo" },
  { postalCode: "416 64", city: "Göteborg", area: "Frölunda" },
  { postalCode: "421 30", city: "Göteborg", area: "Västra Frölunda" },
  { postalCode: "426 71", city: "Göteborg", area: "Västra Frölunda" },

  // Malmö
  { postalCode: "200 10", city: "Malmö", area: "Centrum" },
  { postalCode: "211 15", city: "Malmö", area: "Centrum" },
  { postalCode: "212 24", city: "Malmö", area: "Västra Hamnen" },
  { postalCode: "213 77", city: "Malmö", area: "Limhamn" },
  { postalCode: "214 20", city: "Malmö", area: "Rosengård" },
  { postalCode: "215 32", city: "Malmö", area: "Fosie" },
  { postalCode: "217 22", city: "Malmö", area: "Oxie" },

  // Uppsala
  { postalCode: "750 07", city: "Uppsala", area: "Centrum" },
  { postalCode: "751 05", city: "Uppsala", area: "Luthagen" },
  { postalCode: "752 37", city: "Uppsala", area: "Fålhagen" },
  { postalCode: "753 09", city: "Uppsala", area: "Åby" },
  { postalCode: "754 50", city: "Uppsala", area: "Granby" },
  { postalCode: "755 98", city: "Uppsala", area: "Boländerna" },

  // Västerås
  { postalCode: "721 30", city: "Västerås", area: "Centrum" },
  { postalCode: "722 12", city: "Västerås", area: "Malmaberg" },
  { postalCode: "723 48", city: "Västerås", area: "Bäckby" },
  { postalCode: "724 67", city: "Västerås", area: "Hälla" },

  // Örebro
  { postalCode: "700 03", city: "Örebro", area: "Centrum" },
  { postalCode: "701 32", city: "Örebro", area: "Vivalla" },
  { postalCode: "702 25", city: "Örebro", area: "Länsmansgården" },
  { postalCode: "703 62", city: "Örebro", area: "Almby" },

  // Linköping
  { postalCode: "581 83", city: "Linköping", area: "Centrum" },
  { postalCode: "582 46", city: "Linköping", area: "Ryd" },
  { postalCode: "583 30", city: "Linköping", area: "Lambohov" },
  { postalCode: "584 22", city: "Linköping", area: "Skäggetorp" },

  // Helsingborg
  { postalCode: "250 07", city: "Helsingborg", area: "Centrum" },
  { postalCode: "251 08", city: "Helsingborg", area: "Söder" },
  { postalCode: "252 67", city: "Helsingborg", area: "Ramlösa" },
  { postalCode: "254 67", city: "Helsingborg", area: "Drottninghög" },

  // Jönköping
  { postalCode: "550 02", city: "Jönköping", area: "Centrum" },
  { postalCode: "551 18", city: "Jönköping", area: "Väster" },
  { postalCode: "553 02", city: "Jönköping", area: "Råslätt" },

  // Norrköping
  { postalCode: "600 07", city: "Norrköping", area: "Centrum" },
  { postalCode: "601 74", city: "Norrköping", area: "Hageby" },
  { postalCode: "603 77", city: "Norrköping", area: "Vrinnevi" },

  // Lund
  { postalCode: "220 05", city: "Lund", area: "Centrum" },
  { postalCode: "221 00", city: "Lund", area: "Centrum" },
  { postalCode: "222 40", city: "Lund", area: "Klostergården" },
  { postalCode: "223 63", city: "Lund", area: "Gunnesbo" },

  // Umeå
  { postalCode: "900 07", city: "Umeå", area: "Centrum" },
  { postalCode: "901 87", city: "Umeå", area: "Teg" },
  { postalCode: "902 47", city: "Umeå", area: "Sandbacka" },

  // Gävle
  { postalCode: "800 03", city: "Gävle", area: "Centrum" },
  { postalCode: "801 88", city: "Gävle", area: "Bomhus" },
  { postalCode: "803 10", city: "Gävle", area: "Strömsbro" },

  // Borås
  { postalCode: "500 06", city: "Borås", area: "Centrum" },
  { postalCode: "501 12", city: "Borås", area: "Norrby" },
  { postalCode: "503 38", city: "Borås", area: "Trandared" },

  // Södertälje
  { postalCode: "151 36", city: "Södertälje", area: "Centrum" },
  { postalCode: "152 42", city: "Södertälje", area: "Ronna" },

  // Eskilstuna
  { postalCode: "631 05", city: "Eskilstuna", area: "Centrum" },
  { postalCode: "632 25", city: "Eskilstuna", area: "Vilsta" },

  // Karlstad
  { postalCode: "650 02", city: "Karlstad", area: "Centrum" },
  { postalCode: "652 30", city: "Karlstad", area: "Kronoparken" },

  // Växjö
  { postalCode: "351 04", city: "Växjö", area: "Centrum" },
  { postalCode: "352 30", city: "Växjö", area: "Araby" },

  // Halmstad
  { postalCode: "300 09", city: "Halmstad", area: "Centrum" },
  { postalCode: "302 41", city: "Halmstad", area: "Breared" },

  // Sundsvall
  { postalCode: "850 07", city: "Sundsvall", area: "Centrum" },
  { postalCode: "852 30", city: "Sundsvall", area: "Skönsberg" },

  // Luleå
  { postalCode: "971 25", city: "Luleå", area: "Centrum" },
  { postalCode: "972 38", city: "Luleå", area: "Porsön" },

  // Trollhättan
  { postalCode: "461 30", city: "Trollhättan", area: "Centrum" },
  { postalCode: "462 35", city: "Trollhättan", area: "Sylte" },

  // Östersund
  { postalCode: "831 34", city: "Östersund", area: "Centrum" },
  { postalCode: "832 50", city: "Östersund", area: "Torvalla" },

  // Borlänge
  { postalCode: "781 70", city: "Borlänge", area: "Centrum" },
  { postalCode: "782 31", city: "Borlänge", area: "Tjärna Ängar" },

  // Kalmar
  { postalCode: "391 82", city: "Kalmar", area: "Centrum" },
  { postalCode: "392 31", city: "Kalmar", area: "Lindsdal" },

  // Kiruna
  { postalCode: "981 21", city: "Kiruna", area: "Centrum" },
  { postalCode: "981 38", city: "Kiruna", area: "Lombolo" },

  // Karlskrona
  { postalCode: "371 30", city: "Karlskrona", area: "Centrum" },
  { postalCode: "372 35", city: "Karlskrona", area: "Lyckeby" },

  // Skövde
  { postalCode: "541 30", city: "Skövde", area: "Centrum" },
  { postalCode: "542 35", city: "Skövde", area: "Billingen" }
];

// Funktion för att hitta stad och område baserat på postnummer
export const findLocationByPostalCode = (postalCode: string): PostalCodeData | null => {
  const cleanedCode = postalCode.replace(/\s+/g, ' ').trim();
  return swedishPostalCodes.find(location => location.postalCode === cleanedCode) || null;
};

// Funktion för att validera postnummer format
export const isValidPostalCodeFormat = (postalCode: string): boolean => {
  const cleanedCode = postalCode.replace(/\s+/g, ' ').trim();
  // Svenska postnummer: XXX XX format
  const postalCodeRegex = /^\d{3}\s\d{2}$/;
  return postalCodeRegex.test(cleanedCode);
};

// Funktion för att formatera postnummer
export const formatPostalCode = (postalCode: string): string => {
  const digits = postalCode.replace(/\D/g, '');
  if (digits.length >= 3) {
    const formatted = digits.slice(0, 3) + (digits.length > 3 ? ' ' + digits.slice(3, 5) : '');
    return formatted;
  }
  return digits;
};