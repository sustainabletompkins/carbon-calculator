// Checks the offset price, emission factors and quick offset averages
// against the figures the fund confirmed (see the Carbon Calculator
// Assumptions doc). Everything is compared in lbs and miles.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COST_PER_LB,
  HOME_FACTORS_KG,
  KG_CO2_PER_GALLON_GASOLINE,
  QUICK_OFFSET_LBS_PER_YEAR,
  airKgPerPassengerMile,
  kgToLbs,
  offsetCost,
  poundsForDollars,
} from "../lib/offsetRates.js";

const near = (actual, expected, tolerance, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );

const lbsToKg = (lbs) => lbs / kgToLbs(1);
const airLbsPerMile = (legMiles, cabin) => kgToLbs(airKgPerPassengerMile(legMiles, cabin));

test("offset price is $25 per ton (2,000 lbs)", () => {
  near(COST_PER_LB * 2000, 25, 1e-9, "price per ton");
  near(offsetCost(lbsToKg(2000)), 25, 1e-9, "cost of 2,000 lbs");
});

test("a dollar offsets 80 lbs, cents included", () => {
  assert.equal(poundsForDollars(1), 80);
  assert.equal(poundsForDollars(25.5), 2040);
  // Donation pounds and the offset price agree: buying back the pounds a
  // donation is credited costs exactly the donation.
  near(offsetCost(lbsToKg(poundsForDollars(40))), 40, 1e-9, "round trip");
});

test("car: 19.64 lbs CO2 per gallon; 100 miles at 25 mpg is 78.6 lbs, $0.98", () => {
  near(kgToLbs(KG_CO2_PER_GALLON_GASOLINE), 19.64, 1e-9, "lbs per gallon");
  const kg = (100 / 25) * KG_CO2_PER_GALLON_GASOLINE;
  near(kgToLbs(kg), 78.56, 0.01, "lbs");
  near(offsetCost(kg), 0.98, 0.005, "cost");
});

test("home energy factors in lbs per unit", () => {
  near(kgToLbs(HOME_FACTORS_KG.electricityKwh), 0.242, 1e-9, "electricity, upstate NY grid");
  near(kgToLbs(HOME_FACTORS_KG.naturalGasTherm), 11.7, 1e-9, "natural gas per therm");
  near(kgToLbs(HOME_FACTORS_KG.propaneGallon), 12.52, 0.01, "propane per gallon");
  near(kgToLbs(HOME_FACTORS_KG.fuelOilGallon), 22.49, 0.01, "heating oil per gallon");
});

test("flight rates by one-way length and cabin, lbs per passenger-mile", () => {
  const table = [
    // [one-way miles, cabin, lbs/mile]; no cabin = EPA's all-seats average
    [200, undefined, 0.456],
    [200, "economy", 0.447],
    [200, "business", 0.675],
    [200, "first", 0.675],
    [1000, undefined, 0.284],
    [1000, "economy", 0.279],
    [1000, "business", 0.421],
    [1000, "first", 0.421],
    [2475, undefined, 0.359],
    [2475, "economy", 0.277],
    [2475, "business", 0.798],
    [2475, "first", 1.1],
  ];
  for (const [miles, cabin, lbs] of table) {
    near(airLbsPerMile(miles, cabin), lbs, 0.001, `${miles} mi ${cabin ?? "all seats"}`);
  }
});

test("flight length bands switch at 300 and 2,300 miles", () => {
  near(airLbsPerMile(299), 0.456, 0.001, "299 mi is short");
  near(airLbsPerMile(300), 0.284, 0.001, "300 mi is medium");
  near(airLbsPerMile(2299), 0.284, 0.001, "2,299 mi is medium");
  near(airLbsPerMile(2300), 0.359, 0.001, "2,300 mi is long");
});

test("economy round trip NY to LA is about 1,370 lbs, $17.12", () => {
  const kg = 2 * 2475 * airKgPerPassengerMile(2475, "economy");
  near(kgToLbs(kg), 1370, 1, "lbs");
  near(offsetCost(kg), 17.12, 0.01, "cost");
});

test("quick offset: home is the EPA average home on the upstate grid", () => {
  const electricity = 12194 * kgToLbs(HOME_FACTORS_KG.electricityKwh);
  near(electricity, 2951, 1, "electricity lbs");
  // EPA's per-home natural gas, propane and heating oil, in lbs.
  const total = electricity + 4762 + 529 + 551;
  near(QUICK_OFFSET_LBS_PER_YEAR.home, total, 5, "home lbs per year");
});

test("quick offset: car is 12,000 miles at 22.8 mpg", () => {
  const lbs = (12000 / 22.8) * kgToLbs(KG_CO2_PER_GALLON_GASOLINE);
  near(QUICK_OFFSET_LBS_PER_YEAR.car, lbs, 1, "car lbs per year");
});

test("quick offset: air is 2.5 NY-LA round trips at the all-seats rate", () => {
  const lbs = 2.5 * 2 * 2475 * airLbsPerMile(2475);
  near(QUICK_OFFSET_LBS_PER_YEAR.air, lbs, 1, "air lbs per year");
});

test("quick offset yearly costs", () => {
  near(QUICK_OFFSET_LBS_PER_YEAR.home * COST_PER_LB, 109.88, 0.01, "home");
  near(QUICK_OFFSET_LBS_PER_YEAR.car * COST_PER_LB, 129.21, 0.01, "car");
  near(QUICK_OFFSET_LBS_PER_YEAR.air * COST_PER_LB, 55.59, 0.01, "air");
});
