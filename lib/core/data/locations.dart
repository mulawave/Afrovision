class CountryData {
  final String name;
  final List<StateData> states;
  const CountryData({required this.name, required this.states});
}

class StateData {
  final String name;
  final List<String> cities;
  const StateData({required this.name, required this.cities});
}

const List<CountryData> countries = [
  CountryData(name: 'Nigeria', states: [
    StateData(name: 'Abia', cities: ['Aba', 'Umuahia', 'Arochukwu']),
    StateData(name: 'Adamawa', cities: ['Yola', 'Mubi', 'Jimeta']),
    StateData(name: 'Akwa Ibom', cities: ['Uyo', 'Ikot Ekpene', 'Eket']),
    StateData(name: 'Anambra', cities: ['Awka', 'Onitsha', 'Nnewi']),
    StateData(name: 'Bauchi', cities: ['Bauchi', 'Azare', "Jama'are"]),
    StateData(name: 'Bayelsa', cities: ['Yenagoa', 'Brass', 'Sagbama']),
    StateData(name: 'Benue', cities: ['Makurdi', 'Gboko', 'Otukpo']),
    StateData(name: 'Borno', cities: ['Maiduguri', 'Biu', 'Bama']),
    StateData(name: 'Cross River', cities: ['Calabar', 'Ikom', 'Ogoja']),
    StateData(name: 'Delta', cities: ['Asaba', 'Warri', 'Sapele']),
    StateData(name: 'Ebonyi', cities: ['Abakaliki', 'Afikpo', 'Onueke']),
    StateData(name: 'Edo', cities: ['Benin City', 'Auchi', 'Ekpoma']),
    StateData(name: 'Ekiti', cities: ['Ado Ekiti', 'Ikere', 'Ikole']),
    StateData(name: 'Enugu', cities: ['Enugu', 'Nsukka', 'Abakaliki']),
    StateData(name: 'FCT', cities: ['Abuja', 'Gwagwalada', 'Kuje']),
    StateData(name: 'Gombe', cities: ['Gombe', 'Kaltungo', 'Billiri']),
    StateData(name: 'Imo', cities: ['Owerri', 'Orlu', 'Okigwe']),
    StateData(name: 'Jigawa', cities: ['Dutse', 'Hadejia', 'Kazaure']),
    StateData(name: 'Kaduna', cities: ['Kaduna', 'Zaria', 'Kafanchan']),
    StateData(name: 'Kano', cities: ['Kano', 'Wudil', 'Bichi']),
    StateData(name: 'Katsina', cities: ['Katsina', 'Daura', 'Funtua']),
    StateData(name: 'Kebbi', cities: ['Birnin Kebbi', 'Argungu', 'Yauri']),
    StateData(name: 'Kogi', cities: ['Lokoja', 'Okene', 'Kabba']),
    StateData(name: 'Kwara', cities: ['Ilorin', 'Offa', 'Jebba']),
    StateData(name: 'Lagos', cities: ['Lagos', 'Ikeja', 'Lekki', 'Surulere', 'Epe']),
    StateData(name: 'Nasarawa', cities: ['Lafia', 'Keffi', 'Akwanga']),
    StateData(name: 'Niger', cities: ['Minna', 'Bida', 'Suleja']),
    StateData(name: 'Ogun', cities: ['Abeokuta', 'Sagamu', 'Ijebu Ode']),
    StateData(name: 'Ondo', cities: ['Akure', 'Ondo', 'Owo']),
    StateData(name: 'Osun', cities: ['Osogbo', 'Ile-Ife', 'Ilesa']),
    StateData(name: 'Oyo', cities: ['Ibadan', 'Oyo', 'Ogbomoso']),
    StateData(name: 'Plateau', cities: ['Jos', 'Pankshin', 'Shendam']),
    StateData(name: 'Rivers', cities: ['Port Harcourt', 'Bonny', 'Eleme']),
    StateData(name: 'Sokoto', cities: ['Sokoto', 'Gusau', 'Wurno']),
    StateData(name: 'Taraba', cities: ['Jalingo', 'Wukari', 'Serti']),
    StateData(name: 'Yobe', cities: ['Damaturu', 'Potiskum', 'Nguru']),
    StateData(name: 'Zamfara', cities: ['Gusau', 'Kaura Namoda', 'Anka']),
  ]),
  CountryData(name: 'Ghana', states: [
    StateData(name: 'Greater Accra', cities: ['Accra', 'Tema', 'Madina']),
    StateData(name: 'Ashanti', cities: ['Kumasi', 'Obuasi', 'Ejisu']),
    StateData(name: 'Western', cities: ['Takoradi', 'Sekondi', 'Axim']),
    StateData(name: 'Central', cities: ['Cape Coast', 'Winneba', 'Kasoa']),
    StateData(name: 'Eastern', cities: ['Koforidua', 'Nkawkaw', 'Akosombo']),
    StateData(name: 'Volta', cities: ['Ho', 'Keta', 'Hohoe']),
    StateData(name: 'Northern', cities: ['Tamale', 'Yendi', 'Savelugu']),
    StateData(name: 'Upper East', cities: ['Bolgatanga', 'Navrongo', 'Bawku']),
    StateData(name: 'Upper West', cities: ['Wa', 'Jirapa', 'Nandom']),
    StateData(name: 'Bono', cities: ['Sunyani', 'Berekum', 'Dormaa Ahenkro']),
    StateData(name: 'Bono East', cities: ['Techiman', 'Kintampo', 'Nkoranza']),
    StateData(name: 'Ahafo', cities: ['Goaso', 'Bechem', 'Kenyasi']),
    StateData(name: 'Oti', cities: ['Dambai', 'Kete Krachi', 'Nkwanta']),
    StateData(name: 'Western North', cities: ['Sefwi Wiawso', 'Bibiani', 'Enchi']),
    StateData(name: 'North East', cities: ['Nalerigu', 'Walewale', 'Gambaga']),
    StateData(name: 'Savannah', cities: ['Damongo', 'Salaga', 'Bole']),
  ]),
  CountryData(name: 'Kenya', states: [
    StateData(name: 'Nairobi', cities: ['Nairobi', 'Westlands', 'Embakasi']),
    StateData(name: 'Mombasa', cities: ['Mombasa', 'Nyali', 'Likoni']),
    StateData(name: 'Kisumu', cities: ['Kisumu', 'Ahero', 'Maseno']),
    StateData(name: 'Nakuru', cities: ['Nakuru', 'Naivasha', 'Gilgil']),
    StateData(name: 'Eldoret', cities: ['Eldoret', 'Iten', 'Kapsabet']),
    StateData(name: 'Kiambu', cities: ['Kiambu', 'Thika', 'Ruiru']),
    StateData(name: 'Machakos', cities: ['Machakos', 'Athi River', 'Kangundo']),
    StateData(name: 'Kakamega', cities: ['Kakamega', 'Bungoma', 'Mumias']),
    StateData(name: 'Nyeri', cities: ['Nyeri', 'Karatina', 'Othaya']),
    StateData(name: 'Meru', cities: ['Meru', 'Chuka', 'Maua']),
    StateData(name: 'Kilifi', cities: ['Kilifi', 'Malindi', 'Watamu']),
    StateData(name: 'Narok', cities: ['Narok', 'Kilgoris', 'Lemek']),
    StateData(name: 'Garissa', cities: ['Garissa', 'Dadaab', 'Hola']),
    StateData(name: 'Kisii', cities: ['Kisii', 'Ogembo', 'Suneka']),
    StateData(name: "Murang'a", cities: ["Murang'a", 'Kangema', 'Kiharu']),
    StateData(name: 'Bungoma', cities: ['Bungoma', 'Webuye', 'Kimilili']),
  ]),
  CountryData(name: 'South Africa', states: [
    StateData(name: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Soweto', 'Sandton']),
    StateData(name: 'Western Cape', cities: ['Cape Town', 'Stellenbosch', 'Paarl']),
    StateData(name: 'KwaZulu-Natal', cities: ['Durban', 'Pietermaritzburg', 'Newcastle']),
    StateData(name: 'Eastern Cape', cities: ['Gqeberha', 'East London', 'Mthatha']),
    StateData(name: 'Free State', cities: ['Bloemfontein', 'Welkom', 'Sasolburg']),
    StateData(name: 'Mpumalanga', cities: ['Mbombela', 'Witbank', 'Secunda']),
    StateData(name: 'Limpopo', cities: ['Polokwane', 'Tzaneen', 'Phalaborwa']),
    StateData(name: 'North West', cities: ['Mahikeng', 'Rustenburg', 'Klerksdorp']),
    StateData(name: 'Northern Cape', cities: ['Kimberley', 'Upington', 'Springbok']),
  ]),
  CountryData(name: 'Uganda', states: [
    StateData(name: 'Kampala', cities: ['Kampala', 'Makindye', 'Kawempe']),
    StateData(name: 'Wakiso', cities: ['Wakiso', 'Entebbe', 'Nansana']),
    StateData(name: 'Mukono', cities: ['Mukono', 'Seeta', 'Katosi']),
    StateData(name: 'Jinja', cities: ['Jinja', 'Njeru', 'Kakira']),
    StateData(name: 'Mbarara', cities: ['Mbarara', 'Kyazanga', 'Bushenyi']),
    StateData(name: 'Gulu', cities: ['Gulu', 'Lacor', 'Layibi']),
    StateData(name: 'Mbale', cities: ['Mbale', 'Bugema', 'Lwakhakha']),
    StateData(name: 'Masaka', cities: ['Masaka', 'Bukomansimbi', 'Kalungu']),
    StateData(name: 'Arua', cities: ['Arua', 'Pakwach', 'Nebbi']),
    StateData(name: 'Fort Portal', cities: ['Fort Portal', 'Kasese', 'Bundibugyo']),
  ]),
  CountryData(name: 'Tanzania', states: [
    StateData(name: 'Dar es Salaam', cities: ['Dar es Salaam', 'Kigamboni', 'Temeke']),
    StateData(name: 'Dodoma', cities: ['Dodoma', 'Kondoa', 'Mpwapwa']),
    StateData(name: 'Mwanza', cities: ['Mwanza', 'Musoma', 'Geita']),
    StateData(name: 'Arusha', cities: ['Arusha', 'Moshi', 'Karatu']),
    StateData(name: 'Tanga', cities: ['Tanga', 'Muheza', 'Pangani']),
    StateData(name: 'Mbeya', cities: ['Mbeya', 'Tukuyu', 'Mbozi']),
    StateData(name: 'Morogoro', cities: ['Morogoro', 'Kilosa', 'Ifakara']),
    StateData(name: 'Zanzibar', cities: ['Zanzibar City', 'Stone Town', 'Nungwi']),
  ]),
  CountryData(name: 'Cameroon', states: [
    StateData(name: 'Centre', cities: ['Yaoundé', 'Mbalmayo', 'Obala']),
    StateData(name: 'Littoral', cities: ['Douala', 'Edéa', 'Nkongsamba']),
    StateData(name: 'Southwest', cities: ['Buea', 'Limbe', 'Kumba']),
    StateData(name: 'Northwest', cities: ['Bamenda', 'Kumbo', 'Wum']),
    StateData(name: 'West', cities: ['Bafoussam', 'Dschang', 'Foumban']),
    StateData(name: 'South', cities: ['Ebolowa', 'Kribi', 'Sangmélima']),
    StateData(name: 'Adamawa', cities: ['Ngaoundéré', 'Meiganga', 'Tignère']),
    StateData(name: 'North', cities: ['Garoua', 'Guider', 'Pitoa']),
    StateData(name: 'Far North', cities: ['Maroua', 'Kousseri', 'Mokolo']),
  ]),
  CountryData(name: 'Senegal', states: [
    StateData(name: 'Dakar', cities: ['Dakar', 'Pikine', 'Guédiawaye']),
    StateData(name: 'Thiès', cities: ['Thiès', 'Mbour', 'Tivaouane']),
    StateData(name: 'Saint-Louis', cities: ['Saint-Louis', 'Richard-Toll', 'Dagana']),
    StateData(name: 'Diourbel', cities: ['Diourbel', 'Mbacké', 'Bambey']),
    StateData(name: 'Kaolack', cities: ['Kaolack', 'Nioro du Rip', 'Guinguinéo']),
    StateData(name: 'Ziguinchor', cities: ['Ziguinchor', 'Bignona', 'Oussouye']),
    StateData(name: 'Louga', cities: ['Louga', 'Linguère', 'Kébémer']),
    StateData(name: 'Fatick', cities: ['Fatick', 'Sokone', 'Foundiougne']),
    StateData(name: 'Tambacounda', cities: ['Tambacounda', 'Bakel', 'Kidira']),
    StateData(name: 'Kolda', cities: ['Kolda', 'Vélingara', 'Saraya']),
  ]),
  CountryData(name: 'United States', states: [
    StateData(name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento']),
    StateData(name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany']),
    StateData(name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio']),
    StateData(name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville']),
    StateData(name: 'Illinois', cities: ['Chicago', 'Springfield', 'Peoria']),
    StateData(name: 'Georgia', cities: ['Atlanta', 'Savannah', 'Augusta']),
    StateData(name: 'Maryland', cities: ['Baltimore', 'Annapolis', 'Silver Spring']),
    StateData(name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Trenton']),
    StateData(name: 'Virginia', cities: ['Richmond', 'Virginia Beach', 'Arlington']),
    StateData(name: 'Massachusetts', cities: ['Boston', 'Cambridge', 'Worcester']),
  ]),
  CountryData(name: 'United Kingdom', states: [
    StateData(name: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds']),
    StateData(name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee']),
    StateData(name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport']),
    StateData(name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn']),
  ]),
  CountryData(name: 'Canada', states: [
    StateData(name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton']),
    StateData(name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau']),
    StateData(name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby']),
    StateData(name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer']),
    StateData(name: 'Manitoba', cities: ['Winnipeg', 'Brandon', 'Steinbach']),
    StateData(name: 'Saskatchewan', cities: ['Saskatoon', 'Regina', 'Prince Albert']),
    StateData(name: 'Nova Scotia', cities: ['Halifax', 'Sydney', 'Dartmouth']),
  ]),
  CountryData(name: 'Other', states: [
    StateData(name: 'Other', cities: ['Other']),
  ]),
];

List<StateData> getStatesForCountry(String countryName) {
  final country = countries.where((c) => c.name == countryName).toList();
  return country.isNotEmpty ? country.first.states : [];
}

List<String> getCitiesForState(String countryName, String stateName) {
  final states = getStatesForCountry(countryName);
  final state = states.where((s) => s.name == stateName).toList();
  return state.isNotEmpty ? state.first.cities : [];
}

const List<String> referralSources = [
  'Google Search',
  'TikTok',
  'WhatsApp Status',
  'Xlounge-Extreme',
  'From a friend or Family member',
  'Facebook',
  'Myngul',
  'Twitter',
  'Instagram',
  'Youtube',
  'Telegram',
  'Other, please specify',
];
