"""Audited local scenario. Official observations never imply official policy effects.

Rebuild with build_simulator_catalog.py. Source extracts and hashes live in
data/simulator/evidence; all discretionary assumptions are kept in the catalogue.
"""
import json
from pathlib import Path


def audit(d):
    a = json.loads(Path('data/simulator/audit-inputs.json').read_text())
    d['release_history'] = json.loads(Path('data/simulator/releases.json').read_text())
    d['version'] = d['release_history']['current']
    d['version_label'] = d['release_history']['label']
    d['report_settings'] = dict(quarterly_window=4, quarterly_colors=['#32658c','#2a9b8e','#b67b45'], final_colors=['#96723d','#5678a0','#38988b'])
    d['audited_at'] = a['cutoff']
    d['turn_comments'] = json.loads(Path('data/simulator/turn-comments.json').read_text())
    refs = {
        'population_projection': ('INE · Población anual 2026–2076, tabla 36643 (PROP308)', 'https://www.ine.es/jaxiT3/Tabla.htm?t=36643'),
        'demographic_flows': ('INE · Nacimientos, defunciones y migración anual: tablas 36644/46/48/50', 'https://www.ine.es/dynt3/inebase/index.htm?capsel=6677&padre=6672'),
        'households_projection': ('INE · Proyección de hogares 2026–2041', 'https://www.ine.es/dyngs/Prensa/PROH20262041.htm'),
        'population_observed': ('INE · Población y hogares, 1 de julio de 2026', 'https://www.ine.es/dyngs/Prensa/ECP2T26.htm'),
        'tenure': ('INE · ECV 2025, régimen de tenencia, tabla 9997', 'https://www.ine.es/jaxiT3/Tabla.htm?t=9997'),
        'gdp_observed': ('INE · Contabilidad Nacional Anual 2025, revisión 2026', 'https://www.ine.es/dyngs/Prensa/CNA2025.htm'),
        'gdp_projection': ('Banco de España · Proyecciones junio 2026, cuadro 2', 'https://www.bde.es/f/webbe/SES/Secciones/Publicaciones/InformesBoletinesRevistas/BoletinEconomico/26/T2/Fich/be2602-it.pdf'),
        'bde_2025': ('Banco de España · Informe Anual 2025, capítulo 2', 'https://www.bde.es/f/webbe/SES/Secciones/Publicaciones/PublicacionesAnuales/InformesAnuales/25/InfAnual_2025.pdf'),
        'rent_observed': ('MIVAU · SERPAVI 2026, tabla 1, alquileres de 2024', 'https://publicaciones.transportes.gob.es/downloadcustom/sample/4078'),
        'sale_observed': ('MIVAU · Valor tasado de vivienda libre, 2T 2026 (CSV)', 'https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP006_01.csv'),
        'tourists_observed': ('INE · FRONTUR, año 2025', 'https://www.ine.es/dyngs/Prensa/FRONTUR1225.htm'),
        'tourist_homes_observed': ('INE · Viviendas turísticas, mayo 2026, tabla 39364', 'https://www.ine.es/jaxiT3/Tabla.htm?t=39364'),
        'cofog': ('Eurostat · Gasto ejecutado de todas las AAPP, COFOG 2024', 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp?lang=EN&geo=ES&time=2024&unit=MIO_EUR&sector=S13&na_item=TE'),
        'tax_collection': ('AEAT · Recaudación diciembre 2025, cuadro 4.1, antes de cesiones', 'https://sede.agenciatributaria.gob.es/static_files/AEAT/Estudios/Estadisticas/Informes_Estadisticos/Informes_mensuales_recaudacion_tributaria/2025/IMR_25_12_es_es.pdf'),
        'vat_base': ('AEAT · IVA 2025, cuadro 8.7, gasto final sujeto al tipo general', 'https://sede.agenciatributaria.gob.es/static_files/AEAT/Estudios/Estadisticas/Informes_Estadisticos/Informes_Anuales_de_Recaudacion_Tributaria/Ejercicio_2025/Cuadro_8.7_es_es.xlsx'),
        'vat_rates': ('AEAT · Tipos del IVA', 'https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html'),
        'income_rates': ('BOE · IRPF, artículos 63 y 74: escalas estatal y autonómica', 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764'),
        'corporate_rates': ('AEAT · Tipos de Sociedades y calendario de transición', 'https://www3.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/folleto-actividades-economicas/4-impuesto-sobre-sociedades/4_3-tipo-gravamen-cuota-integra.html'),
        'nonresident_rates': ('AEAT · Tipos del IRNR sin establecimiento permanente', 'https://sede.agenciatributaria.gob.es/Sede/no-residentes/irnr-sin-establecimiento-permanente/tipos-gravamen-irnr-sin-establecimiento-permanente.html'),
        'excise_rates': ('BOE · Ley de Impuestos Especiales, tarifas por producto', 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741'),
        'local_tax': ('BOE · Haciendas Locales, IBI artículo 72 e ICIO artículo 102', 'https://www.boe.es/buscar/act.php?id=BOE-A-2004-4214'),
        'territorial_tax': ('Hacienda · Tributación autonómica 2025, ITP y AJD', 'https://www.hacienda.gob.es/SGFAL/FinanciacionTerritorial/Autonomica/Capitulo-I-Tributacion-Autonomica-2025.pdf'),
        'construction_project': ('EMVS Madrid · Iberia Loreto 1: 52 viviendas, inversión 14.618.794 €', 'https://www.madrid.es/portales/munimadrid/es/Inicio/Actualidad/Noticias/Almeida-anuncia-que-EMVS-Madrid-iniciara-las-obras-de-2-500-nuevas-viviendas-para-alquiler-asequible-en-2026/?vgnextchannel=a12149fa40ec9410VgnVCM100000171f5a0aRCRD&vgnextoid=bf6aa7957789b910VgnVCM100000891ecb1aRCRD'),
    }
    for key, (title, url) in refs.items():
        d['sources'][key] = dict(title=title, url=url, kind='official_reference', accessed=a['cutoff'])
    # Remove historical budget/navigation references from the live catalogue.
    for key in ['civio', 'pge_spending', 'pge_tax']:
        d['sources'].pop(key, None)
    households = 19759349 + (20783505 - 19759349) / 5
    b = dict(gdp=1690012000000 * 1.05, population=a['demography']['2027']['population'],
             rent_demand=round(households * .202 * .15), buy_demand=round(households * .733 * .04),
             tourists=96770515, tourist_homes=341001)
    d['national']['baseline'] = b
    d['scenario'] = dict(
        start_year=2027, demography=a['demography'], household_anchors=a['household_anchors'],
        households_at_start=households, tenure_percent=a['tenure_percent'],
        observations=dict(population=49801559, households=19874860, date='2026-07-01',
                          foreign_nationality=7437543, foreign_born=10291807,
                          spanish_nationality=42364016, born_in_spain=39509752),
        gdp_nominal_growth={'2027': .043}, gdp_deflator={'2027': .025},
        extrapolation=dict(real_gdp_growth=.015, gdp_deflator=.02, tourists_growth=0, tourist_homes_growth=0,
                           note='Desde 2028, PIB real +1,5 % y deflactor +2 % anuales: supuestos, no previsiones oficiales. Turismo constante. Hogares desde 2041: tamaño medio fijo y senda de población del INE.'),
        annual_completions=92000, rent_search_share=.15, buy_search_share=.04,
        rental_listing_turnover=.04, sale_listing_turnover=.025,
        price_shortage_elasticity=2, income_price_elasticity=.1,
        note='Hogares: interpolación lineal entre anclas quinquenales. Flujos demográficos: reparto uniforme en cuatro trimestres, sin estacionalidad. 92.000 viviendas/año es el dato 2025 mantenido como supuesto, no una previsión; no descuenta demoliciones ni segundas residencias. Desajuste de hogares y construcción ≠ déficit medido de viviendas. Elasticidades de precio y tasas de búsqueda sin calibrar.')
    d['scenario']['behavior'] = dict(gdp_effect_min=-.3,gdp_effect_max=.3,population_effect_min=-.5,population_effect_max=1,tourist_effect_min=-.7,tourist_effect_max=.5,tourist_home_effect_min=-.85,tourist_home_effect_max=1,demand_effect_min=-.75,demand_effect_max=1,rent_demand_sale_response=.25,rent_demand_price_response=-.15,rent_demand_income_response=.1,buy_demand_price_response=-.3,buy_demand_income_response=.2,rent_price_demand_response=.1,rent_price_tourism_response=.02,sale_price_demand_response=.1,price_feedback_min=-.3,price_feedback_max=.3)
    d['scenario']['listing_behavior'] = dict(rent_demand_response=.35,rent_tourism_response=.4,rent_price_response=.2,sale_demand_response=.3,sale_price_response=.15,rent_min=45000,rent_max=450000,sale_min=180000,sale_max=1200000)
    d['prices'] = {
        'rent': {'value': 8.2, 'title': 'Alquiler mediano', 'sources': ['rent_observed'], 'note': '8,20 €/m² al mes: mediana SERPAVI de viviendas colectivas arrendadas en 2024. Publicación 2026. El agregado de precios no incluye País Vasco y Navarra; no es una media de anuncios ni el alquiler de entrada de 2027. Se conserva esta referencia sin inventar una actualización. 80 m² × 8,20 = 656 €/mes, conversión ilustrativa; no es la mediana publicada de 600 €/vivienda.'},
        'sale': {'value': 2355, 'title': 'Venta · valor tasado', 'sources': ['sale_observed'], 'note': '2.355 €/m²: valor tasado medio nacional de vivienda libre, segundo trimestre de 2026. No es precio de anuncio ni precio escriturado. 80 m² × 2.355 = 188.400 €. Se mantiene el último nivel observado al inicio ficticio de enero de 2027.'}}
    definitions = {
        'gdp': ('Proyección derivada para 2026', ['gdp_observed', 'gdp_projection'], 'PIB nominal observado 2025: 1.690.012 M€. Se aplica +5,0 % nominal previsto por Banco de España para 2026: 1.774.512,6 M€ como nivel anualizado inicial. En 2027 +4,3 % nominal (PIB real +1,7 %; deflactor +2,5 %, cifras redondeadas). Desde 2028, hipótesis explícita de crecimiento real +1,5 % y deflactor +2 %. No es una previsión oficial a veinte años.'),
        'population': ('Proyección INE · 1 enero 2027', ['population_projection', 'demographic_flows', 'population_observed', 'households_projection'], '50.078.768 habitantes proyectados a enero de 2027, frente a 49.801.559 observados en julio de 2026. La senda usa nacimientos, defunciones, inmigración y emigración anuales del INE, repartidos en cuatro trimestres. Son proyecciones condicionadas, no certezas. Los hogares crecen también por cambios de tamaño: interpolación de anclas INE hasta 2041; después tamaño fijo. Se conserva la versión de la proyección sin mezclar revisiones de población observada.'),
        'rent_demand': ('Estimación · no hay censo nacional de buscadores', ['tenure', 'households_projection'], 'Hogares proyectados para enero de 2027 × 20,2 % en alquiler × 15 % en búsqueda simultánea. El 15 % es supuesto modificable, no dato INE. No son todas las personas que necesitan alquiler. Crece con hogares y desajuste de construcción, y responde a medidas y precios; respuesta no calibrada.'),
        'buy_demand': ('Estimación · no hay censo nacional de buscadores', ['tenure', 'households_projection'], 'Hogares proyectados para enero de 2027 × 73,3 % propietarios × 4 % de búsqueda simultánea. El 4 % es supuesto de escala; no identifica quién busca comprar y no excluye a inquilinos compradores. Evita equiparar compraventas anuales con demandantes únicos. Evoluciona con hogares, oferta, precios y medidas.'),
        'tourists': ('Observado · año completo 2025', ['tourists_observed'], '96.770.515 llegadas internacionales en 2025 según FRONTUR, dato provisional. Son viajes, no personas únicas ni población residente. Nivel anualizado sin estacionalidad. Sin una proyección oficial incorporada, se mantiene constante en el escenario sin medidas; no se inventa crecimiento automático.'),
        'tourist_homes': ('Observado · mayo 2026', ['tourist_homes_observed'], '341.001 viviendas turísticas anunciadas, serie VTE71 del INE. Estadística experimental, no censo de licencias. Sin medidas se mantiene el último nivel: extrapolar las variaciones entre plataformas como crecimiento estructural sería injustificado.')}
    for i in d['national']['indicators']:
        i['status'], i['sources'], i['definition'] = definitions[i['key']]
        i['url'] = d['sources'][i['sources'][0]]['url']
    d['national']['methodology'] = 'Corte documental 03/10/2026. Inicio enero 2027: población proyectada, PIB anualizado estimado y últimas referencias disponibles para precios y turismo. Las fechas se detallan en cada ?. No existe una observación común de enero de 2027.'
    d['groups'] = ['Arrendadores', 'Inversores', 'Inquilinos', 'Compradores residentes', 'Compradores no residentes', 'Propietarios residentes']
    d['initial_happiness'] = [65, 60, 35, 30, 50, 70]
    reasons = [
        '50 neutral +20 por demanda e ingresos −5 por riesgo y costes. No se dispone de encuesta representativa de satisfacción de arrendadores.',
        '50 neutral +15 por demanda y valor de activos −5 por costes de producción y financiación. No es un índice observado de confianza inversora.',
        '50 neutral −10 por esfuerzo de alquiler −5 por escasez y estabilidad. Banco de España describe esfuerzo medio del 26,7 % de renta neta en 2024; no se convierte mecánicamente ese porcentaje en felicidad.',
        '50 neutral −15 por barreras de ahorro y precio −5 por escasez. La restricción de acceso está documentada; los puntos son una valoración del diseño.',
        '50 neutral: sin una encuesta comparable se evita atribuir bienestar por nacionalidad. Este grupo se define por residencia, no por origen ni ciudadanía.',
        '50 neutral +25 por seguridad de tenencia −5 por mantenimiento y exposición hipotecaria. El 48,9 % de hogares tiene vivienda propia sin hipoteca y el 24,4 % con hipoteca; el índice resume ambos.'
    ]
    d['group_audit'] = [dict(name=n, initial_happiness=h, uncertainty_points=15,
                           note=r + ' Estimación de satisfacción con vivienda, no felicidad vital ni encuesta. Banda orientativa ±15 puntos, no intervalo estadístico. Los colectivos se solapan y no se suman como población.',
                           sources=['tenure', 'bde_2025']) for n, h, r in zip(d['groups'], d['initial_happiness'], reasons)]
    # 20.2% tenants + 73.3% owner occupiers + 6.5% free-use households.
    # Free-use satisfaction is a stated midpoint proxy, not another population count.
    d['weights'] = [0, 0, 23.45, 0, 0, 76.55]
    d['collective_note'] = 'Media por hogares, no por personas: 20,2 % inquilinos + 73,3 % propietarios residentes + 6,5 % cesión gratuita. Para cesión se usa la media de ambos índices (supuesto), equivalente a pesos 23,45 % y 76,55 %. ECV 2025: propiedad sin hipoteca 48,9 %, con hipoteca 24,4 %, alquiler de mercado 16,7 %, reducido 3,5 %, cesión 6,5 %. Arrendadores, inversores y compradores son papeles solapados y no añaden votos. No se asigna nacionalidad a la tenencia. Se mantienen las cuotas de tenencia por falta de un modelo de transiciones.'
    # Disjoint COFOG portfolios: do not mix State budgets with regional execution.
    portfolios = {
        'pensions': ('Vejez y supervivencia', ['GF1002', 'GF1003']),
        'health': ('Sanidad', ['GF07']), 'education': ('Educación', ['GF09']),
        'social': ('Familia, exclusión y otros servicios sociales', ['GF1004', 'GF1007', 'GF1009']),
        'employment': ('Asuntos económicos, comerciales y laborales', ['GF0401']),
        'unemployment': ('Desempleo', ['GF1005']), 'culture': ('Servicios culturales', ['GF0802']),
        'defence': ('Defensa', ['GF02']), 'security': ('Orden público y seguridad', ['GF03']),
        'infrastructure': ('Protección del medio ambiente', ['GF05']),
        'research': ('Investigación básica', ['GF0104']), 'transport': ('Transporte', ['GF0405'])}
    tax = {
        'irpf': (142465653000, 'income_rates', 'IRPF: escala general estatal 9,5 / 12 / 15 / 18,5 / 22,5 / 24,5 %, más la autonómica correspondiente; ahorro con escala propia. No existe un único tipo nacional. El control añade un recargo proporcional sobre cuota, no puntos a un supuesto tipo único.'),
        'iva': (99532419000, 'vat_rates', 'IVA general inicial 21 %, reducido 10 %, superreducido 4 % y casos al 0 %. Vivienda nueva generalmente 10 %, ciertas VPO 4 %; alquiler habitual exento. Solo cambia el tipo general. Base de gasto final a tipo general de 2025: 394.493,985 M€ (AEAT cuadro 8.7). No se aplica 21 % a toda la recaudación.'),
        'corporate': (42265860000, 'corporate_rates', 'Sociedades general 25 %. En 2026 reducida dimensión 23 % y microempresas 19 % primeros 50.000 € / 21 % resto. En el inicio 2027: 22 % y 17 % / 20 %, respectivamente. Reducida dimensión 21 % en 2028 y 20 % desde 2029. Existen regímenes especiales. El control es un recargo sobre cuota de todos los regímenes, no una subida ficticia del tipo general para toda la base.'),
        'excise': (23083146000, 'excise_rates', 'Impuestos especiales: tarifas específicas por producto y tipos ad valorem, sin un porcentaje general único. El juego aplica un recargo proporcional de cuota; no convierte euros por litro en puntos porcentuales.'),
        'nonresident': (5397031000, 'nonresident_rates', 'IRNR sin establecimiento permanente: general 24 %; 19 % para UE/EEE con intercambio de información, y reglas por clase de renta y convenio. El control aplica un recargo proporcional a cuota, no supone un tipo único ni grava a toda persona extranjera residente.')}
    for s in d['funding_sources']:
        s['sandbox_share'] = 1
        if s['kind'] == 'spending_cut':
            name, codes = portfolios[s['id'][7:]]
            s.update(name=name, cofog_codes=codes, annual_reference=sum(a['cofog_2024_million_eur'][c] for c in codes)*1000000,
                     reference_year=2024, sources=['cofog'], scope='Gasto ejecutado COFOG de todas las AAPP, 2024; no crédito presupuestario 2026/2027.',
                     audit_note='Cartera sin solapamiento con las demás opciones. ' + '+'.join(codes) + '. El límite de recorte del 20 % es una regla de juego, no dinero disponible ni garantía de viabilidad legal. Se lleva el nivel nominal observado al inicio como supuesto; después se indexa al deflactor del escenario. Vejez/supervivencia incluye prestaciones distintas de pensiones; protección social no es toda la función GF10.')
        else:
            value, ref, note = tax[s['id'][7:]]
            s.update(annual_reference=value, reference_year=2025, sources=['tax_collection', ref],
                     scope='Recaudación AEAT 2025 antes de cesiones territoriales; no toda la recaudación foral ni previsión 2027.',
                     audit_note=note + ' Rendimiento: 70 % de la estimación estática, hipótesis prudencial sin estimación econométrica. No es una previsión oficial de ingresos. Base trasladada sin crecimiento hasta el inicio; indexación posterior al deflactor.', tax_mode='quota_surcharge')
            if s['id'].endswith('_iva'):
                s.update(name='IVA · tipo general 21 %', tax_mode='general_vat', baseline_rate=21, max_rate=24,
                         annual_tax_base=a['vat_general_final_expenditure_2025'], max_adjustment=3/21)
                s['sources'].append('vat_base')
    d['sources']['itp_ajd_collection'] = dict(title='Hacienda · Memoria tributaria 2024, cuadros IV.10, IV.14 y IV.16', url='https://www.hacienda.gob.es/ig/memorias/memoria-tributaria-2024/mat-2024.pdf')
    d['sources']['itp_ajd_law'] = dict(title='BOE · Texto refundido del ITP y AJD', url='https://www.boe.es/buscar/act.php?id=BOE-A-1993-25359')
    template = next(x for x in d['funding_sources'] if x['id']=='a3_tax_nonresident')
    d['funding_sources'] = [x for x in d['funding_sources'] if x['id']!='a3_tax_nonresident']
    for key,name,value,note in [
        ('itp','ITP · transmisiones patrimoniales',9615300000,'Reventa de vivienda normalmente sujeta a TPO. Tipos, bonificaciones y exenciones autonómicos; no existe un tipo nacional único.'),
        ('ajd','AJD · actos jurídicos documentados',2897600000,'La cuota notarial variable puede gravar escrituras de compra sujetas a IVA. En escrituras de préstamo hipotecario el sujeto pasivo es el prestamista. Tipos y beneficios autonómicos.')]:
        f = dict(template)
        f.update(id='a3_tax_'+key,name=name,annual_reference=value,reference_year=2024,sources=['itp_ajd_collection','itp_ajd_law'],happiness=[-2,-3,0,-5,-2,0],scope='CCAA de régimen común + País Vasco + Navarra, 2024. No incluye gestión estatal ni se limita a vivienda.',audit_note=note+' Recaudación agregada de todo el tributo: ITP 9.355,9 + 192,2 + 67,2 M€; AJD 2.841,0 + 39,6 + 17,0 M€. El control aplica un recargo proporcional sobre cuota al conjunto del tributo; NO son puntos de tipo ni ingresos exclusivos de compraventa residencial. Respuesta del 70 % y límite de recargo del 10 %: supuestos del juego.',consequences='Más recursos y mayor carga en las operaciones gravadas. Efectos de felicidad y actividad hipotéticos, sin calibración causal.')
        d['funding_sources'].append(f)
    d['methodology']['taxes_pending']='ITP y AJD usan recaudación territorial 2024, recargo sobre cuota y tipos autonómicos. IBI, Patrimonio e IGIC pendientes de base comparable.'
    d['sources']['irpf_effective'] = dict(title='AEAT · Informe anual 2025, IRPF: tipo medio efectivo estimado 15,1 %', url='https://sede.agenciatributaria.gob.es/static_files/AEAT/Estudios/Estadisticas/Informes_Estadisticos/Informes_Anuales_de_Recaudacion_Tributaria/Ejercicio_2025/IART25_ca_es.pdf')
    controls = {
      'iva': (21,18,24,'Tipo general','Tipo general legal. Solo se modifica la base gravada al 21 %; reducidos 10 % y 4 % sin cambios.'),
      'irpf': (15.1,12.1,18.1,'Tipo medio efectivo','Media efectiva AEAT 2025 estimada, no tipo marginal ni tramo legal. Aproximación de recaudación: caja de referencia escalada por cambio relativo del tipo medio.'),
      'corporate': (25,20,30,'Tipo general de referencia','General legal 25 %. El modelo escala la recaudación agregada como aproximación; no reproduce tipos reducidos, deducciones y bases por régimen.'),
      'itp': (6,4,8,'Tipo de referencia TPO','6 % subsidiario estatal para inmuebles, NO media nacional. Tipos autonómicos diferentes. Se escala la recaudación agregada: aproximación, no microsimulación territorial.'),
      'ajd': (.5,.1,1,'Tipo de referencia AJD','0,5 % subsidiario estatal de cuota notarial variable, NO media nacional. Tipos autonómicos diferentes. Aproximación sobre recaudación agregada del tributo.'),
      'excise': (100,80,120,'Índice de tarifas','Base 100: cesta de impuestos especiales. No existe un tipo porcentual único; incluye tarifas por unidad física.')}
    for f in d['funding_sources']:
        if f['kind']=='tax_increase':
            key=f['id'][7:];base,lo,hi,label,note=controls[key]
            f['fiscal_control']=dict(base=base,min=lo,max=hi,step=.01,unit='índice' if key=='excise' else '%',label=label,note=note)
            if key=='irpf': f['sources'].append('irpf_effective')
        else:
            base=f['annual_reference']/1e6
            f['fiscal_control']=dict(base=base,min=base*.8,max=base*1.2,step=.01,unit='M€ / año',label='Dotación anual de referencia',note='Gasto COFOG 2024 usado como base de juego, no presupuesto aprobado 2027. Ampliar mejora la incidencia social modelada; recortar la invierte.')
    # Every cash amount is now quantity × unit amount. These are programme designs,
    # not falsely attributed government appropriations or universal cost tariffs.
    specs = {}
    def spec(key, quantity, unit, initial_unit, quarter_unit, note, refs=(), maintenance=0):
        specs[key] = dict(quantity=quantity, unit=unit, initial_unit=initial_unit, quarter_unit=quarter_unit,
                          note=note, sources=list(refs), annual_maintenance_per_home=maintenance)
    administrative = {
        'freeze': (300, 15000), 'index_cap': (200, 10000), 'benchmark': (500, 20000),
        'income_cap': (1000, 15000), 'cost_return': (1000, 20000), 'protected_sale': (200, 10000),
        'admin_digital': (500, 50000), 'admin_parallel': (500, 10000), 'admin_standard': (600, 25000),
        'admin_risk': (1000, 10000), 'admin_staff': (1000, 5000), 'upzone': (500, 20000),
        'building_code': (200, 15000), 'vacancy_tax': (1000, 10000), 'land_tax': (1000, 30000),
        'anti_flip': (300, 10000), 'tourist_days': (1000, 10000), 'tourist_licenses': (500, 10000),
        'seasonal_checks': (1500, 10000), 'foreign_surcharge': (300, 10000), 'foreign_ban': (500, 10000)}
    for key, (staff, setup) in administrative.items():
        spec(key, staff, 'puestos equivalentes de ejecución', setup, 70000/4,
             'Hipótesis presupuestaria: 70.000 €/puesto/año incluyendo costes laborales y medios; implantación por puesto indicada aparte. No es salario oficial ni coste verificado de aprobar una ley. La intensidad regula cobertura y capacidad; no cambia automáticamente el tipo legal.', ['bde_2025'])
    spec('voluntary_cap', 50000, 'viviendas conveniadas', 100, 250*3, 'Compensación elegida de 250 €/mes; no es una tarifa oficial de convenios.', ['plan2026'])
    unit = 14618794/52
    spec('public_build', 10000, 'viviendas públicas nuevas', unit*.25, unit*.75/12,
         'Inversión de proyecto por vivienda: 14.618.794 €/52 = 281.130,65 €. Referencia local EMVS 2026 que incluye suelo, trasteros y aparcamientos; NO coste nacional puro de construcción ni tarifa de 80 m². Reparto supuesto 25 % inicial y 75 % en 12 trimestres. Sensibilidad orientativa 200.000–360.000 €/vivienda. Mantenimiento 2.000 €/año supuesto.', ['construction_project'], 2000)
    spec('ppp_build', 10000, 'viviendas con concesión', 20000, 40000/12, 'Aportación pública supuesta 60.000 €/vivienda, no coste total: el privado debe cubrir el resto del proyecto y asumir riesgo. Valor del suelo cedido debe añadirse al análisis patrimonial; no se considera ingreso gratuito.', ['plan2026', 'construction_project'])
    spec('cooperative', 5000, 'viviendas cooperativas', 20000, 60000/12, 'Subvención diseñada de 80.000 €/vivienda útil de 80 m²: referencia al límite 1.000 €/m² y 70 % de inversión del PEV, no coste total ni concesión automática. Resto por cooperativa; suelo cedido no valorado.', ['plan2026'])
    spec('land_ready', 20000, 'viviendas potenciales en suelo urbanizado', 8000, 32000/12, 'Urbanización completa supuesta 40.000 €/capacidad de vivienda; ayuda PEV hasta 8.000 € no equivale a coste de urbanizar. No son viviendas terminadas.', ['plan2026'])
    spec('infill', 10000, 'conversiones subvencionadas', 10000, 20000/12, 'Subvención supuesta 30.000 €/conversión; exige proyecto habitable y financiación privada restante. No es precio total de adquisición y obra.', ['bde_2025'])
    spec('industrial', 10000, 'viviendas de proyectos industrializados', 10000, 10000/12, 'Apoyo supuesto 20.000 €/vivienda de proyectos existentes, no coste total ni 10.000 viviendas adicionales garantizadas.', ['plan2026'])
    spec('training', 20000, 'plazas de formación', 1000, 5000/12, '6.000 €/plaza para el programa completo: hipótesis de formación y acompañamiento, no baremo oficial.', ['bde_2025'])
    spec('rural_land', 10000, 'viviendas potenciales con servicios', 10000, 40000/16, '50.000 €/vivienda potencial en redes y habilitación, supuesto; no incluye construir viviendas ni habilita suelos protegidos.', ['bde_2025'])
    spec('buy_existing', 5000, 'viviendas compradas', 2355*80*1.05, 2000/4, 'Referencia tasada 2.355 €/m² × 80 m² = 188.400 €; +5 % gastos de adquisición supuesto. Valoración no garantiza precio de compra. Mantenimiento 2.000 €/año supuesto, también tras el programa. Cambia tenencia, no stock físico.', ['sale_observed'], 2000)
    spec('empty_rehab', 20000, 'viviendas vacías rehabilitadas', 20000, 2000/8, 'Ayuda elegida de 20.000 € más 2.000 € de seguimiento por vivienda durante ocho trimestres; coste y aptitud técnica requieren proyecto.', ['plan2026'])
    spec('energy_rehab', 50000, 'viviendas rehabilitadas', 11600, 1000/8, '11.600 €: límite por vivienda del tramo de ahorro energético del 45–60 % del RD 853/2021; además límite porcentual del 65 %. Se modela gasto al máximo, no coste total ni derecho de cualquier vivienda; +1.000 € de gestión supuesto.', ['rehab'])
    spec('accessibility', 20000, 'viviendas adaptadas', 13000, 1000/8, 'Referencia PEV art. 99: máximo general 13.000 €/vivienda y 70 % del coste subvencionable, con excepciones. Se supone solicitud elegible con coste suficiente; +1.000 € gestión supuesto.', ['plan2026'])
    spec('rental_guarantee', 100000, 'contratos asegurados', 100, 656*12*.04/4, 'Prima/reserva esperada supuesta: renta de referencia 656 €/mes ×12×4 % anual. El 4 % no es siniestralidad oficial; no cubre pérdidas extremas.', ['rent_observed'])
    spec('mediation', 100000, 'contratos atendidos', 100, 200/4, '100 € alta +200 €/año mediación por contrato: presupuesto supuesto sin tarifa pública nacional.', ['plan2026'])
    spec('sareb', 10000, 'activos aptos movilizados', 40000, 2000/4, '40.000 €/activo de puesta en uso y 2.000 €/año mantenimiento supuestos; excluye compra de activos ajenos y saneamiento de deuda. No afirma que existan 10.000 aptos gratuitos.', ['plan2026'], 2000)
    spec('rent_aid_target', 100000, 'hogares · ayuda 250 €/mes', 100, 250*3, 'Ayuda de 250 €/mes, máximo ordinario de referencia PEV art.119; elegibilidad y renta deben comprobarse. Gestión inicial 100 €/hogar supuesta.', ['plan2026'])
    spec('rent_aid_universal', 500000, 'hogares · ayuda 250 €/mes', 100, 250*3, 'Diseño hipotético ampliado a 500.000 hogares; 250 €/mes elegido usando referencia PEV, sin afirmar cobertura universal ni prestación vigente para todos.', ['plan2026'])
    spec('housing_first', 10000, 'hogares acompañados', 2000, (656+700)*3, 'Alquiler ilustrativo 656 €/mes +700 €/mes de acompañamiento +2.000 € alta: diseño supuesto, no coste nacional oficial Housing First. No confundir límite de ayuda con coste del servicio.', ['jrc', 'rent_observed'])
    spec('legal_aid', 50000, 'hogares atendidos por trimestre', 60, 200, '200 €/hogar y trimestre de asistencia +60 € alta: hipótesis, no baremo oficial de justicia gratuita.', ['plan2026'])
    spec('mortgage_guarantee', 50000, 'hipotecas · aval 20 %', 250000*.2*.05, 100/4, 'Préstamo supuesto 250.000 €, aval 20 %, exposición 2.500 M€ para 50.000 operaciones (escala de la línea ICO). Reserva de pérdidas del 5 % =125 M€, no gasto igual al aval. Administración 100 €/hipoteca/año supuesta; pérdidas superiores no cubiertas por esta reserva.', ['ico'])
    spec('mortgage_relief', 100000, 'hogares · deducción 1.500 €/año', 50, 1500/4, 'Nueva deducción hipotética de 1.500 €/hogar/año y 50 € implantación; no es la deducción estatal vigente ni beneficio universal.', ['income_rates'])
    spec('tenant_purchase', 5000, 'viviendas · descuento 20 %', 2355*80*.2, 500/8, 'Menor ingreso patrimonial: tasación ilustrativa 188.400 € ×20 % descuento supuesto; +500 € gestión por operación. Se financia el descuento, no toda la vivienda; venta no se cuenta como nueva oferta.', ['sale_observed'])
    spec('transaction_tax_cut', 100000, 'operaciones/año · ayuda equivalente 2.000 €', 10, 2000/4, 'Diseño de reducción fiscal media de 2.000 €/operación, no tipo nacional de ITP/AJD. Tarifas y bonificaciones dependen de comunidad, bien y adquirente; 2025 es la comparación territorial consultada, debe revisarse cada norma autonómica para ejecutar.', ['territorial_tax'])
    spec('supply_tax_cut', 50000, 'viviendas/año · bonificación equivalente 3.000 €', 20, 3000/4, 'Menor recaudación elegida 3.000 €/vivienda, no tarifa. ICIO: tipo fijado por ordenanza con máximo legal 4 % sobre coste de ejecución material, no precio de venta. Tasas y bonificaciones territoriales; no se fija un tipo municipal inventado.', ['local_tax'])
    spec('student_housing', 20000, 'plazas de alojamiento', 20000, 60000/12, '80.000 €/plaza de inversión total y 1.000 €/año de mantenimiento: hipótesis pendiente de muestra representativa de promociones; una plaza no es una vivienda familiar.', ['plan2026'], 1000)
    spec('transit', 100, 'corredores de autobús mejorados', 2000000, 1000000/4, '2 M€/corredor de implantación y 1 M€/año operación, diseño supuesto de autobús. No representa coste de metro o ferrocarril.', ['cofog'])
    spec('rural_incentive', 50000, 'hogares y negocios · 3.000 €/año', 100, 3000/4, 'Ayuda elegida 3.000 €/año a residencia/actividad efectiva, más 100 € gestión inicial. No equivale a prestación oficial ni garantiza traslado.', ['bde_2025'])
    spec('remote_work', 1000, 'áreas conectadas', 100000, 10000/4, '100.000 €/área de infraestructura +10.000 €/año servicio, hipótesis de proyecto; exige comprobar cobertura, hogares y contratos.', ['bde_2025'])
    assert len(specs) == len(d['measures']) == 50
    for m in d['measures']:
        key = m['id'][3:]
        s = specs[key]
        quantity = s['quantity']
        m['cost_audit'] = s
        m['initial_cost'] = round(quantity*s['initial_unit'])
        m['quarterly_cost'] = round(quantity*s['quarter_unit'])
        m['full_application'] = f"{quantity} {s['unit']}"
        m['unit_cost_status'] = 'explicit_programme_estimate_with_separate_official_references'
        m['cost_breakdown'] = dict(homes_at_full=quantity, annual_maintenance_per_home=s['annual_maintenance_per_home'])
        m['sources'] = list(dict.fromkeys(s['sources'] + m['sources']))
        m['audit_note'] = s['note'] + ' Las cantidades de beneficiarios, calendarios y efectos son supuestos del diseño. Los importes se escalan linealmente con la intensidad y con el deflactor al adoptar la medida; los pagos se fijan al contratar. Efectos de precio, PIB y felicidad sin calibración causal española; no quedan verificados por estas fuentes.'
        m['national_effects']['migration'] = 0
        # Finite programmes must not move the entire national market by several %.
        scale = 1 if key in administrative else min(1, quantity/1000000)
        if key == 'public_build':
            scale = quantity/(households*.202)  # gross rental stock coverage
        m['effect_scale'] = scale
        m['effect_scale_note'] = 'Coeficientes ilustrativos anteriores reducidos por alcance: cantidades/1.000.000, o viviendas públicas/parque de hogares arrendatarios. No es una elasticidad estimada; medidas regulatorias mantienen escenario nacional hipotético.'
        m['price'] = {k: v*scale for k, v in m['price'].items()}
        m['happiness'] = [v*scale for v in m['happiness']]
        m['national_effects'] = {k: v*scale for k, v in m['national_effects'].items()}
        m['national_effects_note'] = m['effect_scale_note'] + ' No se atribuyen flujos migratorios a políticas sin evidencia.'
        m['regulation_sources'] = [r for r in m['sources'] if d['sources'][r]['kind'] in ['legal_reference', 'legal_constraint', 'aid_limits_not_total_cost', 'current_regulation'] or r in ['local_tax', 'territorial_tax', 'income_rates']]
        if key in ['foreign_ban', 'foreign_surcharge', 'land_tax', 'income_cap', 'cost_return']:
            m['audit_note'] += ' Reforma hipotética: la norma citada puede limitarla y NO acredita que esté autorizada hoy.'
        if key == 'foreign_ban':
            m['name'] = 'Restricción hipotética de compra no residente'
        if key == 'vacancy_tax':
            m['audit_note'] += ' IBI art.72.4: recargo 50 %, hasta 100 % por más de tres años, y hasta 50 puntos adicionales según titularidad; requiere ordenanza y requisitos de desocupación. No se ingresa recaudación automática no verificada.'
            m['sources'].append('local_tax')
    d['methodology'].update(
        budget='COFOG ejecutado 2024, conjunto AAPP, carteras disjuntas. No PGE actuales. Traslado al inicio sin revalorizar: hipótesis. Límite de recorte 20 % de diseño. Indexación posterior por deflactor.',
        national_scale='Se elimina multiplicación genérica ×100; cada uno de los 50 programas define cantidad, unidad, coste inicial/unitario recurrente y límites de evidencia.',
        costs='Referencias de diversa fecha y supuestos en euros de inicio; no son una licitación ni contabilidad pública completa. Contratos se fijan al aprobar; nuevas adopciones y capacidad fiscal siguen deflactor. Pérdidas fiscales y descuentos también se financian.',
        effects='Magnitudes de efectos aún hipotéticas. Se modera alcance de programas finitos; felicidad es estimada, no encuesta. Incertidumbre y límites visibles en ?. No usar resultados como pronóstico.'
    )
    d['audit_limitations'] = ['No microsimulación fiscal territorial ni balance patrimonial completo.', 'Precios con cobertura y fechas distintas; no precios de oferta.', 'Demanda simultánea, anuncios y felicidad estimados, no estadísticas observadas.', 'Coeficientes causales y elasticidades no calibrados; los escenarios no son predicciones.', 'La versión realista es local. Las funciones antiguas alpha-3 de Supabase no ejecutan este motor y requieren una migración antes de cualquier conexión.']
    return d
