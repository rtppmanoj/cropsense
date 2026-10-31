/**
 * Small, curated set of official crop nutrient guides. Rates are shown only when
 * the user's state and crop system match the source guide. Entered available
 * N, P₂O₅, and K₂O values are real soil-test readings in kg/ha; these are shown
 * as context and are not directly subtracted from fertilizer application rates.
 */
export interface FertilizerGuidance {
  crop: string;
  state?: string;
  nutrients: string;
  fertilizers: string;
  timing: string;
  dosage?: string;
  condition?: string;
  source: string;
  url: string;
  checkedOn: string;
}

const guides: Record<string, FertilizerGuidance> = {
  rice: {
    crop: 'rice', state: 'Tamil Nadu', nutrients: 'Nitrogen (N), phosphorus as P₂O₅, and potassium as K₂O.',
    fertilizers: 'Use nutrient sources selected by the local agriculture office; TNAU advises soil-test-based nutrients and split N/K management.',
    timing: 'Phosphorus is basal and incorporated. Split N and K by crop stage; TNAU lists basal, tillering, panicle initiation, and heading for the cited system.',
    dosage: 'TNAU blanket rates vary by duration, season, tract, and cultivar: 120:40:40 to 175:60:60 kg N:P₂O₅:K₂O/ha in the listed cases. Do not apply this range as a field dose without matching the crop system.',
    condition: 'Tamil Nadu guide only. Variety duration, season, tract, irrigation, and soil test are needed to choose the applicable rate.',
    source: 'Tamil Nadu Agricultural University (TNAU), transplanted rice nutrient management',
    url: 'https://agritech.tnau.ac.in/agriculture/agri_cropproduction_cereals_rice_tranpudlow_mainfield_nutrient_mgmt_inorganic.html', checkedOn: '2026-10-28',
  },
  maize: {
    crop: 'maize', nutrients: 'Nitrogen (N), phosphorus (P₂O₅), and potassium (K₂O).',
    fertilizers: 'The ICAR advisory specifies NPK nutrient rates; ask the local agriculture office which locally approved fertilizer products fit the soil test.',
    timing: 'ICAR Kharif 2025 advisory: split the listed dose into thirds at sowing, 30 days after sowing, and 50 days after sowing.',
    dosage: 'ICAR Kharif 2025 advisory gives 120:60:60 kg N:P:K/ha for its maize recommendation. Confirm season, region, and soil-test applicability with a local KVK before use.',
    condition: 'Advisory is season- and context-specific; do not treat as a universal rate. Compare it with the farmer’s soil test and confirm locally.',
    source: 'ICAR, Kharif Agro-Advisories for Farmers 2025',
    url: 'https://icar.gov.in/sites/default/files/2025-10/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf', checkedOn: '2026-10-28',
  },
  cotton: {
    crop: 'cotton', state: 'Tamil Nadu', nutrients: 'Nitrogen (N), phosphorus as P₂O₅, and potassium as K₂O.',
    fertilizers: 'TNAU lists nutrient-based rates; select fertilizer products and soil amendments through the district agriculture office or KVK.',
    timing: 'For varieties: basal 50% N and K₂O plus full P₂O₅; top-dress remaining N and K₂O at 40–45 days after sowing. Hybrids use staged splits in the TNAU guide.',
    dosage: 'TNAU blanket rate: varieties 32:16:16 kg N:P₂O₅:K₂O/acre; hybrids 48:24:24 kg/acre. Apply only after confirming variety/hybrid and local applicability.',
    condition: 'Tamil Nadu guide only. Cotton type, soil test, and local production system determine the suitable rate.',
    source: 'Tamil Nadu Agricultural University (TNAU), cotton nutrient management',
    url: 'https://www.agritech.tnau.ac.in/agriculture/agri_cotton_Inorganic_manures%20.html', checkedOn: '2026-10-28',
  },
  blackgram: {
    crop: 'blackgram', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus (P₂O₅), potassium (K₂O), and sulphur.',
    fertilizers: 'TNAU lists urea, single superphosphate (SSP), muriate of potash (MOP), and gypsum in its nutrient schedule; final product choice depends on soil test.',
    timing: 'The cited TNAU irrigated schedule applies the full NPKS dose basally at the last ploughing before sowing.',
    dosage: 'TNAU irrigated blanket recommendation: 25:50:25:40 kg N:P₂O₅:K₂O:S/ha. This is not a universal rate and should be checked against the local soil test and crop system.',
    condition: 'Tamil Nadu irrigated blackgram guide only; rainfed and other state recommendations can differ.',
    source: 'Tamil Nadu Agricultural University (TNAU), irrigated blackgram nutrient management',
    url: 'https://agritech.tnau.ac.in/agriculture/CropProduction/Pulses/BlackgramIrrigated%20nutrient%20managament.html', checkedOn: '2026-10-28',
  },
  banana: {
    crop: 'banana', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus (P₂O₅), and potassium (K₂O); TNAU notes the schedule varies by cultivar and production system.',
    fertilizers: 'TNAU lists neem-coated urea for N and muriate of potash for K, with phosphorus fertilizer applied separately; confirm product and cultivar locally.',
    timing: 'For the cited garden-land system, TNAU splits N and K at the 3rd, 5th, and 7th month after planting and applies phosphorus at the 3rd month.',
    dosage: 'No single dose is shown because TNAU rates differ by cultivar, wetland/garden/hill system, and tissue-culture status. Use the linked schedule with a soil test and local expert.',
    condition: 'Tamil Nadu guide only. Cultivar, planting system, and plant type are required before selecting a dose.',
    source: 'Tamil Nadu Agricultural University (TNAU), banana fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_fert_banana.html', checkedOn: '2026-10-28',
  },
  coconut: {
    crop: 'coconut', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus (P₂O₅), and potassium (K₂O), alongside organic manure in the cited TNAU schedule.',
    fertilizers: 'TNAU names urea, superphosphate, and muriate of potash; confirm locally based on palm age, soil test, and water availability.',
    timing: 'For palms from the 5th year, the cited TNAU guide splits the annual dose equally across June–July and December–January, with adequate soil moisture.',
    dosage: 'TNAU schedule for palms from year 5: 1.3 kg urea + 2.0 kg superphosphate + 2.0 kg muriate of potash per palm/year. Age-specific doses differ for years 2–4.',
    condition: 'Tamil Nadu guide only. Palm age is essential; do not use the year-5 rate on younger palms.',
    source: 'Tamil Nadu Agricultural University (TNAU), coconut nutrient management',
    url: 'https://agritech.tnau.ac.in/agriculture/agri_nutrientmgt_coconut.html', checkedOn: '2026-10-28',
  },
  chickpea: {
    crop: 'chickpea', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus as P₂O₅, potassium as K₂O, and sulphur.',
    fertilizers: 'TNAU lists basal nutrient applications; gypsum can supply sulphur where single superphosphate (SSP) is not used as the phosphorus source.',
    timing: 'Apply the listed nutrients basally before sowing. The linked TNAU schedule separates rainfed and irrigated crops.',
    dosage: 'TNAU Bengalgram guide: rainfed 12.5:25:12.5:10 and irrigated 25:50:25:20 kg N:P₂O₅:K₂O:S/ha. Choose only after confirming the crop system and soil-test interpretation.',
    condition: 'Tamil Nadu guide only; irrigation and soil test change which rate applies.',
    source: 'Tamil Nadu Agricultural University (TNAU), Bengalgram nutrient management',
    url: 'https://www.agritech.tnau.ac.in/agriculture/agri_nutrientmgt_bengalgram.html', checkedOn: '2026-10-28',
  },
  mungbean: {
    crop: 'mungbean', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus as P₂O₅, potassium as K₂O, and sulphur.',
    fertilizers: 'TNAU lists urea, SSP or DAP, MOP, and gypsum according to the phosphorus source. Confirm product selection with a soil test.',
    timing: 'Apply the cited irrigated greengram NPKS schedule basally during the last plough before sowing.',
    dosage: 'TNAU irrigated greengram blanket recommendation: 25:50:25:40 kg N:P₂O₅:K₂O:S/ha. Rainfed and other state schedules differ.',
    condition: 'Tamil Nadu irrigated greengram guide only; mungbean/greengram variety and irrigation system must match.',
    source: 'Tamil Nadu Agricultural University (TNAU), irrigated greengram nutrient management',
    url: 'https://agritech.tnau.ac.in/agriculture/CropProduction/Pulses/Nutrient%20Management_green%20gram.html', checkedOn: '2026-10-28',
  },
  jute: {
    crop: 'jute', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus as P₂O₅, and potassium as K₂O; farmyard manure is part of the TNAU schedule.',
    fertilizers: 'Use nutrient sources confirmed by the district agriculture office and soil test; the guide gives nutrient quantities rather than prescribing a retail blend.',
    timing: 'Apply FYM and full P and K basally at the last ploughing. Top-dress nitrogen after first and second weedings, following the crop stage in the guide.',
    dosage: 'TNAU guide: 5 t well-decomposed FYM/ha and 20 kg/ha each of N, P₂O₅, K₂O basally, plus 10 kg N/ha after each of the first two weedings.',
    condition: 'Tamil Nadu guide only. Confirm local jute type, soil, and the current district package of practices.',
    source: 'Tamil Nadu Agricultural University (TNAU), jute nutrient management',
    url: 'https://agritech.tnau.ac.in/agriculture/agri_nutrientmgt_jute.html', checkedOn: '2026-10-28',
  },
  mango: {
    crop: 'mango', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus, and potassium; the TNAU schedule is tree-age-specific.',
    fertilizers: 'The linked TNAU guide expresses nutrient amounts per tree; choose fertilizer products and any soil amendments with local horticulture advice.',
    timing: 'For the cited normal-soil schedule, apply during September–October, 45–90 cm from the trunk to the canopy drip line and incorporate.',
    dosage: 'TNAU schedule from the 6th year onward: 1.0 kg N + 1.0 kg P + 1.5 kg K per tree. Younger trees use age-based lower amounts; do not use the mature-tree dose without checking age.',
    condition: 'Tamil Nadu normal-soil guide only. Tree age, planting density, soil test, and production system are needed to confirm a rate.',
    source: 'Tamil Nadu Agricultural University (TNAU), mango fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_fert_mango.html', checkedOn: '2026-10-28',
  },
  papaya: {
    crop: 'papaya', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus, and potassium; TNAU gives per-plant amounts.',
    fertilizers: 'The guide gives nutrient rates rather than fertilizer product names. Use the local horticulture office to select suitable products for the soil test.',
    timing: 'Apply 10 kg FYM per plant basally. Begin the cited N, P, K applications at two-month intervals from the third month after planting.',
    dosage: 'TNAU schedule: 50 g each of N, P, and K per plant at bimonthly intervals from month 3. Confirm cultivar and schedule locally before use.',
    condition: 'Tamil Nadu guide only; apply the rate per plant, not per acre. Planting system and soil test still matter.',
    source: 'Tamil Nadu Agricultural University (TNAU), papaya fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_fert_papaya.html', checkedOn: '2026-10-28',
  },
  watermelon: {
    crop: 'watermelon', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus, and potassium, with farmyard manure in the TNAU schedule.',
    fertilizers: 'The guide states nutrient quantities; the application form and fertilizer products should be confirmed against the soil report and local package of practices.',
    timing: 'TNAU lists phosphorus and potassium basally and nitrogen 30 days after sowing; its separate fertigation schedule uses staged splits.',
    dosage: 'TNAU field schedule: FYM 20 t/ha, P 55 kg/ha and K 55 kg/ha basally, plus N 55 kg/ha at 30 days after sowing. Its drip-fertigation schedule has a different total rate; do not mix the systems.',
    condition: 'Tamil Nadu guide only. Variety, season, soil test, and whether the crop is soil-applied or fertigated change the suitable schedule.',
    source: 'Tamil Nadu Agricultural University (TNAU), watermelon production guide',
    url: 'https://www.agritech.tnau.ac.in/horticulture/horti_vegetables_watermelon.html', checkedOn: '2026-10-28',
  },
  orange: {
    crop: 'orange', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus (P₂O₅), and potassium (K₂O); TNAU also lists micronutrients in its schedule.',
    fertilizers: 'Urea or another locally approved nitrogen source; SSP/DAP for phosphorus; MOP for potash; and FYM. Apply micronutrient products only according to the crop guide or a diagnosed need.',
    timing: 'TNAU schedule: split nitrogen between March and October; apply FYM, phosphorus, and potash in October. Its foliar micronutrient schedule is tied to new flush growth.',
    condition: 'TNAU sweet-orange schedule; confirm the variety, tree age, production system, and product rates against the soil report and local horticulture package.',
    source: 'Tamil Nadu Agricultural University (TNAU), sweet orange fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_fert_sorange.html', checkedOn: '2026-10-28',
  },
  muskmelon: {
    crop: 'muskmelon', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus, and potassium.',
    fertilizers: 'The linked TNAU fertigation guide lists water-soluble fertilizer grades; use only where a drip/fertigation system and local recommendation apply.',
    timing: 'The TNAU schedule splits the fertigation dose across establishment, vegetative growth, flowering/first picking, and harvest stages.',
    dosage: 'TNAU fertigation guide for watermelon/muskmelon: 200:100:100 kg N:P:K/ha over the crop cycle. This is a fertigation schedule, not a soil-application dose.',
    condition: 'Tamil Nadu fertigation guide only. Confirm crop, irrigation system, and soil-test interpretation with a local horticulture expert.',
    source: 'Tamil Nadu Agricultural University (TNAU), fertilizer fertigation schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/ferti_schedule.pdf', checkedOn: '2026-10-28',
  },
  pigeonpeas: {
    crop: 'pigeonpeas', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus as P₂O₅, potassium as K₂O, and sulphur.',
    fertilizers: 'TNAU lists basal NPKS and sulphur supplied as gypsum where SSP is not used as the phosphorus source.',
    timing: 'Apply the schedule basally before sowing. Select the rainfed or irrigated rate that matches the actual crop system.',
    dosage: 'TNAU redgram guide: rainfed 12.5:25:12.5:10 or irrigated 25:50:25:20 kg N:P₂O₅:K₂O:S/ha.',
    condition: 'Tamil Nadu redgram guide only. Variety, water regime, soil test, and local package of practices must match.',
    source: 'Tamil Nadu Agricultural University (TNAU), redgram production guide',
    url: 'https://agritech.tnau.ac.in/agriculture/CropProduction/Pulses/pulses_redgram.html', checkedOn: '2026-10-28',
  },
  grapes: {
    crop: 'grapes', state: 'Tamil Nadu', nutrients: 'Nitrogen, phosphorus, and potassium; the TNAU schedule varies by variety, vine age, and pruning cycle.',
    fertilizers: 'Use the linked TNAU table for the exact variety and vine year. It lists FYM, green leaves, and N, P, K nutrient quantities per vine.',
    timing: 'TNAU advises applying manures twice after pruning; split potash, with half immediately after pruning and half 60 days later.',
    condition: 'Tamil Nadu guide only. A safe numeric dose cannot be selected without grape variety, vine age, and production/pruning system.',
    source: 'Tamil Nadu Agricultural University (TNAU), grapes production and fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_grapes.html', checkedOn: '2026-10-28',
  },
  apple: {
    crop: 'apple', state: 'Tamil Nadu', nutrients: 'Nitrogen (N), phosphorus (P), and potassium (K), with farmyard manure.',
    fertilizers: 'The TNAU hill-region guide gives nutrient quantities per bearing tree. Select fertilizer products with local horticulture advice and the soil report.',
    timing: 'Apply the cited bearing-tree schedule immediately after pruning.',
    dosage: 'TNAU schedule for bearing trees: 25 kg FYM + 500 g N + 1 kg P + 1 kg K per tree. This is not for young or non-bearing trees.',
    condition: 'Tamil Nadu hill-region guide only. Confirm hill suitability, tree age/bearing status, variety, and soil-test interpretation before use.',
    source: 'Tamil Nadu Agricultural University (TNAU), apple fertilizer schedule',
    url: 'https://agritech.tnau.ac.in/horticulture/horti_fruits_fert_apple.html', checkedOn: '2026-10-28',
  },
};

