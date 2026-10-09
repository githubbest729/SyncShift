// SyncShift API: bound to the SyncShift_Backend sheet
const TOKEN = 'PUT-YOUR-OWN-LONG-RANDOM-PASSWORD-HERE'; // shared secret; set '' to disable
const SHEETS = { tasks: 'Tasks', nudges: 'Nudges', content: 'Content_Calendar' };

function doGet(e) { return handle_(e.parameter || {}); }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return out_({ error: 'Invalid JSON body' }); }
  return handle_(Object.assign({}, e.parameter, body));
}

function handle_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (TOKEN && p.token !== TOKEN) return out_({ error: 'Unauthorized' });
    const name = SHEETS[String(p.route || '').toLowerCase()];
    if (!name) return out_({ error: 'Unknown route. Use tasks, nudges or content.' });
    const sh = SpreadsheetApp.getActive().getSheetByName(name);
    if (!sh) return out_({ error: 'Missing tab: ' + name });

    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const col = {}; headers.forEach((h, i) => { if (h !== '') col[norm(h)] = i + 1; });
    const idCol = /id$/.test(norm(headers[0])) ? 1 : null; // column A, e.g. "Task ID"
    const keyCol = idCol || 1;

    // last row that actually has a value in the key column (ignores formula spill)
    const keys = sh.getRange(1, keyCol, sh.getMaxRows(), 1).getValues();
    let last = 1; keys.forEach((r, i) => { if (r[0] !== '') last = i + 1; });

    const action = String(p.action || (p.data ? 'add' : 'list')).toLowerCase();

    if (action === 'meta') { // dropdown options per column, so the app never sends invalid values
      const m = {};
      headers.forEach((h, i) => {
        if (h === '') return;
        const dv = sh.getRange(2, i + 1).getDataValidation();
        if (!dv) return;
        const t = dv.getCriteriaType(), v = dv.getCriteriaValues();
        if (t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) m[h] = v[0];
        else if (t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE)
          m[h] = v[0].getValues().reduce((a, r) => a.concat(r), []).filter(String);
      });
      return out_(m);
    }

    if (action === 'list') {
      if (last < 2) return out_([]);
      const vals = sh.getRange(2, 1, last - 1, headers.length).getDisplayValues();
      const raw = sh.getRange(2, 1, last - 1, headers.length).getValues();
      const rows = vals.map((r, ri) => {
        const o = {};
        headers.forEach((h, ci) => {
          if (h === '') return;
          const v = raw[ri][ci];
          o[h] = v instanceof Date ? v.toISOString() : (typeof v === 'number' ? v : r[ci]);
        });
        return o;
      }).filter(o => Object.values(o).some(v => v !== ''));
      return out_(rows);
    }

    const data = p.data || {};
    const setCells = (row) => {
      Object.keys(data).forEach(k => {
        const c = col[norm(k)];
        if (!c || c === idCol) return;
        let v = data[k];
        if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) v = new Date(v); // ISO text -> real date
        sh.getRange(row, c).setValue(v);
      });
    };

    if (action === 'add') {
      const row = last + 1;
      if (idCol) sh.getRange(row, idCol).setValue(data.id || Utilities.getUuid().slice(0, 8));
      const tsCol = col.timestamp || col.created;
      if (tsCol) sh.getRange(row, tsCol).setValue(new Date());
      setCells(row);
      // copy per-row formulas (e.g. "Hours Elapsed") from the row above
      if (row > 2) headers.forEach((h, i) => {
        const c = i + 1;
        if (h !== '' && !sh.getRange(row, c).getFormula() && sh.getRange(row - 1, c).getFormula() &&
            !sh.getRange(row - 1, c).getFormula().toUpperCase().startsWith('=ARRAYFORMULA'))
          sh.getRange(row - 1, c).copyTo(sh.getRange(row, c));
      });
      return out_({ ok: true, id: idCol ? sh.getRange(row, idCol).getValue() : row });
    }

    if (action === 'update' || action === 'delete') {
      if (!idCol) return out_({ error: 'Add an ID column to the "' + name + '" tab first.' });
      const idx = keys.findIndex((r, i) => i > 0 && String(r[0]) === String(p.id));
      if (idx < 0) return out_({ error: 'ID not found: ' + p.id });
      if (action === 'delete') sh.deleteRow(idx + 1); else setCells(idx + 1);
      return out_({ ok: true });
    }

    return out_({ error: 'Unknown action: ' + action });
  } catch (err) {
    return out_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
