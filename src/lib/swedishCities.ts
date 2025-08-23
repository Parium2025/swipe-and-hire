// Svenska städer och postnummer data
export interface CityData {
  name: string;
  postalCodes: string[];
}

export const swedishCities: CityData[] = [
  {
    name: "Stockholm",
    postalCodes: ["100 05", "101 22", "102 12", "103 10", "104 05", "105 52", "111 20", "111 49", "112 19", "113 30", "114 35", "115 42", "116 21", "117 43", "118 25"]
  },
  {
    name: "Göteborg",
    postalCodes: ["400 14", "401 15", "402 22", "403 12", "404 30", "405 30", "411 01", "411 18", "412 63", "413 14", "414 51", "415 02", "416 64", "417 05", "418 78"]
  },
  {
    name: "Malmö",
    postalCodes: ["200 10", "201 22", "202 15", "203 14", "204 22", "205 02", "211 15", "212 24", "213 77", "214 20", "215 32", "216 14", "217 22"]
  },
  {
    name: "Uppsala",
    postalCodes: ["750 07", "751 05", "752 37", "753 09", "754 50", "755 98"]
  },
  {
    name: "Västerås",
    postalCodes: ["721 30", "722 12", "723 48", "724 67", "725 91"]
  },
  {
    name: "Örebro",
    postalCodes: ["700 03", "701 32", "702 25", "703 62", "704 62"]
  },
  {
    name: "Linköping",
    postalCodes: ["581 83", "582 46", "583 30", "584 22", "585 94"]
  },
  {
    name: "Helsingborg",
    postalCodes: ["250 07", "251 08", "252 67", "253 35", "254 67"]
  },
  {
    name: "Jönköping",
    postalCodes: ["550 02", "551 18", "552 25", "553 02", "554 52"]
  },
  {
    name: "Norrköping",
    postalCodes: ["600 07", "601 74", "602 23", "603 77", "604 22"]
  },
  {
    name: "Lund",
    postalCodes: ["220 05", "221 00", "222 40", "223 63", "224 78"]
  },
  {
    name: "Umeå",
    postalCodes: ["900 07", "901 87", "902 47", "903 62", "904 22"]
  },
  {
    name: "Gävle",
    postalCodes: ["800 03", "801 88", "802 67", "803 10", "804 20"]
  },
  {
    name: "Borås",
    postalCodes: ["500 06", "501 12", "502 41", "503 38", "504 62"]
  },
  {
    name: "Södertälje",
    postalCodes: ["151 36", "152 42", "153 30", "154 42"]
  },
  {
    name: "Eskilstuna",
    postalCodes: ["631 05", "632 25", "633 42", "634 51"]
  },
  {
    name: "Karlstad",
    postalCodes: ["650 02", "651 88", "652 30", "653 40"]
  },
  {
    name: "Täby",
    postalCodes: ["183 30", "183 62", "183 77"]
  },
  {
    name: "Växjö",
    postalCodes: ["351 04", "352 30", "353 46", "354 62"]
  },
  {
    name: "Halmstad",
    postalCodes: ["300 09", "301 18", "302 41", "303 92"]
  },
  {
    name: "Sundsvall",
    postalCodes: ["850 07", "851 70", "852 30", "853 56"]
  },
  {
    name: "Luleå",
    postalCodes: ["971 25", "972 38", "973 46", "974 31"]
  },
  {
    name: "Trollhättan",
    postalCodes: ["461 30", "462 35", "463 52"]
  },
  {
    name: "Östersund",
    postalCodes: ["831 34", "832 50", "833 02"]
  },
  {
    name: "Borlänge",
    postalCodes: ["781 70", "782 31", "783 35"]
  },
  {
    name: "Tumba",
    postalCodes: ["147 30", "147 62"]
  },
  {
    name: "Kalmar",
    postalCodes: ["391 82", "392 31", "393 56"]
  },
  {
    name: "Kiruna",
    postalCodes: ["981 21", "981 38"]
  },
  {
    name: "Karlskrona",
    postalCodes: ["371 30", "372 35"]
  },
  {
    name: "Skövde",
    postalCodes: ["541 30", "542 35"]
  }
];

// Funktion för att hitta stad baserat på postnummer
export const findCityByPostalCode = (postalCode: string): string | null => {
  const cleanedPostalCode = postalCode.replace(/\s+/g, ' ').trim();
  
  for (const city of swedishCities) {
    if (city.postalCodes.some(code => code === cleanedPostalCode)) {
      return city.name;
    }
  }
  
  return null;
};

// Funktion för att filtrera städer baserat på sökning
export const filterCities = (searchTerm: string): CityData[] => {
  if (!searchTerm.trim()) return [];
  
  const term = searchTerm.toLowerCase();
  return swedishCities.filter(city => 
    city.name.toLowerCase().includes(term)
  ).slice(0, 5); // Begränsa till 5 resultat
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