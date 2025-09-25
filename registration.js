(function(){
  'use strict';

  const tBody = document.querySelector('#studentsTable tbody');
  const singleForm = document.getElementById('singleForm');
  const nameInput = document.getElementById('name');
  const klassInput = document.getElementById('klass');
  const feeInput = document.getElementById('fee');
  const submitBtn = singleForm.querySelector('button[type="submit"]');
  const searchBoxReg = document.getElementById('searchBoxReg');

  const excelInput = document.getElementById('excelInput');
  const uploadExcelBtn = document.getElementById('uploadExcelBtn');
  const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
  const preview = document.getElementById('preview');

  function formatMoney(n){
    return new Intl.NumberFormat('so-SO', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(Number(n||0));
  }

  let editId = null; // currently editing student id

  function filteredStudents(){
    const q = (searchBoxReg?.value || '').trim().toLowerCase();
    const students = StorageAPI.getStudents();
    if(!q) return students;
    return students.filter(s => s.name.toLowerCase().includes(q) || (s.className||'').toLowerCase().includes(q));
  }

  function renderTable(){
    const students = filteredStudents();
    const rows = students.map(s => {
      const paid = StorageAPI.sumPaid(s);
      const rem = StorageAPI.remaining(s);
      return `<tr data-id="${s.id}">
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.className)}</td>
        <td>${formatMoney(s.totalFee)}</td>
        <td>${formatMoney(paid)}</td>
        <td>${formatMoney(rem)}</td>
        <td>
          <button type="button" class="ghost" data-action="edit">Beddel</button>
          <button type="button" class="danger" data-action="delete">Tirtir</button>
        </td>
      </tr>`;
    }).join('');
    tBody.innerHTML = rows || '<tr><td colspan="6">Ma jiro arday wali.</td></tr>';
  }

  function escapeHtml(str){
    return String(str||'').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  singleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const className = klassInput.value.trim();
    const totalFee = Number(feeInput.value);
    if(!name || !className || isNaN(totalFee)) return;
    if(editId){
      StorageAPI.updateStudent(editId, { name, className, totalFee });
      editId = null;
      if (submitBtn) submitBtn.textContent = 'Ku dar Arday';
    } else {
      StorageAPI.addStudent({ name, className, totalFee });
    }
    singleForm.reset();
    renderTable();
    toast('Kayd waa la cusbooneysiiyay');
  });

  // Row actions: Edit / Delete
  tBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;
    const action = btn.getAttribute('data-action');
    if (action === 'delete') {
      if (!confirm('Ma hubtaa inaad tirtirayso ardaygan iyo bixintiisa?')) return;
      StorageAPI.removeStudent(id);
      if (editId === id) {
        editId = null;
        singleForm.reset();
        if (submitBtn) submitBtn.textContent = 'Ku dar Arday';
      }
      renderTable();
      toast('La tirtiray');
    } else if (action === 'edit') {
      const s = StorageAPI.getStudentById(id);
      if (!s) return;
      nameInput.value = s.name;
      klassInput.value = s.className;
      feeInput.value = s.totalFee;
      editId = id;
      if (submitBtn) submitBtn.textContent = 'Cusbooneysii';
    }
  });

  uploadExcelBtn.addEventListener('click', async () => {
    const file = excelInput.files?.[0];
    if(!file){ alert('Dooro fayl Excel.'); return; }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    // Accept both English and Somali headers, including free/bilaash flag
    const mapped = rows.map(r => ({
      Name: r.Name || r.Magac || r.MAGAC || r["Magaca Ardayga"] || r["magaca"],
      Class: r.Class || r.Fasalka || r.FASAL || r["Fasalka"],
      TotalFee: r.TotalFee || r.LacagtaGuud || r["Lacagta Guud"] || r["Lacagta"],
      Free: r.Free ?? r.Bilaash ?? r["Bilaash"] ?? r["free"] ?? r["FREE"] ?? ''
    }));

    // Preview
    const table = XLSX.utils.json_to_sheet(mapped);
    const html = XLSX.utils.sheet_to_html(table);
    preview.innerHTML = html;
    preview.classList.remove('hidden');

    // Persist
    let count = 0;
    const truthy = (v) => {
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === 'yes' || s === 'haa' || s === 'ha' || s === '1' || s === 'bilaash' || s === 'free';
    };
    for(const r of mapped){
      const name = String(r.Name||'').trim();
      const className = String(r.Class||'').trim();
      const free = truthy(r.Free);
      const totalFee = free ? 0 : Number(r.TotalFee||0);
      if(!name || !className) continue;
      StorageAPI.addStudent({ name, className, totalFee, free });
      count++;
    }
    renderTable();
    toast(`${count} arday ayaa lagu daray`);
  });

  downloadTemplateBtn.addEventListener('click', async () => {
    // Build with ExcelJS to get header styles
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Diiwaangelin');

    // Columns and widths
    ws.columns = [
      { header: 'Magac', key: 'name', width: 22 },
      { header: 'Fasalka', key: 'class', width: 16 },
      { header: 'Lacagta Guud', key: 'total', width: 16, style: { numFmt: '#,##0.##' } },
      { header: 'Bilaash', key: 'free', width: 12 }
    ];

    // Sample rows
    ws.addRow({ name: 'Xasan Cali', class: 'Fasal 7', total: 120, free: false });
    ws.addRow({ name: 'Maryan Axmed', class: 'Fasal 8', total: 0, free: true });

    // Header styling (first row)
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // dark gray
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 18;

    // Autofilter
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: 4 } };

    // Output
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tusaale_arday.xlsx'; a.click(); URL.revokeObjectURL(url);
  });

  // Export/Import JSON same as index
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  exportBtn.addEventListener('click', () => {
    const data = StorageAPI.loadState();
    if(!data.students.length){ alert('Ma jirto xog la dhoofiyo'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'students-fees.json'; a.click(); URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      StorageAPI.replaceState(data);
      renderTable();
      toast('Xogta waa la soo dejiyay');
    }catch{
      alert('Fayl sax ah ma aha');
    } finally { importInput.value=''; }
  });

  function toast(msg){
    let el = document.getElementById('toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; Object.assign(el.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'rgba(17,24,39,0.95)',border:'1px solid #1f2937',color:'#e5e7eb',padding:'10px 14px',borderRadius:'8px',zIndex:'1000'}); document.body.appendChild(el);}    
    el.textContent = msg; el.style.opacity='1';
    clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(()=>{ el.style.opacity='0'; }, 1400);
  }

  renderTable();

  if (searchBoxReg) {
    searchBoxReg.addEventListener('input', renderTable);
  }
})();
