// Offset price and emission factors shared by the calculators, the admin
// screens and the server. Calculators work in kg of CO2; these are defined in
// the units the fund uses (pounds) and converted once here.

export const LBS_PER_KG = 2.20462;

// $25 per ton (2,000 lbs) of CO2, the price the fund has always charged.
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
