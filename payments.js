(function(){
  'use strict';

  const classFilter = document.getElementById('classFilter');
  const studentSelect = document.getElementById('studentSelect');
  const paymentForm = document.getElementById('paymentForm');
  const amountInput = document.getElementById('amount');
  const dateInput = document.getElementById('pdate');
  const noteInput = document.getElementById('note');
  const submitBtn = paymentForm.querySelector('button[type="submit"]');

  const studentsTableBody = document.querySelector('#studentsTable tbody');
  const paymentsTitle = document.getElementById('paymentsTitle');
  const paymentsTableBody = document.querySelector('#paymentsTable tbody');

  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');

  function escapeHtml(str){
    return String(str||'').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }
  function formatMoney(n){ return new Intl.NumberFormat('so-SO', { style:'currency', currency:'USD', currencyDisplay:'narrowSymbol' }).format(Number(n||0)); }

  function allClasses(){
    const set = new Set(StorageAPI.getStudents().map(s=>s.className).filter(Boolean));
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }

  function renderClassFilter(){
    const classes = allClasses();
    const old = classFilter.value;
    classFilter.innerHTML = '<option value="">Dhammaan fasallada</option>' + classes.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if(classes.includes(old)) classFilter.value = old; else classFilter.value = '';
  }

  function currentStudents(){
    const sel = classFilter.value;
    const list = StorageAPI.getStudents();
    let filtered = sel ? list.filter(s => s.className === sel) : list;
    const box = document.getElementById('searchBoxPay');
    const q = (box?.value || '').trim().toLowerCase();
    if(!q) return filtered;
    return filtered.filter(s => s.name.toLowerCase().includes(q) || (s.className||'').toLowerCase().includes(q));
  }

  function renderStudentSelect(){
    const list = currentStudents();
    const old = studentSelect.value;
    studentSelect.innerHTML = '<option value="" disabled selected>-- dooro arday --</option>' + list.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.className)})</option>`).join('');
    if(list.some(s=>s.id===old)) studentSelect.value = old;
  }

  let payRestMode = false;

  function renderStudentsTable(){
    const rows = currentStudents().map(s => {
      const paid = StorageAPI.sumPaid(s);
      const rem = StorageAPI.remaining(s);
      const actions = rem > 0
        ? `<button class="ghost" data-action="view">Muuji Bixinnada</button> <button class="primary" data-action="pay-rest">Bixi Harsan</button>`
        : `<button class="ghost" data-action="view">Muuji Bixinnada</button>`;
      return `<tr data-id="${s.id}">
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.className)}</td>
        <td>${formatMoney(s.totalFee)}</td>
        <td>${formatMoney(paid)}</td>
        <td>${formatMoney(rem)}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
    studentsTableBody.innerHTML = rows || '<tr><td colspan="6">Ma jiro arday fasalkan.</td></tr>';
  }

  function renderPaymentsTable(studentId){
    const s = StorageAPI.getStudents().find(x=>x.id===studentId);
    if(!s){ paymentsTitle.textContent=''; paymentsTableBody.innerHTML=''; return; }
    paymentsTitle.textContent = `${s.name} — ${s.className}`;
    paymentsTableBody.innerHTML = (s.payments||[]).map(p=>`<tr data-student-id="${s.id}" data-payment-id="${p.id}">
      <td>${escapeHtml(p.date||'')}</td>
      <td>${formatMoney(p.amount)}</td>
      <td>${escapeHtml(p.note||'')}</td>
      <td><button class="danger" data-action="delete-payment">Tirtir</button></td>
    </tr>`).join('') || '<tr><td colspan="4">Ma jiro bixin wali.</td></tr>';
  }

  classFilter.addEventListener('change', () => { renderStudentSelect(); renderStudentsTable(); paymentsTitle.textContent=''; paymentsTableBody.innerHTML=''; });
  const searchBoxPay = document.getElementById('searchBoxPay');
  if (searchBoxPay) { searchBoxPay.addEventListener('input', () => { renderStudentSelect(); renderStudentsTable(); }); }

  studentsTableBody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = btn.closest('tr'); const id = tr?.getAttribute('data-id'); if(!id) return;
    const action = btn.getAttribute('data-action');
    if(action==='view'){ renderPaymentsTable(id); studentSelect.value = id; }
    else if(action==='pay-rest'){
      const s = StorageAPI.getStudents().find(x=>x.id===id); if(!s) return;
      const rem = StorageAPI.remaining(s);
      studentSelect.value = id;
      amountInput.value = rem > 0 ? rem : '';
      dateInput.value = new Date().toISOString().slice(0,10);
      noteInput.value = 'Bixin harsan';
      amountInput.focus();
      toast('Qaddarka harsan waa la buuxiyay');
      // UX: scroll and highlight form, change submit text
      payRestMode = true;
      if (submitBtn) submitBtn.textContent = 'Bixi Harsan';
      paymentForm.classList.add('highlight');
      paymentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  paymentForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const sid = studentSelect.value; if(!sid) return;
    let amount = Number(amountInput.value); if(isNaN(amount) || amount<=0) return;
    const date = dateInput.value || new Date().toISOString().slice(0,10);
    const note = noteInput.value.trim();
    const s = StorageAPI.getStudents().find(x=>x.id===sid); if(!s) return;
    const rem = StorageAPI.remaining(s);
    if(amount > rem){ amount = rem; toast('Qaddarka waa ka badan yahay harsan — waxaa loo dajiyay qaddarka harsan.'); }
    if(amount <= 0){ return; }
    StorageAPI.recordPayment(sid, { amount, date, note });
    paymentForm.reset(); studentSelect.value = sid;
    renderStudentsTable(); renderPaymentsTable(sid);
    toast('Bixin waa lagu daray');
    // reset UX state
    payRestMode = false;
    if (submitBtn) submitBtn.textContent = 'Ku dar Bixin';
    paymentForm.classList.remove('highlight');
  });

  paymentsTableBody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = btn.closest('tr');
    const sid = tr?.getAttribute('data-student-id');
    const pid = tr?.getAttribute('data-payment-id');
    const action = btn.getAttribute('data-action');
    if(action==='delete-payment'){
      if(!confirm('Ma hubtaa inaad tirtirayso bixintan?')) return;
      StorageAPI.deletePayment(sid, pid);
      renderStudentsTable(); renderPaymentsTable(sid);
      toast('La tirtiray');
    }
  });

  // Export/Import JSON
  exportBtn.addEventListener('click', () => {
    const data = StorageAPI.loadState();
    if(!data.students.length){ alert('Ma jirto xog la dhoofiyo'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='students-fees.json'; a.click(); URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text(); const data = JSON.parse(text);
      StorageAPI.replaceState(data);
      renderClassFilter(); renderStudentSelect(); renderStudentsTable(); paymentsTitle.textContent=''; paymentsTableBody.innerHTML='';
      toast('Xogta waa la soo dejiyay');
    }catch{ alert('Fayl sax ah ma aha'); }
    finally{ importInput.value=''; }
  });

  function toast(msg){
    let el = document.getElementById('toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; Object.assign(el.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'rgba(17,24,39,0.95)',border:'1px solid #1f2937',color:'#e5e7eb',padding:'10px 14px',borderRadius:'8px',zIndex:'1000'}); document.body.appendChild(el);}    
    el.textContent = msg; el.style.opacity='1';
    clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(()=>{ el.style.opacity='0'; }, 1400);
  }

  // Init
  renderClassFilter();
  renderStudentSelect();
  renderStudentsTable();
})();
