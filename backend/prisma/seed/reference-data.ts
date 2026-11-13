/** Global reference data for development: India (Kerala) and UAE, to test multi-country. */

export const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
];

interface DistrictSeed {
  name: string;
  cities: string[];
}

interface RegionSeed {
  code: string;
  name: string;
  type: 'STATE' | 'PROVINCE' | 'EMIRATE' | 'TERRITORY';
  districts: DistrictSeed[];
}

interface CountrySeed {
  isoCode: string;
  name: string;
  currencyCode: string;
  phoneCode: string;
  defaultTimezone: string;
  regions: RegionSeed[];
}

export const GEOGRAPHY: CountrySeed[] = [
  {
    isoCode: 'IN',
    name: 'India',
    currencyCode: 'INR',
    phoneCode: '91',
    defaultTimezone: 'Asia/Kolkata',
    regions: [
      {
        code: 'KL',
        name: 'Kerala',
        type: 'STATE',
        districts: [
          { name: 'Ernakulam', cities: ['Kochi', 'Aluva'] },
          { name: 'Thiruvananthapuram', cities: ['Thiruvananthapuram'] },
          { name: 'Kozhikode', cities: ['Kozhikode'] },
          { name: 'Thrissur', cities: ['Thrissur'] },
          { name: 'Malappuram', cities: ['Malappuram', 'Tirur'] },
        ],
      },
    ],
  },
  {
    isoCode: 'AE',
    name: 'United Arab Emirates',
    currencyCode: 'AED',
    phoneCode: '971',
    defaultTimezone: 'Asia/Dubai',
    regions: [
      {
        code: 'DU',
        name: 'Dubai',
        type: 'EMIRATE',
        districts: [{ name: 'Dubai', cities: ['Dubai'] }],
      },
      {
        code: 'AZ',
        name: 'Abu Dhabi',
        type: 'EMIRATE',
        districts: [{ name: 'Abu Dhabi', cities: ['Abu Dhabi', 'Al Ain'] }],
      },
      {
        code: 'SH',
        name: 'Sharjah',
        type: 'EMIRATE',
        districts: [{ name: 'Sharjah', cities: ['Sharjah'] }],
      },
    ],
  },
];
