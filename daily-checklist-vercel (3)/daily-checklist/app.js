(function(){
  var $=function(s){return document.querySelector(s)};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  function todayIST(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date())}
  function nowIST(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
  function fmtDate(iso){var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
  function num(v){var n=parseFloat(v);return isFinite(n)?n:null}
  function fmtAvg(a){return a==null?'':(Math.round(a*100)/100).toString()}

  var sb=null, canWrite=true;
  var agents=[], logdays=[], entries={}, dayDoc={};
  var pollT=null;
  function must(res){if(res&&res.error)throw res.error;return res?res.data:null}
  var selDate=todayIST(), selAgent='', tab='entry';
  var unsubs=[], entryDirty=false, leadDirty=false, bugRows=[];
  var toastT=null, armT=null, armedId=null;

  function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},3200)}
  function banner(m){var b=$('#banner');if(m){b.textContent=m;b.hidden=false}else b.hidden=true}
  function lsGet(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}

  /* ---------- derived data ---------- */
  function activeAgents(){return agents.filter(function(a){return a.active!==false}).sort(function(a,b){return (a.order||0)-(b.order||0)})}
  function rows(){
    var act=activeAgents();
    var list=act.map(function(a){return {id:a.id,name:a.name,e:entries[a.id]||null}});
    var ids={};act.forEach(function(a){ids[a.id]=1});
    Object.keys(entries).forEach(function(k){if(!ids[k])list.push({id:k,name:entries[k].name||k,e:entries[k]})});
    return list;
  }
  function totals(list){
    var t={closed:0,pending:0,inprog:0,bug:0,ratings:0,avg:null,filled:0},ws=0,wn=0;
    list.forEach(function(r){var e=r.e;if(!e)return;t.filled++;t.closed+=e.closed||0;t.pending+=e.pending||0;t.inprog+=e.inprog||0;t.bug+=e.bug||0;t.ratings+=e.ratings||0;
      if(e.avg!=null&&e.ratings>0){ws+=e.avg*e.ratings;wn+=e.ratings}});
    if(wn)t.avg=ws/wn;return t;
  }

  /* ---------- tabs ---------- */
  function setTab(t){
    tab=t;
    ['entry','sheet','hist'].forEach(function(k){
      $('#p-'+k).hidden=(k!==t);
      $('#tab-'+k).setAttribute('aria-selected',k===t?'true':'false');
    });
    if(t==='sheet')renderSheet(true);
  }
  document.querySelectorAll('nav.tabs button').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.tab)})});

  /* ---------- people ---------- */
  function renderPeople(){
    var act=activeAgents(), sel=$('#agentSel');
    if(!act.length){
      sel.innerHTML='<option value="">No names yet. Add one on the right.</option>';
      selAgent='';
    }else{
      if(!selAgent||!act.some(function(a){return a.id===selAgent})){
        var saved=lsGet('flabs_agent');
        selAgent=act.some(function(a){return a.id===saved})?saved:'';
      }
      sel.innerHTML='<option value="">Choose your name</option>'+act.map(function(a){return '<option value="'+esc(a.id)+'"'+(a.id===selAgent?' selected':'')+'>'+esc(a.name)+'</option>'}).join('');
    }
    $('#peopleChips').innerHTML=act.map(function(a){
      return '<span class="chip">'+esc(a.name)+'<button data-rm="'+esc(a.id)+'" title="Remove from list" aria-label="Remove '+esc(a.name)+'">&times;</button></span>';
    }).join('');
    renderEntryForm(false);
    renderFill();
    if(tab==='sheet')renderSheet(false);
  }
  $('#peopleChips').addEventListener('click',function(ev){
    var b=ev.target.closest('button[data-rm]');if(!b||!sb||!canWrite)return;
    var id=b.dataset.rm;
    if(armedId!==id){
      armedId=id;b.textContent='Remove?';b.className='arm';clearTimeout(armT);armT=setTimeout(function(){armedId=null;renderPeople()},3000);return;
    }
    clearTimeout(armT);armedId=null;
    sb.from('agents').update({active:false}).eq('id',id).then(function(r){must(r);toast('Removed from the list. Past data is kept.');return loadAgents()}).catch(function(){toast('Could not remove. Try again.')});
  });
  $('#addPerson').addEventListener('click',addPerson);
  $('#newName').addEventListener('keydown',function(e){if(e.key==='Enter')addPerson()});
  function addPerson(){
    if(!sb){toast('Database is not connected. Fill config.js with your Supabase URL and key, then redeploy.');return}
    var name=$('#newName').value.replace(/\s+/g,' ').trim();
    if(!name){toast('Type a name first.');return}
    var low=name.toLowerCase();
    if(activeAgents().some(function(a){return a.name.toLowerCase()===low})){toast('That name is already in the list.');return}
    var base='a_'+(low.replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'person');
    var id=base, used={};agents.forEach(function(a){used[a.id]=1});
    var i=2;while(used[id]){id=base+'_'+i++}
    var maxOrder=agents.reduce(function(m,a){return Math.max(m,a.order||0)},0);
    $('#addPerson').disabled=true;
    sb.from('agents').insert({id:id,name:name,sort_order:maxOrder+1,active:true}).then(function(r){must(r);
      $('#newName').value='';selAgent=id;lsSet('flabs_agent',id);entryDirty=false;toast(name+' added.');return loadAgents();
    }).catch(function(){toast('Could not add the name. Try again.')}).then(function(){$('#addPerson').disabled=false});
  }
  $('#agentSel').addEventListener('change',function(){
    selAgent=this.value;lsSet('flabs_agent',selAgent);
    if(entryDirty&&!entries[selAgent]){$('#entrySaved').textContent=selAgent?'Not saved yet for '+fmtDate(selDate)+'.':''}
    else{entryDirty=false;renderEntryForm(true)}
  });

  /* ---------- entry form ---------- */
  var F={closed:'#f-closed',pending:'#f-pending',inprog:'#f-inprog',bug:'#f-bug',ratings:'#f-ratings',avg:'#f-avg'};
  function renderEntryForm(force){
    if(entryDirty&&!force)return;
    var e=selAgent?entries[selAgent]:null;
    Object.keys(F).forEach(function(k){
      var el=$(F[k]);el.disabled=false;
      el.value=(e&&e[k]!=null)?e[k]:'';
    });
    $('#saveEntry').disabled=!sb||!canWrite;
    $('#entrySaved').textContent=e&&e.savedAt?('Saved today at '+e.savedAt+'. You can change and save again.'):(selAgent?'Not saved yet for '+fmtDate(selDate)+'.':'');
    entryChecks();
  }
  function entryChecks(){
    var ip=num($(F.inprog).value),av=num($(F.avg).value),rt=num($(F.ratings).value),cl=num($(F.closed).value);
    var h='';
    if(ip!=null)h+=ip===0?'<span class="chip ok">In progress is 0</span>':'<span class="chip bad">In progress must be 0 at end of day</span>';
    if(av!=null&&(rt||0)>0)h+=av>=4.5?'<span class="chip ok">Rating is 4.5 or above</span>':'<span class="chip warn">Rating is below 4.5. Add a note under Low rating review.</span>';
    if(rt!=null&&cl!=null&&rt<cl)h+='<span class="chip warn">Ratings taken ('+rt+') is less than closed ('+cl+')</span>';
    $('#entryChecks').innerHTML=h;
  }
  Object.keys(F).forEach(function(k){$(F[k]).addEventListener('input',function(){entryDirty=true;entryChecks()})});

  $('#saveEntry').addEventListener('click',function(){
    if(!sb||!canWrite)return;
    var cur=$('#agentSel').value;if(cur&&cur!==selAgent){selAgent=cur;lsSet('flabs_agent',cur)}
    if(!selAgent){toast('Choose your name first.');return}
    var a=agents.filter(function(x){return x.id===selAgent})[0];
    var d={};
    var keys=['closed','pending','inprog','bug','ratings'];
    for(var i=0;i<keys.length;i++){
      var v=$(F[keys[i]]).value.trim(), n=v===''?0:num(v);
      if(n==null||n<0||Math.floor(n)!==n){toast('Use whole numbers (0 or more) in the count fields.');return}
      d[keys[i]]=n;
    }
    var av=$(F.avg).value.trim();
    if(av===''){ if(d.ratings>0){toast('Enter the average rating.');return} d.avg=null }
    else{var x=num(av);if(x==null||x<0||x>5){toast('Average rating must be between 0 and 5.');return}d.avg=x}
    d.agentId=selAgent;d.name=a?a.name:selAgent;d.savedAt=nowIST();d.updatedAt=Date.now();
    var date=selDate,btn=this;btn.disabled=true;
    sb.from('entries').upsert({date:date,agent_id:selAgent,name:d.name,closed:d.closed,pending:d.pending,in_progress:d.inprog,bug:d.bug,ratings:d.ratings,avg:d.avg,saved_at:d.savedAt,updated_at:new Date().toISOString()},{onConflict:'date,agent_id'}).then(function(r){
      must(r);entryDirty=false;toast('Saved. Thank you, '+d.name+'.');
      return Promise.all([loadDate(),loadHistory()]);
    }).catch(function(){toast('Could not save. Check your connection and try again.')}).then(function(){btn.disabled=false});
  });

  function renderFill(){
    var list=rows(),done=list.filter(function(r){return r.e}).length;
    $('#fillSub').textContent=list.length?(done+' of '+list.length+' filled for '+fmtDate(selDate)):'';
    $('#fillChips').innerHTML=list.length?list.map(function(r){
      return '<span class="chip '+(r.e?'ok':'')+'">'+(r.e?'&#10003; ':'')+esc(r.name)+'</span>';
    }).join(''):'<span class="saved">Add support person names to get started.</span>';
  }

  /* ---------- sheet ---------- */
  function cell(v){return v==null?'<td class="n empty">&ndash;</td>':'<td class="n">'+esc(v)+'</td>'}
  function renderBoard(){
    var list=rows(),t=totals(list);
    var h='<thead><tr><th>Support person</th><th class="n">Closed</th><th class="n">Pending</th><th class="n">In progress</th><th class="n">Bug / Req.</th><th class="n">Ratings</th><th class="n">Avg rating</th></tr></thead><tbody>';
    if(!list.length)h+='<tr><td colspan="7" class="empty">No support persons yet.</td></tr>';
    list.forEach(function(r){
      var e=r.e;
      h+='<tr><td><div class="nm"><span>'+esc(r.name)+'</span><button data-edit="'+esc(r.id)+'">'+(e?'Edit':'Fill')+'</button></div></td>';
      if(!e){h+='<td class="n empty">&ndash;</td>'.repeat(6)+'</tr>';return}
      h+=cell(e.closed)+cell(e.pending)+'<td class="n'+(e.inprog>0?' v-bad':'')+'">'+esc(e.inprog)+'</td>'+cell(e.bug)+cell(e.ratings)+
         '<td class="n'+(e.avg!=null&&e.avg<4.5?' v-warn':'')+'">'+(e.avg==null?'&ndash;':esc(fmtAvg(e.avg)))+'</td></tr>';
    });
    h+='<tr class="total"><td>Team total / avg</td><td class="n">'+t.closed+'</td><td class="n">'+t.pending+'</td><td class="n'+(t.inprog>0?' v-bad':'')+'">'+t.inprog+'</td><td class="n">'+t.bug+'</td><td class="n">'+t.ratings+'</td><td class="n">'+(t.avg==null?'&ndash;':fmtAvg(t.avg))+'</td></tr></tbody>';
    $('#board').innerHTML=h;
  }
  $('#board').addEventListener('click',function(ev){
    var b=ev.target.closest('button[data-edit]');if(!b)return;
    selAgent=b.dataset.edit;lsSet('flabs_agent',selAgent);entryDirty=false;
    renderPeople();setTab('entry');
  });

  var draft=null;
  function bugsFromDay(d){
    var b=(d&&d.bugs)?d.bugs.slice():[];
    while(b.length<2)b.push({});
    return b;
  }
  function renderLead(force,useDraft){
    if(leadDirty&&!force&&!useDraft)return;
    var d=useDraft?draft:(dayDoc||{}),ag=d.aging||{};
    bugRows=bugsFromDay(d);
    var dis=(!sb||!canWrite)?' disabled':'';
    var h='<h2>Sheet details</h2><p class="sub">Filled by the team lead for '+fmtDate(selDate)+'.</p>'+
    '<div class="grid2"><div class="field"><label for="l-lead">Team lead name</label><input id="l-lead" type="text" value="'+esc(d.teamLead!=null?d.teamLead:'Sunny')+'"'+dis+'></div>'+
    '<div class="field"><label for="l-rep">Reporting to</label><input id="l-rep" type="text" value="'+esc(d.reportingTo!=null?d.reportingTo:'Tanuj / Saurabh')+'"'+dis+'></div></div>'+
    '<h2 style="margin-top:20px">2. Ticket delay &amp; aging check (end of day count)</h2>'+
    '<div class="grid5" style="margin-top:8px">'+
      agingField('l-a-total','Total active tickets',ag.total,dis)+agingField('l-a-le30','Closed in 30 mins or less',ag.le30,dis)+
      agingField('l-a-m4','Open 30m to 4 hours',ag.m30_4h,dis)+agingField('l-a-h24','Open 4h to 24 hours',ag.h4_24,dis)+agingField('l-a-gt24','Open beyond 24h (goal 0)',ag.gt24,dis)+
    '</div>'+
    '<h2 style="margin-top:20px">3. Bugs &amp; feature requirements sent to Shivam</h2>'+
    '<div class="scroll bugs" style="margin-top:8px"><table style="min-width:720px"><thead><tr><th>Ticket # / Lab</th><th>Urgent?</th><th style="width:34%">What is the bug / feature needed?</th><th>Sent to</th><th>Time sent</th><th>Shivam confirmed?</th></tr></thead><tbody>'+
    bugRows.map(function(b,i){
      return '<tr><td><input data-b="ticket" data-i="'+i+'" value="'+esc(b.ticket||'')+'"'+dis+' aria-label="Ticket or lab"></td>'+
      '<td><select data-b="urgent" data-i="'+i+'"'+dis+' aria-label="Urgent"><option></option><option'+(b.urgent==='Yes'?' selected':'')+'>Yes</option><option'+(b.urgent==='No'?' selected':'')+'>No</option></select></td>'+
      '<td><input data-b="desc" data-i="'+i+'" value="'+esc(b.desc||'')+'"'+dis+' aria-label="Bug or feature"></td>'+
      '<td>Shivam</td>'+
      '<td><input data-b="time" data-i="'+i+'" value="'+esc(b.time||'')+'" placeholder="HH:MM"'+dis+' aria-label="Time sent"></td>'+
      '<td><select data-b="confirmed" data-i="'+i+'"'+dis+' aria-label="Confirmed"><option></option><option'+(b.confirmed==='Yes'?' selected':'')+'>Yes</option><option'+(b.confirmed==='No'?' selected':'')+'>No</option></select></td></tr>';
    }).join('')+'</tbody></table></div>'+
    '<div class="actions" style="margin-top:8px"><button class="btn ghost small" id="addBug"'+dis+'>Add another row</button></div>'+
    '<div class="field" style="margin-top:20px"><label for="l-low">Low rating review (1, 2 or 3 star tickets). Write lab name, why the rating was low, and what was done to fix it.</label><textarea id="l-low"'+dis+'>'+esc(d.lowRatings||'')+'</textarea></div>'+
    '<div class="grid2" style="margin-top:16px"><div class="field"><label for="l-sig">Team lead EOD sign-off (type your name)</label><input id="l-sig" type="text" value="'+esc(d.signature||'')+'"'+dis+'></div>'+
    '<div class="field"><label for="l-time">Sign-off time</label><div class="row" style="flex-wrap:nowrap"><input id="l-time" type="text" value="'+esc(d.signTime||'')+'" placeholder="HH:MM"'+dis+'><button class="btn ghost small" id="nowBtn" type="button"'+dis+'>Now</button></div></div></div>'+
    '<div class="actions"><button class="btn" id="saveLead"'+dis+'>Save sheet details</button><button class="btn ghost" id="pdfBtn">Download PDF</button><span class="saved" id="leadSaved">'+(d.updatedAt?'Last saved '+esc(new Date(d.updatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})):'')+'</span></div>';
    $('#leadCard').innerHTML=h;
  }
  function agingField(id,label,v,dis){return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="number" inputmode="numeric" min="0" step="1" value="'+(v==null?'':esc(v))+'"'+dis+'></div>'}
  function collectBugs(){
    document.querySelectorAll('#leadCard [data-b]').forEach(function(el){
      var i=+el.dataset.i;bugRows[i]=bugRows[i]||{};bugRows[i][el.dataset.b]=el.value;
    });
  }
  function renderSheet(force){renderBoard();renderLead(force)}

  $('#leadCard').addEventListener('input',function(){leadDirty=true});
  $('#leadCard').addEventListener('change',function(){leadDirty=true});
  $('#leadCard').addEventListener('click',function(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.id==='addBug'){draft=leadData();draft.bugs=bugRows.slice();draft.bugs.push({});leadDirty=true;renderLead(false,true);return}
    if(t.id==='nowBtn'){$('#l-time').value=nowIST();leadDirty=true;return}
    if(t.id==='saveLead')saveLead(t);
    if(t.id==='pdfBtn')makePdf(t);
  });
  function aging(id){var v=$(id).value.trim();return v===''?null:num(v)}
  function leadData(){
    collectBugs();
    var bugs=bugRows.filter(function(b){return b&&(b.ticket||b.desc||b.time||b.urgent||b.confirmed)}).map(function(b){
      return {ticket:b.ticket||'',urgent:b.urgent||'',desc:b.desc||'',time:b.time||'',confirmed:b.confirmed||''}});
    return {date:selDate,teamLead:$('#l-lead').value.trim(),reportingTo:$('#l-rep').value.trim(),
      aging:{total:aging('#l-a-total'),le30:aging('#l-a-le30'),m30_4h:aging('#l-a-m4'),h4_24:aging('#l-a-h24'),gt24:aging('#l-a-gt24')},
      bugs:bugs,lowRatings:$('#l-low').value.trim(),signature:$('#l-sig').value.trim(),signTime:$('#l-time').value.trim(),updatedAt:Date.now()};
  }
  function saveLead(btn){
    if(!sb||!canWrite)return;
    var d=leadData(),date=selDate;btn.disabled=true;
    sb.from('days').upsert({date:date,team_lead:d.teamLead,reporting_to:d.reportingTo,aging:d.aging,bugs:d.bugs,low_ratings:d.lowRatings,signature:d.signature,sign_time:d.signTime,updated_at:new Date().toISOString()},{onConflict:'date'}).then(function(r){must(r);leadDirty=false;draft=null;toast('Sheet details saved.');return Promise.all([loadDate(),loadHistory()])})
      .catch(function(){toast('Could not save. Try again.')}).then(function(){btn.disabled=false});
  }

  /* ---------- data loading (Supabase) ---------- */
  function loadAgents(){
    return sb.from('agents').select('*').order('sort_order').then(function(r){
      agents=must(r).map(function(x){return {id:x.id,name:x.name,order:x.sort_order,active:x.active}});renderPeople();
    }).catch(function(){banner('Could not load names. Check your internet and the Supabase settings in config.js.')});
  }
  function loadDate(){
    var d=selDate;
    return Promise.all([sb.from('entries').select('*').eq('date',d),sb.from('days').select('*').eq('date',d).maybeSingle()]).then(function(res){
      if(d!==selDate)return;
      var er=must(res[0]),dr=must(res[1]);
      entries={};er.forEach(function(x){entries[x.agent_id]={agentId:x.agent_id,name:x.name,closed:x.closed,pending:x.pending,inprog:x.in_progress,bug:x.bug,ratings:x.ratings,avg:x.avg==null?null:Number(x.avg),savedAt:x.saved_at}});
      dayDoc=dr?{teamLead:dr.team_lead,reportingTo:dr.reporting_to,aging:dr.aging||{},bugs:dr.bugs||[],lowRatings:dr.low_ratings,signature:dr.signature,signTime:dr.sign_time,updatedAt:dr.updated_at?new Date(dr.updated_at).getTime():0}:{};
      renderEntryForm(false);renderFill();if(tab==='sheet'){renderBoard();renderLead(false)}
    }).catch(function(){banner('Could not load this day. Check your internet and the Supabase settings in config.js.')});
  }
  function loadHistory(){
    return Promise.all([sb.from('entries').select('date,closed,ratings,avg').order('date',{ascending:false}).limit(2000),sb.from('days').select('date,signature').order('date',{ascending:false}).limit(400)]).then(function(res){
      var er=must(res[0]),dr=must(res[1]),by={},signed={};
      dr.forEach(function(x){if(x.signature)signed[x.date]=1});
      er.forEach(function(x){
        var o=by[x.date]=by[x.date]||{date:x.date,people:0,closed:0,ratings:0,ws:0};
        o.people++;o.closed+=x.closed||0;o.ratings+=x.ratings||0;if(x.avg!=null&&x.ratings>0)o.ws+=Number(x.avg)*x.ratings;
      });
      logdays=Object.keys(by).sort().reverse().map(function(k){var o=by[k];return {date:k,people:o.people,closed:o.closed,avg:o.ratings?o.ws/o.ratings:null,signed:!!signed[k]}});
      renderHist();
    }).catch(function(){});
  }
  function renderHist(){
    var el=$('#histList');
    if(!logdays.length){el.innerHTML='<div class="empty-state">No days saved yet. The first entry saved on the My entry tab will appear here.</div>';return}
    el.innerHTML=logdays.map(function(l){
      return '<button class="hrow" data-d="'+esc(l.date)+'"><span><span class="k">Date</span><span class="d">'+fmtDate(l.date)+'</span></span>'+
      '<span><span class="k">Closed</span><span class="d">'+(l.closed||0)+'</span></span>'+
      '<span><span class="k">People filled</span><span class="d">'+(l.people||0)+'</span></span>'+
      '<span><span class="k">Avg rating</span><span class="d">'+(l.avg==null?'&ndash;':fmtAvg(l.avg))+'</span></span>'+
      '<span class="chip '+(l.signed?'ok':'')+'">'+(l.signed?'Signed off':'Not signed')+'</span></button>';
    }).join('');
  }
  $('#histList').addEventListener('click',function(ev){
    var b=ev.target.closest('button[data-d]');if(!b)return;
    changeDate(b.dataset.d);setTab('sheet');
  });

  /* ---------- date ---------- */
  function changeDate(d){
    if(!d)return;selDate=d;$('#dateInput').value=d;entryDirty=false;leadDirty=false;
    entries={};dayDoc={};draft=null;renderEntryForm(true);renderFill();if(tab==='sheet')renderSheet(true);loadDate();
  }
  $('#dateInput').addEventListener('change',function(){changeDate(this.value)});

  /* ---------- PDF ---------- */
  function makePdf(btn){
    if(!window.jspdf||!window.jspdf.jsPDF){toast('PDF tool did not load. Reload the page and try again.');return}
    var list=rows(),t=totals(list),d=leadData();
    var jsPDF=window.jspdf.jsPDF,doc=new jsPDF({unit:'pt',format:'a4'});
    var W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36;
    var HEAD=[31,45,41];
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(90);
    doc.text('SUPPORT TEAM OPERATIONS',M,36);doc.text('Ref: FLABS-SPT-02',W-M,36,{align:'right'});
    doc.setTextColor(20);doc.setFontSize(16);doc.text('DAILY WORK CHECKLIST',W/2,58,{align:'center'});
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text((d.teamLead||'Team Lead')+' - Ticket Support Team Lead',W/2,72,{align:'center'});
    doc.setDrawColor(20);doc.setLineWidth(1.2);doc.line(M,82,W-M,82);
    doc.setFontSize(9);doc.text('Team Lead Name: '+(d.teamLead||''),M,98);doc.text('Reporting To: '+(d.reportingTo||''),W/2,98,{align:'center'});doc.text('Date: '+fmtDate(selDate),W-M,98,{align:'right'});

    function heading(txt,y){doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(20);doc.text(txt,M,y)}
    var styles={fontSize:9,cellPadding:4,lineColor:[200,208,205],lineWidth:.5,textColor:20};
    var headStyles={fillColor:HEAD,textColor:255,fontStyle:'bold',fontSize:8.5};

    heading('1. SUPPORT AGENT LEADERBOARD',118);
    var body=list.map(function(r){var e=r.e;return e?[r.name,e.closed,e.pending,e.inprog,e.bug,e.ratings,e.avg==null?'':fmtAvg(e.avg)]:[r.name,'','','','','','']});
    body.push(['Team Total / Avg',t.filled?t.closed:'',t.filled?t.pending:'',t.filled?t.inprog:'',t.filled?t.bug:'',t.filled?t.ratings:'',t.avg==null?'':fmtAvg(t.avg)]);
    doc.autoTable({startY:124,head:[['Support Person Name','Closed','Pending','In Progress (Goal: 0)','Bug / Requirement','Ratings Taken (#)','Avg Rating (/5)']],body:body,
      styles:styles,headStyles:headStyles,margin:{left:M,right:M},
      columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}},
      didParseCell:function(h){if(h.section==='body'&&h.row.index===body.length-1){h.cell.styles.fontStyle='bold';h.cell.styles.fillColor=[230,238,235]}}});
    var y=doc.lastAutoTable.finalY+14;
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90);
    doc.text('Key Support Rules: Zero In-Progress at EOD. Close every ticket within 30 minutes. Always collect a rating before closing. Maintain 4.5 or above.',M,y,{maxWidth:W-2*M});
    y+=24;
    if(y>H-160){doc.addPage();y=40}
    heading('2. TICKET DELAY & AGING CHECK (END OF DAY COUNT)',y);
    var ag=d.aging;function a(v){return v==null?'':v}
    doc.autoTable({startY:y+6,head:[['Total Active Tickets','Closed in <=30 Mins','Open 30m - 4 Hours','Open 4h - 24 Hours','Open Beyond 24h (Goal: 0)']],body:[[a(ag.total),a(ag.le30),a(ag.m30_4h),a(ag.h4_24),a(ag.gt24)]],
      styles:Object.assign({},styles,{halign:'center',minCellHeight:20}),headStyles:Object.assign({},headStyles,{halign:'center'}),margin:{left:M,right:M}});
    y=doc.lastAutoTable.finalY+20;
    if(y>H-200){doc.addPage();y=40}
    heading('3. BUGS & FEATURE REQUIREMENTS SENT TO SHIVAM',y);
    var br=d.bugs.length?d.bugs:[{},{}];
    doc.autoTable({startY:y+6,head:[['Ticket # / Lab','Urgent?','What is the Bug / Feature Needed?','Sent to','Time Sent','Shivam Confirmed?']],
      body:br.map(function(b){return [b.ticket||'',b.urgent||'',b.desc||'','Shivam',b.time||'',b.confirmed||'']}),
      styles:Object.assign({},styles,{minCellHeight:20}),headStyles:headStyles,margin:{left:M,right:M},columnStyles:{2:{cellWidth:170}}});
    y=doc.lastAutoTable.finalY+20;
    if(y>H-170){doc.addPage();y=40}
    heading('LOW RATING REVIEW (1, 2, OR 3 STAR TICKETS)',y);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(20);
    var low=doc.splitTextToSize(d.lowRatings||'-',W-2*M);
    doc.text(low,M,y+14);
    y+=14+low.length*11+22;
    if(y>H-80){doc.addPage();y=40}
    doc.setDrawColor(150);doc.setLineWidth(.5);doc.line(M,y,W-M,y);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text((d.teamLead||'TEAM LEAD').toUpperCase()+' EOD SIGN-OFF',M,y+16);
    doc.setFont('helvetica','normal');doc.text('Signature:',M,y+34);
    doc.setFont('helvetica','italic');doc.setFontSize(13);doc.text(d.signature||'',M+52,y+34);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Time:',W/2+40,y+34);doc.setFont('helvetica','bold');doc.text(d.signTime||'',W/2+68,y+34);

    var fname='Daily-Work-Checklist-'+selDate+'.pdf';
    try{doc.save(fname);toast('PDF downloaded.')}catch(e){toast('Could not create the PDF.')}
  }

  /* ---------- boot ---------- */
  $('#dateInput').value=selDate;
  renderPeople();renderHist();
  var cfg=window.APP_CONFIG||{};
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||/YOUR-PROJECT|YOUR_/.test(cfg.SUPABASE_URL+cfg.SUPABASE_ANON_KEY)){
    banner('Database not connected. Open config.js, paste your Supabase Project URL and anon key, save, and redeploy (README step 1). Until then names and numbers cannot be saved.');
  }else if(!(window.supabase&&window.supabase.createClient)){
    banner('Could not load the database library. Check your internet connection and reload.');
  }else{
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    loadAgents().then(function(){return Promise.all([loadDate(),loadHistory()])});
    pollT=setInterval(function(){
      if(document.visibilityState!=='visible')return;
      loadAgents();loadDate();loadHistory();
    },20000);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){loadAgents();loadDate();loadHistory()}});
  }
})();

