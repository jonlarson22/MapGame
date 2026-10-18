// facts.js — bite-size facts for the hold-to-view state/province card.
//
// Sources:
// - Populations: US = U.S. Census Bureau Vintage 2024 estimates (July 1, 2024),
//   rounded to 1 decimal in millions and labeled "2024 est."; Canada = Statistics
//   Canada quarterly estimates, July 1, 2024 (territories shown in thousands,
//   since 0.0M would be meaningless).
// - Admission years/order: the standard statehood and Confederation sequences
//   (provinces numbered 1-10 in the conventional order, territories 11-13 by
//   creation year: NT 1870, YT 1898, NU 1999).
// - Mottos, nicknames, birds, flowers: the official state/provincial symbols.
// - NT and YT have no official motto (motto: null) — the sheet skips that row.

export const STATE_FACTS = {
  AK: { capital: 'Juneau', pop: '0.7M', admitted: 1959, order: 49, motto: 'North to the Future', nick: 'The Last Frontier', bird: 'Willow ptarmigan', flower: 'Forget-me-not' },
  AL: { capital: 'Montgomery', pop: '5.3M', admitted: 1819, order: 22, motto: 'Audemus jura nostra defendere', nick: 'Yellowhammer State', bird: 'Northern flicker', flower: 'Camellia' },
  AR: { capital: 'Little Rock', pop: '3.1M', admitted: 1836, order: 25, motto: 'Regnat populus', nick: 'The Natural State', bird: 'Northern mockingbird', flower: 'Apple blossom' },
  AZ: { capital: 'Phoenix', pop: '7.6M', admitted: 1912, order: 48, motto: 'Ditat Deus', nick: 'Grand Canyon State', bird: 'Cactus wren', flower: 'Saguaro cactus blossom' },
  CA: { capital: 'Sacramento', pop: '39.4M', admitted: 1850, order: 31, motto: 'Eureka', nick: 'Golden State', bird: 'California quail', flower: 'California poppy' },
  CO: { capital: 'Denver', pop: '6.0M', admitted: 1876, order: 38, motto: 'Nil sine numine', nick: 'Centennial State', bird: 'Lark bunting', flower: 'Rocky Mountain columbine' },
  CT: { capital: 'Hartford', pop: '3.7M', admitted: 1788, order: 5, motto: 'Qui transtulit sustinet', nick: 'Constitution State', bird: 'American robin', flower: 'Mountain laurel' },
  DE: { capital: 'Dover', pop: '1.1M', admitted: 1787, order: 1, motto: 'Liberty and Independence', nick: 'First State', bird: 'Delaware blue hen', flower: 'Peach blossom' },
  FL: { capital: 'Tallahassee', pop: '23.4M', admitted: 1845, order: 27, motto: 'In God We Trust', nick: 'Sunshine State', bird: 'Northern mockingbird', flower: 'Orange blossom' },
  GA: { capital: 'Atlanta', pop: '11.2M', admitted: 1788, order: 4, motto: 'Wisdom, Justice, Moderation', nick: 'Peach State', bird: 'Brown thrasher', flower: 'Cherokee rose' },
  HI: { capital: 'Honolulu', pop: '1.4M', admitted: 1959, order: 50, motto: 'Ua Mau ke Ea o ka ʻĀina i ka Pono', nick: 'Aloha State', bird: 'Hawaiian goose (nēnē)', flower: 'Hawaiian hibiscus' },
  IA: { capital: 'Des Moines', pop: '3.2M', admitted: 1846, order: 29, motto: 'Our liberties we prize and our rights we will maintain', nick: 'Hawkeye State', bird: 'American goldfinch', flower: 'Wild prairie rose' },
  ID: { capital: 'Boise', pop: '2.0M', admitted: 1890, order: 43, motto: 'Esto perpetua', nick: 'Gem State', bird: 'Mountain bluebird', flower: 'Syringa' },
  IL: { capital: 'Springfield', pop: '12.7M', admitted: 1818, order: 21, motto: 'State sovereignty, national union', nick: 'Prairie State', bird: 'Northern cardinal', flower: 'Violet' },
  IN: { capital: 'Indianapolis', pop: '6.9M', admitted: 1816, order: 19, motto: 'The Crossroads of America', nick: 'Hoosier State', bird: 'Northern cardinal', flower: 'Peony' },
  KS: { capital: 'Topeka', pop: '2.9M', admitted: 1861, order: 34, motto: 'Ad astra per aspera', nick: 'Sunflower State', bird: 'Western meadowlark', flower: 'Sunflower' },
  KY: { capital: 'Frankfort', pop: '4.6M', admitted: 1792, order: 15, motto: 'United we stand, divided we fall', nick: 'Bluegrass State', bird: 'Northern cardinal', flower: 'Goldenrod' },
  LA: { capital: 'Baton Rouge', pop: '4.6M', admitted: 1812, order: 18, motto: 'Union, justice, confidence', nick: 'Pelican State', bird: 'Brown pelican', flower: 'Magnolia' },
  MA: { capital: 'Boston', pop: '7.1M', admitted: 1788, order: 6, motto: 'Ense petit placidam sub libertate quietem', nick: 'Bay State', bird: 'Black-capped chickadee', flower: 'Mayflower' },
  MD: { capital: 'Annapolis', pop: '6.3M', admitted: 1788, order: 7, motto: 'Fatti maschii, parole femine', nick: 'Old Line State', bird: 'Baltimore oriole', flower: 'Black-eyed Susan' },
  ME: { capital: 'Augusta', pop: '1.4M', admitted: 1820, order: 23, motto: 'Dirigo', nick: 'Pine Tree State', bird: 'Black-capped chickadee', flower: 'White pine cone and tassel' },
  MI: { capital: 'Lansing', pop: '10.1M', admitted: 1837, order: 26, motto: 'Si quaeris peninsulam amoenam circumspice', nick: 'Great Lakes State', bird: 'American robin', flower: 'Apple blossom' },
  MN: { capital: 'Saint Paul', pop: '5.8M', admitted: 1858, order: 32, motto: 'L’Étoile du Nord', nick: 'North Star State', bird: 'Common loon', flower: 'Pink and white lady’s slipper' },
  MO: { capital: 'Jefferson City', pop: '6.2M', admitted: 1821, order: 24, motto: 'Salus populi suprema lex esto', nick: 'Show-Me State', bird: 'Eastern bluebird', flower: 'White hawthorn blossom' },
  MS: { capital: 'Jackson', pop: '2.9M', admitted: 1817, order: 20, motto: 'Virtute et armis', nick: 'Magnolia State', bird: 'Northern mockingbird', flower: 'Magnolia' },
  MT: { capital: 'Helena', pop: '1.1M', admitted: 1889, order: 41, motto: 'Oro y plata', nick: 'Treasure State', bird: 'Western meadowlark', flower: 'Bitterroot' },
  NC: { capital: 'Raleigh', pop: '11.0M', admitted: 1789, order: 12, motto: 'Esse quam videri', nick: 'Tar Heel State', bird: 'Northern cardinal', flower: 'Flowering dogwood' },
  ND: { capital: 'Bismarck', pop: '0.8M', admitted: 1889, order: 39, motto: 'Liberty and union, now and forever, one and inseparable', nick: 'Peace Garden State', bird: 'Western meadowlark', flower: 'Wild prairie rose' },
  NE: { capital: 'Lincoln', pop: '2.0M', admitted: 1867, order: 37, motto: 'Equality before the law', nick: 'Cornhusker State', bird: 'Western meadowlark', flower: 'Goldenrod' },
  NH: { capital: 'Concord', pop: '1.4M', admitted: 1788, order: 9, motto: 'Live Free or Die', nick: 'Granite State', bird: 'Purple finch', flower: 'Purple lilac' },
  NJ: { capital: 'Trenton', pop: '9.5M', admitted: 1787, order: 3, motto: 'Liberty and Prosperity', nick: 'Garden State', bird: 'American goldfinch', flower: 'Violet' },
  NM: { capital: 'Santa Fe', pop: '2.1M', admitted: 1912, order: 47, motto: 'Crescit eundo', nick: 'Land of Enchantment', bird: 'Greater roadrunner', flower: 'Yucca' },
  NV: { capital: 'Carson City', pop: '3.2M', admitted: 1864, order: 36, motto: 'All for Our Country', nick: 'Silver State', bird: 'Mountain bluebird', flower: 'Sagebrush' },
  NY: { capital: 'Albany', pop: '19.9M', admitted: 1788, order: 11, motto: 'Excelsior', nick: 'Empire State', bird: 'Eastern bluebird', flower: 'Rose' },
  OH: { capital: 'Columbus', pop: '11.9M', admitted: 1803, order: 17, motto: 'With God, all things are possible', nick: 'Buckeye State', bird: 'Northern cardinal', flower: 'Scarlet carnation' },
  OK: { capital: 'Oklahoma City', pop: '4.1M', admitted: 1907, order: 46, motto: 'Labor omnia vincit', nick: 'Sooner State', bird: 'Scissor-tailed flycatcher', flower: 'Oklahoma rose' },
  OR: { capital: 'Salem', pop: '4.3M', admitted: 1859, order: 33, motto: 'Alis volat propriis', nick: 'Beaver State', bird: 'Western meadowlark', flower: 'Oregon grape' },
  PA: { capital: 'Harrisburg', pop: '13.1M', admitted: 1787, order: 2, motto: 'Virtue, liberty and independence', nick: 'Keystone State', bird: 'Ruffed grouse', flower: 'Mountain laurel' },
  RI: { capital: 'Providence', pop: '1.1M', admitted: 1790, order: 13, motto: 'Hope', nick: 'Ocean State', bird: 'Rhode Island red', flower: 'Violet' },
  SC: { capital: 'Columbia', pop: '5.5M', admitted: 1788, order: 8, motto: 'Dum spiro spero', nick: 'Palmetto State', bird: 'Carolina wren', flower: 'Yellow jessamine' },
  SD: { capital: 'Pierre', pop: '0.9M', admitted: 1889, order: 40, motto: 'Under God the people rule', nick: 'Mount Rushmore State', bird: 'Ring-necked pheasant', flower: 'American pasqueflower' },
  TN: { capital: 'Nashville', pop: '7.2M', admitted: 1796, order: 16, motto: 'Agriculture and Commerce', nick: 'Volunteer State', bird: 'Northern mockingbird', flower: 'Iris' },
  TX: { capital: 'Austin', pop: '31.3M', admitted: 1845, order: 28, motto: 'Friendship', nick: 'Lone Star State', bird: 'Northern mockingbird', flower: 'Bluebonnet' },
  UT: { capital: 'Salt Lake City', pop: '3.5M', admitted: 1896, order: 45, motto: 'Industry', nick: 'Beehive State', bird: 'California gull', flower: 'Sego lily' },
  VA: { capital: 'Richmond', pop: '8.8M', admitted: 1788, order: 10, motto: 'Sic semper tyrannis', nick: 'Old Dominion', bird: 'Northern cardinal', flower: 'Flowering dogwood' },
  VT: { capital: 'Montpelier', pop: '0.6M', admitted: 1791, order: 14, motto: 'Freedom and Unity', nick: 'Green Mountain State', bird: 'Hermit thrush', flower: 'Red clover' },
  WA: { capital: 'Olympia', pop: '8.0M', admitted: 1889, order: 42, motto: 'Alki', nick: 'Evergreen State', bird: 'American goldfinch', flower: 'Coast rhododendron' },
  WI: { capital: 'Madison', pop: '6.0M', admitted: 1848, order: 30, motto: 'Forward', nick: 'Badger State', bird: 'American robin', flower: 'Wood violet' },
  WV: { capital: 'Charleston', pop: '1.8M', admitted: 1863, order: 35, motto: 'Montani semper liberi', nick: 'Mountain State', bird: 'Northern cardinal', flower: 'Rhododendron' },
  WY: { capital: 'Cheyenne', pop: '0.6M', admitted: 1890, order: 44, motto: 'Equal rights', nick: 'Equality State', bird: 'Western meadowlark', flower: 'Indian paintbrush' },
};

