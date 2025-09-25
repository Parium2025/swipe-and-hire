// Svenska städer och postnummer data
export interface CityData {
  name: string;
  postalCodes: string[];
}

export const swedishCities: CityData[] = [
  // Storstäder
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
  
  // Länshuvudstäder och större städer
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
    name: "Eskilstuna",
    postalCodes: ["631 05", "632 25", "633 42", "634 51"]
  },
  {
    name: "Karlstad",
    postalCodes: ["650 02", "651 88", "652 30", "653 40"]
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
  },
  {
    name: "Falun",
    postalCodes: ["791 71", "792 32", "793 31"]
  },
  {
    name: "Skellefteå",
    postalCodes: ["931 87", "931 31", "931 77"]
  },
  {
    name: "Kristianstad",
    postalCodes: ["291 88", "291 39", "291 54"]
  },
  {
    name: "Karlskoga",
    postalCodes: ["691 30", "691 41", "691 52"]
  },
  {
    name: "Sandviken",
    postalCodes: ["811 80", "812 30", "813 37"]
  },
  {
    name: "Örnsköldsvik",
    postalCodes: ["891 30", "891 41", "891 52"]
  },
  {
    name: "Nyköping",
    postalCodes: ["611 30", "611 41", "611 52"]
  },
  {
    name: "Lidköping",
    postalCodes: ["531 30", "531 41", "531 52"]
  },
  {
    name: "Mariestad",
    postalCodes: ["542 30", "542 41", "542 52"]
  },
  
  // Viktiga städer i Stockholmsregionen
  {
    name: "Södertälje",
    postalCodes: ["151 36", "152 42", "153 30", "154 42"]
  },
  {
    name: "Täby",
    postalCodes: ["183 30", "183 62", "183 77"]
  },
  {
    name: "Norrtälje",
    postalCodes: ["761 30", "761 41", "761 52"]
  },
  {
    name: "Enköping",
    postalCodes: ["745 30", "745 41", "745 52"]
  },
  
  // Skånska städer
  {
    name: "Landskrona",
    postalCodes: ["261 31", "261 44", "261 53"]
  },
  {
    name: "Trelleborg",
    postalCodes: ["231 30", "231 42", "231 54"]
  },
  {
    name: "Ystad",
    postalCodes: ["271 30", "271 41", "271 52"]
  },
  {
    name: "Ängelholm",
    postalCodes: ["262 30", "262 41", "262 52"]
  },
  {
    name: "Eslöv",
    postalCodes: ["241 30", "241 41", "241 52"]
  },
  
  // Västra Götaland städer
  {
    name: "Uddevalla",
    postalCodes: ["451 30", "451 80", "451 50"]
  },
  {
    name: "Varberg",
    postalCodes: ["432 30", "432 41", "432 50"]
  },
  {
    name: "Falkenberg",
    postalCodes: ["311 30", "311 41", "311 52"]
  },
  {
    name: "Alingsås",
    postalCodes: ["441 30", "441 41", "441 52"]
  },
  {
    name: "Kungälv",
    postalCodes: ["442 30", "442 41", "442 50"]
  },
  {
    name: "Strömstad",
    postalCodes: ["452 30", "452 41", "452 52"]
  },
  {
    name: "Ulricehamn",
    postalCodes: ["523 30", "523 41", "523 52"]
  },
  {
    name: "Falköping",
    postalCodes: ["521 30", "521 41", "521 52"]
  },
  
  // Smålandska städer
  {
    name: "Västervik",
    postalCodes: ["593 30", "593 41", "593 52"]
  },
  {
    name: "Oskarshamn",
    postalCodes: ["572 30", "572 41", "572 52"]
  },
  {
    name: "Ljungby",
    postalCodes: ["341 30", "341 41", "341 52"]
  },
  {
    name: "Alvesta",
    postalCodes: ["342 30", "342 41", "342 52"]
  },
  {
    name: "Älmhult",
    postalCodes: ["343 30", "343 41", "343 52"]
  },
  {
    name: "Nybro",
    postalCodes: ["382 30", "382 41", "382 52"]
  },
  {
    name: "Vimmerby",
    postalCodes: ["598 30", "598 41", "598 52"]
  },
  
  // Östergötlandska städer
  {
    name: "Motala",
    postalCodes: ["591 79", "591 30", "591 88"]
  },
  {
    name: "Mjölby",
    postalCodes: ["595 30", "595 41", "595 52"]
  },
  {
    name: "Vadstena",
    postalCodes: ["592 30", "592 41", "592 52"]
  },
  {
    name: "Söderköping",
    postalCodes: ["614 30", "614 41", "614 52"]
  },
  
  // Värmlandska städer
  {
    name: "Kristinehamn",
    postalCodes: ["681 30", "681 41", "681 52"]
  },
  {
    name: "Arvika",
    postalCodes: ["671 30", "671 41", "671 52"]
  },
  {
    name: "Filipstad",
    postalCodes: ["682 30", "682 41", "682 52"]
  },
  {
    name: "Säffle",
    postalCodes: ["661 30", "661 41", "661 52"]
  },
  {
    name: "Hagfors",
    postalCodes: ["683 30", "683 41", "683 52"]
  },
  
  // Dalarnas städer
  {
    name: "Ludvika",
    postalCodes: ["771 30", "771 41", "771 52"]
  },
  {
    name: "Avesta",
    postalCodes: ["774 30", "774 41", "774 52"]
  },
  {
    name: "Hedemora",
    postalCodes: ["776 30", "776 41", "776 52"]
  },
  {
    name: "Mora",
    postalCodes: ["792 30", "792 41", "792 52"]
  },
  {
    name: "Rättvik",
    postalCodes: ["795 30", "795 41", "795 52"]
  },
  {
    name: "Leksand",
    postalCodes: ["793 30", "793 41", "793 52"]
  },
  {
    name: "Säter",
    postalCodes: ["783 30", "783 41", "783 52"]
  },
  
  // Västmanlands städer
  {
    name: "Köping",
    postalCodes: ["731 30", "731 41", "731 52"]
  },
  {
    name: "Sala",
    postalCodes: ["733 30", "733 41", "733 52"]
  },
  {
    name: "Fagersta",
    postalCodes: ["737 30", "737 41", "737 52"]
  },
  {
    name: "Arboga",
    postalCodes: ["732 30", "732 41", "732 52"]
  },
  
  // Södermanlands städer
  {
    name: "Katrineholm",
    postalCodes: ["641 30", "641 40", "641 51"]
  },
  {
    name: "Strängnäs",
    postalCodes: ["645 30", "645 41", "645 52"]
  },
  {
    name: "Flen",
    postalCodes: ["642 30", "642 41", "642 52"]
  },
  {
    name: "Trosa",
    postalCodes: ["619 30", "619 41", "619 52"]
  },
  {
    name: "Oxelösund",
    postalCodes: ["613 30", "613 41", "613 52"]
  },
  
  // Västernorrlands städer
  {
    name: "Härnösand",
    postalCodes: ["871 30", "871 41", "871 52"]
  },
  {
    name: "Kramfors",
    postalCodes: ["872 30", "872 41", "872 52"]
  },
  {
    name: "Sollefteå",
    postalCodes: ["881 30", "881 41", "881 52"]
  },
  {
    name: "Hudiksvall",
    postalCodes: ["824 30", "824 41", "824 52"]
  },
  
  // Jämtlands städer
  {
    name: "Åre",
    postalCodes: ["837 30", "837 41", "837 52"]
  },
  {
    name: "Strömsund",
    postalCodes: ["833 30", "833 41", "833 52"]
  },
  
  // Västerbottens städer
  {
    name: "Lycksele",
    postalCodes: ["921 30", "921 41", "921 52"]
  },
  {
    name: "Storuman",
    postalCodes: ["923 30", "923 41", "923 52"]
  },
  
  // Norrbottens städer
  {
    name: "Boden",
    postalCodes: ["961 30", "961 41", "961 52"]
  },
  {
    name: "Gällivare",
    postalCodes: ["982 30", "982 41", "982 52"]
  },
  {
    name: "Haparanda",
    postalCodes: ["953 30", "953 41", "953 52"]
  },
  {
    name: "Kalix",
    postalCodes: ["952 30", "952 41", "952 52"]
  },
  {
    name: "Piteå",
    postalCodes: ["941 30", "941 41", "941 52"]
  },
  {
    name: "Arvidsjaur",
    postalCodes: ["933 30", "933 41", "933 52"]
  },
  
  // Blekinge städer
  {
    name: "Karlshamn",
    postalCodes: ["374 30", "374 41", "374 52"]
  },
  {
    name: "Ronneby",
    postalCodes: ["372 30", "372 41", "372 52"]
  },
  {
    name: "Sölvesborg",
    postalCodes: ["294 30", "294 41", "294 52"]
  },
  {
    name: "Olofström",
    postalCodes: ["293 30", "293 41", "293 52"]
  },
  
  // Gotland
  {
    name: "Gotland",
    postalCodes: ["621 30", "621 41", "621 52", "622 30", "623 30", "624 30"]
  },
  {
    name: "Visby",
    postalCodes: ["621 30", "621 41", "621 52"]
  },
  
  // Åland (många svenskar arbetar där)
  {
    name: "Åland",
    postalCodes: ["22100", "22110", "22120"]
  },
  {
    name: "Mariehamn",
    postalCodes: ["22100", "22101", "22110"]
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