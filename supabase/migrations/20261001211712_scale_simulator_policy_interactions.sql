create or replace function simulator_private.calculate_alpha2(p_run_id uuid,p_turn integer)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.sim_runs; b public.sim_turns; d record; s record; g record; params jsonb;
 h numeric[]:=array[0,0,0,0,0,0]::numeric[]; rents numeric:=0; sales numeric:=0; frees numeric:=0;
 force numeric; maturity numeric; risk numeric; ratio numeric; i integer;
 admin_force numeric:=0;build_force numeric:=0;aid_force numeric:=0;control_force numeric:=0;supply_interaction numeric;demand_interaction numeric;
begin
 select * into r from public.sim_runs where id=p_run_id and user_id=auth.uid();
 if not found then raise exception 'Run not owned' using errcode='42501'; end if;
 select * into b from public.sim_turns where run_id=r.id and turn_no=0;
 for d in select * from public.sim_decisions where run_id=r.id loop
  params:=d.measure_snapshot->'model_parameters';
  if p_turn<d.effect_start_turn then continue; end if;
  if p_turn>d.end_turn and not coalesce((params->>'permanent')::boolean,false) then continue; end if;
  maturity:=greatest(0,least(1,(p_turn-d.effect_start_turn+1)::numeric/4));
  force:=(1-exp(-2*d.intensity))/(1-exp(-2::numeric))*maturity;
  rents:=rents+coalesce((params->'price'->>'rent')::numeric,0)*force;
  sales:=sales+coalesce((params->'price'->>'sale')::numeric,0)*force;
  frees:=frees+coalesce((params->'price'->>'free_rent')::numeric,0)*force;
  for i in 1..6 loop h[i]:=h[i]+coalesce((params->'happiness'->>(i-1))::numeric,0)*force;end loop;
  if coalesce((params->>'risk_high')::boolean,false) and d.intensity>0.75 then
   risk:=power((d.intensity-0.75)/0.25,2)*maturity;h[3]:=h[3]-2*risk;h[2]:=h[2]-risk;frees:=frees+risk;
  end if;
  if params->>'category'='admin' then admin_force:=greatest(admin_force,force);end if;if params->>'category'='supply' then build_force:=greatest(build_force,force);end if;
  if d.measure_id like '%rent_aid%' then aid_force:=greatest(aid_force,force);end if;if params->>'exclusive_group'='rent_control' then control_force:=greatest(control_force,force);end if;
 end loop;
 supply_interaction:=least(admin_force,build_force);demand_interaction:=least(aid_force,control_force);
 rents:=rents-0.5*supply_interaction;sales:=sales-0.5*supply_interaction;frees:=frees+0.5*demand_interaction;h[3]:=h[3]-demand_interaction;
 for s in select tb.*,bs.reference_parameters from public.sim_turn_budgets tb join public.sim_budget_sources bs on bs.id=tb.source_id where tb.run_id=r.id and tb.turn_no=p_turn loop
  ratio:=case when s.capacity>0 then greatest(0,least(1,s.committed/s.capacity)) else 0 end;
  for i in 1..6 loop h[i]:=h[i]+coalesce((s.reference_parameters->'happiness'->>(i-1))::numeric,0)*ratio;end loop;
 end loop;
 for g in select tg.*,gr.display_order from public.sim_turn_groups tg join public.sim_groups gr on gr.id=tg.group_id where tg.run_id=r.id and tg.turn_no=0 loop
  update public.sim_turn_groups set unrest=round(greatest(0,least(100,g.unrest-20*tanh(h[g.display_order]::double precision/20)))::numeric,2),
  explanation='Hipótesis alfa: efectos modulados, maduración e incidencia de financiación. No medición de opinión pública.' where run_id=r.id and turn_no=p_turn and group_id=g.group_id;
 end loop;
 update public.sim_turns set rent_m2=round(b.rent_m2*(1+p_turn*0.001)*(1+25*tanh(rents::double precision/25)/100)::numeric,2),
 sale_m2=round(b.sale_m2*(1+p_turn*0.0015)*(1+25*tanh(sales::double precision/25)/100)::numeric,2),
 collective_unrest=(select round(sum(unrest*weight_percent)/100,2) from public.sim_turn_groups where run_id=r.id and turn_no=p_turn),
 summary='Hipótesis alfa sin calibración: precios, malestar y financiación calculados con catálogo investigado y coeficientes de juego.',
 state=jsonb_build_object('synthetic',true,'model_version','alpha-2','coefficient_status','game_assumption_not_empirical_estimate','free_rent_m2',round((b.rent_m2*(1+p_turn*0.001)*(1+25*tanh(frees::double precision/25)/100))::numeric,2))
 where run_id=r.id and turn_no=p_turn;
end $$;
revoke all on function simulator_private.calculate_alpha2(uuid,integer) from public,anon,authenticated;