export const PROVINCE_FACTS = {
  AB: { capital: 'Edmonton', pop: '4.9M', joined: 1905, order: 9, motto: 'Fortis et liber', bird: 'Great horned owl', flower: 'Wild rose' },
  BC: { capital: 'Victoria', pop: '5.7M', joined: 1871, order: 6, motto: 'Splendor sine occasu', bird: 'Steller’s jay', flower: 'Pacific dogwood' },
  MB: { capital: 'Winnipeg', pop: '1.5M', joined: 1870, order: 5, motto: 'Gloriosus et liber', bird: 'Great gray owl', flower: 'Prairie crocus' },
  NB: { capital: 'Fredericton', pop: '0.9M', joined: 1867, order: 4, motto: 'Spem reduxit', bird: 'Black-capped chickadee', flower: 'Purple violet' },
  NL: { capital: 'St. John\'s', pop: '0.5M', joined: 1949, order: 10, motto: 'Quaerite primum regnum Dei', bird: 'Atlantic puffin', flower: 'Pitcher plant' },
  NS: { capital: 'Halifax', pop: '1.1M', joined: 1867, order: 3, motto: 'Munit haec et altera vincit', bird: 'Osprey', flower: 'Mayflower' },
  NT: { capital: 'Yellowknife', pop: '45K', joined: 1870, order: 11, motto: null, bird: 'Gyrfalcon', flower: 'Mountain avens' },
  NU: { capital: 'Iqaluit', pop: '41K', joined: 1999, order: 13, motto: 'Nunavut sanginivut', bird: 'Rock ptarmigan', flower: 'Purple saxifrage' },
  ON: { capital: 'Toronto', pop: '16.1M', joined: 1867, order: 1, motto: 'Ut incepit fidelis sic permanet', bird: 'Common loon', flower: 'White trillium' },
  PE: { capital: 'Charlottetown', pop: '0.2M', joined: 1873, order: 7, motto: 'Parva sub ingenti', bird: 'Blue jay', flower: 'Lady’s slipper' },
  QC: { capital: 'Quebec City', pop: '9.0M', joined: 1867, order: 2, motto: 'Je me souviens', bird: 'Snowy owl', flower: 'Blue flag iris' },
  SK: { capital: 'Regina', pop: '1.2M', joined: 1905, order: 8, motto: 'Multis e gentibus vires', bird: 'Sharp-tailed grouse', flower: 'Western red lily' },
  YT: { capital: 'Whitehorse', pop: '47K', joined: 1898, order: 12, motto: null, bird: 'Common raven', flower: 'Fireweed' },
};
