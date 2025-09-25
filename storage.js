(function(){
  'use strict';
  const STORAGE_KEY = 'fees_app_v1';

  function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { students: [] };
      const data = JSON.parse(raw);
      if(!Array.isArray(data.students)) return { students: [] };
      data.students.forEach(s => { s.payments = Array.isArray(s.payments) ? s.payments : []; });
      return data;
    }catch{ return { students: [] }; }
  }
  function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function getStudents(){ return loadState().students; }

  function addStudent({name, className, totalFee, free}){
    const state = loadState();
    const student = { id: uid(), name, className, totalFee: Number(totalFee)||0, free: Boolean(free)||false, payments: [] };
    state.students.push(student);
    saveState(state);
    return student;
  }

  function removeStudent(studentId){
    const state = loadState();
    state.students = state.students.filter(s => s.id !== studentId);
    saveState(state);
  }

  function updateStudent(studentId, { name, className, totalFee, free }){
    const state = loadState();
    const s = state.students.find(x => x.id === studentId);
    if(!s) return null;
    if(typeof name === 'string') s.name = name;
    if(typeof className === 'string') s.className = className;
    if(typeof totalFee !== 'undefined') s.totalFee = Number(totalFee)||0;
    if(typeof free !== 'undefined') s.free = Boolean(free);
    saveState(state);
    return s;
  }

  function getStudentById(studentId){
    return loadState().students.find(s => s.id === studentId) || null;
  }

  function recordPayment(studentId, {amount, date, note}){
    const state = loadState();
    const s = state.students.find(x => x.id === studentId);
    if(!s) return null;
    const p = { id: uid(), amount: Number(amount)||0, date: date || new Date().toISOString().slice(0,10), note: note||'' };
    s.payments.push(p);
    saveState(state);
    return p;
  }

  function deletePayment(studentId, paymentId){
    const state = loadState();
    const s = state.students.find(x => x.id === studentId);
    if(!s) return;
    s.payments = s.payments.filter(p => p.id !== paymentId);
    saveState(state);
  }

  function sumPaid(student){ return (student.payments||[]).reduce((a,p)=>a+(Number(p.amount)||0),0); }
  function remaining(student){
    if (student.free) return 0;
    return (Number(student.totalFee)||0) - sumPaid(student);
  }
  function status(student){
    if (student.free) return 'free';
    const r = remaining(student);
    if(r <= 0) return 'paid';
    if(r >= (Number(student.totalFee)||0)) return 'unpaid';
    return 'partial';
  }

  function replaceState(newState){
    const data = { students: [] };
    if(newState && Array.isArray(newState.students)){
      data.students = newState.students.map(s => ({
        id: s.id || uid(),
        name: s.name||'',
        className: s.className||'',
        totalFee: Number(s.totalFee)||0,
        free: Boolean(s.free)||false,
        payments: Array.isArray(s.payments) ? s.payments.map(p=>({ id: p.id||uid(), amount: Number(p.amount)||0, date: p.date||'', note: p.note||'' })) : []
      }));
    }
    saveState(data);
  }

  window.StorageAPI = {
    loadState, saveState,
    getStudents, addStudent, removeStudent, updateStudent, getStudentById,
    recordPayment, deletePayment,
    sumPaid, remaining, status,
    replaceState
  };
})();