export function getFertilizerGuidance(crop: string, state?: string | null): FertilizerGuidance {
  const name = crop.trim().toLowerCase();
  const guide = guides[name];
  if (guide && (!guide.state || guide.state.toLowerCase() === state?.trim().toLowerCase())) return guide;

  const pulses = new Set(['blackgram', 'chickpea', 'kidneybeans', 'lentil', 'mothbeans', 'mungbean', 'pigeonpeas']);
  const fruitCrops = new Set(['apple', 'banana', 'coconut', 'coffee', 'grapes', 'mango', 'orange', 'papaya', 'pomegranate']);
  const timing = pulses.has(name)
    ? 'Use seed-applied, crop-compatible Rhizobium and PSB inoculants before sowing. Place phosphorus at sowing; use nitrogen only where the local pulse package recommends a starter dose.'
    : fruitCrops.has(name)
      ? 'For perennial fruit crops, split nutrients around the locally recommended growth or pruning stages; do not apply the full annual amount at once.'
      : 'Use phosphorus as a basal nutrient and split nitrogen around the crop growth stages specified in the local package of practices.';
  const products = pulses.has(name)
    ? 'Single superphosphate (SSP) or DAP as the phosphorus source; muriate of potash (MOP) only where potassium is needed; crop-compatible Rhizobium and PSB inoculants; and FYM/compost. Avoid automatic extra nitrogen in a well-nodulated pulse crop.'
    : fruitCrops.has(name)
      ? 'Urea or neem-coated urea as a nitrogen source; SSP or DAP for phosphorus; MOP for potassium; and well-decomposed FYM/compost. Use micronutrient products only when the soil/leaf test or crop guide indicates a need.'
      : 'Urea or neem-coated urea for nitrogen; SSP or DAP for phosphorus; MOP for potassium; and FYM/compost. Select only the nutrients required by the soil report.';
  return {
    crop: name,
    nutrients: pulses.has(name)
      ? 'Prioritize phosphorus and soil-test-needed potassium; legumes also benefit from suitable Rhizobium/PSB inoculation. Nitrogen is not automatically required at the same rate as non-legumes.'
      : 'Nitrogen (N), phosphorus (P₂O₅), and potassium (K₂O); add secondary or micronutrients only when the soil/leaf test or crop guidance identifies a need.',
    fertilizers: products,
    timing,
    source: 'ICAR guidance on soil-test-based balanced nutrient management',
    url: 'https://icar.gov.in/sites/default/files/2025-11/December_2025%20Indian%20Farming.pdf',
    checkedOn: '2026-10-28',
  };
}
