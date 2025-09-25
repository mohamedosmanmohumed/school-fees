(function () {
  'use strict';

  // Simple i18n map (Somali labels). You can edit these words if you prefer other terms.
  const t = {
    addedStudent: 'Arday waa lagu daray',
    addedPayment: 'Bixin waa lagu daray',
    deleted: 'La tirtiray',
    confirmDeleteStudent: 'Ma hubtaa inaad tirtirayso ardaygan iyo dhammaan bixintiisa?',
    confirmDeletePayment: 'Ma hubtaa inaad tirtirayso bixintan?',
    importSuccess: 'Xogta waa la soo dejiyay',
    importError: 'Fayl sax ah ma aha',
    nothingToExport: 'Ma jirto xog la dhoofiyo',
  };

  // LocalStorage helpers
  const STORAGE_KEY = 'fees_app_v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { students: [] };
      const data = JSON.parse(raw);
      if (!Array.isArray(data.students)) return { students: [] };
      // Normalize
      data.students.forEach(s => { s.payments = Array.isArray(s.payments) ? s.payments : []; });
      return data;
    } catch {
      return { students: [] };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ID generator
  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // In-memory state
  let state = loadState();

  // Elements
  const studentForm = document.getElementById('studentForm');
  const nameInput = document.getElementById('studentName');
  const classInput = document.getElementById('studentClass');
  const totalFeeInput = document.getElementById('totalFee');
  const freeFlagInput = document.getElementById('freeFlag');
  const totalFeeRow = document.getElementById('totalFeeRow');

  const studentsTableBody = document.querySelector('#studentsTable tbody');
  const searchBox = document.getElementById('searchBox');

  const paymentForm = document.getElementById('paymentForm');
  const paymentStudentSelect = document.getElementById('paymentStudent');
  const paymentAmountInput = document.getElementById('paymentAmount');
  const paymentDateInput = document.getElementById('paymentDate');
  const paymentNoteInput = document.getElementById('paymentNote');

  const paymentsSection = document.getElementById('paymentsSection');
  const paymentsTitle = document.getElementById('paymentsTitle');
  const paymentsTableBody = document.querySelector('#paymentsTable tbody');

  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');

  // Utilities
  function sumPayments(student) {
    return (student.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }

  function formatMoney(n) {
    const val = Number(n || 0);
    return new Intl.NumberFormat('so-SO', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(val);
  }

  function renderStudentOptions() {
    const selected = paymentStudentSelect.value;
    paymentStudentSelect.innerHTML = '<option value="" disabled selected>-- dooro arday --</option>' +
      state.students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.className)})</option>`).join('');
    if (state.students.some(s => s.id === selected)) {
      paymentStudentSelect.value = selected;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]+/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function filteredStudents() {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) return state.students;
    return state.students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q)
    );
  }

  let editId = null; // track which student is being edited via the top form

  function renderStudentsTable() {
    const rows = filteredStudents().map(s => {
      const paid = sumPayments(s);
      const remaining = s.free ? 0 : (Number(s.totalFee) || 0) - paid;
      const badge = s.free
        ? `<span class="badge ok">Bilaash</span>`
        : (remaining <= 0 ? `<span class="badge ok">Dhameystiran</span>` : `<span class="badge warn">Harsan</span>`);
      return `<tr data-id="${s.id}">
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.className)}</td>
        <td>${formatMoney(s.totalFee)}</td>
        <td>${formatMoney(paid)}</td>
        <td>${formatMoney(remaining)}</td>
        <td>
          <button class="ghost" data-action="edit">Beddel</button>
          <button class="ghost" data-action="view">Muuji Bixinnada</button>
          <button class="danger" data-action="delete">Tirtir</button>
          ${badge}
        </td>
      </tr>`;
    }).join('');
    studentsTableBody.innerHTML = rows || '<tr><td colspan="6">Ma jiro arday wali.</td></tr>';
  }

  function renderPaymentsTable(studentId) {
    const s = state.students.find(x => x.id === studentId);
    if (!s) {
      paymentsSection.classList.add('hidden');
      return;
    }
    paymentsTitle.textContent = `${s.name} — ${s.className}`;
    const rows = (s.payments || []).map(p => {
      return `<tr data-student-id="${s.id}" data-payment-id="${p.id}">
        <td>${escapeHtml(p.date || '')}</td>
        <td>${formatMoney(p.amount)}</td>
        <td>${escapeHtml(p.note || '')}</td>
        <td><button class="danger" data-action="delete-payment">Tirtir</button></td>
      </tr>`;
    }).join('');
    paymentsTableBody.innerHTML = rows || '<tr><td colspan="4">Ma jiro bixin wali.</td></tr>';
    paymentsSection.classList.remove('hidden');
  }

  // Event handlers
  function updateFreeUI() {
    if (!freeFlagInput) return;
    const isFree = !!freeFlagInput.checked;
    if (isFree) {
      if (totalFeeRow) totalFeeRow.style.display = 'none';
      totalFeeInput.value = 0;
      totalFeeInput.required = false;
    } else {
      if (totalFeeRow) totalFeeRow.style.display = '';
      totalFeeInput.required = true;
    }
  }

  if (freeFlagInput) {
    freeFlagInput.addEventListener('change', updateFreeUI);
  }
  studentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const className = classInput.value.trim();
    const free = !!freeFlagInput?.checked;
    const totalFee = free ? 0 : Number(totalFeeInput.value);
    if (!name || !className || isNaN(totalFee)) return;

    if (editId) {
      const s = state.students.find(x => x.id === editId);
      if (s) {
        s.name = name;
        s.className = className;
        s.totalFee = totalFee;
        s.free = free;
        saveState();
      }
      editId = null;
      const submitBtn = studentForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Ku dar Arday';
      toast('Kayd waa la cusbooneysiiyay');
    } else {
      state.students.push({ id: uid(), name, className, totalFee, free, payments: [] });
      saveState();
      toast(t.addedStudent);
    }
    studentForm.reset();
    if (freeFlagInput) freeFlagInput.checked = false;
    updateFreeUI();
    renderStudentsTable();
    renderStudentOptions();
  });

  searchBox.addEventListener('input', () => {
    renderStudentsTable();
  });

  studentsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    const action = btn.getAttribute('data-action');
    if (action === 'delete') {
      if (!confirm(t.confirmDeleteStudent)) return;
      state.students = state.students.filter(s => s.id !== id);
      saveState();
      renderStudentsTable();
      renderStudentOptions();
      const shown = paymentsTitle.textContent.includes(id); // not reliable; re-hide
      paymentsSection.classList.add('hidden');
      toast(t.deleted);
    } else if (action === 'view') {
      renderPaymentsTable(id);
      // also select in dropdown
      paymentStudentSelect.value = id;
    } else if (action === 'edit') {
      const s = state.students.find(x => x.id === id);
      if (!s) return;
      nameInput.value = s.name;
      classInput.value = s.className;
      totalFeeInput.value = s.totalFee;
      if (freeFlagInput) freeFlagInput.checked = !!s.free;
      updateFreeUI();
      editId = id;
      const submitBtn = studentForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Cusbooneysii';
    }
  });

  paymentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = paymentStudentSelect.value;
    if (!studentId) return;
    const amount = Number(paymentAmountInput.value);
    const date = paymentDateInput.value || new Date().toISOString().slice(0, 10);
    const note = paymentNoteInput.value.trim();
    if (isNaN(amount) || amount <= 0) return;

    const s = state.students.find(x => x.id === studentId);
    if (!s) return;
    s.payments.push({ id: uid(), amount, date, note });
    saveState();
    paymentForm.reset();
    paymentStudentSelect.value = studentId; // keep selection
    renderStudentsTable();
    renderPaymentsTable(studentId);
    toast(t.addedPayment);
  });

  paymentsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const studentId = tr?.getAttribute('data-student-id');
    const paymentId = tr?.getAttribute('data-payment-id');
    const action = btn.getAttribute('data-action');

    if (action === 'delete-payment') {
      if (!confirm(t.confirmDeletePayment)) return;
      const s = state.students.find(x => x.id === studentId);
      if (!s) return;
      s.payments = s.payments.filter(p => p.id !== paymentId);
      saveState();
      renderStudentsTable();
      renderPaymentsTable(studentId);
      toast(t.deleted);
    }
  });

  // Export/Import
  exportBtn.addEventListener('click', () => {
    const data = loadState();
    if (!data.students.length) {
      alert(t.nothingToExport);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-fees.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.students)) throw new Error('bad');
      // Basic shape check
      data.students.forEach(s => {
        s.id = s.id || uid();
        s.name = s.name || '';
        s.className = s.className || '';
        s.totalFee = Number(s.totalFee || 0);
        s.payments = Array.isArray(s.payments) ? s.payments : [];
        s.payments.forEach(p => { p.id = p.id || uid(); p.amount = Number(p.amount || 0); });
      });
      state = data;
      saveState();
      renderStudentsTable();
      renderStudentOptions();
      paymentsSection.classList.add('hidden');
      toast(t.importSuccess);
    } catch (err) {
      console.error(err);
      alert(t.importError);
    } finally {
      importInput.value = '';
    }
  });

  // Simple toast
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position = 'fixed';
      el.style.bottom = '20px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.background = 'rgba(17, 24, 39, 0.95)';
      el.style.border = '1px solid #1f2937';
      el.style.color = '#e5e7eb';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '8px';
      el.style.zIndex = '1000';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  // Initial render
  renderStudentsTable();
  renderStudentOptions();
  updateFreeUI();
})();
