// Country code mapping and flag emoji utilities for tournaments

export const COUNTRY_CODES: Record<string, string> = {
  // Grand Slams
  'Australia': 'AU',
  'Australie': 'AU',
  'France': 'FR',
  'United Kingdom': 'GB',
  'Royaume-Uni': 'GB',
  'UK': 'GB',
  'Great Britain': 'GB',
  'USA': 'US',
  'United States': 'US',
  'États-Unis': 'US',

  // Europe
  'Austria': 'AT',
  'Autriche': 'AT',
  'Belgium': 'BE',
  'Belgique': 'BE',
  'Croatia': 'HR',
  'Croatie': 'HR',
  'Czech Republic': 'CZ',
  'Czechia': 'CZ',
  'République tchèque': 'CZ',
  'Denmark': 'DK',
  'Danemark': 'DK',
  'Finland': 'FI',
  'Finlande': 'FI',
  'Germany': 'DE',
  'Allemagne': 'DE',
  'Greece': 'GR',
  'Grèce': 'GR',
  'Hungary': 'HU',
  'Hongrie': 'HU',
  'Ireland': 'IE',
  'Irlande': 'IE',
  'Italy': 'IT',
  'Italie': 'IT',
  'Luxembourg': 'LU',
  'Monaco': 'MC',
  'Netherlands': 'NL',
  'Pays-Bas': 'NL',
  'Norway': 'NO',
  'Norvège': 'NO',
  'Poland': 'PL',
  'Pologne': 'PL',
  'Portugal': 'PT',
  'Romania': 'RO',
  'Roumanie': 'RO',
  'Russia': 'RU',
  'Russie': 'RU',
  'Serbia': 'RS',
  'Serbie': 'RS',
  'Slovakia': 'SK',
  'Slovaquie': 'SK',
  'Spain': 'ES',
  'Espagne': 'ES',
  'Sweden': 'SE',
  'Suède': 'SE',
  'Switzerland': 'CH',
  'Suisse': 'CH',
  'Turkey': 'TR',
  'Turkiye': 'TR',
  'Turquie': 'TR',

  // Americas
  'Argentina': 'AR',
  'Argentine': 'AR',
  'Brazil': 'BR',
  'Brésil': 'BR',
  'Canada': 'CA',
  'Chile': 'CL',
  'Chili': 'CL',
  'Colombia': 'CO',
  'Colombie': 'CO',
  'Ecuador': 'EC',
  'Équateur': 'EC',
  'Mexico': 'MX',
  'Mexique': 'MX',
  'Peru': 'PE',
  'Pérou': 'PE',
  'Uruguay': 'UY',

  // Asia-Pacific
  'China': 'CN',
  'Chine': 'CN',
  'Hong Kong': 'HK',
  'India': 'IN',
  'Inde': 'IN',
  'Indonesia': 'ID',
  'Indonésie': 'ID',
  'Japan': 'JP',
  'Japon': 'JP',
  'Kazakhstan': 'KZ',
  'Malaysia': 'MY',
  'Malaisie': 'MY',
  'New Zealand': 'NZ',
  'Nouvelle-Zélande': 'NZ',
  'Philippines': 'PH',
  'Singapore': 'SG',
  'Singapour': 'SG',
  'South Korea': 'KR',
  'Corée du Sud': 'KR',
  'Korea': 'KR',
  'Korea, Rep.': 'KR',
  'Taiwan': 'TW',
  'Taïwan': 'TW',
  'Thailand': 'TH',
  'Thaïlande': 'TH',
  'Sri Lanka': 'LK',
  'Uzbekistan': 'UZ',
  'Ouzbékistan': 'UZ',
  'Vietnam': 'VN',

  // Middle East & Africa
  'Bahrain': 'BH',
  'Bahreïn': 'BH',
  'Egypt': 'EG',
  'Egypte': 'EG',
  'Égypte': 'EG',
  'Israel': 'IL',
  'Israël': 'IL',
  'Morocco': 'MA',
  'Maroc': 'MA',
  'Qatar': 'QA',
  'Saudi Arabia': 'SA',
  'Arabie Saoudite': 'SA',
  'South Africa': 'ZA',
  'Afrique du Sud': 'ZA',
  'Tunisia': 'TN',
  'Tunisie': 'TN',
  'United Arab Emirates': 'AE',
  'Émirats': 'AE',
  'Émirats arabes unis': 'AE',
  'UAE': 'AE',
};

export const getCountryCode = (countryName: string): string => {
  return COUNTRY_CODES[countryName] || 'XX';
};

// Convert country code directly to flag emoji (e.g., 'FR' -> 🇫🇷)
export const codeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return '';
  const upperCode = code.toUpperCase();
  const codePoints = upperCode
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const getFlagEmoji = (countryNameOrCode: string): string => {
  // If it's a 2-letter code, convert directly
  if (countryNameOrCode && countryNameOrCode.length === 2) {
    return codeToFlag(countryNameOrCode);
  }
  
  // Otherwise look up the country name
  let code = COUNTRY_CODES[countryNameOrCode];
  if (!code) return '';
  if (code === 'UK') code = 'GB';
  return codeToFlag(code);
};
