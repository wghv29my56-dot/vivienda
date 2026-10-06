/* realism-1: pure local model. Official paths and modelling assumptions are distinct.
   This version is not compatible with the old alpha-3 SQL engine. */
window.SIM_NATIONAL = {
 populationAt(t) {
  const s=window.SIM_CATALOG.scenario,year=s.start_year+Math.floor(t/4),q=t%4;
  const a=s.demography[year],b=s.demography[year+1];
  return q?a.population+(b.population-a.population)*q/4:a.population;
 },
 flowsAt(t) {
  const s=window.SIM_CATALOG.scenario,a=s.demography[s.start_year+Math.floor((t-1)/4)];
  return {births:a.births/4,deaths:a.deaths/4,immigration:a.immigration/4,emigration:a.emigration/4,rounding_adjustment:(a.rounding_adjustment||0)/4};
 },
 householdsAt(t) {
  const s=window.SIM_CATALOG.scenario,y=s.start_year+t/4,anchors=s.household_anchors;
  if(y>=2041) return anchors[2041]*this.populationAt(t)/s.demography[2041].population;
  const lo=Object.keys(anchors).map(Number).filter(n=>n<=y).at(-1),hi=lo+5;
  return anchors[lo]+(anchors[hi]-anchors[lo])*(y-lo)/5;
 },
 deflatorAt(t) {
  return window.SIM_HOUSING_POLICY.gdpPriceIndex(window.SIM_CATALOG,t);
 },
 gdpAt(t) {
  const d=window.SIM_CATALOG,s=d.scenario;
  const post=(1+s.extrapolation.real_gdp_growth)*(1+s.extrapolation.gdp_deflator);
  return d.national.baseline.gdp*Math.pow(1+s.gdp_nominal_growth[2027],Math.min(t,4)/4)*Math.pow(post,Math.max(0,t-4)/4);
 },
 step({baseline:b,previous:p,previousPrices:pp,initialPrices:ip,turn:t,effects:e,fiscal,previousMigrationDelta=0,reference=null}) {
  const config=window.SIM_CATALOG;const grow=id=>Math.pow(1+(config.national.indicators.find(i=>i.key===id)?.annual_growth||0),t/4);
  const s=config.scenario,k=s.behavior,clip=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const gdp=this.gdpAt(t)*grow('gdp')*(1+clip(e.gdp+fiscal,k.gdp_effect_min,k.gdp_effect_max));
  // Programme flows are explicit scenario assumptions, independent of nationality or rent.
  const officialFlows=this.flowsAt(t),flows={...officialFlows,immigration:Math.max(0,officialFlows.immigration+(e.immigration_per_year||0)/4),emigration:Math.max(0,officialFlows.emigration+(e.emigration_per_year||0)/4)};
  const migrationPopulationDelta=previousMigrationDelta+(flows.immigration-officialFlows.immigration)-(flows.emigration-officialFlows.emigration);
  let projectedPopulation=b.population;
  for(let q=1;q<=t;q++){const f=this.flowsAt(q);projectedPopulation+=f.births-f.deaths+f.immigration-f.emigration+f.rounding_adjustment;}
  const population=Math.max(1,projectedPopulation+migrationPopulationDelta)*grow('population')*(1+clip(e.population||0,k.population_effect_min,k.population_effect_max));
  const households=this.householdsAt(t)*(population/this.populationAt(t));
  const availableHomes=s.annual_completions*t/4+(e.additional_homes||0);
  const housingGap=households-s.households_at_start-availableHomes;
  const shortage=housingGap/s.households_at_start;
  const tourists=b.tourists*grow('tourists')*Math.pow(1+s.extrapolation.tourists_growth,t/4)*(1+clip(e.tourists,k.tourist_effect_min,k.tourist_effect_max));
  const tourist_homes=(e.tourist_home_level??(b.tourist_homes+(s.tourism?.annual_new_homes||0)*t/4))*grow('tourist_homes')*Math.pow(1+s.extrapolation.tourist_homes_growth,t/4)*(1+clip(e.tourist_homes,k.tourist_home_effect_min,k.tourist_home_effect_max));
  const deflator=this.deflatorAt(t),oldDeflator=this.deflatorAt(t-1);
  const income=(gdp/population)/(b.gdp/b.population)/deflator-1;
  const rentPressure=pp.rent/ip.rent/oldDeflator-1,salePressure=pp.sale/ip.sale/oldDeflator-1;
  const rent_demand=b.rent_demand*grow('rent_demand')*(households/s.households_at_start)*(1+clip(e.rent_demand+(config.rules.coherence?0:shortage)+k.rent_demand_sale_response*salePressure+k.rent_demand_price_response*rentPressure+k.rent_demand_income_response*income,k.demand_effect_min,k.demand_effect_max));
  const buy_demand=b.buy_demand*grow('buy_demand')*(households/s.households_at_start)*(1+clip(e.buy_demand+(config.rules.coherence?0:shortage)+k.buy_demand_price_response*salePressure+k.buy_demand_income_response*income,k.demand_effect_min,k.demand_effect_max));
  // Sensitivity assumptions, not official price forecasts.
  const pressure=s.price_shortage_elasticity*shortage;
  let rentFeedback=clip(pressure+k.rent_price_demand_response*e.rent_demand+k.rent_price_tourism_response*Math.log(tourist_homes/b.tourist_homes),k.price_feedback_min,k.price_feedback_max);
  let saleFeedback=clip(pressure+k.sale_price_demand_response*e.buy_demand+s.income_price_elasticity*income,k.price_feedback_min,k.price_feedback_max);
  let segmented=null;
  if(config.rules.coherence){const c=config.rules.coherence,ten=s.tenure_percent,rentShare=(ten.rent_market+ten.rent_reduced)/100,ownerShare=(ten.owner_mortgage+ten.owner_no_mortgage)/100,rentStock=s.households_at_start*rentShare,ownerStock=s.households_at_start*ownerShare;
   const rentGap=(households-s.households_at_start)*rentShare-s.annual_completions*t/4*c.new_completion_rent_share-(e.rentHomes||0),saleGap=(households-s.households_at_start)*ownerShare-s.annual_completions*t/4*(1-c.new_completion_rent_share)-(e.saleHomes||0);
   const rentDemandPressure=reference?Math.log(Math.max(.01,rent_demand/reference.state.rent_demand)):0,saleDemandPressure=reference?Math.log(Math.max(.01,buy_demand/reference.state.buy_demand)):0,refMarket=reference?.diagnostics?.coherence?.market;
   const rentListingPressure=e.market?-Math.log(e.market.rent/(refMarket?.rent??e.market.rentBase)):0,saleListingPressure=e.market?-Math.log(e.market.sale/(refMarket?.sale??e.market.saleBase)):0;
   rentFeedback=clip(s.price_shortage_elasticity*rentGap/rentStock+k.rent_price_demand_response*rentDemandPressure+c.listing_price_elasticity*rentListingPressure+k.rent_price_tourism_response*Math.log(tourist_homes/b.tourist_homes)+(e.territorial?.weightedPrice||0),k.price_feedback_min,k.price_feedback_max);
   saleFeedback=clip(s.price_shortage_elasticity*saleGap/ownerStock+k.sale_price_demand_response*saleDemandPressure+c.listing_price_elasticity*saleListingPressure+s.income_price_elasticity*income+(e.territorial?.weightedPrice||0),k.price_feedback_min,k.price_feedback_max);
   segmented={rentGap,saleGap,rentDemandPressure,saleDemandPressure,rentListingPressure,saleListingPressure};
  }
  return {state:{gdp,population,rent_demand,buy_demand,tourists,tourist_homes},rentFeedback,saleFeedback,
          diagnostics:{segmented,flows,officialFlows,migrationPopulationDelta,households,availableHomes,housingGap,deflator,officialGdpHorizon:2027}};
 }
};
