// Offset price and emission factors shared by the calculators, the admin
// screens and the server. Calculators work in kg of CO2; these are defined in
// the units the fund uses (pounds) and converted once here.

export const LBS_PER_KG = 2.20462;
export const kgToLbs = (kg) => kg * LBS_PER_KG;

// $25 per ton (2,000 lbs) of CO2, the price since late 2016 (it was $20 before).
export const COST_PER_LB = 0.0125;
export const COST_PER_KG = COST_PER_LB * LBS_PER_KG;

export const offsetCost = (kgCo2) => kgCo2 * COST_PER_KG;

// Pounds of CO2 a dollar offsets at COST_PER_LB (80).
export const poundsForDollars = (dollars) => dollars / COST_PER_LB;

// CO2 from burning one gallon of gasoline: 19.64 lbs.
export const KG_CO2_PER_GALLON_GASOLINE = 19.64 / LBS_PER_KG;

// Home energy, kg CO2 per unit.
export const HOME_FACTORS_KG = {
  // Upstate NY grid (eGRID NYUP, 2023 data): 0.242 lbs per kWh.
  electricityKwh: 0.242 / LBS_PER_KG,
  // EPA: 11.7 lbs per therm.
  naturalGasTherm: 11.7 / LBS_PER_KG,
  propaneGallon: 5.68,
  fuelOilGallon: 10.2,
};

// Flights, kg CO2 per passenger-mile by one-way flight length. EPA GHG
// Emission Factors Hub 2025 (all seats averaged).
const AIR_KG_PER_MILE = { short: 0.207, medium: 0.129, long: 0.163 };

// EPA doesn't split by cabin, so each class scales that average by its ratio
// to the average passenger in the UK government's 2025 conversion factors
// (short-haul for flights under 2,300 miles, long-haul above; the UK has no
// short-haul first class, so first uses business there).
const AIR_CLASS_RATIOS = {
  shorter: { economy: 0.98, business: 1.48, first: 1.48 },
  long: { economy: 0.77, business: 2.22, first: 3.06 },
};

export const airKgPerPassengerMile = (legMiles, flightClass) => {
  const band = legMiles < 300 ? "short" : legMiles < 2300 ? "medium" : "long";
  const ratios = band === "long" ? AIR_CLASS_RATIOS.long : AIR_CLASS_RATIOS.shorter;
  return AIR_KG_PER_MILE[band] * (ratios[flightClass] ?? 1);
};

// Quick offsets: CO2 for a typical year, in lbs.
export const QUICK_OFFSET_LBS_PER_YEAR = {
  // EPA average US home on the upstate NY grid: electricity 2,951 + natural
  // gas 4,762 + propane 529 + heating oil 551.
  home: 8790,
  // 12,000 miles (upstate NY average) at 22.8 mpg, 19.64 lbs per gallon.
  car: 10337,
  // 2.5 NY-LA round trips (2,475 miles each way) at the long-haul rate.
  air: 4447,
};
