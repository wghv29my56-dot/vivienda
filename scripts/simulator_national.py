"""Versioned national scenario; coefficients are explicit game assumptions."""
import re

def nationalise(d):
 d['version']='alpha-3'; d['geography']={'scope':'national','country_code':'ES','name':'España'}
 d['national']={'baseline':{'gdp':1690012000000,'population':49801559,'rent_demand':1192492,'buy_demand':892796,'tourists':96770515,'tourist_homes':341001},'indicators':[
 {'key':'gdp','name':'PIB nominal','unit':'€ / año','status':'Referencia INE · 2025','url':'https://ine.es/dyngs/Prensa/CNA2025.htm','definition':'PIB a precios corrientes: 1.690.012 millones de euros. Revisión de septiembre de 2026. En el juego, nivel anualizado; no PIB real ni crecimiento descontando inflación.'},
 {'key':'population','name':'Población','unit':'habitantes','status':'Referencia INE · julio 2026','url':'https://www.ine.es/dyngs/Prensa/ECP2T26.htm','definition':'Población residente, dato provisional a 1 de julio de 2026. Evolución trimestral con saldo demográfico y respuesta hipotética a empleo y vivienda.'},
 {'key':'rent_demand','name':'Demandantes de alquiler','unit':'hogares · estimación','status':'Estimación del juego','url':'https://www.ine.es/dyngs/Prensa/ECP2T26.htm','definition':'Bolsa hipotética de hogares en búsqueda: 19.874.860 hogares × 6 % = 1.192.492. El 6 % es un supuesto, no una tasa observada. No es el número de inquilinos ni un registro de solicitantes.'},
 {'key':'buy_demand','name':'Demandantes de compra','unit':'hogares · estimación','status':'Estimación del juego','url':'https://ine.es/dyngs/Prensa/ETDP1225.html','definition':'Bolsa hipotética: 714.237 compraventas de 2025 × 1,25 = 892.796 hogares. El multiplicador es supuesto y las operaciones no equivalen a compradores únicos. No existe aquí un recuento observado de demandantes.'},
 {'key':'tourists','name':'Turistas internacionales','unit':'llegadas / año','status':'Referencia INE · 2025','url':'https://www.ine.es/dyngs/Prensa/FRONTUR1225.html','definition':'96.770.515 llegadas en la publicación provisional FRONTUR de febrero de 2026. No personas únicas ni visitantes presentes a la vez. El juego usa un nivel anualizado sin estacionalidad.'},
 {'key':'tourist_homes','name':'Pisos turísticos','unit':'viviendas anunciadas','status':'Referencia INE · mayo 2026','url':'https://www.ine.es/jaxiT3/Tabla.htm?t=39364','definition':'341.001 viviendas anunciadas en plataformas, tabla INE 39364, serie VTE71. Medición experimental; no equivale a licencias legales ni a todas las viviendas de uso ocasional.'}],
 'methodology':'Referencias de fechas distintas trasladadas sin extrapolación a enero de 2027 para iniciar el juego. Desde el primer turno son simulaciones, no datos oficiales. Porcentajes respecto al inicio. Demanda estimada: hogares en búsqueda, no personas. Coeficientes sin calibrar.'}
 # National programmes: quantities and cash x100, unit costs unchanged.
 defaults={'controls':[-.002,0,.04,-.01,0,0], 'admin':[.004,.00005,-.01,-.01,0,0], 'supply':[.006,.0001,-.05,-.035,0,0], 'mobilise':[.002,.00005,-.025,-.005,0,-.005], 'access':[.001,0,.01,.01,0,0], 'tax':[-.001,0,0,0,0,0], 'demand':[0,0,0,0,0,0], 'territory':[.003,0,-.005,-.005,0,0]}
 overrides={
 'tourist_days':[-.002,0,-.025,-.005,-.015,-.25],
 'tourist_licenses':[-.0005,0,-.008,0,-.003,-.04],
 'seasonal_checks':[-.0002,0,-.02,0,0,-.015],
 'foreign_surcharge':[-.001,-.0001,.005,-.035,0,0],
 'foreign_ban':[-.003,-.0003,.01,-.06,0,0],
 'student_housing':[.003,.0001,-.04,0,0,0],
 'rent_aid_target':[.001,.00005,.025,-.005,0,0],
 'rent_aid_universal':[.001,.0001,.05,-.01,0,0],
 'mortgage_guarantee':[.001,0,-.01,.04,0,0],
 'mortgage_relief':[.001,0,-.015,.05,0,0],
 'tenant_purchase':[0,0,.025,-.02,0,0],
 'housing_first':[.001,.00005,-.02,0,0,0],
 'transaction_tax_cut':[.002,0,-.005,.025,0,0],
 'supply_tax_cut':[.004,0,-.025,-.015,0,0],
 'vacancy_tax':[-.001,0,-.025,-.005,0,0],
 'land_tax':[.001,0,-.01,-.015,0,0],
 'anti_flip':[-.001,0,0,-.015,0,0],
 'rural_incentive':[.002,0,-.003,-.003,0,0]}
 for m in d['measures']:
  old=m['id'][3:];m['id']='a3_'+old
  m['initial_cost']*=100;m['quarterly_cost']*=100
  if not m['full_application'].startswith('100 %'):
   m['full_application']=re.sub(r'^\d+',lambda x:str(int(x[0])*100),m['full_application'])
  m['full_application']=m['full_application'].replace('de prueba','nacional').replace('del programa','del programa nacional')
  cb=m.get('cost_breakdown',{})
  for k in ['homes_at_full','homes','guaranteed_exposure','cash_reserve']:
   if k in cb:cb[k]*=100
  if old=='mortgage_guarantee':cb['note']='Exposición nacional de 10.000 M€; reserva de pérdidas del 5 % como hipótesis, no gasto equivalente al aval.'
  m['national_effects']=dict(zip(['gdp','migration','rent_demand','buy_demand','tourists','tourist_homes'],overrides.get(old,defaults[m['category']])))
  m['national_effects_note']='Hipótesis a plena aplicación; porcentajes sobre el nivel de referencia, salvo migración (fracción trimestral). No son elasticidades empíricas. Aplicación coordinada de administraciones.'
 for s in d['funding_sources']:
  s['id']=s['id'].replace('a2_','a3_');s['sandbox_share']=1
  s['gdp_multiplier']=.7 if s['kind']=='tax_increase' else (1.2 if any(k in s['id'] for k in ['health','education','research','infrastructure']) else .9)
 d['methodology']['budget']='Referencias nacionales PGE 2023 al 100 % de su escala, sin sumar ingresos y gastos como si fueran recursos independientes. Capacidades de recorte/impuesto hipotéticas. No equivale al presupuesto consolidado actual ni incluye todo el gasto autonómico.'
 d['methodology']['national_scale']='Cantidades y costes de programas alpha-2 ×100; costes unitarios constantes. Ejemplo: 100.000 viviendas públicas, 24.000 M€ en 12 trimestres y 50 M€/trimestre de mantenimiento. Hipótesis de alcance, no plan oficial.'
 return d
