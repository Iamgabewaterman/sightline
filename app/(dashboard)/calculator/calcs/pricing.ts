// Baseline material prices (Oregon / Pacific NW reference).
// Scale these using RegionalCalcPricing ratios for the user's location.
export const P: Record<string, number> = {
  // Framing
  stud2x4: 4.80, stud2x6: 8.50, stud2x8: 11.20, stud2x10: 14.50, stud2x12: 18.00,
  plate2x4lf: 0.48, plate2x6lf: 0.75,
  post4x4: 12.00, post6x6: 28.00,
  osb716: 22.00, ply34: 55.00, ply12: 42.00,
  joistHanger: 1.20, hurricaneTie: 0.90,
  nails16d: 3.50, nailsLb: 2.80,
  headerLVL34: 180.00, // 3.5"×9.5" LVL per piece (10ft)
  // Roofing
  archShingles: 105.00,  // per square (100 sqft) — architectural 4 bundles
  tab3Shingles: 75.00,   // per square — 3-tab 3 bundles
  ridgeCap: 55.00,       // per square (35 LF per bundle)
  valleyMetal10: 18.00,  // per 10-ft section of valley flashing
  dripEdge10: 4.50,      // per 10-ft section
  iceWaterRoll: 85.00,   // per roll (~2 squares / 200 sqft)
  felt15Roll: 28.00,     // per roll (400 sqft)
  felt30Roll: 38.00,     // per roll (200 sqft)
  synthUndRoll: 65.00,   // synthetic underlayment roll (10 squares)
  starterBundle: 48.00,  // per bundle (105 LF)
  roofingNails5lb: 32.00,// per 5-lb box (~10 squares of arch shingles)
  gutterLF5: 4.50,       // 5" K-style gutter per LF
  gutterLF6: 6.00,       // 6" K-style gutter per LF
  downspoutLF: 3.50,     // per LF
  gutterHanger: 1.20,    // per hanger (every 24")
  gutterEndCap: 3.00,    // pair
  gutterCorner: 12.00,   // per corner piece
  gutterSealant: 8.00,   // tube
  // Concrete
  concrete80: 7.50,  // 80lb bag
  concrete60: 5.50,  // 60lb bag
  rebar4_20: 14.00,  // #4 rebar 20ft stick
  rebar5_20: 18.00,  // #5 rebar 20ft stick
  wireMesh10: 12.00, // 10-ft roll wire mesh
  expansionJoint: 4.50, // per 10-ft strip
  concreteSealer: 38.00, // per gallon (covers 200 sqft)
  block8x8x16: 2.20, // per block
  block12x8x16: 3.50, // per block
  mortarBag: 14.00,  // 80lb mortar bag
  formBoard2x8_8: 12.00, // 2×8×8 form board
  // Tile & Flooring
  thinset50: 22.00,      // 50lb bag
  unsandedGrout25: 18.00,// 25lb bag
  sandedGrout25: 24.00,  // 25lb bag
  grout25: 22.00,        // 25lb grout bag (generic)
  groutSealer: 16.00,    // quart
  grout_sealer_qt: 14.00,// quart (alias)
  tile12x12: 1.80,       // per tile (ceramic 12×12)
  tile1212ceramic: 1.80, // per sqft
  tile1212porcelain: 3.50, // per sqft
  tile1224porcelain: 4.20, // per sqft
  tile1818porcelain: 3.80, // per sqft
  tile2424porcelain: 5.50, // per sqft
  tileSpacer: 4.00,      // bag of 500
  cementBoard14: 12.00,  // 3×5 sheet
  cbScrews: 10.00,       // box of 100
  lvpSqft: 3.50,         // per sqft (mid-grade)
  lvpPerBox: 70.00,      // per box (~22 sqft, mid-grade LVP)
  underlayRoll: 35.00,   // 100 sqft roll
  underlaymentRoll: 35.00,// alias
  floorTransition: 22.00,// each
  pullBarKit: 18.00,     // pull bar + tapping block
  hardwoodSqft: 5.50,    // per sqft (unfinished)
  hardwoodPerBox: 110.00,// per box (~20 sqft, mid-grade)
  floorStaples: 18.00,   // box of 1000
  floorAdhesive: 35.00,  // gallon
  moistureBarrier: 65.00,// roll (500 sqft)
  carpetSqYd: 28.00,     // per square yard (installed mid-grade)
  carpetPerSqYd: 28.00,  // alias
  carpetPadSqYd: 8.00,   // per square yard
  carpetPadPerSqYd: 8.00,// alias
  tackStrip8ft: 2.50,    // per 8-ft piece
  // Paint
  intPaint: 38.00,     // per gallon
  paintInterior: 38.00,// alias
  extPaint: 48.00,     // per gallon
  paintExterior: 48.00,// alias
  paintCeiling: 28.00, // flat white ceiling paint per gallon
  paintTrim: 42.00,    // semi-gloss trim paint per gallon
  primer: 28.00,       // per gallon
  rollerCover: 4.00,   // each
  brush3: 8.00,        // 3" brush
  paintersTape: 6.00,  // roll
  dropCloth: 12.00,    // each
  deckStain: 42.00,    // per gallon
  // Electrical
  romex14_250: 75.00,   // 250ft spool 14/2
  romex12_250: 95.00,   // 250ft spool 12/2
  romex10_250: 130.00,  // 250ft spool 10/2
  elecBox: 2.50,        // single gang
  junctionBox: 2.50,    // alias for single gang box
  elecBoxDouble: 3.50,  // double gang
  outlet: 3.50,         // standard duplex outlet
  gfciOutlet: 18.00,    // GFCI outlet
  switch1pole: 4.50,    // single-pole switch
  breaker15: 8.00,      // 15A breaker
  breaker20: 10.00,     // 20A breaker
  breaker30: 22.00,     // 30A breaker
  breaker50: 38.00,     // 50A breaker
  wireStaples: 5.00,    // box
  wireNuts: 5.00,       // bag
  panelBox200: 180.00,  // 200A main panel
  panel200: 380.00,     // 200A complete panel (with main breaker)
  panel150: 280.00,     // 150A panel
  panel100: 180.00,     // 100A panel (alias panelBox100)
  panelBox100: 120.00,  // 100A subpanel
  meterSocket: 85.00,   // 200A meter socket
  groundRod: 18.00,     // 8-ft copper ground rod
  // EMT conduit per LF (uncut)
  emt_half: 0.80,  // 1/2" EMT per LF
  emt_3q:   1.10,  // 3/4" EMT per LF
  emt_1:    1.60,  // 1" EMT per LF
  pvc_half: 0.50,  // 1/2" PVC conduit per LF
  pvc_3q:   0.75,  // 3/4" PVC conduit per LF
  pvc_1:    1.10,  // 1" PVC conduit per LF
  // THHN wire per-spool
  thhn12_500: 65.00,  // 12AWG THHN 500ft spool
  thhn10_500: 90.00,  // 10AWG THHN 500ft spool
  thhn6_500:  160.00, // 6AWG THHN 500ft spool
  conduit10: 8.00,      // 10-ft EMT conduit (1/2")
  conduitConn: 1.50,    // connector
  conduitStrap: 0.80,   // strap
  wireGelLube: 12.00,   // pull lube
  // Plumbing
  pvc4_10: 14.00,   // 4" PVC 10ft
  pvc3_10: 10.00,   // 3" PVC 10ft
  pvc2_10: 7.00,    // 2" PVC 10ft
  pvc15_10: 5.50,   // 1.5" PVC 10ft
  pex12_100: 48.00, // 1/2" PEX 100ft coil
  pex12_250: 105.00,// 1/2" PEX 250ft coil
  pex34_100: 68.00, // 3/4" PEX 100ft coil
  pex34_250: 155.00,// 3/4" PEX 250ft coil
  copper12_10: 24.00,  // 1/2" copper 10ft
  copper34_10: 38.00,  // 3/4" copper 10ft
  cpvc12_10: 12.00,    // 1/2" CPVC 10ft
  cpvc34_10: 18.00,    // 3/4" CPVC 10ft
  pvcGlue: 8.00,    // PVC cement
  pvcPrimer: 8.00,  // PVC primer
  pTrap2: 10.00,    // P-trap 2"
  waxRing: 6.00,    // wax ring
  angleStop: 8.00,  // angle stop shutoff
  supplyLine: 6.00, // braided supply line
  // HVAC
  hvac2ton: 2200.00,     // 2-ton split system (unit only)
  hvac3ton: 3200.00,     // 3-ton split system
  hvac4ton: 4200.00,     // 4-ton split system
  hvacAirHandler: 800.00,// air handler / fan coil
  thermostat: 180.00,    // smart programmable thermostat
  lineset25: 120.00,     // 25-ft pre-insulated line set
  flexDuct6_25: 22.00,   // 6" flex duct 25ft section
  flexDuct10_25: 38.00,  // 10" flex duct 25ft section
  smDuct6_5: 18.00,      // 6" sheet metal duct 5ft stick
  smDuct10_5: 28.00,     // 10" sheet metal duct 5ft stick
  hvacSupplyReg: 12.00,  // supply register
  hvacReturnGrille: 18.00, // return grille
  hvacFlexDuct10: 22.00,  // 6" flex duct 25ft (legacy alias)
  hvacDuctTape: 8.00,     // roll
  hvacMastic: 22.00,      // gallon
  hvacMetalScrews: 5.00,  // box
  hvacDuctBoard4x8: 28.00,// sheet rigid duct board
  // ── Restoration & Remediation ──────────────────────────────────────────────
  // Drywall hang/finish consumables
  dwSheet: 14.00,          // 4×8 ½" drywall sheet (regional via pricing.drywall)
  dwScrew1lb: 7.00,        // 1-lb box drywall screws (~150 sqft coverage)
  jointCompound45: 16.00,  // 4.5-gal bucket all-purpose joint compound
  drywallTape500: 7.00,    // 500-ft roll paper joint tape
  cornerBead8: 3.50,       // 8-ft metal outside corner bead
  // Water damage remediation
  antimicrobialGal: 35.00, // gallon antimicrobial/biocide treatment
  airScrubberDay: 45.00,   // HEPA air scrubber rental, per day
  dehumidifierDay: 65.00,  // LGR dehumidifier rental, per day
  dryingMatDay: 18.00,     // floor drying mat, per day each
  plasticSheet10: 55.00,   // 10-ft × 100-ft 6-mil containment roll
  contractorBagsBox: 22.00,// box of 32 contractor bags (3-mil)
  // moistureBarrier (500 sqft roll) reused from flooring section above
  // Insulation
  insulBattBag: 48.00,     // batt insulation, per bag/package
  insulBlownBag: 42.00,    // blown-in insulation, per bag
  // Texture / skim
  textureSprayBag: 15.00,  // bag of wall/ceiling spray texture
  // Contents pack-out
  packBox: 2.50,           // medium moving box
  packTapeRoll: 3.50,      // packing tape roll
  packPaperReam: 22.00,    // ream of packing paper
  wardrobeBox: 12.00,      // wardrobe box
  mattressBag: 6.00,       // mattress bag
  // Suspended ceiling grid
  ceilTile2x2: 4.50,       // 2×2 acoustic ceiling tile
  ceilTile2x4: 6.00,       // 2×4 acoustic ceiling tile
  gridMain12: 8.00,        // 12-ft main tee runner
  gridCross4: 3.00,        // 4-ft cross tee
  gridCross2: 2.00,        // 2-ft cross tee
  wallAngleLf: 0.60,       // wall angle, per LF
  hangerWireFt: 0.15,      // suspension hanger wire, per ft
  // Texture removal
  chemStripperGal: 32.00,  // gallon texture/popcorn stripping solution
  disposalBagsBox: 18.00,  // box of heavy disposal bags
  plasticSheet4: 24.00,    // 10-ft × 25-ft 4-mil sheeting roll
};

/** Apply regional pricing scale factor to a baseline price. */
export function rScale(base: number, regionalValue: number, baselineValue: number): number {
  if (baselineValue === 0) return base;
  return base * (regionalValue / baselineValue);
}

/** Format a price as a range string: "$X – $Y". */
export function priceRange(unitCost: number, qty: number): string {
  const lo = unitCost * qty * 0.85;
  const hi = unitCost * qty * 1.15;
  return `$${lo.toFixed(0)} – $${hi.toFixed(0)}`;
}
