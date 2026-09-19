function renderOp(){
let trains=RailETA.getTrains(),events=RailETA.getEvents(),stats=RailETA.getNetworkStats();
document.getElementById('activeTrains').textContent=stats.activeTrains;
document.getElementById('delayedTrains').textContent=stats.delayed;
document.getElementById('delayedNote').textContent=stats.needAttention+' need attention';
document.getElementById('eventCount').textContent=stats.activeEvents;
document.getElementById('highRisk').textContent=stats.highRisk;
document.getElementById('trainTable').innerHTML=trains.map(t=>`<tr><td>${UI.formatTrain(t)}</td><td>${t.location}</td><td>${t.speed} km/h</td><td>+${t.delay} min</td><td><b>+${t.predictedDelay} min</b></td><td>${UI.risk(t.risk)}</td><td>${t.status}</td><td><button class="btn small secondary" onclick="showTrain('${t.id}')">View</button></td></tr>`).join('');
document.getElementById('eventList').innerHTML=events.length?events.slice(0,4).map(e=>`<div class="side-event"><i class="event-dot ${e.severity==='High'?'red':''}"></i><div><b>${e.location} · ${e.type}</b><br><small class="muted">${e.severity} severity · ${e.affected} affected trains</small></div></div>`).join(''):'<p class="muted">✓ No active operational events. Network is currently operating normally.</p>'}
function showTrain(id){let t=RailETA.getTrain(id);UI.modal('trainDetail',`<h2>Train ${t.id}</h2><p class="muted">Current prediction detail</p><div class="grid two"><div class="card"><span class="label">CURRENT LOCATION</span><b>${t.location}</b></div><div class="card"><span class="label">CURRENT SPEED</span><b>${t.speed} km/h</b></div><div class="card"><span class="label">PREDICTED DESTINATION DELAY</span><b>+${t.predictedDelay} min</b></div><div class="card"><span class="label">CONFIDENCE</span><b>${t.confidence}% · ${t.risk}</b></div></div><div class="actions"><button class="btn" data-close>Close</button></div>`)}
document.addEventListener('DOMContentLoaded',()=>{renderOp();drawRailMap('operatorMap',true)});
window.addEventListener('railsync-update',renderOp);
