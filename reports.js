(function(){
  'use strict';

  const classFilter = document.getElementById('classFilter');
  const statusFilter = document.getElementById('statusFilter');
  const tbody = document.querySelector('#reportTable tbody');
  const exportExcelBtn = document.getElementById('exportExcel');

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

  function currentRows(){
    const selClass = classFilter.value;
    const selStatus = statusFilter.value; // '', 'paid','partial','unpaid'
    let list = StorageAPI.getStudents();
    if(selClass) list = list.filter(s => s.className === selClass);
    if(selStatus) list = list.filter(s => StorageAPI.status(s) === selStatus);
    return list;
  }

  function statusLabel(code){
    if(code==='paid') return 'La bixiyay dhammaan';
    if(code==='partial') return 'Qayb ahaan la bixiyay';
    if(code==='unpaid') return 'Aan la bixin';
    if(code==='free') return 'Bilaash';
    return code;
  }

  function renderTable(){
    const rows = currentRows().map(s => {
      const paid = StorageAPI.sumPaid(s);
      const rem = StorageAPI.remaining(s);
      const st = StorageAPI.status(s);
      return `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.className)}</td>
        <td>${formatMoney(s.totalFee)}</td>
        <td>${formatMoney(paid)}</td>
        <td>${formatMoney(rem)}</td>
        <td>${statusLabel(st)}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="6">Natiijo ma jirto.</td></tr>';
  }

  async function exportExcel(){
    // Use ExcelJS for styled headers and flexible number format
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Warbixin');

    ws.columns = [
      { header: 'Magac', key: 'name', width: 22 },
      { header: 'Fasalka', key: 'class', width: 16 },
      { header: 'Lacagta Guud', key: 'total', width: 16, style: { numFmt: '#,##0.##' } },
      { header: 'La bixiyey', key: 'paid', width: 16, style: { numFmt: '#,##0.##' } },
      { header: 'Harsan', key: 'balance', width: 16, style: { numFmt: '#,##0.##' } },
      { header: 'Xaalad', key: 'status', width: 22 }
    ];

    const rows = currentRows().map(s => ({
      name: s.name,
      class: s.className,
      total: Number(s.totalFee)||0,
      paid: StorageAPI.sumPaid(s),
      balance: StorageAPI.remaining(s),
      status: (()=>{ const st = StorageAPI.status(s); return st==='paid'?'La bixiyay dhammaan':(st==='partial'?'Qayb ahaan la bixiyay':'Aan la bixin'); })()
    }));
    ws.addRows(rows);

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 18;

    // Autofilter entire used range
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: 6 } };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'warbixin_lacag.xlsx'; a.click(); URL.revokeObjectURL(url);
  }

  classFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);
  exportExcelBtn.addEventListener('click', exportExcel);

  // Init
  renderClassFilter();
  renderTable();
})();
