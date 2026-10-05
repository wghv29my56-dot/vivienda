/* Internal model format v1. No executable code in imports. Shared by editor/game/tests. */
(function(root){
'use strict';
const H=typeof module!=='undefined'&&module.exports?require('./housing-policy.js'):root.SIM_HOUSING_POLICY;
const clone=x=>JSON.parse(JSON.stringify(x)), KEY='vivienda.simulator.model.v1';
const slots=['landlords','investors','tenants','domestic_buyers','foreign_buyers','resident_owners'];
const coreVars=['gdp','population','rent_demand','buy_demand','tourists','tourist_homes'];
const defaults={max_measures_per_turn:5,maturation_turns:4,intensity_curve:2,price_effect_cap:25,happiness_effect_cap:20,risk_threshold:.75,risk_tenant_points:2,risk_investor_points:1,risk_rent_percent:1,supply_interaction:.5,aid_control_interaction:.5,spending_multiplier:.8,tenant_burden_points:10,buyer_burden_points:8,years_options:[5,10,15,20]};
// A source's direct effect applies only to the estimated exposed share of a
// collective. Shares are model assumptions, not disjoint population counts.
function fundingGroupEffects(source,groups){
 if(!source.incidence)return Object.fromEntries(groups.map(g=>[g.id,source.group_effects?.[g.id]??0]));
 const {exposure_key,direct_points,indirect_points}=source.incidence;
 return Object.fromEntries(groups.map(g=>[g.id,Math.round((direct_points*(g.funding_exposure?.[exposure_key]??0)+indirect_points*(g.funding_exposure?.resident??0))*100)/100||0]));
}
function syncFundingEffects(pack){for(const source of pack.model.funding_sources)if(source.incidence)source.group_effects=fundingGroupEffects(source,pack.model.groups);return pack;}
function fromCatalog(c){
 if(c.model_config)return clone(c.model_config);
 const m=clone(c);
 m.groups=c.group_ids.map((id,i)=>({id,name:c.groups[i],engine_slot:id,initial:c.initial_happiness[i],weight:c.weights[i],visible:true,min:0,max:100,note:c.group_audit[i].note,sources:c.group_audit[i].sources}));
 m.variables=c.national.indicators.map(i=>({...clone(i),id:i.key,initial:c.national.baseline[i.key],derive_from_households:['rent_demand','buy_demand'].includes(i.key),visible:true,min:0,max:null,annual_growth:0}));
 m.categories=Object.entries(c.categories).map(([id,name])=>({id,name}));
 m.sources=Object.entries(c.sources).map(([id,s])=>({id,...clone(s)}));
 m.competencies=[{id:'national',name:'Estatal',description:'Legislación y financiación estatal dentro de sus competencias.',sources:['law_housing']},{id:'regional',name:'Autonómica',description:'Vivienda, urbanismo y tributos cedidos según normativa autonómica.',sources:['law_housing']},{id:'local',name:'Local',description:'Planeamiento, licencias, suelo, gestión e impuestos locales.',sources:['local_tax']}];
 m.territories=[{id:'es_unallocated',name:'España · sin desglose territorial',type:'national',population_share:100,household_share:100,note:'El escenario actual es nacional. No se han inventado cifras municipales. Sustituye esta fila por territorios mutuamente excluyentes cuyas cuotas sumen 100.',sources:['population_observed']}];
 m.rules={...defaults};
 for(const measure of m.measures){
  measure.enabled=true;measure.intensity_min=.05;measure.intensity_max=1;measure.intensity_step=.05;
  measure.dependencies=[];measure.allowed_funding_sources=m.funding_sources.map(s=>s.id);
  measure.effects=[];
  const add=(type,id,amount,operation)=>{measure.effects.push({id:'effect_'+(measure.effects.length+1),target_type:type,target_id:id,amount,operation,delay_turns:measure.delay_turns,maturation_turns:4,duration_turns:measure.duration_turns,permanent:measure.permanent,min_value:null,max_value:null,requires:[]});};
  for(const [id,n] of Object.entries(measure.price))add('price',id,n,'percent');
  measure.happiness.forEach((n,i)=>add('group',slots[i],n,'points'));
  for(const [id,n] of Object.entries(measure.national_effects))if(coreVars.includes(id))add('variable',id,n*100,'percent');
  if(['a3_public_build','a3_ppp_build','a3_cooperative','a3_infill','a3_empty_rehab'].includes(measure.id))add('variable','available_homes',measure.cost_audit.quantity,'absolute');
  else if(measure.additional_homes_at_full>0)add('variable','available_homes',measure.additional_homes_at_full,'absolute');
  delete measure.price;delete measure.happiness;delete measure.national_effects;
 }
 m.variables.push({id:'available_homes',name:'Viviendas adicionales disponibles',unit:'viviendas',initial:0,visible:false,min:0,max:null,annual_growth:0,status:'Acumulación estimada por las medidas',definition:'Viviendas añadidas o movilizadas por los programas. No se suman compras de viviendas existentes.',sources:['bde_2025']});
 for(const f of m.funding_sources){f.group_effects=Object.fromEntries(slots.map((id,i)=>[id,f.happiness[i]]));delete f.happiness;}
 delete m.group_ids;delete m.weights;delete m.initial_happiness;delete m.group_audit;delete m.national;
 return {format:'vivienda-simulator-model',schema_version:1,comments:[],metadata:{id:'vivienda-realism',version:c.version,title:'Modelo nacional de vivienda',created_at:(c.audited_at||c.created||'2026-10-03')+'T00:00:00.000Z',notes:'Base auditada. Ediciones internas requieren revisión de evidencia.'},model:m};
}
function validate(pack){
 const errors=[],add=(path,message)=>errors.push({path,message}),finite=n=>typeof n==='number'&&Number.isFinite(n);
 if(!pack||typeof pack!=='object'||Array.isArray(pack))return [{path:'$',message:'Se esperaba un documento JSON del modelo.'}];
 if(pack.format!=='vivienda-simulator-model'||pack.schema_version!==1)return [{path:'schema_version',message:'Formato o versión de esquema no compatible (se requiere v1).'}];
 if(pack.comments!==undefined&&(!Array.isArray(pack.comments)||pack.comments.some(c=>!c||typeof c.id!=='string'||typeof c.text!=='string'||!c.text.trim()||!['pending','resolved'].includes(c.status)||!c.anchor)))add('comments','Comentarios incompletos: ID, texto, ubicación y estado obligatorios.');
 if(Array.isArray(pack.comments)&&new Set(pack.comments.map(c=>c?.id)).size!==pack.comments.length)add('comments','IDs de comentario duplicados.');
 if(!pack.metadata?.version||!pack.metadata?.id)add('metadata','Identificador y versión obligatorios.');
 const m=pack.model;if(!m||typeof m!=='object')return [...errors,{path:'model',message:'Falta el modelo.'}];
 const collections=['groups','variables','measures','categories','competencies','funding_sources','sources','territories'],sets={};
 for(const k of collections){
  if(!Array.isArray(m[k])){add(k,'Debe ser una lista.');continue;}
  if(m[k].length>1000)add(k,'Máximo 1.000 elementos por colección.');
  sets[k]=new Set();m[k].forEach((v,i)=>{const p=`${k}[${i}]`;if(!v||typeof v!=='object'||Array.isArray(v)){add(p,'Elemento no válido.');return;}
   if(typeof v.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v.id))add(p+'.id','ID obligatorio: letras, números, guion o guion bajo, comenzando por letra.');
   if(sets[k].has(v.id))add(p+'.id','ID duplicado: '+v.id);sets[k].add(v.id);
   if(k!=='sources'&&(!v.name||typeof v.name!=='string'))add(p+'.name','Nombre obligatorio.');
  });
 }
 if(collections.some(k=>!Array.isArray(m[k])))return errors;
 const refs=(ids,k,p)=>{if(!Array.isArray(ids)){add(p,'Debe ser una lista de IDs.');return;}for(const id of ids)if(!sets[k].has(id))add(p,'Referencia inexistente: '+id);};
 const number=(v,p,min=-Infinity,max=Infinity)=>{if(!finite(v)||v<min||v>max)add(p,`Número finito entre ${min} y ${max}.`);};
 const integer=(v,p,min=0,max=400)=>{number(v,p,min,max);if(!Number.isInteger(v))add(p,'Debe ser un entero.');};
 for(const k of collections)for(const v of m[k])if(v?.sources!==undefined)refs(v.sources,'sources',k+'.'+v.id+'.sources');
 for(const s of m.sources){try{const u=new URL(s.url);if(!['https:','http:'].includes(u.protocol))throw 0;}catch{add('sources.'+s.id+'.url','URL HTTP(S) válida obligatoria.');}if(!s.title)add('sources.'+s.id+'.title','Título obligatorio.');}
 const engineSlots=new Set();
 for(const g of m.groups){number(g.initial,'groups.'+g.id+'.initial',0,100);number(g.weight,'groups.'+g.id+'.weight',0,100);number(g.min,'groups.'+g.id+'.min',0,100);number(g.max,'groups.'+g.id+'.max',g.min,100);if(g.initial<g.min||g.initial>g.max)add('groups.'+g.id,'Valor inicial fuera de límites.');if(g.engine_slot){if(!slots.includes(g.engine_slot)||engineSlots.has(g.engine_slot))add('groups.'+g.id+'.engine_slot','Papel interno no válido o duplicado.');engineSlots.add(g.engine_slot);}}
 if(Math.abs(m.groups.reduce((n,g)=>n+(finite(g.weight)?g.weight:0),0)-100)>1e-6)add('groups','Los pesos de felicidad deben sumar 100 %.');
 for(const v of m.variables){number(v.initial,'variables.'+v.id+'.initial',0);number(v.annual_growth,'variables.'+v.id+'.annual_growth',-.99,1);if(v.min!==null&&v.min!==undefined)number(v.min,'variables.'+v.id+'.min');if(v.max!==null&&v.max!==undefined)number(v.max,'variables.'+v.id+'.max',v.min??-Infinity);if((v.min!=null&&v.initial<v.min)||(v.max!=null&&v.initial>v.max))add('variables.'+v.id,'Valor inicial fuera de límites.');if(!v.unit)add('variables.'+v.id+'.unit','Unidad obligatoria.');}
 for(const id of [...coreVars,'available_homes'])if(!sets.variables.has(id))add('variables','Falta variable necesaria para el motor nacional: '+id);
 for(const id of ['gdp','population','rent_demand','buy_demand','tourist_homes'])if(!(m.variables.find(v=>v.id===id)?.initial>0))add('variables.'+id,'Esta variable base debe ser positiva.');
 if(!m.scenario||!m.prices||!m.rules)return [...errors,{path:'model',message:'Faltan escenario, precios o reglas.'}];
 for(const key of ['rent','sale'])number(m.prices[key]?.value,'prices.'+key+'.value',.01);
 if(!m.territories.length)add('territories','Define al menos un territorio.');
 for(const field of ['population_share','household_share']){m.territories.forEach(t=>number(t[field],'territories.'+t.id+'.'+field,0,100));if(Math.abs(m.territories.reduce((n,t)=>n+(t[field]||0),0)-100)>1e-6)add('territories.'+field,'Las cuotas territoriales deben sumar 100 %. No mezclar ciudades con sus comunidades superpuestas.');}
 for(const measure of m.measures){
  const p='measures.'+measure.id;
  if(!['linear','saturating'].includes(measure.curve))add(p+'.curve','Curva lineal o saturating obligatoria.');
  if(!sets.categories.has(measure.category))add(p+'.category','Categoría inexistente.');
  if(!measure.mechanism)add(p+'.mechanism','Descripción obligatoria.');
  refs(measure.competencies,'competencies',p+'.competencies');if(!measure.competencies?.length)add(p+'.competencies','Selecciona al menos una competencia.');
  if(measure.competency_roles){for(const [id,role]of Object.entries(measure.competency_roles)){if(!measure.competencies.includes(id))add(p+'.competency_roles.'+id,'La función debe corresponder a una competencia de la medida.');if(!role.text||typeof role.text!=='string')add(p+'.competency_roles.'+id,'Explica la función de la administración.');refs(role.sources,'sources',p+'.competency_roles.'+id+'.sources');}for(const id of measure.competencies)if(!measure.competency_roles[id])add(p+'.competency_roles','Falta la función de '+id+'.');}
  refs(measure.dependencies,'measures',p+'.dependencies');refs(measure.regulation_sources||[],'sources',p+'.regulation_sources');if(measure.cost_audit)refs(measure.cost_audit.sources||[],'sources',p+'.cost_audit.sources');refs(measure.allowed_funding_sources,'funding_sources',p+'.allowed_funding_sources');
  if(measure.dependencies?.includes(measure.id))add(p+'.dependencies','Una medida no puede depender de sí misma.');
  number(measure.initial_cost,p+'.initial_cost',0);number(measure.quarterly_cost,p+'.quarterly_cost',0);
  for(const c of measure.tax_control?.components||[])if(c.demand_drop!==undefined)number(c.demand_drop,p+'.tax_control.demand_drop',0,1);
  if(measure.map_reference&&!['mapa_fiscalidad_mejorada.html','mapa_desarrollo_urbano.html'].includes(measure.map_reference.path))add(p+'.map_reference','Solo se admiten los dos mapas de la web.');
  if(measure.budget_control&&!['annual','quarter'].includes(measure.budget_control.period))add(p+'.budget_control','Indica presupuesto anual o trimestral.');
  if(measure.territory_program){const a=measure.territory_program,ap=p+'.territory_program';if(!['strategic','transport','digital'].includes(a.kind))add(ap+'.kind','Programa territorial desconocido.');integer(a.first_delivery_turn,ap+'.first_delivery_turn',1,80);integer(a.last_delivery_turn,ap+'.last_delivery_turn',a.first_delivery_turn,80);number(a.rent_share,ap+'.rent_share',0,1);integer(a.staff_at_full,ap+'.staff_at_full',0,100000);if(a.kind==='strategic'){number(a.max_homes,ap+'.max_homes',1);number(a.completion_share,ap+'.completion_share',0,1);}if(a.kind==='transport')number(a.max_households,ap+'.max_households',1);if(!a.note)add(ap+'.note','Explica presupuesto, plazos y alcance.');}
  for(const c of measure.tax_control?.components||[])if(c.protected_scope){number(c.scope_share,p+'.tax_control.scope_share',0,.9);const src=m.funding_sources.find(s=>s.id===c.source_id);if(!src||Math.abs(c.annual_base*c.base/100-src.annual_reference*c.scope_share)>.02)add(p+'.tax_control.scope_share','La base elegible debe concordar con la cuota de la recaudación nacional.');if(!measure.fiscal_links?.some(f=>f.control_component===c.id&&f.protected_scope===c.protected_scope))add(p+'.tax_control','La rebaja territorial necesita una pérdida fiscal y ámbito concordantes.');}
  for(const f of measure.fiscal_links||[])if(f.protected_scope&&!measure.tax_control?.components.some(c=>c.id===f.control_component&&c.protected_scope===f.protected_scope))add(p+'.fiscal_links','Ámbito protegido sin control fiscal asociado.');
  if(measure.term_control){const c=measure.term_control,cp=p+'.term_control';integer(c.min_turns,cp+'.min_turns',1,80);integer(c.max_turns,cp+'.max_turns',c.min_turns,80);integer(c.default_turns,cp+'.default_turns',c.min_turns,c.max_turns);if(c.max_turns!==measure.duration_turns||measure.permanent)add(cp,'El plazo máximo debe coincidir y la medida debe ser temporal.');}
  if(measure.tourism_program){const a=measure.tourism_program,ap=p+'.tourism_program';if(!['days','licenses','inspection','ban'].includes(a.kind))add(ap+'.kind','Control de turismo o demanda desconocido.');if(a.kind==='days'){integer(a.min_days,ap+'.min_days',1,365);integer(a.max_days,ap+'.max_days',a.min_days+1,365);number(a.mild_fraction,ap+'.mild_fraction',0,.1);number(a.curve,ap+'.curve',1,5);for(const k of ['withdrawal_share','residential_share','rent_share'])number(a[k],ap+'.'+k,0,1);integer(a.first_turn,ap+'.first_turn',1);integer(a.last_turn,ap+'.last_turn',a.first_turn,measure.duration_turns);}if(a.kind==='licenses'){number(a.annual_new,ap+'.annual_new',1);number(a.license_step,ap+'.license_step',1,a.annual_new);if(a.annual_new!==m.scenario.tourism?.annual_new_homes)add(ap,'La referencia debe coincidir con las incorporaciones del escenario.');}if(a.kind==='inspection'){integer(a.min_inspectors,ap+'.min_inspectors',1);integer(a.max_inspectors,ap+'.max_inspectors',a.min_inspectors,100000);integer(a.inspector_step,ap+'.inspector_step',1,a.max_inspectors);number(a.pool_homes,ap+'.pool_homes',1);number(a.cases_per_inspector_year,ap+'.cases_per_inspector_year',1);number(a.success_share,ap+'.success_share',0,1);number(a.rent_share,ap+'.rent_share',0,1);integer(a.setup_turns,ap+'.setup_turns',0);integer(a.ramp_turns,ap+'.ramp_turns',1);}if(!a.note)add(ap+'.note','Explica los datos y los criterios del programa.');}
  if(measure.temporal_control){const c=measure.temporal_control,cp=p+'.temporal_control';integer(c.min_turns,cp+'.min_turns',1,12);integer(c.max_turns,cp+'.max_turns',c.min_turns,12);integer(c.default_turns,cp+'.default_turns',c.min_turns,c.max_turns);if(c.max_turns!==measure.duration_turns||measure.permanent)add(cp,'La duración máxima debe coincidir y la medida debe ser temporal.');if(typeof c.cancellable!=='boolean')add(cp+'.cancellable','Indica si se permite cancelar.');}
  if(measure.temporal_control?.happiness){const h=measure.temporal_control.happiness,c=measure.temporal_control,hp=p+'.temporal_control.happiness';integer(h.reference_turns,hp+'.reference_turns',c.min_turns+1,c.max_turns-1);number(h.short_factor,hp+'.short_factor',0,1);number(h.long_factor,hp+'.long_factor',1,10);}
  if(measure.access_program?.management){const g=measure.access_program.management,gp=p+'.access_program.management';number(g.max,gp+'.max',1,10);number(g.default,gp+'.default',0,g.max);number(g.capacity_floor,gp+'.capacity_floor',0,1);number(g.speed_floor,gp+'.speed_floor',.1,1);number(g.speed_ceiling,gp+'.speed_ceiling',1,5);for(const k of ['extra_setup_unit','extra_quarter_unit'])number(g[k],gp+'.'+k,0);if(!g.note)add(gp+'.note','Explica el coste y la eficacia de gestión.');}
  if(measure.access_program){const a=measure.access_program,ap=p+'.access_program';if(!['rent_aid','housing_first','legal_aid','guarantee','interest_relief','public_sale','moratorium'].includes(a.kind))add(ap+'.kind','Programa de acceso desconocido.');for(const k of ['max_beneficiaries','setup_unit','quarter_admin_unit','quarter_benefit_unit','observed_reach'])number(a[k],ap+'.'+k,k==='max_beneficiaries'?1:0);integer(a.first_delivery_turn,ap+'.first_delivery_turn',1,80);integer(a.last_delivery_turn,ap+'.last_delivery_turn',a.first_delivery_turn,80);if(a.last_delivery_turn>measure.duration_turns)add(ap,'Las entregas exceden la duración.');number(a.rental_withdrawal,ap+'.rental_withdrawal',0,1);for(const k of ['initial_gdp_share','quarter_gdp_share'])if(a[k]!==undefined)number(a[k],ap+'.'+k,0,1);if(a.kind==='guarantee'||a.kind==='public_sale'){number(a.reference_price_per_m2,ap+'.reference_price_per_m2',1);number(a.area,ap+'.area',1);for(const k of (a.kind==='guarantee'?['loan_share','guarantee_share','loss_reserve']:['discount']))number(a[k],ap+'.'+k,0,1);}if(a.kind==='public_sale'&&!sets.variables.has('public_rental_stock'))add(ap,'Falta el parque público de alquiler.');if(!a.reference_note||!a.range_note)add(ap,'Explica la referencia observada y el máximo hipotético.');}
  if(measure.existing_program){const a=measure.existing_program,ap=p+'.existing_program';if(!['purchase','rehab'].includes(a.kind))add(ap,'Programa de vivienda existente desconocido.');for(const k of ['area','reference_homes'])number(a[k],ap+'.'+k,1);for(const k of ['max_sale_share','completion_rate','rent_fraction','occupancy_rate'])number(a[k],ap+'.'+k,0,1);for(const k of ['setup_unit','annual_operating','rehab_unit','transaction_overhead','reference_price_per_m2'])number(a[k],ap+'.'+k,0);if(a.acquisition_gdp_share!==undefined)number(a.acquisition_gdp_share,ap+'.acquisition_gdp_share',0,1);if(a.acquisition_mode!==undefined&&!['voluntary','expropriation'].includes(a.acquisition_mode))add(ap+'.acquisition_mode','Modo de adquisición desconocido.');if(a.compensation_premium!==undefined)number(a.compensation_premium,ap+'.compensation_premium',0,1);if(a.acquisition_mode==='expropriation'&&(a.kind!=='purchase'||a.compensation_premium===undefined))add(ap,'La expropiación exige adquisición y premio de afección explícito.');integer(a.first_delivery_turn,ap+'.first_delivery_turn',1,80);integer(a.last_delivery_turn,ap+'.last_delivery_turn',a.first_delivery_turn,80);if(a.last_delivery_turn>measure.duration_turns)add(ap,'El programa debe cubrir las entregas.');}
  if(measure.quantity_control){number(measure.quantity_control.max,p+'.quantity_control.max',.01);if(!measure.quantity_control.unit||!measure.quantity_control.label)add(p+'.quantity_control','Unidad y etiqueta obligatorias.');}
  if(measure.supply_program){const s=measure.supply_program,sp=p+'.supply_program';if(!['land','housing'].includes(s.kind))add(sp,'Tipo de programa inválido.');number(s.max_homes,sp+'.max_homes',1);number(s.lifetime_homes,sp+'.lifetime_homes',s.max_homes);integer(s.first_delivery_turn,sp+'.first_delivery_turn',1,80);integer(s.last_delivery_turn,sp+'.last_delivery_turn',s.first_delivery_turn,80);integer(s.build_after_land_turns,sp+'.build_after_land_turns',0,80);for(const k of ['completion_rate','rental_share'])number(s[k],sp+'.'+k,0,1);if(s.regularisation){for(const k of ['market_share','mortgage_eligible_share','listing_share'])number(s.regularisation[k],sp+'.regularisation.'+k,0,1);if(s.kind!=='housing')add(sp+'.regularisation','La regularización actúa sobre viviendas existentes.');}if(measure.duration_turns<s.last_delivery_turn)add(sp,'La financiación debe cubrir la ejecución del programa.');}
  if(measure.cost_reduction){const r=measure.cost_reduction;number(r.max_percent,p+'.cost_reduction.max_percent',0,15);integer(r.delay_turns,p+'.cost_reduction.delay_turns',0,80);integer(r.ramp_turns,p+'.cost_reduction.ramp_turns',1,80);if(r.tax_weight!==undefined)number(r.tax_weight,p+'.cost_reduction.tax_weight',0,1);}
  if(measure.tax_control){const c=measure.tax_control,cp=p+'.tax_control';if(!Array.isArray(c.components)||!c.components.length)add(cp,'Añade componentes tributarios.');else {if(new Set(c.components.map(x=>x.id)).size!==c.components.length)add(cp,'IDs de tipo duplicados.');for(const r of c.components){if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(r.id)||!r.name||!r.note)add(cp,'ID, nombre y criterio obligatorios.');if(!['cut','surcharge','land_rate'].includes(r.mode))add(cp,'Modalidad tributaria desconocida.');number(r.min,cp+'.min',0,100);number(r.max,cp+'.max',r.min,100);number(r.base,cp+'.base',r.min,r.max);number(r.step,cp+'.step',.001,100);number(r.weight,cp+'.weight',.001);number(r.annual_base,cp+'.annual_base',0);number(r.collection_rate,cp+'.collection_rate',0,1);if(r.source_id!=null&&!sets.funding_sources.has(r.source_id))add(cp,'Fuente tributaria inexistente.');if(r.mode==='cut'&&!(r.base>r.min))add(cp,'La rebaja necesita un tipo base superior al mínimo.');if(r.mode!=='cut'&&r.max<=r.base)add(cp,'El recargo necesita un máximo superior al tipo inicial.');if(r.mode==='cut'){const links=(measure.fiscal_links||[]).filter(f=>f.control_component===r.id);if(links.length!==1||links[0].source_id!==r.source_id||Math.abs(links[0].quarterly_loss-r.annual_base*(r.base-r.min)/100/4)>.01)add(cp,'La pérdida fiscal debe coincidir con la base y la rebaja del componente.');}if(r.carriers){if(!Array.isArray(r.carriers)||!r.carriers.length||!r.carriers.some(x=>x.id===c.default_carrier))add(cp,'Impuesto receptor predeterminado inexistente.');else for(const x of r.carriers){number(x.annual_base,cp+'.carrier.annual_base',0);if(!sets.funding_sources.has(x.source_id)||!x.name)add(cp,'Impuesto receptor inválido.');}}}}
   if(measure.curve!=='linear')add(cp,'Los efectos tributarios usan escala lineal.');
  }
  if(measure.tax_support){number(measure.tax_support.max_annual,p+'.tax_support.max_annual',1);number(measure.tax_support.default,p+'.tax_support.default',0,1);number(measure.tax_support.step,p+'.tax_support.step',.001,1);if(measure.tax_support.rate_control){const c=measure.tax_support.rate_control;number(c.base,p+'.tax_support.rate_control.base',.001,100);number(c.min,p+'.tax_support.rate_control.min',0,c.base-.001);number(c.step,p+'.tax_support.rate_control.step',.001,c.base-c.min);if(!c.name||!c.note)add(p+'.tax_support.rate_control','Etiqueta y criterio obligatorios.');}}
  if(measure.admin_program){const a=measure.admin_program,ap=p+'.admin_program';
   for(const k of ['staff_at_full','annual_cost_per_staff','homes_per_staff_year'])number(a[k],ap+'.'+k,.01);
   number(a.setup_cost_per_staff,ap+'.setup_cost_per_staff',0);
   for(const k of ['completion_rate','rejection_rate','rental_share'])number(a[k],ap+'.'+k,0,1);
   for(const k of ['setup_turns','build_turns'])integer(a[k],ap+'.'+k,0,80);
   integer(a.ramp_turns,ap+'.ramp_turns',1,80);
   if(a.setup_turns>=measure.duration_turns)add(ap,'El programa termina antes de comenzar la tramitación.');
   if(Math.abs(measure.quarterly_cost-a.staff_at_full*a.annual_cost_per_staff/4)>.01||Math.abs(measure.initial_cost-a.staff_at_full*a.setup_cost_per_staff)>.01)add(ap,'El coste debe coincidir con la plantilla y los costes unitarios.');
   if(!m.rules.administration)add(ap,'Faltan los límites compartidos de tramitación.');
  }
  if(measure.price_control){const c=measure.price_control,cp=p+'.price_control';
   if(!['freeze','index','reduction','amortization','sale'].includes(c.mode))add(cp+'.mode','Modalidad de control desconocida.');
   for(const k of ['coverage','default_enforcement','compliance_floor','compliance_ceiling','withdrawal_at_full'])number(c[k],cp+'.'+k,0,1);
   if(c.compliance_ceiling<c.compliance_floor)add(cp,'El cumplimiento máximo no puede ser menor que el mínimo.');
   number(c.max_reduction,cp+'.max_reduction',0,90);number(c.annual_limit_max,cp+'.annual_limit_max',0,20);
   if(c.basis!==undefined&&!['cost_margin','indexed_resale','market_discount'].includes(c.basis))add(cp+'.basis','Base de tope desconocida.');
   if(c.basis==='cost_margin'){number(c.reference_cost_per_m2,cp+'.reference_cost_per_m2',1);number(c.margin_max,cp+'.margin_max',0,100);number(c.cost_growth,cp+'.cost_growth',0,1);}
   if(c.basis==='indexed_resale')number(c.resale_growth,cp+'.resale_growth',0,1);
   if(c.mode==='amortization'){const b=c.amortization;
    if(!b||!Array.isArray(b.assets)||!b.assets.length)add(cp+'.amortization','Falta la vivienda de referencia.');
    else {number(b.area,cp+'.amortization.area',1);number(b.inflation_factor,cp+'.amortization.inflation_factor',.01);number(b.residual_rate,cp+'.amortization.residual_rate',0,1);number(b.return_rate,cp+'.amortization.return_rate',0,100);number(b.future_inflation,cp+'.amortization.future_inflation',-.99,1);integer(b.year,cp+'.amortization.year',1900,2200);for(const a of b.assets){number(a.amount,cp+'.amortization.assets.amount',0);number(a.life,cp+'.amortization.assets.life',1);number(a.start,cp+'.amortization.assets.start',1900,2200);}}
   }
  }
  if(measure.fiscal_links!==undefined){
   if(!Array.isArray(measure.fiscal_links))add(p+'.fiscal_links','Lista de beneficios fiscales obligatoria.');
   else for(const link of measure.fiscal_links){if(!link.tax_name)add(p+'.fiscal_links','Nombre de impuesto obligatorio.');if(link.source_id!=null&&!sets.funding_sources.has(link.source_id))add(p+'.fiscal_links','Fuente fiscal inexistente.');number(link.quarterly_loss,p+'.fiscal_links.quarterly_loss',0);if(link.control_component&&!measure.tax_control?.components.some(c=>c.id===link.control_component&&c.mode==='cut'))add(p+'.fiscal_links','Componente de rebaja inexistente.');}
  }
  if(measure.migration_program){const c=measure.migration_program;for(const k of ['annual_capacity','unit_cost','eligible_pool'])number(c[k],p+'.migration_program.'+k,1);for(const k of ['gdp_per_resident','rental_extra_multiplier'])number(c[k],p+'.migration_program.'+k,0,10);if(!['removal','regularise','permits','seasonal','relocation','return','reception','construction'].includes(c.kind))add(p+'.migration_program.kind','Tipo de programa no válido.');if(!measure.migration_flows||!measure.budget_control)add(p+'.migration_program','Faltan flujos o selector presupuestario.');if(c.bonus){const b=c.bonus;for(const k of ['min','max','default'])number(b[k],p+'.migration_program.bonus.'+k,0,100000);number(b.step,p+'.migration_program.bonus.step',1,100000);number(b.participation_floor,p+'.migration_program.bonus.participation_floor',0,1);if(b.min>b.default||b.default>b.max||b.max<=b.min||(b.default-b.min)%b.step||(b.max-b.min)%b.step)add(p+'.migration_program.bonus','Intervalo o pasos de bonificación incoherentes.');}}
  if(measure.migration_flows){number(measure.migration_flows.immigration_per_year,p+'.migration_flows.immigration_per_year',-5000000,5000000);number(measure.migration_flows.emigration_per_year,p+'.migration_flows.emigration_per_year',-5000000,5000000);integer(measure.migration_flows.maturation_turns,p+'.migration_flows.maturation_turns');}
  if(measure.additional_homes_at_full!==undefined)number(measure.additional_homes_at_full,p+'.additional_homes_at_full',0);
  if(measure.initial_cost+measure.quarterly_cost>0&&!measure.allowed_funding_sources?.length)add(p+'.allowed_funding_sources','Una medida con gasto necesita financiación elegible.');
  if(measure.cost_breakdown?.annual_maintenance_per_home>0&&measure.quarterly_cost===0)add(p+'.quarterly_cost','El mantenimiento posterior necesita financiación trimestral de referencia.');
  integer(measure.duration_turns,p+'.duration_turns',1);integer(measure.delay_turns,p+'.delay_turns');
  number(measure.intensity_min,p+'.intensity_min',0,1);number(measure.intensity_max,p+'.intensity_max',measure.intensity_min,1);number(measure.intensity_step,p+'.intensity_step',.001,measure.intensity_max-measure.intensity_min);
  if(measure.intensity_min===measure.intensity_max)add(p+'.intensity_max','El máximo debe superar el mínimo.');
  for(const k of ['pros','cons'])if(!Array.isArray(measure[k])||!measure[k].length||measure[k].some(s=>typeof s!=='string'||!s.trim()))add(p+'.'+k,'Añade al menos una consecuencia pública.');
  if(!Array.isArray(measure.effects)){add(p+'.effects','Falta lista de efectos.');continue;}
  if(new Set(measure.effects.map(e=>e.id)).size!==measure.effects.length||measure.effects.some(e=>!e.id))add(p+'.effects','Cada efecto necesita ID único dentro de su medida.');
  for(const [i,e] of measure.effects.entries()){
   const ep=p+'.effects['+i+']',targets={price:new Set(['rent','sale','free_rent']),group:sets.groups,variable:sets.variables};
   if(!targets[e.target_type]?.has(e.target_id))add(ep+'.target_id','Efecto huérfano: destino inexistente.');
   if(!['percent','points','absolute'].includes(e.operation))add(ep+'.operation','Operación no compatible.');
   if(e.target_type==='variable'&&!['percent','absolute'].includes(e.operation))add(ep+'.operation','Las variables admiten porcentaje o unidades absolutas.');
   if(e.target_type==='group'&&e.operation!=='points')add(ep+'.operation','Felicidad se expresa en puntos.');
   if(e.target_type==='price'&&e.operation!=='percent')add(ep+'.operation','Los precios usan variación porcentual.');
   if(e.target_type==='variable'&&coreVars.includes(e.target_id)&&e.operation!=='percent')add(ep+'.operation','Las variables estructurales usan variación porcentual; las nuevas admiten valores absolutos.');
   if(e.on_registration&&!measure.supply_program?.regularisation)add(ep+'.on_registration','Falta el programa de regularización.');
   if(e.tax_component&&!measure.tax_control?.components.some(c=>c.id===e.tax_component))add(ep+'.tax_component','Componente fiscal inexistente.');
   if(e.on_territory&&!measure.territory_program)add(ep+'.on_territory','Falta el programa territorial.');
   if(e.on_access&&!measure.access_program)add(ep+'.on_access','Falta el programa de beneficiarios.');
  if(e.on_existing&&!measure.existing_program)add(ep+'.on_existing','Falta el programa de vivienda existente que aporta las entregas.');
   number(e.amount,ep+'.amount',-1e15,1e15);integer(e.delay_turns,ep+'.delay_turns');integer(e.maturation_turns,ep+'.maturation_turns',0);integer(e.duration_turns,ep+'.duration_turns',1);
   if(!e.permanent&&e.delay_turns>=e.duration_turns)add(ep+'.duration_turns','El efecto caduca antes de empezar.');
   if(e.min_value!=null)number(e.min_value,ep+'.min_value');if(e.max_value!=null)number(e.max_value,ep+'.max_value',e.min_value??-Infinity);
   if(e.target_type==='variable'&&coreVars.includes(e.target_id)&&e.max_value!=null&&e.max_value<=0)add(ep+'.max_value','Las variables estructurales deben permanecer positivas.');
   if(e.target_type==='price'&&e.max_value!=null&&e.max_value<=0)add(ep+'.max_value','El precio debe permanecer positivo.');
   if(e.target_type==='group'&&((e.min_value!=null&&e.min_value<0)||(e.max_value!=null&&e.max_value>100)))add(ep,'Los límites de felicidad deben estar entre 0 y 100.');
   refs(e.requires,'measures',ep+'.requires');
  }
 }
 const visiting=new Set(),done=new Set(),byId=new Map(m.measures.map(x=>[x.id,x]));
 function visit(id){if(visiting.has(id)){add('measures.'+id+'.dependencies','Dependencias circulares.');return;}if(done.has(id))return;visiting.add(id);const x=byId.get(id);for(const dep of [...(x?.dependencies||[]),...(x?.effects||[]).flatMap(e=>e.requires||[])])if(byId.has(dep))visit(dep);visiting.delete(id);done.add(id);}
 m.measures.forEach(x=>visit(x.id));
 for(const f of m.funding_sources){const p='funding_sources.'+f.id;number(f.annual_reference,p+'.annual_reference',1);number(f.response,p+'.response',.001,1);number(f.max_adjustment,p+'.max_adjustment',.0001,1);number(f.sandbox_share,p+'.sandbox_share',.0001,1);if(!['spending_cut','tax_increase','public_debt'].includes(f.kind))add(p+'.kind','Tipo de financiación no válido.');for(const id of Object.keys(f.group_effects||{}))if(!sets.groups.has(id))add(p+'.group_effects','Colectivo inexistente: '+id);if(f.incidence){const i=f.incidence;if(!i.exposure_key||!/^[a-z][a-z0-9_]*$/.test(i.exposure_key))add(p+'.incidence.exposure_key','Clave de exposición no válida.');number(i.direct_points,p+'.incidence.direct_points',-30,0);number(i.indirect_points,p+'.incidence.indirect_points',-30,0);for(const g of m.groups){for(const key of [i.exposure_key,'resident'])number(g.funding_exposure?.[key],'groups.'+g.id+'.funding_exposure.'+key,0,1);}if(m.groups.some(g=>f.group_effects?.[g.id]!==fundingGroupEffects(f,m.groups)[g.id]))add(p+'.group_effects','Los efectos calculados no coinciden con las cuotas de exposición; vuelve a guardarlos desde el panel.');}if(f.fiscal_control){const c=f.fiscal_control;number(c.base,p+'.fiscal_control.base',.0001);number(c.min,p+'.fiscal_control.min',0,c.base);number(c.max,p+'.fiscal_control.max',c.base);number(c.step,p+'.fiscal_control.step',.00001);if(!c.unit||!c.label)add(p+'.fiscal_control','Unidad y etiqueta obligatorias.');}if(f.tax_mode==='general_vat'){number(f.annual_tax_base,p+'.annual_tax_base',1);number(f.baseline_rate,p+'.baseline_rate',0,100);number(f.max_rate,p+'.max_rate',f.baseline_rate+.01,100);}}
 integer(m.rules.max_measures_per_turn,'rules.max_measures_per_turn',1,50);number(m.rules.intensity_curve,'rules.intensity_curve',.001,20);
 if(m.rules.administration){const a=m.rules.administration;for(const k of ['backlog_homes','max_extra_permits_per_year'])number(a[k],'rules.administration.'+k,1);integer(a.listing_turns,'rules.administration.listing_turns',1,80);number(a.listing_share,'rules.administration.listing_share',0,1);}
 if(m.rules.public_debt){const c=m.rules.public_debt;number(c.annual_rate,'rules.public_debt.annual_rate',0,.2);integer(c.reduction_delay_turns,'rules.public_debt.reduction_delay_turns',1,1);integer(c.repayment_turns,'rules.public_debt.repayment_turns',4,80);number(c.baseline_annual_interest,'rules.public_debt.baseline_annual_interest',0);}
 for(const k of ['price_effect_cap','happiness_effect_cap'])number(m.rules[k],'rules.'+k,.01,100);
 number(m.rules.risk_threshold,'rules.risk_threshold',0,.99);
 if(!Array.isArray(m.rules.years_options)||!m.rules.years_options.length||m.rules.years_options.some(y=>!Number.isInteger(y)||y<1||y>20))add('rules.years_options','Horizontes enteros entre 1 y 20 años.');
 for(const [section,keys] of Object.entries({behavior:'gdp_effect_min gdp_effect_max population_effect_min population_effect_max tourist_effect_min tourist_effect_max tourist_home_effect_min tourist_home_effect_max demand_effect_min demand_effect_max rent_demand_sale_response rent_demand_price_response rent_demand_income_response buy_demand_price_response buy_demand_income_response rent_price_demand_response rent_price_tourism_response sale_price_demand_response price_feedback_min price_feedback_max',listing_behavior:'rent_demand_response rent_tourism_response rent_price_response sale_demand_response sale_price_response rent_min rent_max sale_min sale_max'})){
 for(const key of keys.split(' '))number(m.scenario[section]?.[key],'scenario.'+section+'.'+key);
 for(const key of keys.split(' ').filter(k=>k.endsWith('_min')))if(m.scenario[section]?.[key]>m.scenario[section]?.[key.replace('_min','_max')])add('scenario.'+section+'.'+key,'El mínimo supera el máximo.');
 }
 if(m.report_settings){integer(m.report_settings.quarterly_window,'report_settings.quarterly_window',1,80);for(const k of ['quarterly_colors','final_colors'])if(!Array.isArray(m.report_settings[k])||m.report_settings[k].length!==3||m.report_settings[k].some(c=>!/^#[0-9a-f]{6}$/i.test(c)))add('report_settings.'+k,'Tres colores hexadecimales obligatorios.');}
 if(m.turn_comments){if(!Array.isArray(m.turn_comments)||m.turn_comments.some(t=>!t.id||!t.variable||!['up','down','flat'].includes(t.trend)||typeof t.text!=='string'))add('turn_comments','Comentarios narrativos incompletos.');else if(new Set(m.turn_comments.map(t=>t.id)).size!==m.turn_comments.length)add('turn_comments','IDs narrativos duplicados.');}
 integer(m.scenario.start_year,'scenario.start_year',2027,2027);
 for(let y=2027;y<=2047;y++){const row=m.scenario.demography?.[y];if(!row){add('scenario.demography.'+y,'Falta año de la senda.');continue;}number(row.population,'scenario.demography.'+y+'.population',1);if(y<2047)for(const k of ['births','deaths','immigration','emigration'])number(row[k],'scenario.demography.'+y+'.'+k,0);}
 for(const k of ['spending_multiplier','tenant_burden_points','buyer_burden_points','risk_tenant_points','risk_investor_points','risk_rent_percent','supply_interaction','aid_control_interaction'])number(m.rules[k],'rules.'+k,0,100);
 integer(m.rules.maturation_turns,'rules.maturation_turns',1,100);
 for(const k of ['annual_completions','households_at_start'])number(m.scenario[k],'scenario.'+k,0);
 for(const k of ['price_shortage_elasticity','income_price_elasticity'])number(m.scenario[k],'scenario.'+k,0,20);
 if(m.scenario.tourism){const c=m.scenario.tourism;number(c.annual_new_homes,'scenario.tourism.annual_new_homes',0,100000);for(const k of ['prevented_residential_share','rent_share','rent_listing_share','sale_listing_share','initial_listing_share'])number(c[k],'scenario.tourism.'+k,0,1);if(!c.note)add('scenario.tourism.note','Explica la referencia de incorporaciones.');}
 for(const k of ['real_gdp_growth','gdp_deflator','tourists_growth','tourist_homes_growth'])number(m.scenario.extrapolation?.[k],'scenario.extrapolation.'+k,-.99,1);
 for(const y of [2026,2031,2036,2041])number(m.scenario.household_anchors?.[y],'scenario.household_anchors.'+y,1);
 for(const k of ['rent_search_share','buy_search_share','rental_listing_turnover','sale_listing_turnover'])number(m.scenario[k],'scenario.'+k,0,1);
 if(!m.scenario.household_anchors?.[2041])add('scenario.household_anchors','Falta ancla 2041.');
 if(Math.abs(Object.values(m.scenario.tenure_percent||{}).reduce((n,v)=>n+v,0)-100)>1e-6)add('scenario.tenure_percent','La distribución de tenencia debe sumar 100 %.');
 if(m.measures.some(x=>x.migration_program))number(m.scenario.migration_programs?.departure_pool,'scenario.migration_programs.departure_pool',1,5000000);
 if(m.profiles!==undefined){if(!Array.isArray(m.profiles))add('profiles','Debe ser una lista.');else{const ids=new Set();for(const profile of m.profiles){if(!profile.id||!profile.name||ids.has(profile.id))add('profiles','ID y nombre únicos obligatorios.');ids.add(profile.id);refs(profile.sources||[],'sources','profiles.'+profile.id+'.sources');}for(const g of m.groups)for(const [id,value]of Object.entries(g.profiles||{})){if(!ids.has(id))add('groups.'+g.id+'.profiles','Perfil inexistente: '+id);number(value,'groups.'+g.id+'.profiles.'+id,0,1);}for(const measure of m.measures)for(const e of measure.effects){if(e.profile_id&&!ids.has(e.profile_id))add('measures.'+measure.id+'.effects','Perfil inexistente.');if(e.profile_id)number(e.profile_reference,'effects.profile_reference',.001,1);}}}
 if(m.rules.collective_happiness){const c=m.rules.collective_happiness;integer(c.version,'rules.collective_happiness.version',1,1);refs(c.excluded_groups,'groups','rules.collective_happiness.excluded_groups');for(const k of ['peer_feedback','gdp_total_weight','budget_linear_share','tax_linear_share'])number(c[k],'rules.collective_happiness.'+k,0,1);for(const k of ['loss_limit','gain_limit','gdp_loss_points','gdp_gain_points'])number(c[k],'rules.collective_happiness.'+k,0,100);for(const k of ['gdp_loss_scale','gdp_gain_scale'])number(c[k],'rules.collective_happiness.'+k,.001,1);for(const g of m.groups){number(g.collective_sensitivity,'groups.'+g.id+'.collective_sensitivity',0,1);if(c.excluded_groups.includes(g.id)&&g.weight!==0)add('groups.'+g.id+'.weight','Colectivo excluido: peso cero.');else if(!c.excluded_groups.includes(g.id)&&g.weight<=0)add('groups.'+g.id+'.weight','Cada colectivo nacional debe tener peso positivo.');}for(const source of m.funding_sources)for(const k of ['collective_loss_at_full','collective_gain_at_full'])number(source.fiscal_response?.[k],'funding_sources.'+source.id+'.fiscal_response.'+k,0,100);}
 if(m.rules.coherence){const c=m.rules.coherence;integer(c.version,'rules.coherence.version',1,1);for(const [key,value]of Object.entries(c))if(key!=='version'&&key!=='note')number(value,'rules.coherence.'+key,0,1e7);for(const key of ['new_completion_rent_share','regional_origin_share','purchase_resale_share','admin_expectations_share'])number(c[key],'rules.coherence.'+key,0,1);if(c.regional_origin_share===0||c.regional_origin_share===1)add('rules.coherence.regional_origin_share','Se necesitan dos mercados territoriales no vacíos.');}
 for(const g of m.groups){if(g.income_reference!==undefined)number(g.income_reference,'groups.'+g.id+'.income_reference',1);if(g.reference_households!==undefined)number(g.reference_households,'groups.'+g.id+'.reference_households',1);}
 for(const source of m.funding_sources)if(source.fiscal_response){const f=source.fiscal_response;for(const key of ['income_reference','cash_sensitivity','service_sensitivity','political_points'])number(f[key],'funding_sources.'+source.id+'.fiscal_response.'+key,0,1e7);number(f.affected_household_share,'fiscal_response.affected_household_share',.001,1);}
 for(const measure of m.measures){const p='measures.'+measure.id;
  if(measure.supply_program?.private_capital_at_full!==undefined){const a=measure.supply_program;number(a.private_capital_at_full,p+'.private_capital_at_full',0);number(a.private_capital_per_home,p+'.private_capital_per_home',1);number(a.private_finance_share,p+'.private_finance_share',0,1);}
  if(measure.admin_program?.reference_output_homes!==undefined)number(measure.admin_program.reference_output_homes,p+'.reference_output_homes',1);
  for(const id of measure.fiscal_benefit_targets||[])if(!m.groups.some(g=>g.id===id))add(p+'.fiscal_benefit_targets','Colectivo inexistente: '+id);
  if(measure.market_program){const a=measure.market_program;if(!['mobilisation','private_build'].includes(a.kind))add(p+'.market_program','Canal de oferta desconocido.');for(const k of ['max_homes','eligible_pool'])number(a[k],p+'.market_program.'+k,1,1e7);for(const k of ['rent_share','retention'])number(a[k],p+'.market_program.'+k,0,1);integer(a.first_delivery_turn,p+'.market_program.first_delivery_turn',1,80);integer(a.last_delivery_turn,p+'.market_program.last_delivery_turn',a.first_delivery_turn,80);if(!a.pool_key||!a.note)add(p+'.market_program','Bolsa y criterio obligatorios.');}
  if(measure.insurance_program){const a=measure.insurance_program;for(const k of ['max_contracts','area','baseline_rent','reserve_months','setup_unit','annual_admin_unit'])number(a[k],p+'.insurance_program.'+k,0,1e7);for(const k of ['annual_claim_rate','claims_consumption_share'])number(a[k],p+'.insurance_program.'+k,0,1);}
  if(measure.territory_program?.private_capital_at_full!==undefined){const a=measure.territory_program;number(a.private_capital_at_full,p+'.private_capital_at_full',0);number(a.private_capital_per_home,p+'.private_capital_per_home',1);number(a.private_finance_share,p+'.private_finance_share',0,1);}
  if(measure.existing_program?.commitment_turns!==undefined){integer(measure.existing_program.commitment_turns,p+'.commitment_turns',1,80);number(measure.existing_program.retention_after_commitment,p+'.retention_after_commitment',0,1);if(measure.existing_program.affordability_required!==true)add(p,'La renta asequible debe ser condición expresa.');}
  if(measure.migration_program?.beneficiary_reference!==undefined)number(measure.migration_program.beneficiary_reference,p+'.beneficiary_reference',1,1e7);
  for(const e of measure.effects){if(e.on_beneficiaries&&!measure.migration_program)add(p+'.effects','Falta programa de beneficiarios.');if(e.on_admin_output&&!measure.admin_program)add(p+'.effects','Falta programa administrativo.');}
 }
 // Reject non-finite, unsafe keys and unsupported values even in extension fields.
 function scan(v,path){if(typeof v==='number'&&!finite(v))add(path,'Número no finito.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))add(path,'Clave de objeto no admitida.');scan(x,path+'.'+k);}}
 scan(pack,'$');return errors;
}
function toCatalog(pack){
 const issues=validate(pack);if(issues.length)throw new Error(issues.map(e=>e.path+': '+e.message).join('\n'));
 const m=clone(pack.model);
 for(const v of m.variables)if(v.derive_from_households){const shares=m.scenario.tenure_percent,share=v.id==='rent_demand'?(shares.rent_market+shares.rent_reduced)/100:(shares.owner_no_mortgage+shares.owner_mortgage)/100,search=v.id==='rent_demand'?m.scenario.rent_search_share:m.scenario.buy_search_share;v.initial=Math.round(m.scenario.households_at_start*share*search);}
 const d=clone(m),gs=slots.map(id=>m.groups.find(g=>g.engine_slot===id));
 d.version=pack.metadata.version;d.groups=gs.map(g=>g?.name||'Colectivo desactivado');d.group_ids=slots;d.initial_happiness=gs.map(g=>g?.initial??50);d.weights=gs.map(g=>g?.weight||0);
 d.group_audit=gs.map(g=>({name:g?.name||'Colectivo desactivado',initial_happiness:g?.initial??50,note:g?.note||'',sources:g?.sources||[]}));
 d.categories=Object.fromEntries(m.categories.map(c=>[c.id,c.name]));d.sources=Object.fromEntries(m.sources.map(s=>[s.id,s]));
 d.national={baseline:Object.fromEntries(m.variables.map(v=>[v.id,v.initial])),indicators:m.variables.map(v=>({...v,key:v.id}))};
 d.extra_groups=m.groups.filter(g=>!g.engine_slot);d.display_groups=m.groups;d.rules=m.rules;d.competency_definitions=m.competencies;
 d.measures=m.measures.filter(x=>x.enabled).map(x=>{
  const v={...x,price:{rent:0,sale:0,free_rent:0},happiness:slots.map(()=>0),national_effects:Object.fromEntries(coreVars.map(k=>[k,0]))};
  for(const e of x.effects){if(e.target_type==='price')v.price[e.target_id]+=e.amount;if(e.target_type==='group'){const i=gs.findIndex(g=>g?.id===e.target_id);if(i>=0)v.happiness[i]+=e.amount;}if(e.target_type==='variable'&&coreVars.includes(e.target_id))v.national_effects[e.target_id]+=e.amount/100;}
  return v;
 });
 d.funding_sources=m.funding_sources.map(f=>{const group_effects=fundingGroupEffects(f,m.groups);return {...f,group_effects,happiness:gs.map(g=>group_effects[g?.id]||0)};});
 d.model_config=clone(pack);return d;
}
function readStore(storage){try{const v=JSON.parse(storage.getItem(KEY)||'null');return v&&v.format==='vivienda-model-store'?v:{format:'vivienda-model-store',revision:0,active:null,draft:null,previous:null,history:[],preview:null};}catch{return {format:'vivienda-model-store',revision:0,active:null,draft:null,previous:null,history:[],preview:null};}}
function writeStore(storage,state,expected){const actual=readStore(storage);if(actual.revision!==expected)throw new Error('Otra pestaña ha guardado cambios. Recarga el panel antes de sobrescribirlos.');const next={...state,revision:actual.revision+1};storage.setItem(KEY,JSON.stringify(next));return next;}
function diff(a,b,path=''){
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diff(a[k],b[k],path?path+'.'+k:k));
 if(Array.isArray(a)&&Array.isArray(b)&&a.every(x=>x&&x.id)&&b.every(x=>x&&x.id)){const aa=Object.fromEntries(a.map(x=>[x.id,x])),bb=Object.fromEntries(b.map(x=>[x.id,x]));const rows=diff(aa,bb,path);if(a.map(x=>x.id).join()!==b.map(x=>x.id).join())rows.push({path:path+'.$order',before:a.map(x=>x.id),after:b.map(x=>x.id)});return rows;}
 return [{path,before:a,after:b}];
}
function policyAt(d,m,a,t,acts,context={}){
 const out={price:{rent:0,sale:0,free_rent:0},groups:{},variables:{},bounds:[]},index=new Map(d.measures.map((x,i)=>[x.id,i]));
 const has=id=>acts.some(x=>x.index===index.get(id)&&x.start<=t&&(d.measures[x.index].permanent||t<H.actionEnd(d.measures[x.index],x)));
 if((m.temporal_control||m.term_control||m.tourism_program)&&t>=H.actionEnd(m,a))return out;
 if(m.tourism_program?.kind==='ban'&&H.tourismForce(m,a)===0)return out;
 if(!m.enabled||a.intensity<m.intensity_min||a.intensity>m.intensity_max||m.dependencies.some(id=>!has(id)))return out;
 const strength=m.migration_program?.bonus?H.migrationCapacity(m,a)/m.migration_program.annual_capacity:H.taxForce(m,a),curve=d.rules.intensity_curve,fx=x=>(1-Math.exp(-curve*x))/(1-Math.exp(-curve));
 for(const e of m.effects){
  if(t<a.start+e.delay_turns||(!e.permanent&&t>=a.start+e.duration_turns)||e.requires.some(id=>!has(id)))continue;
  const maturity=e.maturation_turns?Math.min(1,(t-a.start-e.delay_turns+1)/e.maturation_turns):1;
  const control=H?.control(m,a);
  let amount=e.amount*(e.target_id==='available_homes'||m.curve==='linear'?strength:fx(strength))*maturity;
  if(e.tax_component)amount=e.amount*H.taxComponentForce(m,a,e.tax_component)*maturity;
  if(e.on_territory&&m.territory_program)amount=e.amount*H.territoryAt(m,a,t).progress;
  if(e.on_existing&&m.existing_program)amount=e.amount*H.existingAt(m,a,t).delivered/m.existing_program.reference_homes;
  if(e.on_registration&&m.supply_program?.regularisation)amount=e.amount*H.supplyAt(m,a,t).regularised/m.supply_program.max_homes;
  if(e.on_delivery&&m.supply_program)amount=e.amount*H.supplyAt(m,a,t).completed/m.supply_program.max_homes;
  if(e.on_access&&m.access_program)amount=e.amount*H.accessAt(m,a,t)/m.access_program.max_beneficiaries;
  if(e.on_beneficiaries&&m.migration_program)amount=e.amount*H.beneficiaryForce(d,m,a,t,acts,context.migration);
  if(e.on_admin_output&&m.admin_program){const pipeline=context.administration||H.adminPipeline(d,t,acts),result=pipeline.byAction?.get(a)||{permits:0,completed:0},share=d.rules.coherence?.admin_expectations_share??.1;amount=e.amount*(result.permits*share+result.completed*(1-share))/m.admin_program.reference_output_homes;}
  if(e.profile_id){const g=d.display_groups?.find(g=>g.id===e.target_id)||d.groups.find(g=>g.id===e.target_id);amount*=Math.min(2,(g?.profiles?.[e.profile_id]||0)/Math.max(.001,e.profile_reference));}
  if(e.target_type==='group'&&m.temporal_control)amount*=H.durationHappiness(m,a);
  if(control){
   const p=m.price_control,targetId=p.mode==='sale'?'sale':'rent';
   amount*=control.compliance;
   if(e.coverage_scaled)amount*=p.coverage;
   if(d.rules.coherence&&e.target_type==='variable'){const current=(a.reference_price??d.prices[targetId].value)*Math.pow(1+d.scenario.extrapolation.gdp_deflator,Math.max(0,t-a.start)/4),goal=H.target(m,a,current,t-a.start);amount*=Math.min(1,Math.max(0,1-goal/current)/Math.max(.01,p.max_reduction*a.intensity/100));}
   if(e.target_type==='price'&&e.target_id===targetId){
    const original=d.prices[targetId].value,elapsed=Math.max(0,t-a.start),inflation=d.scenario.extrapolation.gdp_deflator;
    const unconstrained=(a.reference_price??original)*Math.pow(1+inflation,elapsed/4);
    const goal=H.target(m,{...a,reference_price:a.reference_price??original},unconstrained,elapsed),coverage=p.coverage*(p.mode==='freeze'?a.intensity:1);
    amount=Math.min(0,(goal/unconstrained-1)*100)*coverage*control.compliance*maturity;
   }
  }
  if(e.target_type==='price')out.price[e.target_id]+=amount;
  if(e.target_type==='group')out.groups[e.target_id]=(out.groups[e.target_id]||0)+amount;
  if(e.target_type==='variable'){const v=out.variables[e.target_id]||{percent:0,absolute:0};v[e.operation==='absolute'?'absolute':'percent']+=amount;out.variables[e.target_id]=v;}
  if(e.min_value!=null||e.max_value!=null)out.bounds.push(e);
 }
 return out;
}
const safeValidate=pack=>{try{return validate(pack);}catch(e){return [{path:'model',message:'Estructura incompleta o tipo de dato incorrecto: '+e.message}];}};
const api={KEY,slots,coreVars,defaults,clone,fromCatalog,validate:safeValidate,toCatalog,readStore,writeStore,diff,policyAt,syncFundingEffects};
root.SIM_MODEL=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
