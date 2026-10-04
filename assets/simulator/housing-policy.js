/* Shared, deterministic rules. All policy parameters live in the versioned model. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function amortization(asset,year,inflation=1,residual=.15){
 if(year<asset.start||year>=asset.start+asset.life||asset.life<=0)return 0;
 return asset.type==='Vivienda'?asset.amount*inflation*(1-residual)/asset.life:asset.amount/asset.life;
}
function annualRent(annualAmortization,returnRate){return annualAmortization*(1+returnRate/100);}
function control(m,a){
 const p=m.price_control;if(!p)return null;
 const enforcement=clamp(a.enforcement??p.default_enforcement,0,1);
 return {enforcement,compliance:p.compliance_floor+(p.compliance_ceiling-p.compliance_floor)*enforcement,
  reduction:p.max_reduction*a.intensity,coverage:p.coverage};
}
function target(m,a,current,elapsed=0){
 const p=m.price_control,c=control(m,a);if(!c)return current;
 const reference=a.reference_price??current;
 if(p.mode==='sale'&&p.basis==='cost_margin'){const ceiling=p.reference_cost_per_m2*(1+p.margin_max*(1-a.intensity)/100)*Math.pow(1+p.cost_growth,elapsed/4);return Math.min(current,ceiling);}
 if(p.mode==='sale'&&p.basis==='indexed_resale')return reference*(1-c.reduction/100)*Math.pow(1+p.resale_growth,elapsed/4);
 if(p.mode==='freeze')return reference;
 if(p.mode==='index')return reference*Math.pow(1+p.annual_limit_max*(1-a.intensity)/100,elapsed/4);
 if(p.mode==='amortization'){
  const b=p.amortization,year=b.year+Math.floor(elapsed/4);
  const sum=b.assets.reduce((n,v)=>n+amortization(v,year,b.inflation_factor*Math.pow(1+b.future_inflation,elapsed/4),b.residual_rate),0);
  const formula=annualRent(sum,b.return_rate)/12/b.area;
  return current+(Math.min(current,formula)-current)*a.intensity;
 }
 return reference*(1-c.reduction/100);
}
// End is exclusive. Cancellation affects future turns; recorded history is retained.
function actionEnd(m,a){return Math.min(a.start+((m.temporal_control||m.term_control)?(a.duration_turns??(m.temporal_control||m.term_control).default_turns):m.duration_turns),a.cancelled_turn??Infinity);}
function accessManagement(m,a){const p=m.access_program?.management;if(!p)return {level:1,capacity:1,speed:1};const level=clamp(a.management??p.default,0,p.max);return {level,capacity:p.capacity_floor+(1-p.capacity_floor)*Math.sqrt(level/p.max),speed:p.speed_floor+(p.speed_ceiling-p.speed_floor)*level/p.max};}
function durationLabel(turns){const months=turns*3,years=Math.floor(months/12),rest=months%12;return [years?years+' '+(years===1?'año':'años'):'',rest?rest+' '+(rest===1?'mes':'meses'):''].filter(Boolean).join(' y ')||'0 meses';}
function durationHappiness(m,a){const p=m.temporal_control?.happiness;if(!p)return 1;const c=m.temporal_control,n=a.duration_turns??c.default_turns;return n<=p.reference_turns?p.short_factor+(1-p.short_factor)*(n-c.min_turns)/(p.reference_turns-c.min_turns):1+(p.long_factor-1)*(n-p.reference_turns)/(c.max_turns-p.reference_turns);}
function accessAt(m,a,t){const p=m.access_program;if(!p||t<a.start)return 0;const mg=accessManagement(m,a),first=Math.max(1,Math.ceil(p.first_delivery_turn/mg.speed)),last=Math.max(first,Math.ceil(p.last_delivery_turn/mg.speed)),fraction=deliveryFraction(Math.min(t,actionEnd(m,a)-1)-a.start+1,first,last);return p.max_beneficiaries*a.intensity*fraction*mg.capacity;}
function publicStockAt(d,t,actions){const base=d.national?.baseline?.public_rental_stock??d.variables?.find(v=>v.id==='public_rental_stock')?.initial??0;let added=0,sold=0,reserved=0;
 for(const a of actions){const m=d.measures[a.index];if(m.supply_program?.public_ownership)added+=supplyAt(m,a,t).completed*m.supply_program.rental_share;if(m.existing_program?.kind==='purchase')added+=existingAt(m,a,t).delivered;if(m.access_program?.kind==='public_sale'&&a.start<=t){sold+=accessAt(m,a,t);reserved+=m.access_program.max_beneficiaries*a.intensity;}}
 return {stock:Math.max(0,base+added-sold),available:Math.max(0,base+added-reserved),sold};
}
function accessConflicts(d,actions){const errors=[];
 for(const a of actions){const m=d.measures[a.index],p=m.access_program;
  if(p?.management&&a.management!==undefined&&(!Number.isFinite(a.management)||a.management<0||a.management>p.management.max))errors.push('Medios de gestión fuera del intervalo de «'+m.name+'».');
  if(m.temporal_control&&(!Number.isInteger(a.duration_turns)||a.duration_turns<m.temporal_control.min_turns||a.duration_turns>m.temporal_control.max_turns))errors.push('Duración fuera del intervalo de «'+m.name+'».');
  if(p?.kind==='public_sale'&&publicStockAt(d,a.start,actions.filter(b=>b.start<=a.start)).available===0){const subset=actions.filter(b=>b.start<=a.start),sold=subset.filter(b=>d.measures[b.index].access_program?.kind==='public_sale').reduce((n,b)=>n+d.measures[b.index].access_program.max_beneficiaries*b.intensity,0);const stock=publicStockAt(d,a.start,subset.filter(b=>d.measures[b.index].access_program?.kind!=='public_sale')).available;if(sold>stock+.01)errors.push('No hay suficientes viviendas públicas sin reservar para esta venta.');}
 }
 return [...new Set(errors)];
}
function fundingScopeFraction(d,sourceId,t,actions){const scopes=new Map();for(const a of actions){const m=d.measures[a.index];if(!m.enabled||t<a.start||t>=actionEnd(m,a))continue;for(const c of m.tax_control?.components||[])if(c.source_id===sourceId&&c.protected_scope&&taxRate(c,a)<taxBase(c,a)){scopes.set(c.protected_scope,Math.max(scopes.get(c.protected_scope)||0,c.scope_share));}}return Math.max(0,1-[...scopes.values()].reduce((n,x)=>n+x,0));}
function taxComponentForce(m,a,id){const c=m.tax_control?.components.find(c=>c.id===id);if(!c)return 0;return c.mode==='cut'?clamp((taxBase(c,a)-taxRate(c,a))/(taxBase(c,a)-c.min||1),0,1):clamp((taxRate(c,a)-c.base)/(c.max-c.base||1),0,1);}
function territoryAt(m,a,t){const p=m.territory_program;if(!p||t<a.start)return {progress:0,completed:0};const progress=deliveryFraction(t-a.start+1,p.first_delivery_turn,p.last_delivery_turn)*a.intensity;return {progress,completed:p.kind==='strategic'?Math.min(p.max_homes*p.completion_share*progress,p.private_capital_at_full!==undefined?p.private_capital_at_full*(p.private_finance_share??1)*progress/Math.max(1,p.private_capital_per_home):Infinity):0,accessible:p.kind==='transport'?p.max_households*progress:0};}
function territoryPipeline(d,t,actions){const out={completed:0,accessible:0,rentHomes:0,saleHomes:0,rentListings:0,saleListings:0};for(const a of actions){const m=d.measures[a.index],p=m.territory_program;if(!m.enabled||!p)continue;const now=territoryAt(m,a,t),prior=territoryAt(m,a,t-2),recent=Math.max(0,now.completed-prior.completed);out.completed+=now.completed;out.rentHomes+=now.completed*p.rent_share;out.saleHomes+=now.completed*(1-p.rent_share);out.accessible+=now.accessible||0;out.rentListings+=recent*p.rent_share*.5;out.saleListings+=recent*(1-p.rent_share)*.5;}return out;}
function tourismForce(m,a){const p=m.tourism_program;if(!p)return a.intensity;if(p.kind==='days'){const days=a.days_allowed??(p.max_days-(p.max_days-p.min_days)*a.intensity);return p.mild_fraction+(1-p.mild_fraction)*Math.pow(clamp((p.max_days-days)/(p.max_days-p.min_days),0,1),p.curve);}if(p.kind==='licenses')return clamp(1-(a.annual_licenses??p.annual_new*(1-a.intensity))/p.annual_new,0,1);if(p.kind==='inspection')return clamp((a.inspectors??p.max_inspectors*a.intensity)/p.max_inspectors,0,1);return a.policy_enabled===false?0:(a.policy_enabled===true?1:a.intensity);}
function tourismConflicts(d,actions){const errors=[];for(let i=0;i<actions.length;i++)for(const b of actions.slice(i+1)){const a=actions[i],m=d.measures[a.index],n=d.measures[b.index];if(m.exclusive_group==='nonresident_purchase'&&n.exclusive_group===m.exclusive_group&&a.start<actionEnd(n,b)&&b.start<actionEnd(m,a)&&taxForce(m,a)>0&&taxForce(n,b)>0)errors.push('El recargo y la restricción total de compra no residente no pueden aplicarse a la vez: no quedaría base para recaudar.');}for(const a of actions){const m=d.measures[a.index],p=m.tourism_program;if(m.term_control){const c=m.term_control;if(!Number.isInteger(a.duration_turns)||a.duration_turns<c.min_turns||a.duration_turns>c.max_turns)errors.push('Duración fuera del intervalo de «'+m.name+'».');}if(!p)continue;if(p.kind==='days'&&a.days_allowed!==undefined&&(!Number.isInteger(a.days_allowed)||a.days_allowed<p.min_days||a.days_allowed>p.max_days))errors.push('Límite de días fuera del intervalo.');if(p.kind==='licenses'&&a.annual_licenses!==undefined&&(!Number.isFinite(a.annual_licenses)||a.annual_licenses<0||a.annual_licenses>p.annual_new||a.annual_licenses%p.license_step!==0))errors.push('Nuevas licencias fuera del intervalo.');if(p.kind==='inspection'&&a.inspectors!==undefined&&(!Number.isInteger(a.inspectors)||a.inspectors<p.min_inspectors||a.inspectors>p.max_inspectors||a.inspectors%p.inspector_step!==0))errors.push('Número de efectivos fuera del intervalo.');if(p.kind==='ban'&&a.intensity!==0&&a.intensity!==1)errors.push('La restricción de compra se activa o desactiva.');if(p.kind==='ban'&&a.policy_enabled!==undefined&&typeof a.policy_enabled!=='boolean')errors.push('Activación de compra no válida.');const overlaps=actions.filter(b=>b!==a&&d.measures[b.index].id===m.id&&b.start<actionEnd(m,a)&&a.start<actionEnd(m,b));if(overlaps.length)errors.push('«'+m.name+'» ya está en ejecución.');}return [...new Set(errors)];}
function tourismPipeline(d,t,actions){const config=d.scenario.tourism;if(!config)return null;const baseline=d.national?.baseline?.tourist_homes??d.variables.find(v=>v.id==='tourist_homes').initial,byAction=new Map(actions.filter(a=>d.measures[a.index].tourism_program).map(a=>[a,0]));let prevented=0,withdrawn=0,inspected=0,stock=baseline;const cumul=[],limitPool=Math.max(0,...d.measures.filter(m=>m.tourism_program?.kind==='inspection').map(m=>m.tourism_program.pool_homes));
 for(let q=1;q<=t;q++){const live=actions.filter(a=>{const m=d.measures[a.index];return m.enabled&&m.tourism_program&&q>=a.start&&q<actionEnd(m,a);});const licenses=live.filter(a=>d.measures[a.index].tourism_program.kind==='licenses');const owner=licenses.sort((a,b)=>tourismForce(d.measures[b.index],b)-tourismForce(d.measures[a.index],a))[0],blocked=owner?config.annual_new_homes/4*tourismForce(d.measures[owner.index],owner):0;stock+=config.annual_new_homes/4-blocked;prevented+=blocked;if(owner)byAction.set(owner,byAction.get(owner)+blocked*config.prevented_residential_share);
 for(const a of live){const m=d.measures[a.index],p=m.tourism_program,elapsed=q-a.start+1;if(p.kind==='days'){const target=baseline*p.withdrawal_share*tourismForce(m,a)*deliveryFraction(elapsed,p.first_turn,p.last_turn),already=byAction.get(a)/p.residential_share,delta=Math.min(Math.max(0,target-already),Math.max(0,stock));stock-=delta;withdrawn+=delta;byAction.set(a,byAction.get(a)+delta*p.residential_share);}if(p.kind==='inspection'&&elapsed>p.setup_turns){const found=(a.inspectors??p.max_inspectors*a.intensity)*p.cases_per_inspector_year*p.success_share/4*clamp((elapsed-p.setup_turns)/p.ramp_turns,0,1),delta=Math.min(found,Math.max(0,limitPool-inspected));inspected+=delta;byAction.set(a,byAction.get(a)+delta);}}
 cumul.push([...byAction.values()].reduce((n,x)=>n+x,0));}
 let rentHomes=0,saleHomes=0;for(const [a,count]of byAction){const p=d.measures[a.index].tourism_program;rentHomes+=count*(p.rent_share??config.rent_share);saleHomes+=count*(1-(p.rent_share??config.rent_share));}const converted=rentHomes+saleHomes,recent=converted-(cumul[Math.max(0,t-3)-1]||0);return {touristHomes:Math.max(0,stock),prevented,withdrawn,inspected,converted,rentHomes,saleHomes,rentListings:rentHomes*config.rent_listing_share+recent*config.rent_share*config.initial_listing_share,saleListings:saleHomes*config.sale_listing_share+recent*(1-config.rent_share)*config.initial_listing_share,byAction};}
function taxBase(c,a){return a.tax_bases?.[c.id]??c.base;}
function taxRate(c,a){const base=taxBase(c,a);return a.tax_rates?.[c.id]??(c.mode==='cut'?base-(base-c.min)*a.intensity:c.base+(c.max-c.base)*a.intensity);}
function taxForce(m,a){if(m.tourism_program)return tourismForce(m,a);if(!m.tax_control)return a.intensity;let sum=0,weights=0;for(const c of m.tax_control.components){const w=c.weight??1,base=taxBase(c,a),fraction=c.mode==='cut'?(base-taxRate(c,a))/(base-c.min||1):(taxRate(c,a)-c.base)/(c.max-c.base||1);sum+=w*clamp(fraction,0,1);weights+=w;}return weights?sum/weights:0;}
function taxReceipts(m,a,index=1){if(!m.tax_control)return [];return m.tax_control.components.filter(c=>c.mode!=='cut').map(c=>{const carrier=c.carriers?.find(x=>x.id===(a.tax_carrier??m.tax_control.default_carrier))??c.carriers?.[0];return {source_id:carrier?.source_id??c.source_id,tax_name:carrier?.name??c.name,quarterly_amount:Math.round((carrier?.annual_base??c.annual_base)*(taxRate(c,a)-c.base)/100*c.collection_rate*(1-(c.demand_drop||0)*clamp(taxRate(c,a)/c.max,0,1))/4*index)};});}
function taxConflicts(measures,actions){const errors=[];for(const a of actions){const m=measures[a.index];if(!m.tax_control)continue;for(const c of m.tax_control.components){const n=taxRate(c,a),base=taxBase(c,a),max=c.mode==='cut'?base:c.max;if(!Number.isFinite(n)||!Number.isFinite(base)||base<c.min||base>100||n<c.min||n>max||Math.abs((n-c.min)/c.step-Math.round((n-c.min)/c.step))>1e-6)errors.push('Tipo impositivo fuera del intervalo o paso de «'+c.name+'».');if(c.carriers&&!c.carriers.some(x=>x.id===(a.tax_carrier??m.tax_control.default_carrier)))errors.push('Selecciona IRPF o Sociedades.');}}
return [...new Set(errors)];}
function migrationCapacity(m,a){const p=m.migration_program;if(!p)return 0;const b=p.bonus,bonus=clamp(a.return_bonus??b?.default??0,b?.min??0,b?.max??0),participation=b?b.participation_floor+(1-b.participation_floor)*Math.sqrt(bonus/(b.max||1)):1;return p.annual_capacity*a.intensity*participation;}
// One finite departure pool shared across mandatory and voluntary programmes.
// Returning residents are not the nonresident-buyer group.
function legacyMigrationPipeline(d,t,actions){const out={immigration_per_year:0,emigration_per_year:0,gdp:0,rent_demand:0,departures:0,byAction:new Map()},used=new Map();const initial=d.national?.baseline?.population??d.variables.find(v=>v.id==='population').initial;let shared=0;
 for(let q=1;q<=t;q++)for(const a of [...actions].sort((a,b)=>a.start-b.start||d.measures[a.index].id.localeCompare(d.measures[b.index].id))){const m=d.measures[a.index],p=m.migration_program,f=m.migration_flows;if(!p||!f||!m.enabled||q<a.start+m.delay_turns||q>=actionEnd(m,a))continue;const ramp=f.maturation_turns?clamp((q-a.start-m.delay_turns+1)/f.maturation_turns,0,1):1,prior=used.get(m.id)||0;let count=Math.min(migrationCapacity(m,a)*ramp/4,Math.max(0,p.eligible_pool-prior));const isDeparture=f.emigration_per_year>0,isLimit=f.immigration_per_year<0;if(isDeparture)count=Math.min(count,Math.max(0,d.scenario.migration_programs.departure_pool-shared));if(!isDeparture&&!isLimit)continue;used.set(m.id,prior+count);out.byAction.set(a,(out.byAction.get(a)||0)+count);if(isDeparture){shared+=count;out.departures+=count;}if(q===t){out.emigration_per_year+=isDeparture?count*4:0;out.immigration_per_year-=isLimit?count*4:0;}out.gdp-=count/initial*p.gdp_per_resident;out.rent_demand-=count/initial*p.rental_extra_multiplier;}
 return out;
}
function migrationConflicts(d,actions){const errors=[];for(const a of actions){const m=d.measures[a.index],b=m.migration_program?.bonus;if(b&&a.return_bonus!==undefined&&(!Number.isFinite(a.return_bonus)||a.return_bonus<b.min||a.return_bonus>b.max||Math.abs((a.return_bonus-b.min)/b.step-Math.round((a.return_bonus-b.min)/b.step))>1e-6))errors.push('Bonificación de retorno fuera del intervalo o paso permitido.');}return errors;}
function existingUnitCost(m,a,index=1){
 const p=m.existing_program;if(!p)return null;
 const price=(a.purchase_price??p.reference_price_per_m2*index)*p.area;
 const premium=p.acquisition_mode==='expropriation'?price*(p.compensation_premium??.05):0;
 const asset=p.kind==='purchase'?price:p.rehab_unit*index;
 const administration=(p.kind==='purchase'?price*p.transaction_overhead:0)+p.setup_unit*index;
 return {asset,premium,administration,total:asset+premium+administration};
}
function costs(m,a,index=1){
 const c=control(m,a),scale=c?c.enforcement:taxForce(m,a);
 if(m.migration_program?.bonus){const b=m.migration_program.bonus,bonus=clamp(a.return_bonus??b.default,b.min,b.max),bonusQuarter=Math.round(migrationCapacity(m,a)*bonus/4*index);return {initial:Math.round(m.initial_cost*a.intensity*index),quarter:Math.round(m.quarterly_cost*a.intensity*index)+bonusQuarter,bonusQuarter,fiscalQuarter:0,maintenance:0};}
 if(m.insurance_program){const p=m.insurance_program,n=p.max_contracts*a.intensity,rent=(a.rent_reference??p.baseline_rent)*p.area,adminInitial=n*p.setup_unit*index,reserve=n*rent*p.reserve_months,adminQuarter=n*p.annual_admin_unit/4*index,claimsQuarter=n*rent*12*p.annual_claim_rate/4;return {initial:Math.round(adminInitial+reserve),quarter:Math.round(adminQuarter+claimsQuarter),fiscalQuarter:0,maintenance:0,reserveInitial:Math.round(reserve),claimsQuarter:Math.round(claimsQuarter),gdpInitial:Math.round(adminInitial),gdpQuarter:Math.round(adminQuarter+claimsQuarter*p.claims_consumption_share)};}
 const p=m.access_program;
 const mg=accessManagement(m,a),n=p?p.max_beneficiaries*a.intensity:0,adminInitial=p?.management?n*((p.setup_unit+p.management.extra_setup_unit)*mg.level-p.setup_unit)*index:0,adminQuarter=p?.management?n*((p.quarter_admin_unit+p.management.extra_quarter_unit)*mg.level-p.quarter_admin_unit)*index:0;
 if(p?.kind==='guarantee'||p?.kind==='public_sale'){const n=p.max_beneficiaries*a.intensity,price=(a.purchase_price??p.reference_price_per_m2)*p.area;const reserve=p.kind==='guarantee'?price*p.loan_share*p.guarantee_share*p.loss_reserve:price*p.discount;return {initial:Math.round(n*(reserve+p.setup_unit*index)+adminInitial),quarter:Math.round(n*p.quarter_admin_unit*index+adminQuarter),fiscalQuarter:0,maintenance:0,exposure:p.kind==='guarantee'?n*price*p.loan_share*p.guarantee_share:0};}
 if(m.existing_program){const p=m.existing_program,n=a.units??p.reference_homes*a.intensity,unit=existingUnitCost(m,a,index);return {initial:Math.round(n*unit.total),quarter:Math.round(n*p.annual_operating/4*index),fiscalQuarter:0,maintenance:p.kind==='purchase'?Math.round(n*p.annual_operating/4*index):0,...(p.kind==='purchase'?{compensationInitial:Math.round(n*(unit.asset+unit.premium)),administrationInitial:Math.round(n*unit.administration),gdpInitial:Math.round(n*unit.administration)}:{})};}
 const factor=1-(m.cost_sensitive_share||0)*(1-(a.construction_cost_factor??1));
 const fiscalQuarter=(m.fiscal_links||[]).reduce((n,f)=>n+f.quarterly_loss*fiscalScale(m,a,f)*index,0);
 if(m.tax_control){const receipts=taxReceipts(m,a,index),receiptQuarter=receipts.reduce((n,f)=>n+f.quarterly_amount,0),grossInitial=Math.round(m.initial_cost*scale*index*factor),grossQuarter=Math.round(m.quarterly_cost*scale*index*factor),surplus=Math.max(0,receiptQuarter-grossQuarter);return {initial:Math.max(0,grossInitial-surplus),quarter:Math.round(Math.max(0,grossQuarter-receiptQuarter)+fiscalQuarter),fiscalQuarter:Math.round(fiscalQuarter),maintenance:0,grossInitial,grossQuarter,receiptQuarter,receipts};}
 return {initial:Math.round(m.initial_cost*scale*index*factor+adminInitial),quarter:Math.round(m.quarterly_cost*scale*index*factor+fiscalQuarter+adminQuarter),
  fiscalQuarter:Math.round(fiscalQuarter),maintenance:Math.round((m.cost_breakdown?.annual_maintenance_per_home||0)*(m.cost_breakdown?.homes_at_full||0)*a.intensity/4*index)};
}
function fiscalScale(m,a,link){if(link.control_component&&m.tax_control){const c=m.tax_control.components.find(c=>c.id===link.control_component);return c?Math.max(0,(taxBase(c,a)-taxRate(c,a))/(c.base-c.min||1)):0;}return link.control==='tax_support'?(a.tax_support??m.tax_support?.default??0):a.intensity;}
function constructionCostFactor(d,t,actions){
 let reduction=0;
 for(const a of actions){const m=d.measures[a.index],r=m.cost_reduction;if(!r||t<a.start+r.delay_turns)continue;
  const force=r.tax_weight?a.intensity*(1-r.tax_weight)+(a.tax_support??m.tax_support?.default??0)*r.tax_weight:a.intensity;
  reduction+=r.max_percent/100*force*clamp((t-a.start-r.delay_turns+1)/r.ramp_turns,0,1);
 }
 return 1-Math.min(d.rules.supply?.max_cost_reduction??.15,reduction);
}
function deliveryFraction(elapsed,first,last){return clamp((elapsed-first+1)/(last-first+1),0,1);}
function supplyAt(m,a,t){
 const p=m.supply_program;if(!p)return {land:0,completed:0};
 const elapsed=t-a.start+1,quantity=p.max_homes*a.intensity,approved=Math.min(quantity*p.completion_rate,p.private_capital_at_full!==undefined?p.private_capital_at_full*a.intensity/Math.max(1,p.private_capital_per_home):Infinity)*deliveryFraction(elapsed,p.first_delivery_turn+p.build_after_land_turns,p.last_delivery_turn+p.build_after_land_turns)*(p.private_finance_share??1); 
 return {land:p.kind==='land'?quantity*deliveryFraction(elapsed,p.first_delivery_turn,p.last_delivery_turn):0,
 regularised:p.regularisation?approved:0,mortgagePotential:p.regularisation?approved*p.regularisation.mortgage_eligible_share:0,completed:approved*(p.regularisation?.market_share??1)};
}
function supplyPipeline(d,t,actions){
 const out={completed:0,regularised:0,mortgagePotential:0,servicedLand:0,rentHomes:0,saleHomes:0,rentListings:0,saleListings:0};
 const listingTurns=d.rules.supply?.listing_turns??2,listingShare=d.rules.supply?.listing_share??.5;
 for(const a of actions){const m=d.measures[a.index],p=m.supply_program;if(!p||!m.enabled||a.start>t)continue;
  const now=supplyAt(m,a,t),prior=supplyAt(m,a,t-listingTurns),newHomes=Math.max(0,now.completed-prior.completed);
  out.completed+=now.completed;out.regularised+=now.regularised;out.mortgagePotential+=now.mortgagePotential;out.servicedLand+=now.land;out.rentHomes+=now.completed*p.rental_share;out.saleHomes+=now.completed*(1-p.rental_share);
  out.rentListings+=newHomes*p.rental_share*(p.regularisation?.listing_share??listingShare);out.saleListings+=newHomes*(1-p.rental_share)*(p.regularisation?.listing_share??listingShare);
 }
 return out;
}

// Acquisitions reallocate existing dwellings; they never create physical stock.
function existingAt(m,a,t){
 const p=m.existing_program;if(!p||t<a.start)return {reserved:0,delivered:0};
 const units=a.units??p.reference_homes*a.intensity,elapsed=t-a.start+1;
 const delivered=units*p.completion_rate*deliveryFraction(elapsed,p.first_delivery_turn,p.last_delivery_turn),retention=p.kind==='rehab'&&p.commitment_turns&&elapsed>p.last_delivery_turn+p.commitment_turns?p.retention_after_commitment:1;return {reserved:units-delivered*(1-retention),delivered,rentalDelivered:delivered*retention};
}
function existingPipeline(d,t,actions){
 const out={reserved:0,delivered:0,publicHomes:0,rentListings:0,annualRentIncome:0};
 for(const a of actions){const m=d.measures[a.index],p=m.existing_program;if(!p||!m.enabled)continue;const now=existingAt(m,a,t),prior=existingAt(m,a,t-(d.rules.existing?.listing_turns??2));out.reserved+=now.reserved;out.delivered+=now.rentalDelivered??now.delivered;out.publicHomes+=p.kind==='purchase'?now.delivered:0;out.rentListings+=Math.max(0,now.delivered-prior.delivered)*(d.rules.existing?.listing_share??1);if(p.kind==='purchase')out.annualRentIncome+=now.delivered*(a.rent_reference??d.prices.rent.value)*p.area*12*p.rent_fraction*p.occupancy_rate;}
 return out;
}
function existingConflicts(measures,actions){
 const errors=[];
 for(const a of actions){const m=measures[a.index],p=m.existing_program;if(!p||a.units===undefined)continue;
  if(!Number.isInteger(a.units)||a.units<1||!Number.isFinite(a.sale_pool)||a.sale_pool<1||a.units>Math.floor(a.sale_pool*p.max_sale_share))errors.push('La cantidad de «'+m.name+'» supera su límite de anuncios disponibles.');
  const siblings=actions.filter(b=>b.start===a.start&&measures[b.index].existing_program);if(siblings.reduce((n,b)=>n+(b.units??0),0)>a.sale_pool)errors.push('La compra, expropiación y rehabilitación reservan más anuncios de los disponibles.');
 }
 return [...new Set(errors)];
}

function programmeConflicts(measures,actions){
 const errors=[];
 for(let i=0;i<actions.length;i++){const a=actions[i],m=measures[a.index];if(!m.supply_program&&!m.cost_reduction&&!m.territory_program&&!m.migration_program)continue;
  for(const b of actions.slice(i+1))if(b.index===a.index){const lock=m.supply_program?Math.max(m.duration_turns,m.supply_program.last_delivery_turn):m.duration_turns;
   if(Math.max(a.start,b.start)<Math.min(a.start+lock,b.start+lock))errors.push('«'+m.name+'» sigue en ejecución. Espera a que termine el programa.');}
 }
 for(let i=0;i<measures.length;i++){const m=measures[i],p=m.supply_program;if(p&&actions.filter(a=>a.index===i).reduce((n,a)=>n+a.intensity*p.max_homes,0)>p.lifetime_homes+.001)errors.push('Se ha agotado la capacidad de «'+m.name+'» para esta partida.');}
 for(let i=0;i<measures.length;i++){const m=measures[i];if(m.territory_program&&actions.filter(a=>a.index===i).reduce((n,a)=>n+a.intensity,0)>1+.000001)errors.push('Se ha agotado la cartera territorial de «'+m.name+'».');}
 return [...new Set(errors)];
}
// Cohorts of additional projects, relative to the unchanged baseline build rate.
// All administrative measures draw from one finite backlog; old completed homes
// never disappear when another measure starts or the staffing programme ends.
function adminPipeline(d,t,actions){
 const rules=d.rules.administration;
 const out={permits:0,completed:0,rentHomes:0,saleHomes:0,rentListings:0,saleListings:0,byAction:new Map()};
 if(!rules)return out;
 let remaining=rules.backlog_homes;const cohorts=[];
 for(let q=1;q<=t;q++){
  const requests=actions.map(a=>{const m=d.measures[a.index],p=m.admin_program;
   if(!m.enabled||!p||q<a.start+p.setup_turns||q>=a.start+m.duration_turns)return null;
   const ramp=Math.min(1,(q-a.start-p.setup_turns+1)/p.ramp_turns);
   return {a,p,homes:p.staff_at_full*a.intensity*p.homes_per_staff_year/4*ramp};
  }).filter(Boolean);
  const demand=requests.reduce((sum,r)=>sum+r.homes,0),allocated=Math.min(demand,remaining,rules.max_extra_permits_per_year/4);
  for(const r of requests){const permitted=demand?allocated*r.homes/demand:0;const entry=out.byAction.get(r.a)||{permits:0,completed:0};entry.permits+=permitted;out.byAction.set(r.a,entry);cohorts.push({a:r.a,turn:q+r.p.build_turns,homes:permitted*r.p.completion_rate*(1-r.p.rejection_rate),rent_share:r.p.rental_share});}
  out.permits+=allocated;remaining-=allocated;
 }
 for(const c of cohorts){if(c.turn>t)continue;const rent=c.homes*c.rent_share,sale=c.homes-rent;
  out.byAction.get(c.a).completed+=c.homes;out.completed+=c.homes;out.rentHomes+=rent;out.saleHomes+=sale;
  if(t-c.turn<rules.listing_turns){out.rentListings+=rent*rules.listing_share;out.saleListings+=sale*rules.listing_share;}
 }
 return out;
}
// Tax benefits and funding commitments must not cancel each other, even in
// different measures or later turns. The rule ends with the benefit itself.
function fiscalConflicts(measures,actions){
 const errors=[];for(let i=0;i<actions.length;i++)for(const b of actions.slice(i+1)){const a=actions[i],m=measures[a.index],n=measures[b.index],scopes=(m.tax_control?.components||[]).filter(c=>c.protected_scope).map(c=>c.protected_scope);if(scopes.length&&(n.tax_control?.components||[]).some(c=>scopes.includes(c.protected_scope))&&a.start<actionEnd(n,b)&&b.start<actionEnd(m,a))errors.push('El régimen fiscal de estas zonas ya está en vigor. No se puede duplicar su beneficio.');}
 for(const a of actions){const m=measures[a.index];
  for(const link of m.fiscal_links||[]){if(!link.source_id||fiscalScale(m,a,link)<=0||link.protected_scope)continue;
   for(const b of actions){const bm=measures[b.index];
    const first=Math.max(a.start,b.start),last=Math.min(actionEnd(m,a)-1,actionEnd(bm,b)-1);
    if(first>last)continue;
    if((b.funding||[]).some(f=>f.source_id===link.source_id&&(f.quarterly_amount>0||(b.start>=first&&f.initial_amount>0)))||taxReceipts(bm,b).some(f=>f.source_id===link.source_id&&f.quarterly_amount>0))
     errors.push('No puedes subir '+link.tax_name+' mientras está vigente «'+m.name+'». Elige otro impuesto o una partida presupuestaria.');
   }
  }
 }
 return [...new Set(errors)];
}
// Coherence v1: every price, beneficiary and accounting channel is explicit.
function migrationPipeline(d,t,actions){
 if(!d.rules.coherence)return legacyMigrationPipeline(d,t,actions);
 const out={immigration_per_year:0,emigration_per_year:0,gdp:0,rent_demand:0,departures:0,workers:0,relocated:0,byAction:new Map(),currentByAction:new Map(),activeByAction:new Map()},used=new Map(),shared=new Map(),cohorts=[];
 const initial=d.national?.baseline?.population??d.variables.find(v=>v.id==='population').initial;
 for(let q=1;q<=t;q++)for(const a of [...actions].sort((a,b)=>a.start-b.start||d.measures[a.index].id.localeCompare(d.measures[b.index].id))){
  const m=d.measures[a.index],p=m.migration_program,f=m.migration_flows;if(!p||!f||!m.enabled||q<a.start+m.delay_turns||q>=actionEnd(m,a))continue;
  const ramp=f.maturation_turns?clamp((q-a.start-m.delay_turns+1)/f.maturation_turns,0,1):1,key=p.overlap_pool??p.pool_key,departure=f.emigration_per_year>0,limited=f.immigration_per_year<0;
  const cap=p.overlap_pool?p.shared_pool:(departure?d.scenario.migration_programs.departure_pool:p.eligible_pool),prior=used.get(m.id)||0;
  const count=Math.min(migrationCapacity(m,a)*ramp/4,Math.max(0,p.eligible_pool-prior),Math.max(0,cap-(shared.get(key)||0)));
  used.set(m.id,prior+count);shared.set(key,(shared.get(key)||0)+count);out.byAction.set(a,(out.byAction.get(a)||0)+count);cohorts.push({a,p,q,count});
  if(q===t){out.currentByAction.set(a,count);out.emigration_per_year+=departure?count*4:0;out.immigration_per_year+=p.kind==='construction'?count*4:limited?-count*4:0;}
  if(departure||limited){out.departures+=departure?count:0;out.gdp-=count/initial*p.gdp_per_resident;out.rent_demand-=count/initial*p.rental_extra_multiplier;}
  if(p.kind==='construction')out.workers+=count;
  if(p.kind==='relocation')out.relocated+=count;
 }
 for(const {a,p,q,count}of cohorts){const active=['seasonal','reception'].includes(p.kind)?t<actionEnd(d.measures[a.index],a)&&t<q+(p.service_turns||4):true;if(active)out.activeByAction.set(a,(out.activeByAction.get(a)||0)+count);}
 out.workerCohorts=cohorts.filter(x=>x.p.kind==='construction');return out;
}
function beneficiaryForce(d,m,a,t,actions,pipe){
 const p=m.migration_program;if(!p)return a.intensity;
 const x=pipe||migrationPipeline(d,t,actions),n=['seasonal','reception'].includes(p.kind)?x.activeByAction.get(a)||0:x.byAction.get(a)||0;
 return clamp(n/(p.beneficiary_reference||p.eligible_pool),0,1);
}
function privatePipeline(d,t,actions,migration){
 const c=d.rules.coherence,out={completed:0,rentHomes:0,saleHomes:0,rentListings:0,saleListings:0,workers:0,investmentQuarter:0};if(!c)return out;
 let reserved=0;const cohorts=[],workersByCohort=(migration||migrationPipeline(d,t,actions)).workerCohorts||[];
 for(let q=1;q<=t;q++){
  const factor=constructionCostFactor(d,q,actions),workers=workersByCohort.reduce((n,x)=>n+(x.q<=q?x.count:0),0);
  const efficiency=d.scenario.annual_completions*Math.max(0,1/factor-1)*c.private_supply_elasticity/4,labour=Math.min(workers,c.labour_max_active_workers)*c.labour_homes_per_worker_year/4;
  const room=Math.min(c.private_max_extra_per_year/4,Math.max(0,c.private_lifetime_extra_homes-reserved)),total=efficiency+labour,scale=total?Math.min(1,room/total):0;
  reserved+=(efficiency+labour)*scale;cohorts.push({q:q+c.private_build_turns,homes:efficiency*scale},{q:q+c.labour_build_turns,homes:labour*scale,labour:true});out.workers=workers;
 }
 for(const x of cohorts){const lag=x.labour?c.labour_build_turns:c.private_build_turns;if(t>=x.q-lag&&t<x.q)out.investmentQuarter+=x.homes*c.private_construction_cost_per_home/lag;if(x.q<=t){out.completed+=x.homes;out.rentHomes+=x.homes*c.new_completion_rent_share;out.saleHomes+=x.homes*(1-c.new_completion_rent_share);if(t-x.q<d.rules.supply.listing_turns){out.rentListings+=x.homes*c.new_completion_rent_share*d.rules.supply.listing_share;out.saleListings+=x.homes*(1-c.new_completion_rent_share)*d.rules.supply.listing_share;}}}
 return out;
}
function mobilisationPipeline(d,t,actions){
 const out={completed:0,physicalNew:0,activated:0,rentHomes:0,saleHomes:0,rentListings:0,saleListings:0,byAction:new Map()},used=new Map();
 const ordered=[...actions].sort((a,b)=>a.start-b.start||d.measures[a.index].id.localeCompare(d.measures[b.index].id));
 for(const a of ordered){const m=d.measures[a.index],p=m.market_program;if(!p||!m.enabled||a.start>t)continue;
  const force=taxForce(m,a),target=p.max_homes*force,capacity=Math.max(0,p.eligible_pool-(used.get(p.pool_key)||0)),allocated=Math.min(target,capacity);used.set(p.pool_key,(used.get(p.pool_key)||0)+allocated);
  const elapsed=t-a.start+1,retained=elapsed>m.duration_turns?p.retention:1,now=allocated*deliveryFraction(elapsed,p.first_delivery_turn,p.last_delivery_turn)*retained,prior=allocated*deliveryFraction(elapsed-2,p.first_delivery_turn,p.last_delivery_turn)*retained,recent=Math.max(0,now-prior);
  out.byAction.set(a,now);out.completed+=now;out[p.kind==='private_build'?'physicalNew':'activated']+=now;out.rentHomes+=now*p.rent_share;out.saleHomes+=now*(1-p.rent_share);out.rentListings+=recent*p.rent_share*.5;out.saleListings+=recent*(1-p.rent_share)*.5;
 }
 return out;
}
function privateInvestmentAt(d,t,actions,privateSupply){const c=d.rules.coherence;if(!c)return 0;let total=0;
 for(const a of actions){const m=d.measures[a.index],p=m.supply_program,r=m.territory_program,q=m.market_program;
  if(p?.private_capital_at_full!==undefined){const first=Math.max(1,p.first_delivery_turn+p.build_after_land_turns-c.private_build_turns),last=p.last_delivery_turn+p.build_after_land_turns;if(t>=a.start+first-1&&t<=a.start+last-1)total+=p.private_capital_at_full*(p.private_finance_share??1)*a.intensity/(last-first+1);}
  if(r?.private_capital_at_full!==undefined){const first=Math.max(1,r.first_delivery_turn-c.private_build_turns),last=r.last_delivery_turn;if(t>=a.start+first-1&&t<=a.start+last-1)total+=r.private_capital_at_full*r.private_finance_share*a.intensity/(last-first+1);}
  if(q?.kind==='private_build'){const first=Math.max(1,q.first_delivery_turn-c.private_build_turns),last=q.last_delivery_turn;if(t>=a.start+first-1&&t<=a.start+last-1)total+=q.max_homes*taxForce(m,a)*c.private_construction_cost_per_home/(last-first+1);}
 }
 return total+(privateSupply?.investmentQuarter||0);
}
function controlExposure(d,t,actions){let rentCoverage=0,rentalWithdrawal=0,saleWithdrawal=0;
 for(const a of actions){const m=d.measures[a.index],p=m.price_control;if(!m.enabled||!p||t<a.start+m.delay_turns||t>=actionEnd(m,a))continue;const elapsed=Math.max(0,t-a.start),price=(a.reference_price??d.prices[p.mode==='sale'?'sale':'rent'].value)*Math.pow(1+d.scenario.extrapolation.gdp_deflator,elapsed/4);if(p.mode!=='freeze'&&target(m,a,price,elapsed)>=price)continue;const k=control(m,a),mat=clamp((t-a.start-m.delay_turns+1)/d.rules.maturation_turns,0,1),coverage=p.coverage*k.compliance*mat*(p.mode==='freeze'?a.intensity:1);
  if(p.mode==='sale')saleWithdrawal+=p.withdrawal_at_full*a.intensity*coverage;
  else {rentCoverage+=coverage;rentalWithdrawal+=p.withdrawal_at_full*a.intensity*coverage;}
 }
 for(const a of actions){const m=d.measures[a.index];if(m.access_program&&t>=a.start&&t<actionEnd(m,a))rentalWithdrawal+=m.access_program.rental_withdrawal*a.intensity*accessManagement(m,a).capacity;}
 return {rentCoverage:clamp(rentCoverage,0,1),rentalWithdrawal:clamp(rentalWithdrawal,0,.8),saleWithdrawal:clamp(saleWithdrawal,0,.8)};
}
function marketListings(d,t,actions,pipelines){
 const s=d.scenario,ten=s.tenure_percent,exposure=controlExposure(d,t,actions),rentBase=s.households_at_start*(ten.rent_market+ten.rent_reduced)/100*s.rental_listing_turnover,saleBase=s.households_at_start*(ten.owner_mortgage+ten.owner_no_mortgage)/100*s.sale_listing_turnover;
 const add=key=>Object.values(pipelines).reduce((n,p)=>n+(p?.[key]||0),0),rent=rentBase*(1-exposure.rentalWithdrawal)+add('rentListings')+(pipelines.publicStock?.delta||0)*(d.rules.coherence.public_listing_turnover||0),sale=(Math.max(1,saleBase-(pipelines.existing?.reserved||0)))*(1-exposure.saleWithdrawal)+add('saleListings');
 return {rent:clamp(rent,s.listing_behavior.rent_min,s.listing_behavior.rent_max),sale:clamp(sale,s.listing_behavior.sale_min,s.listing_behavior.sale_max),rentBase,saleBase,...exposure};
}
function fiscalIncidence(d,source,amount,index=1){
 const f=source.fiscal_response;if(!f)return {groups:source.group_effects||{},income:{},diagnostics:{}};
 const groups={},income={},details={},annual=amount*4/index,households=d.scenario.households_at_start,perAffected=annual/(households*f.affected_household_share),resourceRatio=annual/Math.max(1,source.annual_reference);
 for(const g of d.display_groups||d.groups){const exposed=source.incidence.exposure_key==='pension'?(g.profiles?.pensioners??g.funding_exposure?.pension??0):(g.funding_exposure?.[source.incidence.exposure_key]||0),resident=g.funding_exposure?.resident||0,loss=f.affects_income?perAffected*exposed:0;
  income[g.id]=-loss;const direct=f.affects_income?-f.cash_sensitivity*Math.tanh(loss/(g.income_reference||f.income_reference)):-f.service_sensitivity*Math.tanh(resourceRatio)*exposed;
  const political=-f.political_points*Math.tanh(resourceRatio)*resident;groups[g.id]=direct+political;details[g.id]={exposed,annual_income_change:-loss,service_points:f.affects_income?0:direct,political_points:political};
 }
 return {groups,income,diagnostics:{annual_resource_change:annual,euros_per_affected_household:perAffected,relative_service_change:resourceRatio,byGroup:details}};
}
function gdpExpenditure(d,m,a,t,c,context){
 const ended=t>=actionEnd(m,a);if(ended)return c.maintenance||0;
 let quarter=c.gdpQuarter??(c.grossQuarter??(c.quarter-c.fiscalQuarter-(c.bonusQuarter||0)))*(m.access_program?.quarter_gdp_share??1),initial=c.gdpInitial??(c.grossInitial??c.initial)*(m.access_program?.initial_gdp_share??(m.existing_program?.kind==='purchase'?(m.existing_program.acquisition_gdp_share??.05):1));
 if(m.migration_program){const recurring=['seasonal','reception'].includes(m.migration_program.kind),n=(recurring?context.migration?.activeByAction:context.migration?.currentByAction)?.get(a)||0,capacity=migrationCapacity(m,a)/(recurring?1:4);quarter*=capacity?clamp(n/capacity,0,1):0;}
 return quarter+(t===a.start?initial:0);
}
function purchaseCost(d,t,actions,rates){
 const c=d.rules.coherence;if(!c)return {factor:1,base:1,relief:0};const itp=d.funding_sources.find(s=>s.id==='a3_tax_itp'),ajd=d.funding_sources.find(s=>s.id==='a3_tax_ajd'),resale=c.purchase_resale_share;
 const base=1+resale*itp.fiscal_control.base/100+(1-resale)*(c.new_home_vat_rate+ajd.fiscal_control.base)/100;
 let factor=1+resale*(rates?.itp??itp.fiscal_control.base)/100+(1-resale)*(c.new_home_vat_rate+(rates?.ajd??ajd.fiscal_control.base))/100,relief=0;
 for(const a of actions){const m=d.measures[a.index],p=m.purchase_benefit;if(!p||t<a.start||t>=actionEnd(m,a))continue;
  for(const component of m.tax_control.components){const n=component.id==='itp'?p.eligible_resale_transactions:p.eligible_new_transactions,share=clamp(n/d.national.baseline.buy_demand,0,1),change=(taxBase(component,a)-taxRate(component,a))/100;relief+=share*change;}
 }
 return {factor:Math.max(.5,factor-relief),foreignFactor:factor,base,relief};
}
function territorialShift(d,t,actions,territory,migration){
 const c=d.rules.coherence;if(!c)return {households:0,origin:0,destination:0,weightedPrice:0};let households=migration?.relocated||0;
 for(const a of actions){const m=d.measures[a.index],p=m.territory_program,q=m.territorial_shift;if(p){const at=territoryAt(m,a,t);households+=(p.max_relocated_households||0)*at.progress;}if(q)households+=q.max_households*taxForce(m,a)*deliveryFraction(t-a.start+1,q.first_turn,q.last_turn);}
 households=clamp(households,0,d.scenario.households_at_start*(1-c.regional_origin_share));const origin=-households/(d.scenario.households_at_start*c.regional_origin_share),destination=households/(d.scenario.households_at_start*(1-c.regional_origin_share));
 // Arithmetic mean conserves national demand; relief stems from asymmetric local scarcity.
 return {households,origin,destination,weightedPrice:c.regional_price_elasticity*(origin*c.regional_origin_share*c.origin_scarcity_multiplier+destination*(1-c.regional_origin_share)*c.destination_scarcity_multiplier)};
}

// One-pass national climate: direct group impacts -> social climate -> final groups.
function collectiveHappiness(d,values,gdp,population,deflator,amounts,reference,index=1){
 const c=d.rules.collective_happiness,groups=d.display_groups||d.groups,excluded=new Set(c.excluded_groups),eligible=groups.filter(g=>!excluded.has(g.id)),weight=eligible.reduce((n,g)=>n+g.weight,0),mean=v=>eligible.reduce((n,g)=>n+g.weight*v[g.id],0)/weight,directIndex=mean(values),bySource={};let fiscal=0;
 for(const source of d.funding_sources){const f=source.fiscal_response,ratio=(amounts[source.id]||0)*4/index/Math.max(1,source.annual_reference),fraction=clamp(Math.abs(ratio),0,1),linear=source.kind==='spending_cut'?c.budget_linear_share:c.tax_linear_share,severity=linear*fraction+(1-linear)*fraction*fraction,points=ratio>=0?-f.collective_loss_at_full*severity:f.collective_gain_at_full*severity;bySource[source.id]={fraction,annual_change:(amounts[source.id]||0)*4/index,points};fiscal+=points;}
 const base=d.national.baseline,total=gdp/deflator/base.gdp,perCapita=total/(population/base.population),output=c.gdp_total_weight*Math.log(Math.max(.01,total))+(1-c.gdp_total_weight)*Math.log(Math.max(.01,perCapita)),respond=x=>x<0?c.gdp_loss_points*Math.tanh(x/c.gdp_loss_scale):c.gdp_gain_points*Math.tanh(x/c.gdp_gain_scale);
 let macro=respond(output);if(reference){const r=reference.diagnostics.collective,refGdp=reference[9+d.national.indicators.findIndex(i=>i.key==='gdp')],refPop=reference[9+d.national.indicators.findIndex(i=>i.key==='population')],delta=c.gdp_total_weight*Math.log(Math.max(.01,gdp/refGdp))+(1-c.gdp_total_weight)*Math.log(Math.max(.01,(gdp/population)/(refGdp/refPop)));macro=(r?.macro||0)+respond(delta);}
 const peer=reference?c.peer_feedback*(directIndex-(reference.diagnostics.collective?.directIndex??directIndex)):0,shared=clamp(fiscal+macro+peer,-c.loss_limit,c.gain_limit),final={},byGroup={};for(const g of groups){const rebound=shared*g.collective_sensitivity;final[g.id]=clamp(values[g.id]+rebound,g.min??0,g.max??100);byGroup[g.id]={direct:values[g.id],sensitivity:g.collective_sensitivity,rebound,final:final[g.id]};}
 return {directIndex,finalIndex:mean(final),fiscal,macro,peer,shared,bySource,byGroup,final};
}
const api={collectiveHappiness,privateInvestmentAt,beneficiaryForce,privatePipeline,mobilisationPipeline,controlExposure,marketListings,fiscalIncidence,gdpExpenditure,purchaseCost,territorialShift,migrationCapacity,migrationPipeline,migrationConflicts,fundingScopeFraction,taxComponentForce,territoryAt,territoryPipeline,tourismForce,tourismConflicts,tourismPipeline,accessManagement,durationLabel,durationHappiness,taxBase,taxRate,taxForce,taxReceipts,taxConflicts,actionEnd,accessAt,publicStockAt,accessConflicts,amortization,annualRent,control,target,costs,existingUnitCost,fiscalConflicts,adminPipeline,existingAt,existingPipeline,existingConflicts,fiscalScale,constructionCostFactor,supplyAt,supplyPipeline,programmeConflicts};root.SIM_HOUSING_POLICY=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
