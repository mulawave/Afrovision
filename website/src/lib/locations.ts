export interface CountryData {
  name: string;
  states: StateData[];
}

export interface StateData {
  name: string;
  cities: string[];
}

export const countries: CountryData[] = [
  {
    name: "Nigeria",
    states: [
      { name: "Abia", cities: ["Aba", "Umuahia", "Arochukwu"] },
      { name: "Adamawa", cities: ["Yola", "Mubi", "Jimeta"] },
      { name: "Akwa Ibom", cities: ["Uyo", "Ikot Ekpene", "Eket"] },
      { name: "Anambra", cities: ["Awka", "Onitsha", "Nnewi"] },
      { name: "Bauchi", cities: ["Bauchi", "Azare", "Jama'are"] },
      { name: "Bayelsa", cities: ["Yenagoa", "Brass", "Sagbama"] },
      { name: "Benue", cities: ["Makurdi", "Gboko", "Otukpo"] },
      { name: "Borno", cities: ["Maiduguri", "Biu", "Bama"] },
      { name: "Cross River", cities: ["Calabar", "Ikom", "Ogoja"] },
      { name: "Delta", cities: ["Asaba", "Warri", "Sapele"] },
      { name: "Ebonyi", cities: ["Abakaliki", "Afikpo", "Onueke"] },
      { name: "Edo", cities: ["Benin City", "Auchi", "Ekpoma"] },
      { name: "Ekiti", cities: ["Ado Ekiti", "Ikere", "Ikole"] },
      { name: "Enugu", cities: ["Enugu", "Nsukka", "Abakaliki"] },
      { name: "FCT", cities: ["Abuja", "Gwagwalada", "Kuje"] },
      { name: "Gombe", cities: ["Gombe", "Kaltungo", "Billiri"] },
      { name: "Imo", cities: ["Owerri", "Orlu", "Okigwe"] },
      { name: "Jigawa", cities: ["Dutse", "Hadejia", "Kazaure"] },
      { name: "Kaduna", cities: ["Kaduna", "Zaria", "Kafanchan"] },
      { name: "Kano", cities: ["Kano", "Wudil", "Bichi"] },
      { name: "Katsina", cities: ["Katsina", "Daura", "Funtua"] },
      { name: "Kebbi", cities: ["Birnin Kebbi", "Argungu", "Yauri"] },
      { name: "Kogi", cities: ["Lokoja", "Okene", "Kabba"] },
      { name: "Kwara", cities: ["Ilorin", "Offa", "Jebba"] },
      { name: "Lagos", cities: ["Lagos", "Ikeja", "Lekki", "Surulere", "Epe"] },
      { name: "Nasarawa", cities: ["Lafia", "Keffi", "Akwanga"] },
      { name: "Niger", cities: ["Minna", "Bida", "Suleja"] },
      { name: "Ogun", cities: ["Abeokuta", "Sagamu", "Ijebu Ode"] },
      { name: "Ondo", cities: ["Akure", "Ondo", "Owo"] },
      { name: "Osun", cities: ["Osogbo", "Ile-Ife", "Ilesa"] },
      { name: "Oyo", cities: ["Ibadan", "Oyo", "Ogbomoso"] },
      { name: "Plateau", cities: ["Jos", "Pankshin", "Shendam"] },
      { name: "Rivers", cities: ["Port Harcourt", "Bonny", "Eleme"] },
      { name: "Sokoto", cities: ["Sokoto", "Gusau", "Wurno"] },
      { name: "Taraba", cities: ["Jalingo", "Wukari", "Serti"] },
      { name: "Yobe", cities: ["Damaturu", "Potiskum", "Nguru"] },
      { name: "Zamfara", cities: ["Gusau", "Kaura Namoda", "Anka"] },
    ],
  },
  {
    name: "Ghana",
    states: [
      { name: "Greater Accra", cities: ["Accra", "Tema", "Madina"] },
      { name: "Ashanti", cities: ["Kumasi", "Obuasi", "Ejisu"] },
      { name: "Western", cities: ["Takoradi", "Sekondi", "Axim"] },
      { name: "Central", cities: ["Cape Coast", "Winneba", "Kasoa"] },
      { name: "Eastern", cities: ["Koforidua", "Nkawkaw", "Akosombo"] },
      { name: "Volta", cities: ["Ho", "Keta", "Hohoe"] },
      { name: "Northern", cities: ["Tamale", "Yendi", "Savelugu"] },
      { name: "Upper East", cities: ["Bolgatanga", "Navrongo", "Bawku"] },
      { name: "Upper West", cities: ["Wa", "Jirapa", "Nandom"] },
      { name: "Bono", cities: ["Sunyani", "Berekum", "Dormaa Ahenkro"] },
      { name: "Bono East", cities: ["Techiman", "Kintampo", "Nkoranza"] },
      { name: "Ahafo", cities: ["Goaso", "Bechem", "Kenyasi"] },
      { name: "Oti", cities: ["Dambai", "Kete Krachi", "Nkwanta"] },
      { name: "Western North", cities: ["Sefwi Wiawso", "Bibiani", "Enchi"] },
      { name: "North East", cities: ["Nalerigu", "Walewale", "Gambaga"] },
      { name: "Savannah", cities: ["Damongo", "Salaga", "Bole"] },
    ],
  },
  {
    name: "Kenya",
    states: [
      { name: "Nairobi", cities: ["Nairobi", "Westlands", "Embakasi"] },
      { name: "Mombasa", cities: ["Mombasa", "Nyali", "Likoni"] },
      { name: "Kisumu", cities: ["Kisumu", "Ahero", "Maseno"] },
      { name: "Nakuru", cities: ["Nakuru", "Naivasha", "Gilgil"] },
      { name: "Eldoret", cities: ["Eldoret", "Iten", "Kapsabet"] },
      { name: "Kiambu", cities: ["Kiambu", "Thika", "Ruiru"] },
      { name: "Machakos", cities: ["Machakos", "Athi River", "Kangundo"] },
      { name: "Kakamega", cities: ["Kakamega", "Bungoma", "Mumias"] },
      { name: "Nyeri", cities: ["Nyeri", "Karatina", "Othaya"] },
      { name: "Meru", cities: ["Meru", "Chuka", "Maua"] },
      { name: "Kilifi", cities: ["Kilifi", "Malindi", "Watamu"] },
      { name: "Narok", cities: ["Narok", "Kilgoris", "Lemek"] },
      { name: "Garissa", cities: ["Garissa", "Dadaab", "Hola"] },
      { name: "Kisii", cities: ["Kisii", "Ogembo", "Suneka"] },
      { name: "Murang'a", cities: ["Murang'a", "Kangema", "Kiharu"] },
      { name: "Bungoma", cities: ["Bungoma", "Webuye", "Kimilili"] },
    ],
  },
  {
    name: "South Africa",
    states: [
      { name: "Gauteng", cities: ["Johannesburg", "Pretoria", "Soweto", "Sandton"] },
      { name: "Western Cape", cities: ["Cape Town", "Stellenbosch", "Paarl"] },
      { name: "KwaZulu-Natal", cities: ["Durban", "Pietermaritzburg", "Newcastle"] },
      { name: "Eastern Cape", cities: ["Gqeberha", "East London", "Mthatha"] },
      { name: "Free State", cities: ["Bloemfontein", "Welkom", "Sasolburg"] },
      { name: "Mpumalanga", cities: ["Mbombela", "Witbank", "Secunda"] },
      { name: "Limpopo", cities: ["Polokwane", "Tzaneen", "Phalaborwa"] },
      { name: "North West", cities: ["Mahikeng", "Rustenburg", "Klerksdorp"] },
      { name: "Northern Cape", cities: ["Kimberley", "Upington", "Springbok"] },
    ],
  },
  {
    name: "Uganda",
    states: [
      { name: "Kampala", cities: ["Kampala", "Makindye", "Kawempe"] },
      { name: "Wakiso", cities: ["Wakiso", "Entebbe", "Nansana"] },
      { name: "Mukono", cities: ["Mukono", "Seeta", "Katosi"] },
      { name: "Jinja", cities: ["Jinja", "Njeru", "Kakira"] },
      { name: "Mbarara", cities: ["Mbarara", "Kyazanga", "Bushenyi"] },
      { name: "Gulu", cities: ["Gulu", "Lacor", "Layibi"] },
      { name: "Mbale", cities: ["Mbale", "Bugema", "Lwakhakha"] },
      { name: "Masaka", cities: ["Masaka", "Bukomansimbi", "Kalungu"] },
      { name: "Arua", cities: ["Arua", "Pakwach", "Nebbi"] },
      { name: "Fort Portal", cities: ["Fort Portal", "Kasese", "Bundibugyo"] },
    ],
  },
  {
    name: "Tanzania",
    states: [
      { name: "Dar es Salaam", cities: ["Dar es Salaam", "Kigamboni", "Temeke"] },
      { name: "Dodoma", cities: ["Dodoma", "Kondoa", "Mpwapwa"] },
      { name: "Mwanza", cities: ["Mwanza", "Musoma", "Geita"] },
      { name: "Arusha", cities: ["Arusha", "Moshi", "Karatu"] },
      { name: "Tanga", cities: ["Tanga", "Muheza", "Pangani"] },
      { name: "Mbeya", cities: ["Mbeya", "Tukuyu", "Mbozi"] },
      { name: "Morogoro", cities: ["Morogoro", "Kilosa", "Ifakara"] },
      { name: "Zanzibar", cities: ["Zanzibar City", "Stone Town", "Nungwi"] },
    ],
  },
  {
    name: "Cameroon",
    states: [
      { name: "Centre", cities: ["Yaoundé", "Mbalmayo", "Obala"] },
      { name: "Littoral", cities: ["Douala", "Edéa", "Nkongsamba"] },
      { name: "Southwest", cities: ["Buea", "Limbe", "Kumba"] },
      { name: "Northwest", cities: ["Bamenda", "Kumbo", "Wum"] },
      { name: "West", cities: ["Bafoussam", "Dschang", "Foumban"] },
      { name: "South", cities: ["Ebolowa", "Kribi", "Sangmélima"] },
      { name: "Adamawa", cities: ["Ngaoundéré", "Meiganga", "Tignère"] },
      { name: "North", cities: ["Garoua", "Guider", "Pitoa"] },
      { name: "Far North", cities: ["Maroua", "Kousseri", "Mokolo"] },
    ],
  },
  {
    name: "Senegal",
    states: [
      { name: "Dakar", cities: ["Dakar", "Pikine", "Guédiawaye"] },
      { name: "Thiès", cities: ["Thiès", "Mbour", "Tivaouane"] },
      { name: "Saint-Louis", cities: ["Saint-Louis", "Richard-Toll", "Dagana"] },
      { name: "Diourbel", cities: ["Diourbel", "Mbacké", "Bambey"] },
      { name: "Kaolack", cities: ["Kaolack", "Nioro du Rip", "Guinguinéo"] },
      { name: "Ziguinchor", cities: ["Ziguinchor", "Bignona", "Oussouye"] },
      { name: "Louga", cities: ["Louga", "Linguère", "Kébémer"] },
      { name: "Fatick", cities: ["Fatick", "Sokone", "Foundiougne"] },
      { name: "Tambacounda", cities: ["Tambacounda", "Bakel", "Kidira"] },
      { name: "Kolda", cities: ["Kolda", "Vélingara", "Saraya"] },
    ],
  },
  {
    name: "United States",
    states: [
      { name: "California", cities: ["Los Angeles", "San Francisco", "San Diego", "Sacramento"] },
      { name: "New York", cities: ["New York City", "Buffalo", "Rochester", "Albany"] },
      { name: "Texas", cities: ["Houston", "Dallas", "Austin", "San Antonio"] },
      { name: "Florida", cities: ["Miami", "Orlando", "Tampa", "Jacksonville"] },
      { name: "Illinois", cities: ["Chicago", "Springfield", "Peoria"] },
      { name: "Georgia", cities: ["Atlanta", "Savannah", "Augusta"] },
      { name: "Maryland", cities: ["Baltimore", "Annapolis", "Silver Spring"] },
      { name: "New Jersey", cities: ["Newark", "Jersey City", "Trenton"] },
      { name: "Virginia", cities: ["Richmond", "Virginia Beach", "Arlington"] },
      { name: "Massachusetts", cities: ["Boston", "Cambridge", "Worcester"] },
    ],
  },
  {
    name: "United Kingdom",
    states: [
      { name: "England", cities: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"] },
      { name: "Scotland", cities: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"] },
      { name: "Wales", cities: ["Cardiff", "Swansea", "Newport"] },
      { name: "Northern Ireland", cities: ["Belfast", "Derry", "Lisburn"] },
    ],
  },
  {
    name: "Canada",
    states: [
      { name: "Ontario", cities: ["Toronto", "Ottawa", "Mississauga", "Hamilton"] },
      { name: "Quebec", cities: ["Montreal", "Quebec City", "Laval", "Gatineau"] },
      { name: "British Columbia", cities: ["Vancouver", "Victoria", "Surrey", "Burnaby"] },
      { name: "Alberta", cities: ["Calgary", "Edmonton", "Red Deer"] },
      { name: "Manitoba", cities: ["Winnipeg", "Brandon", "Steinbach"] },
      { name: "Saskatchewan", cities: ["Saskatoon", "Regina", "Prince Albert"] },
      { name: "Nova Scotia", cities: ["Halifax", "Sydney", "Dartmouth"] },
    ],
  },
  {
    name: "Other",
    states: [
      { name: "Other", cities: ["Other"] },
    ],
  },
];

export function getStates(countryName: string): StateData[] {
  const country = countries.find((c) => c.name === countryName);
  return country ? country.states : [];
}

export function getCities(countryName: string, stateName: string): string[] {
  const country = countries.find((c) => c.name === countryName);
  if (!country) return [];
  const state = country.states.find((s) => s.name === stateName);
  return state ? state.cities : [];
}

export const referralSources = [
  "Google Search",
  "TikTok",
  "WhatsApp Status",
  "Xlounge-Extreme",
  "From a friend or Family member",
  "Facebook",
  "Myngul",
  "Twitter",
  "Instagram",
  "Youtube",
  "Telegram",
  "Other, please specify",
];
